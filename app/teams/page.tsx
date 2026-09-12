"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { subscribeToTeams, addTeam, updateTeam, deleteTeam } from "@/lib/teams";
import { Team } from "@/types";

export default function TeamsPage() {
  const authChecked = useRequireAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // form state (add)
  const [name, setName] = useState("");
  const [memberCount, setMemberCount] = useState<number>(1);
  const [memberNames, setMemberNames] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMemberCount, setEditMemberCount] = useState<number>(1);
  const [editMemberNames, setEditMemberNames] = useState<string[]>([""]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authChecked) return;
    const unsub = subscribeToTeams((data) => {
      setTeams(data);
      setLoading(false);
    });
    return () => unsub();
  }, [authChecked]);

  if (!authChecked) return null;

  // resize a member-names array to match a new count, preserving existing entries
  function resizeNames(names: string[], count: number): string[] {
    const next = names.slice(0, count);
    while (next.length < count) next.push("");
    return next;
  }

  function handleMemberCountChange(count: number) {
    const safeCount = Math.max(1, count);
    setMemberCount(safeCount);
    setMemberNames((prev) => resizeNames(prev, safeCount));
  }

  function handleEditMemberCountChange(count: number) {
    const safeCount = Math.max(1, count);
    setEditMemberCount(safeCount);
    setEditMemberNames((prev) => resizeNames(prev, safeCount));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const members = memberNames.map((m) => m.trim()).filter((m) => m.length > 0);
      await addTeam(name.trim(), memberCount, members);
      setName("");
      setMemberCount(1);
      setMemberNames([""]);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setEditName(team.name);
    setEditMemberCount(team.memberCount);
    setEditMemberNames(resizeNames(team.members, team.memberCount));
  }

  async function saveEdit(id: string) {
    setSavingId(id);
    try {
      await updateTeam(id, {
        name: editName.trim(),
        memberCount: editMemberCount,
        members: editMemberNames.map((m) => m.trim()).filter((m) => m.length > 0),
      });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteTeam(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Teams</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage teams for your organization
          </p>
        </div>

        {/* Add team form */}
        <form
          onSubmit={handleAdd}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 mb-8"
        >
          <h2 className="font-medium text-slate-900 mb-4">Add New Team</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Team Name
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Member Count
              </label>
              <input
                type="number"
                min={1}
                className="w-full sm:w-40 border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                value={memberCount}
                onChange={(e) => handleMemberCountChange(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Member Names
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {memberNames.map((memberName, idx) => (
                  <input
                    key={idx}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                    value={memberName}
                    onChange={(e) => {
                      const next = [...memberNames];
                      next[idx] = e.target.value;
                      setMemberNames(next);
                    }}
                    placeholder={`Member ${idx + 1} name`}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto bg-slate-900 text-white font-medium px-5 py-2.5 rounded-lg transition hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Adding...
                </>
              ) : (
                "Add Team"
              )}
            </button>
          </div>
        </form>

        {/* Teams list */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            Loading teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">No teams yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Add your first team using the form above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5"
              >
                {editingId === team.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Team Name
                      </label>
                      <input
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Member Count
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="w-full sm:w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                        value={editMemberCount}
                        onChange={(e) => handleEditMemberCountChange(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Member Names
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {editMemberNames.map((memberName, idx) => (
                          <input
                            key={idx}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10"
                            value={memberName}
                            onChange={(e) => {
                              const next = [...editMemberNames];
                              next[idx] = e.target.value;
                              setEditMemberNames(next);
                            }}
                            placeholder={`Member ${idx + 1} name`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveEdit(team.id)}
                        disabled={savingId === team.id}
                        className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingId === team.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {team.name}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {team.memberCount} member
                        {team.memberCount !== 1 ? "s" : ""}
                        {team.members.length > 0 &&
                          `: ${team.members.join(", ")}`}
                      </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button
                        onClick={() => startEdit(team)}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        disabled={deletingId === team.id}
                        className="text-sm font-medium text-red-600 hover:text-red-700 transition disabled:opacity-50"
                      >
                        {deletingId === team.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}