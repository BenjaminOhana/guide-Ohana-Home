// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAto2WicJFqx7OA3bnZP3ni3-eksfm1ALM",
    authDomain: "ohana-home-7b75b.firebaseapp.com",
    projectId: "ohana-home-7b75b",
    storageBucket: "ohana-home-7b75b.firebasestorage.app",
    messagingSenderId: "302187655366",
    appId: "1:302187655366:web:4c36b720a7bf7392e227c7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
