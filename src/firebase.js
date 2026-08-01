import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1Lz-6FF6InRmwiEGOjHYar8BQSYzZVRY",
  authDomain: "ac-its-app.firebaseapp.com",
  projectId: "ac-its-app",
  storageBucket: "ac-its-app.firebasestorage.app",
  messagingSenderId: "468153295250",
  appId: "1:468153295250:web:f2a55bad8603c7e2bfe14b",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);