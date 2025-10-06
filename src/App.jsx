import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';
import MainLayout from './components/MainLayout';
import { usePresence } from './hooks/usePresence'; // 👈 Import เข้ามา
import './style.css';

function App() {
  const [user, setUser] = useState(null);
  
  // เรียกใช้ hook เพื่อจัดการสถานะออนไลน์
  usePresence(user?.uid); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="app-container">
      {!user ? (
        <LoginScreen />
      ) : (
        <MainLayout currentUser={user} />
      )}
    </div>
  );
}

export default App;