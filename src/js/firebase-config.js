import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWnHgYIcYk5wzBwLtfi7VsrUiLVivdGTQ",
  authDomain: "proj-2-6b835.firebaseapp.com",
  projectId: "proj-2-6b835",
  storageBucket: "proj-2-6b835.firebasestorage.app",
  messagingSenderId: "427348687004",
  appId: "1:427348687004:web:30ff63f0fae41bb8fad559",
  measurementId: "G-GFN0V88EKC",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

