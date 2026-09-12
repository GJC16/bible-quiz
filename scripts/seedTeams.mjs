import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCE3OHKhY7S1gf3Vf--E1-2Wa1D7kcA4uA",
  authDomain: "bible-quiz-28df8.firebaseapp.com",
  projectId: "bible-quiz-28df8",
  storageBucket: "bible-quiz-28df8.firebasestorage.app",
  messagingSenderId: "508523544538",
  appId: "1:508523544538:web:8a1eb8bd3978292a3f0ae3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const teams = [
  { name: "Team 1", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 2", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 3", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 4", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 5", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 6", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 7", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 8", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 9", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 10", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 11", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 12", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 13", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
  { name: "Team 14", memberCount: 4, members: ["Member A", "Member B", "Member C", "Member D"] },
];

async function seed() {
  const teamsCol = collection(db, "teams");
  for (const team of teams) {
    await addDoc(teamsCol, {
      ...team,
      createdAt: Date.now(),
    });
    console.log(`Added ${team.name}`);
  }
  console.log("Done seeding 14 teams!");
}

seed();