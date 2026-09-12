import { getAllRounds, getRoundScores } from "@/lib/rounds";
import { getAllTeams } from "@/lib/teams";
import { Team } from "@/types";

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  totalScore: number;
  roundsPlayed: number;
}

export interface RoundLeaderboardEntry {
  teamId: string;
  teamName: string;
  score: number;
}

/**
 * Overall leaderboard: sum of scores from all rounds a team actually played in.
 */
export async function getOverallLeaderboard(): Promise<LeaderboardEntry[]> {
  const [teams, rounds] = await Promise.all([getAllTeams(), getAllRounds()]);
  const teamsMap: Record<string, Team> = {};
  teams.forEach((t) => (teamsMap[t.id] = t));

  const totals: Record<string, { total: number; roundsPlayed: number }> = {};

  for (const round of rounds) {
    const scores = await getRoundScores(round.id);
    for (const s of scores) {
      if (!totals[s.teamId]) totals[s.teamId] = { total: 0, roundsPlayed: 0 };
      totals[s.teamId].total += s.score;
      totals[s.teamId].roundsPlayed += 1;
    }
  }

  const entries: LeaderboardEntry[] = Object.entries(totals).map(([teamId, data]) => ({
    teamId,
    teamName: teamsMap[teamId]?.name ?? "Unknown Team",
    totalScore: data.total,
    roundsPlayed: data.roundsPlayed,
  }));

  entries.sort((a, b) => b.totalScore - a.totalScore);
  return entries;
}

/**
 * Leaderboard for a single round.
 */
export async function getRoundLeaderboard(roundId: string): Promise<RoundLeaderboardEntry[]> {
  const [teams, scores] = await Promise.all([getAllTeams(), getRoundScores(roundId)]);
  const teamsMap: Record<string, Team> = {};
  teams.forEach((t) => (teamsMap[t.id] = t));

  const entries: RoundLeaderboardEntry[] = scores.map((s) => ({
    teamId: s.teamId,
    teamName: teamsMap[s.teamId]?.name ?? "Unknown Team",
    score: s.score,
  }));

  entries.sort((a, b) => b.score - a.score);
  return entries;
}