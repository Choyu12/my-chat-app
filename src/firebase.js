import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; // [สำคัญ] ต้อง Import อันนี้เพิ่ม

// --- ส่วนตั้งค่า Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyB891Rs-PNAymP1DHtY6L5F7NCvhjNAeh8",
  authDomain: "my-chat-app-53367.firebaseapp.com",
  projectId: "my-chat-app-53367",
  storageBucket: "my-chat-app-53367.appspot.com",
  messagingSenderId: "663467280588",
  appId: "1:663467280588:web:1479c1022a22eb84b11a69",
  databaseURL: "https://my-chat-app-53367-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "my-chat-app-53367.firebasestorage.app",

};

// 1. เริ่มต้นแอป
const app = initializeApp(firebaseConfig);

// 2. เริ่มต้นบริการต่างๆ
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtdb = getDatabase(app); // [สำคัญ] สร้างตัวแปร rtdb

// 3. ส่งออกไปใช้ข้างนอก
export { auth, db, storage, rtdb };