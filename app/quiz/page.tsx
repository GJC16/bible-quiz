"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useTeams } from "@/lib/useTeams";
import { subscribeToRounds, createRound, getRoundResult } from "@/lib/rounds";
import { Round } from "@/types";

export default function QuizPage() {
  const authChecked = useRequireAuth();
  const { teams } = useTeams();
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked) return;
    const unsub = subscribeToRounds((data) => {
      setRounds(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authChecked]);

  if (!authChecked) return null;

  const nextRoundNumber =
    rounds.length > 0 ? Math.max(...rounds.map((r) => r.roundNumber)) + 1 : 1;

  const statusStyles: Record<string, string> = {
    setup: "bg-slate-100 text-slate-600",
    active: "bg-emerald-100 text-emerald-700",
    ended: "bg-slate-800 text-white",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Quiz Rounds</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create rounds and open one to run live scoring
          </p>
        </div>

        {nextRoundNumber <= 4 && (
          <CreateRoundPanel
            nextRoundNumber={nextRoundNumber}
            rounds={rounds}
            allTeams={teams}
            onCreated={(id) => router.push(`/quiz/${id}`)}
          />
        )}

        <div className="mt-8">
          <h2 className="text-sm font-medium text-slate-500 mb-3">All rounds</h2>
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
              Loading rounds...
            </div>
          ) : rounds.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-500">No rounds yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Create Round 1 above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...rounds]
                .sort((a, b) => b.roundNumber - a.roundNumber)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/quiz/${r.id}`)}
                    className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-left hover:border-slate-300 hover:shadow-sm transition cursor-pointer"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {r.teamIds.length} team{r.teamIds.length !== 1 ? "s" : ""}
                        {r.maxAdvancing > 0
                          ? ` · ${r.maxAdvancing} advance`
                          : " · Final round"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          statusStyles[r.status] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-slate-400"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- CREATE ROUND ----------------

function CreateRoundPanel({
  nextRoundNumber,
  rounds,
  allTeams,
  onCreated,
}: {
  nextRoundNumber: number;
  rounds: Round[];
  allTeams: { id: string; name: string }[];
  onCreated: (roundId: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [showAllTeams, setShowAllTeams] = useState(false);

  useEffect(() => {
    async function computeDefaults() {
      if (nextRoundNumber === 1) {
        setSuggested(allTeams.map((t) => t.id));
        setSelectedTeamIds(allTeams.map((t) => t.id));
        setShowAllTeams(true); // round 1 has no "qualified" subset — show everyone
        return;
      }
      const prevRound = rounds.find((r) => r.roundNumber === nextRoundNumber - 1);
      if (!prevRound) {
        setSuggested([]);
        setSelectedTeamIds([]);
        setShowAllTeams(false);
        return;
      }
      const result = await getRoundResult(prevRound.id);
      if (result) {
        setSuggested(result.advancingTeamIds);
        setSelectedTeamIds(result.advancingTeamIds);
      }
      setShowAllTeams(false);
    }
    computeDefaults();
  }, [nextRoundNumber, rounds, allTeams]);

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (selectedTeamIds.length === 0) {
      alert("Select at least one team.");
      return;
    }
    setCreating(true);
    try {
      const roundId = await createRound(nextRoundNumber, selectedTeamIds);
      onCreated(roundId);
    } finally {
      setCreating(false);
    }
  }

  const prevRoundExists = nextRoundNumber === 1 || suggested.length > 0;

  // teams shown in the picker: qualified-only by default (rounds 2+),
  // or every team when there's no prior result or the admin expands it
  const visibleTeams =
    nextRoundNumber === 1 || showAllTeams
      ? allTeams
      : allTeams.filter((t) => suggested.includes(t.id));

  const nonQualifiedCount = allTeams.length - suggested.length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-slate-900">Create Round {nextRoundNumber}</h2>
        {nextRoundNumber === 4 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
            Final
          </span>
        )}
      </div>

      {!prevRoundExists && nextRoundNumber > 1 && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Round {nextRoundNumber - 1} hasn&apos;t been ended yet. End it first to get qualified teams.
        </p>
      )}

      <div className="flex items-center justify-between mt-3 mb-3 gap-3">
        <p className="text-sm text-slate-500">
          {nextRoundNumber > 1
            ? showAllTeams
              ? "Showing all teams — deselect any that shouldn't play this round."
              : "Showing only teams that qualified from the previous round."
            : "All teams are selected by default."}
        </p>
        {nextRoundNumber > 1 && prevRoundExists && nonQualifiedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllTeams((v) => !v)}
            className="text-sm font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            {showAllTeams ? "Show qualified only" : "Show all teams"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {visibleTeams.map((team) => {
          const checked = selectedTeamIds.includes(team.id);
          const isQualified = suggested.includes(team.id);
          return (
            <label
              key={team.id}
              className={`flex items-center gap-2.5 text-sm rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                checked ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleTeam(team.id)}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
              />
              <span className="text-slate-800 truncate">{team.name}</span>
              {nextRoundNumber > 1 && !isQualified && (
                <span className="text-slate-400 text-xs ml-auto shrink-0">Not qualified</span>
              )}
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {selectedTeamIds.length} team{selectedTeamIds.length !== 1 ? "s" : ""} selected
        </p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
        >
          {creating ? (
            <>
              <Spinner />
              Creating...
            </>
          ) : (
            `Create Round ${nextRoundNumber}`
          )}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}