"use client";

import { useEffect, useState, useCallback } from "react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { subscribeToRounds } from "@/lib/rounds";
import { subscribeToRoundScores } from "@/lib/rounds";
import { getOverallLeaderboard, getRoundLeaderboard, LeaderboardEntry, RoundLeaderboardEntry } from "@/lib/leaderboard";
import { Round } from "@/types";

type ViewMode = "overall" | "round" | "winner";

export default function DashboardPage() {
  const authChecked = useRequireAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("overall");
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");

  const [overallLeaderboard, setOverallLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [roundLeaderboard, setRoundLeaderboard] = useState<RoundLeaderboardEntry[]>([]);
  const [winnerLeaderboard, setWinnerLeaderboard] = useState<RoundLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked) return;
    const unsub = subscribeToRounds((data) => {
      setRounds(data);
      if (!selectedRoundId && data.length > 0) {
        const active = data.find((r) => r.status === "active");
        setSelectedRoundId(active ? active.id : data[data.length - 1].id);
      }
    });
    return () => unsub();
  }, [authChecked]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshOverall = useCallback(async () => {
    setLoading(true);
    const data = await getOverallLeaderboard();
    setOverallLeaderboard(data);
    setLoading(false);
  }, []);

  const refreshRound = useCallback(async (roundId: string) => {
    if (!roundId) return;
    setLoading(true);
    const data = await getRoundLeaderboard(roundId);
    setRoundLeaderboard(data);
    setLoading(false);
  }, []);

  const refreshWinner = useCallback(async (roundId: string) => {
    setLoading(true);
    const data = await getRoundLeaderboard(roundId);
    setWinnerLeaderboard(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authChecked || viewMode !== "overall") return;
    refreshOverall();
    const unsubs = rounds.map((r) =>
      subscribeToRoundScores(r.id, () => {
        refreshOverall();
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [authChecked, viewMode, rounds, refreshOverall]);

  useEffect(() => {
    if (!authChecked || viewMode !== "round" || !selectedRoundId) return;
    refreshRound(selectedRoundId);
    const unsub = subscribeToRoundScores(selectedRoundId, () => {
      refreshRound(selectedRoundId);
    });
    return () => unsub();
  }, [authChecked, viewMode, selectedRoundId, refreshRound]);

  // Final round = the last round in the list whose status is "ended".
  // Rounds are assumed to be in chronological order.
  const endedRounds = rounds.filter((r) => r.status === "ended");
  const finalRound = endedRounds.length > 0 ? endedRounds[endedRounds.length - 1] : null;

  useEffect(() => {
    if (!authChecked || viewMode !== "winner" || !finalRound) return;
    refreshWinner(finalRound.id);
    const unsub = subscribeToRoundScores(finalRound.id, () => {
      refreshWinner(finalRound.id);
    });
    return () => unsub();
  }, [authChecked, viewMode, finalRound, refreshWinner]);

  if (!authChecked) return null;

  const activeRound = rounds.find((r) => r.status === "active");
  const selectedRound = rounds.find((r) => r.id === selectedRoundId);

  const statusStyles: Record<string, string> = {
    setup: "bg-slate-100 text-slate-600",
    active: "bg-emerald-100 text-emerald-700",
    ended: "bg-slate-800 text-white",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track standings across the whole quiz or a single round
          </p>
        </div>

        {activeRound && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 mb-6">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <p className="text-sm">
              <span className="font-medium">{activeRound.name}</span> is live right now
            </p>
          </div>
        )}

        {/* View toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="inline-flex bg-slate-100 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setViewMode("overall")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === "overall"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setViewMode("round")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === "round"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              By round
            </button>
            <button
              onClick={() => setViewMode("winner")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === "winner"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Winner
            </button>
          </div>

          {viewMode === "round" && (
            <div className="relative w-full sm:w-64">
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="w-full appearance-none border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-sm text-slate-900 bg-white outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.status})
                  </option>
                ))}
              </select>
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
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
        </div>

        {viewMode === "round" && selectedRound && (
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                statusStyles[selectedRound.status] || "bg-slate-100 text-slate-600"
              }`}
            >
              {selectedRound.status}
            </span>
            <span className="text-sm text-slate-500">
              {selectedRound.teamIds.length} team{selectedRound.teamIds.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {viewMode === "winner" && finalRound && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-white">
              Final round: {finalRound.name}
            </span>
          </div>
        )}

        {viewMode === "winner" && !finalRound ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">The quiz hasn&apos;t ended yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              The winner will be shown here once the final round is marked as ended.
            </p>
          </div>
        ) : loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            Loading standings...
          </div>
        ) : viewMode === "overall" ? (
          <Leaderboard
            rows={overallLeaderboard.map((e, i) => ({
              rank: i + 1,
              name: e.teamName,
              score: e.totalScore,
              extra: `${e.roundsPlayed} round${e.roundsPlayed !== 1 ? "s" : ""} played`,
            }))}
          />
        ) : viewMode === "round" ? (
          <Leaderboard
            rows={roundLeaderboard.map((e, i) => ({
              rank: i + 1,
              name: e.teamName,
              score: e.score,
            }))}
          />
        ) : (
          <WinnerCard
            winner={winnerLeaderboard.length > 0 ? winnerLeaderboard[0] : null}
          />
        )}
      </div>
    </div>
  );
}

function WinnerCard({ winner }: { winner: RoundLeaderboardEntry | null }) {
  if (!winner) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-500">No scores recorded for the final round.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="text-4xl">🏆</span>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Winning team
        </p>
        <p className="text-2xl font-semibold text-slate-900">{winner.teamName}</p>
        {/* <p className="text-lg font-medium text-slate-500">{winner.score} points</p> */}
      </div>
    </div>
  );
}

function Leaderboard({
  rows,
}: {
  rows: { rank: number; name: string; score: number; extra?: string }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-500">No standings yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Scores will appear here once a round is underway.
        </p>
      </div>
    );
  }

  const rankBadge = (rank: number) => {
    const base = "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold";
    if (rank === 1) return `${base} bg-slate-900 text-white`;
    if (rank === 2) return `${base} bg-slate-400 text-white`;
    if (rank === 3) return `${base} bg-slate-300 text-slate-700`;
    return `${base} bg-slate-100 text-slate-500`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {rows.map((r, idx) => (
        <div
          key={r.rank}
          className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${
            idx !== rows.length - 1 ? "border-b border-slate-100" : ""
          }`}
        >
          <span className={rankBadge(r.rank)}>{r.rank}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{r.name}</p>
            {r.extra !== undefined && (
              <p className="text-xs text-slate-400 mt-0.5">{r.extra}</p>
            )}
          </div>
          <span className="text-lg font-semibold text-slate-900 shrink-0">{r.score}</span>
        </div>
      ))}
    </div>
  );
}