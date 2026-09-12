import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Round, RoundScore, RoundResult, ScoreEvent, Team } from "@/types";

const roundsCol = collection(db, "rounds");
const roundScoresCol = collection(db, "roundScores");
const roundResultsCol = collection(db, "roundResults");

// ---------- ROUNDS ----------

export function subscribeToRounds(callback: (rounds: Round[]) => void) {
  const q = query(roundsCol, orderBy("roundNumber", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Round, "id">) })));
  });
}

export async function getAllRounds(): Promise<Round[]> {
  const snap = await getDocs(query(roundsCol, orderBy("roundNumber", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Round, "id">) }));
}

export async function getRound(id: string): Promise<Round | null> {
  const snap = await getDoc(doc(db, "rounds", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Round, "id">) };
}

const MAX_ADVANCING_BY_ROUND: Record<number, number> = {
  1: 8,
  2: 4,
  3: 2,
  4: 0, // final, no further advancement
};

export async function createRound(roundNumber: number, teamIds: string[]) {
  const round: Omit<Round, "id"> = {
    roundNumber,
    name: roundNumber === 4 ? "Final Round" : `Round ${roundNumber}`,
    status: "setup",
    teamIds,
    maxAdvancing: MAX_ADVANCING_BY_ROUND[roundNumber] ?? 0,
    createdAt: Date.now(),
  };
  const docRef = await addDoc(roundsCol, round);

  // initialize scores at 0 for every team in this round
  await Promise.all(
    teamIds.map((teamId) =>
      setDoc(doc(db, "roundScores", `${docRef.id}_${teamId}`), {
        roundId: docRef.id,
        teamId,
        score: 0,
        history: [],
      } as RoundScore)
    )
  );

  return docRef.id;
}

export async function updateRoundStatus(roundId: string, status: Round["status"]) {
  const data: Partial<Round> = { status };
  if (status === "ended") data.endedAt = Date.now();
  await updateDoc(doc(db, "rounds", roundId), data);
}

export async function updateRoundTeams(roundId: string, teamIds: string[]) {
  // Only safe to call in 'setup' status, before scoring starts
  await updateDoc(doc(db, "rounds", roundId), { teamIds });
  // ensure score docs exist for all
  await Promise.all(
    teamIds.map((teamId) =>
      setDoc(
        doc(db, "roundScores", `${roundId}_${teamId}`),
        { roundId, teamId, score: 0, history: [] } as RoundScore,
        { merge: true }
      )
    )
  );
}

export async function deleteRound(roundId: string) {
  await deleteDoc(doc(db, "rounds", roundId));
  const scoresSnap = await getDocs(query(roundScoresCol, where("roundId", "==", roundId)));
  await Promise.all(scoresSnap.docs.map((d) => deleteDoc(d.ref)));
  const resultsSnap = await getDocs(query(roundResultsCol, where("roundId", "==", roundId)));
  await Promise.all(resultsSnap.docs.map((d) => deleteDoc(d.ref)));
}

// ---------- SCORES ----------

export function subscribeToRoundScores(roundId: string, callback: (scores: RoundScore[]) => void) {
  const q = query(roundScoresCol, where("roundId", "==", roundId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoundScore, "id">) })));
  });
}

export async function getRoundScores(roundId: string): Promise<RoundScore[]> {
  const snap = await getDocs(query(roundScoresCol, where("roundId", "==", roundId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoundScore, "id">) }));
}

export async function applyScoreEvent(
  roundId: string,
  teamId: string,
  action: ScoreEvent["action"]
) {
  const delta = action === "correct" ? 1 : action === "wrong" ? -1 : 0;
  const scoreId = `${roundId}_${teamId}`;
  const scoreRef = doc(db, "roundScores", scoreId);
  const snap = await getDoc(scoreRef);

  const event: ScoreEvent = { action, delta, timestamp: Date.now() };

  if (!snap.exists()) {
    await setDoc(scoreRef, {
      roundId,
      teamId,
      score: delta,
      history: [event],
    } as RoundScore);
  } else {
    const existing = snap.data() as RoundScore;
    await updateDoc(scoreRef, {
      score: existing.score + delta,
      history: [...existing.history, event],
    });
  }
}

// directly set a score (manual correction / tiebreak adjustment)
export async function setScoreDirectly(roundId: string, teamId: string, newScore: number, note?: string) {
  const scoreId = `${roundId}_${teamId}`;
  const scoreRef = doc(db, "roundScores", scoreId);
  const snap = await getDoc(scoreRef);
  const event: ScoreEvent = { action: "correct", delta: 0, timestamp: Date.now() };
  const historyNote = note ? [{ ...event, action: "correct" as const }] : [];

  if (!snap.exists()) {
    await setDoc(scoreRef, { roundId, teamId, score: newScore, history: historyNote } as RoundScore);
  } else {
    const existing = snap.data() as RoundScore;
    await updateDoc(scoreRef, {
      score: newScore,
      history: [...existing.history, ...historyNote],
    });
  }
}

// ---------- RESULTS / ADVANCEMENT LOGIC ----------

export interface RankedTeam {
  teamId: string;
  score: number;
  tieBreakScore?: number; // previous round score, used only when tied
  rank: number;
  isTied: boolean;
}

/**
 * Ranks teams in a round. If tied, breaks tie using previous round's score (if available).
 * Returns ranked list; flags any UNRESOLVED ties (still tied after tiebreak, or no previous round).
 */
export async function computeRankedTeams(
  roundId: string,
  roundNumber: number
): Promise<{ ranked: RankedTeam[]; unresolvedTies: string[][] }> {
  const scores = await getRoundScores(roundId);

  let previousScores: Record<string, number> = {};
  if (roundNumber > 1) {
    const rounds = await getAllRounds();
    const prevRound = rounds.find((r) => r.roundNumber === roundNumber - 1);
    if (prevRound) {
      const prevScores = await getRoundScores(prevRound.id);
      previousScores = Object.fromEntries(prevScores.map((s) => [s.teamId, s.score]));
    }
  }

  // sort by score desc, then by previous round score desc as tiebreak
  const sorted = [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aPrev = previousScores[a.teamId] ?? 0;
    const bPrev = previousScores[b.teamId] ?? 0;
    return bPrev - aPrev;
  });

  const ranked: RankedTeam[] = [];
  const unresolvedTies: string[][] = [];

  let i = 0;
  let rank = 1;
  while (i < sorted.length) {
    // find group with same score
    let j = i;
    while (j < sorted.length && sorted[j].score === sorted[i].score) j++;
    const group = sorted.slice(i, j);

    if (group.length > 1) {
      // check if tiebreak (previous score) actually resolved it
      const stillTied = group.every(
        (t) => (previousScores[t.teamId] ?? 0) === (previousScores[group[0].teamId] ?? 0)
      );
      if (stillTied) {
        unresolvedTies.push(group.map((t) => t.teamId));
      }
    }

    group.forEach((t) => {
      ranked.push({
        teamId: t.teamId,
        score: t.score,
        tieBreakScore: previousScores[t.teamId],
        rank,
        isTied: group.length > 1,
      });
      rank++;
    });

    i = j;
  }

  return { ranked, unresolvedTies };
}

/**
 * Checks specifically whether there's a tie AT the cutoff boundary
 * (e.g. rank 8 vs rank 9 both qualify-worthy but only 8 can advance).
 */
export function findCutoffTie(ranked: RankedTeam[], maxAdvancing: number): string[] | null {
  if (maxAdvancing <= 0 || ranked.length <= maxAdvancing) return null;
  const cutoffScore = ranked[maxAdvancing - 1].score;
  const tiedAtCutoff = ranked.filter((t) => t.score === cutoffScore);
  if (tiedAtCutoff.length > 1) {
    // check how many of these are needed vs how many slots remain
    const aboveCutoff = ranked.filter((t) => t.score > cutoffScore).length;
    const slotsRemaining = maxAdvancing - aboveCutoff;
    if (tiedAtCutoff.length > slotsRemaining) {
      return tiedAtCutoff.map((t) => t.teamId);
    }
  }
  return null;
}

export async function finalizeRoundResult(
  roundId: string,
  rankedTeamIds: string[],
  advancingTeamIds: string[]
) {
  await setDoc(doc(db, "roundResults", roundId), {
    roundId,
    rankedTeamIds,
    advancingTeamIds,
  } as RoundResult);
}

export async function getRoundResult(roundId: string): Promise<RoundResult | null> {
  const snap = await getDoc(doc(db, "roundResults", roundId));
  if (!snap.exists()) return null;
  return snap.data() as RoundResult;
}