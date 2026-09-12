import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

async function seed() {
  await setDoc(doc(db, "admin", "main"), {
    username: "glorious",
    password: "glorious123", // change this
  });
  console.log("Admin seeded!");
}

seed();