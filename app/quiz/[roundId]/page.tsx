"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useTeams } from "@/lib/useTeams";
import {
  subscribeToRounds,
  updateRoundStatus,
  deleteRound,
  subscribeToRoundScores,
  applyScoreEvent,
  setScoreDirectly,
  computeRankedTeams,
  findCutoffTie,
  finalizeRoundResult,
  RankedTeam,
} from "@/lib/rounds";
import { Round, RoundScore } from "@/types";

export default function RoundPage() {
  const authChecked = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const roundId = params.roundId as string;
  const { teams: allTeams } = useTeams();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [ranked, setRanked] = useState<RankedTeam[]>([]);
  const [cutoffTie, setCutoffTie] = useState<string[] | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // track in-flight actions so buttons can show a spinner / disabled state
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [startingRound, setStartingRound] = useState(false);
  const [endingRound, setEndingRound] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [checkingEnd, setCheckingEnd] = useState(false);
  const [adjustingTie, setAdjustingTie] = useState<string | null>(null);

  function markPending(key: string, on: boolean) {
    setPendingActions((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  useEffect(() => {
    if (!authChecked) return;
    const unsub = subscribeToRounds(setRounds);
    return () => unsub();
  }, [authChecked]);

  const round = rounds.find((r) => r.id === roundId) || null;

  const teamsMap = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    allTeams.forEach((t) => (m[t.id] = t));
    return m;
  }, [allTeams]);

  useEffect(() => {
    if (!roundId) return;
    const unsub = subscribeToRoundScores(roundId, setScores);
    return () => unsub();
  }, [roundId]);

  useEffect(() => {
    if (!round) return;
    async function refreshRanking() {
      const { ranked } = await computeRankedTeams(round!.id, round!.roundNumber);
      setRanked(ranked);
      setCutoffTie(round!.maxAdvancing > 0 ? findCutoffTie(ranked, round!.maxAdvancing) : null);
    }
    refreshRanking();
  }, [scores, round]);

  // Build a lookup from ranked data (rank, score, tie status) but never use
  // this array's ORDER for display — display order is fixed to round.teamIds.
  const rankedById = useMemo(() => {
    const m: Record<string, RankedTeam> = {};
    ranked.forEach((r) => (m[r.teamId] = r));
    return m;
  }, [ranked]);

  // Fixed display order: the order teams were added to the round, set once
  // at round creation and never re-sorted by score during the round.
  const orderedTeamIds = round?.teamIds ?? [];

  if (!authChecked) return null;

  if (rounds.length > 0 && !round) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-900 font-medium">Round not found</p>
          <button
            onClick={() => router.push("/quiz")}
            className="mt-3 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            ← Back to rounds
          </button>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading round...</p>
      </div>
    );
  }

  function scoreFor(teamId: string): number {
    return scores.find((s) => s.teamId === teamId)?.score ?? 0;
  }

  async function handleStart() {
    setStartingRound(true);
    try {
      await updateRoundStatus(round!.id, "active");
    } finally {
      setStartingRound(false);
    }
  }

  async function handleScoreAction(teamId: string, action: "correct" | "skip" | "wrong") {
    const key = `${teamId}:${action}`;
    markPending(key, true);
    try {
      await applyScoreEvent(round!.id, teamId, action);
    } finally {
      markPending(key, false);
    }
  }

  async function handleTieBreakAdjust(teamId: string, extraPoints: number) {
    const key = `${teamId}:${extraPoints}`;
    setAdjustingTie(key);
    try {
      const current = scoreFor(teamId);
      await setScoreDirectly(round!.id, teamId, current + extraPoints, "Tiebreak adjustment");
    } finally {
      setAdjustingTie(null);
    }
  }

  async function attemptEndRound() {
    setCheckingEnd(true);
    try {
      const { ranked: freshRanked } = await computeRankedTeams(round!.id, round!.roundNumber);
      const freshCutoffTie =
        round!.maxAdvancing > 0 ? findCutoffTie(freshRanked, round!.maxAdvancing) : null;

      setRanked(freshRanked);
      setCutoffTie(freshCutoffTie);
      setShowEndModal(true);
    } finally {
      setCheckingEnd(false);
    }
  }

  async function confirmEndRound() {
    setEndingRound(true);
    try {
      const rankedTeamIds = ranked.map((r) => r.teamId);
      const advancingTeamIds =
        round!.maxAdvancing > 0 ? rankedTeamIds.slice(0, round!.maxAdvancing) : rankedTeamIds;

      await finalizeRoundResult(round!.id, rankedTeamIds, advancingTeamIds);
      await updateRoundStatus(round!.id, "ended");
      setShowEndModal(false);
    } finally {
      setEndingRound(false);
    }
  }

  async function handleReopen() {
    setReopening(true);
    try {
      await updateRoundStatus(round!.id, "active");
    } finally {
      setReopening(false);
    }
  }

  async function handleDeleteRound() {
    if (!confirm(`Delete ${round!.name}? This removes all its scores and results.`)) return;
    setDeleting(true);
    try {
      await deleteRound(round!.id);
      router.push("/quiz");
    } finally {
      setDeleting(false);
    }
  }

  const statusStyles: Record<string, string> = {
    setup: "bg-slate-100 text-slate-600",
    active: "bg-emerald-100 text-emerald-700",
    ended: "bg-slate-800 text-white",
  };

  const roundTeams = round.teamIds.map((id) => teamsMap[id]).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <button
          onClick={() => router.push("/quiz")}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition mb-4 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All rounds
        </button>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">{round.name}</h1>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  statusStyles[round.status] || "bg-slate-100 text-slate-600"
                }`}
              >
                {round.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {round.teamIds.length} team{round.teamIds.length !== 1 ? "s" : ""} ·{" "}
              {round.maxAdvancing > 0 ? `${round.maxAdvancing} advance to next round` : "Final round"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            {round.status === "setup" && (
              <button
                onClick={handleStart}
                disabled={startingRound}
                className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
              >
                {startingRound && <Spinner />}
                {startingRound ? "Starting..." : "Start Round"}
              </button>
            )}
            {round.status === "active" && (
              <button
                onClick={attemptEndRound}
                disabled={checkingEnd}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:bg-red-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
              >
                {checkingEnd && <Spinner />}
                {checkingEnd ? "Checking..." : "End Round"}
              </button>
            )}
            {round.status === "ended" && (
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:bg-amber-600 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
              >
                {reopening && <Spinner />}
                {reopening ? "Reopening..." : "Reopen"}
              </button>
            )}
            <button
              onClick={handleDeleteRound}
              disabled={deleting}
              className="text-red-600 text-sm font-medium px-3 py-2 rounded-lg transition hover:bg-red-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting && <Spinner className="text-red-600" />}
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        {round.status === "setup" ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-slate-900 font-medium">Round hasn&apos;t started</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              Teams: {roundTeams.map((t) => t.name).join(", ")}
            </p>
            <button
              onClick={handleStart}
              disabled={startingRound}
              className="bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {startingRound && <Spinner />}
              {startingRound ? "Starting..." : "Start Round"}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 sm:p-5">
            <div className="space-y-2">
              {orderedTeamIds.map((teamId) => {
                const team = teamsMap[teamId];
                if (!team) return null;
                const r = rankedById[teamId];
                const score = r?.score ?? scoreFor(teamId);
                const rank = r?.rank ?? 0;
                const isTied = r?.isTied ?? false;

                return (
                  <div
                    key={teamId}
                    className={`border rounded-xl p-3 sm:p-4 ${
                      isTied ? "border-slate-300 bg-slate-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold bg-slate-100 text-slate-500">
                          {rank || "–"}
                        </span>
                        <span className="font-medium text-slate-900 truncate">{team.name}</span>
                        {isTied && (
                          <span className="text-slate-500 text-xs shrink-0 bg-slate-200 px-1.5 py-0.5 rounded">
                            tied
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-semibold text-slate-900 shrink-0">
                        {score}
                      </span>
                    </div>
                    <ScoreButtons
                      pendingCorrect={pendingActions.has(`${teamId}:correct`)}
                      pendingSkip={pendingActions.has(`${teamId}:skip`)}
                      pendingWrong={pendingActions.has(`${teamId}:wrong`)}
                      onCorrect={() => handleScoreAction(teamId, "correct")}
                      onSkip={() => handleScoreAction(teamId, "skip")}
                      onWrong={() => handleScoreAction(teamId, "wrong")}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showEndModal && (
        <EndRoundModal
          roundName={round.name}
          cutoffTie={cutoffTie}
          teamsMap={teamsMap}
          adjustingTie={adjustingTie}
          ending={endingRound}
          onAdjust={handleTieBreakAdjust}
          onCancel={() => setShowEndModal(false)}
          onConfirm={confirmEndRound}
        />
      )}
    </div>
  );
}

function Spinner({ className = "text-white" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-3.5 w-3.5 shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function ScoreButtons({
  onCorrect,
  onSkip,
  onWrong,
  pendingCorrect,
  pendingSkip,
  pendingWrong,
}: {
  onCorrect: () => void;
  onSkip: () => void;
  onWrong: () => void;
  pendingCorrect: boolean;
  pendingSkip: boolean;
  pendingWrong: boolean;
}) {
  const anyPending = pendingCorrect || pendingSkip || pendingWrong;
  return (
    <div className="flex gap-1.5">
      <button
        onClick={onCorrect}
        disabled={anyPending}
        className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {pendingCorrect && <Spinner />}
        +1 Correct
      </button>
      <button
        onClick={onSkip}
        disabled={anyPending}
        className="flex-1 bg-slate-400 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-500 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {pendingSkip && <Spinner />}
        Skip
      </button>
      <button
        onClick={onWrong}
        disabled={anyPending}
        className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {pendingWrong && <Spinner />}
        −1 Wrong
      </button>
    </div>
  );
}

function EndRoundModal({
  roundName,
  cutoffTie,
  teamsMap,
  adjustingTie,
  ending,
  onAdjust,
  onCancel,
  onConfirm,
}: {
  roundName: string;
  cutoffTie: string[] | null;
  teamsMap: Record<string, { id: string; name: string }>;
  adjustingTie: string | null;
  ending: boolean;
  onAdjust: (teamId: string, extraPoints: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 z-50">
      <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-lg">
        {cutoffTie ? (
          <>
            <h3 className="font-semibold text-slate-900 mb-2">Tie at qualification cutoff</h3>
            <p className="text-sm text-slate-600 mb-4">
              {cutoffTie.map((id) => teamsMap[id]?.name).join(", ")} are tied for the last
              qualifying spot. Ask a tiebreaker question, adjust scores below, then continue
              the quiz — or end it now with the tie unresolved.
            </p>
            <div className="flex flex-col gap-2 mb-5">
              {cutoffTie.map((teamId) => {
                const minusKey = `${teamId}:-1`;
                const plusKey = `${teamId}:1`;
                return (
                  <div
                    key={teamId}
                    className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <span className="font-medium text-slate-800 text-sm truncate">
                      {teamsMap[teamId]?.name}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => onAdjust(teamId, -1)}
                        disabled={adjustingTie !== null}
                        className="text-red-700 hover:bg-red-50 rounded px-2 py-1 font-medium text-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {adjustingTie === minusKey && <Spinner className="text-red-700" />}
                        −1
                      </button>
                      <button
                        onClick={() => onAdjust(teamId, 1)}
                        disabled={adjustingTie !== null}
                        className="text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 font-medium text-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {adjustingTie === plusKey && <Spinner className="text-emerald-700" />}
                        +1
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Continue quiz
              </button>
              <button
                onClick={onConfirm}
                disabled={ending}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {ending && <Spinner />}
                {ending ? "Ending..." : "End anyway"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-slate-900 mb-2">End {roundName}?</h3>
            <p className="text-sm text-slate-600 mb-5">
              This locks in the ranking and determines advancing teams. You can still reopen
              and edit later if needed.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancel}
                disabled={ending}
                className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={ending}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {ending && <Spinner />}
                {ending ? "Ending..." : "Confirm End Round"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}