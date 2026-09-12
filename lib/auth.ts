"use client";

const SESSION_KEY = "quiz_admin_session";

interface AdminSession {
  username: string;
  loggedInAt: number;
}

export function setAdminSession(username: string): void {
  if (typeof window === "undefined") return;
  const session: AdminSession = { username, loggedInAt: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAdminSession();
}