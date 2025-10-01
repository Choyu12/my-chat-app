import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

// ไฟล์นี้คือ HomeScreen.jsx เดิม
function ChatList({ currentUser, onSelectChat, onShowProfile }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // ใช้ onSnapshot เพื่อให้รายชื่อ User อัปเดตแบบ Real-time
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = [];
      querySnapshot.forEach((doc) => {
        // กรองชื่อของตัวเองออก ไม่ให้แสดงในลิสต์
        if (doc.data().uid !== currentUser.uid) {
          usersData.push(doc.data());
        }
      });
      setUsers(usersData);
    });

    // หยุดการดักฟังเมื่อ Component ถูกปิด
    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    // ใช้ className "home-container" เดิมได้เลย เพราะ CSS เราเขียนรองรับไว้แล้ว
    <div className="home-container">
      <div className="home-header">
        {/* แสดง displayName ก่อน ถ้าไม่มีก็ใช้ email แทน */}
        <span>Welcome, {currentUser.displayName || currentUser.email}</span>
        <div>
            {/* ปุ่มสำหรับเปิดหน้า Profile */}
            <button onClick={onShowProfile} className="profile-btn">Profile</button>
        </div>
      </div>
      <div className="user-list-container">
        <h2 className="user-list-title">Start a new chat</h2>
        {users.length > 0 ? (
          users.map((user) => (
            <div key={user.uid} className="user-item" onClick={() => onSelectChat(user)}>
              <div className="user-avatar">
                {/* แสดงตัวอักษรแรกของ displayName หรือ email */}
                {(user.displayName || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                {/* แสดง displayName หรือ email */}
                <span className="user-email">{user.displayName || user.email}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="no-users-text">No other users found. Invite a friend!</p>
        )}
      </div>
    </div>
  );
}

export default ChatList;