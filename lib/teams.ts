import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Team } from "@/types";

const teamsCol = collection(db, "teams");

export function subscribeToTeams(callback: (teams: Team[]) => void) {
  const q = query(teamsCol, orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const teams: Team[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Team, "id">),
    }));
    callback(teams);
  });
}

export async function getAllTeams(): Promise<Team[]> {
  const snap = await getDocs(teamsCol);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, "id">) }));
}

export async function addTeam(name: string, memberCount: number, members: string[]) {
  return addDoc(teamsCol, {
    name,
    memberCount,
    members,
    createdAt: Date.now(),
  });
}

export async function updateTeam(
  id: string,
  data: Partial<Pick<Team, "name" | "memberCount" | "members">>
) {
  return updateDoc(doc(db, "teams", id), data);
}

export async function deleteTeam(id: string) {
  return deleteDoc(doc(db, "teams", id));
}