import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCE3OHKhY7S1gf3Vf--E1-2Wa1D7kcA4uA",
  authDomain: "bible-quiz-28df8.firebaseapp.com",
  projectId: "bible-quiz-28df8",
  storageBucket: "bible-quiz-28df8.firebasestorage.app",
  messagingSenderId: "508523544538",
  appId: "1:508523544538:web:8a1eb8bd3978292a3f0ae3"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);