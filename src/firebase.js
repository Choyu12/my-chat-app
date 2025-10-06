import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; // 👈 Import เข้ามา

const firebaseConfig = {
  apiKey: "AIzaSyB891Rs-PNAymP1DHtY6L5F7NCvhjNAeh8",
  authDomain: "my-chat-app-53367.firebaseapp.com",
  projectId: "my-chat-app-53367",
  storageBucket: "my-chat-app-53367.appspot.com",
  messagingSenderId: "663467280588",
  appId: "1:663467280588:web:1479c1022a22eb84b11a69",
  // VVVVVVVV [ใส่ URL ที่ถูกต้องตาม Error ที่เคยเจอ] VVVVVVVV
  databaseURL: "https://my-chat-app-53367-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app); 
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app); // 👈 Export ฐานข้อมูลใหม่
export default app;