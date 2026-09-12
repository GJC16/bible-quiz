"use client";

import { useEffect, useState } from "react";
import { subscribeToTeams } from "@/lib/teams";
import { Team } from "@/types";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTeams((data) => {
      setTeams(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { teams, loading };
}