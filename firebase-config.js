// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCU20XqAGyFlsRqoOP4Jv1to9Wqsw7-bYg",
  authDomain: "jadwalsekolah-6ab2e.firebaseapp.com",
  projectId: "jadwalsekolah-6ab2e",
  storageBucket: "jadwalsekolah-6ab2e.firebasestorage.app",
  messagingSenderId: "302437086702",
  appId: "1:302437086702:web:5e797d934a3c7e8b09caff"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider };
