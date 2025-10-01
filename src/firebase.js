// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB891Rs-PNAymP1DHtY6L5F7NCvhjNAeh8",
  authDomain: "my-chat-app-53367.firebaseapp.com",
  projectId: "my-chat-app-53367",
  storageBucket: "my-chat-app-53367.firebasestorage.app",
  messagingSenderId: "663467280588",
  appId: "1:663467280588:web:1479c1022a22eb84b11a69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app); 
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;