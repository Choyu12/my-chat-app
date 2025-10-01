import { useState } from 'react';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc } from "firebase/firestore";

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ฟังก์ชันสำหรับ Login
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message);
    }
  };

  // ฟังก์ชันสำหรับ Sign Up
  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.email.split('@')[0], // ตั้งชื่อเริ่มต้นจากอีเมล
        photoURL: '', // รูปโปรไฟล์เริ่มต้นเป็นค่าว่าง
      });
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login-container">
      <h1>Welcome!</h1>
      <div className="login-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {/* ใช้ 2 ปุ่มแยกกันชัดเจน */}
        <button onClick={handleLogin}>Login</button>
        <button onClick={handleSignUp} style={{ marginTop: '10px', background: '#28a745' }}>
          Sign Up
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;