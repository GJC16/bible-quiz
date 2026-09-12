export interface Team {
  id: string;
  name: string;
  memberCount: number;
  members: string[];
  createdAt: number;
}

export interface Admin {
  username: string;
  password: string;
}

export type RoundStatus = "setup" | "active" | "ended";

export interface Round {
  id: string;
  roundNumber: number; // 1, 2, 3, 4
  name: string; // "Round 1", "Final", etc.
  status: RoundStatus;
  teamIds: string[];
  maxAdvancing: number; // 8, 4, 2 (null/0 for final)
  createdAt: number;
  endedAt?: number;
}

export interface ScoreEvent {
  action: "correct" | "skip" | "wrong";
  delta: number;
  timestamp: number;
}

export interface RoundScore {
  id: string; // `${roundId}_${teamId}`
  roundId: string;
  teamId: string;
  score: number;
  history: ScoreEvent[];
}

export interface RoundResult {
  roundId: string;
  rankedTeamIds: string[];
  advancingTeamIds: string[];
  tieBreaksApplied?: { teamId: string; note: string }[];
}