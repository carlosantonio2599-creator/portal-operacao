import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIC_ni8Cc_OMP0l24rTxEPGgQp9AK3g2s",
  authDomain: "equipe-e-f769e.firebaseapp.com",
  projectId: "equipe-e-f769e",
  storageBucket: "equipe-e-f769e.firebasestorage.app",
  messagingSenderId: "645086616559",
  appId: "1:645086616559:web:78d5a67feabbd95088b41a",
  measurementId: "G-E7MMSN8X22"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
