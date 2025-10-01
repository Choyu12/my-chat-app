import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import LoginScreen from './components/LoginScreen';
import MainLayout from './components/MainLayout'; // 👈 Import Layout ใหม่
import './style.css';

function App() {
  const [user, setUser] = useState(null);

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