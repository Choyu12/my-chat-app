import { useState, useEffect } from 'react';
import { db, auth, rtdb } from '../firebase';
import { collection, onSnapshot, query, where, addDoc, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';

function ChatList({ currentUser, onSelectChat, onShowProfile, onShowCreateGroup, selectedChat }) {
  const [chats, setChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [usersInfo, setUsersInfo] = useState({});
  const [onlineStatus, setOnlineStatus] = useState({});
  const [activeTab, setActiveTab] = useState('chats');

  // [ส่วนการทำงาน] Effect 1: ดึงข้อมูล user ทั้งหมดมาเก็บไว้ใน state
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = [];
      const usersInfoData = {};
      querySnapshot.forEach((doc) => {
        usersInfoData[doc.id] = doc.data();
        // กรอง user ปัจจุบันออกจากลิสต์ "All Users"
        if (doc.id !== currentUser.uid) {
          usersData.push(doc.data());
        }
      });
      setAllUsers(usersData);
      setUsersInfo(usersInfoData);
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // [ส่วนการทำงาน] Effect 2: ดึง "ห้องแชท" ทั้งหมดที่ currentUser เป็นสมาชิก
  useEffect(() => {
    if (!currentUser.uid) return;
    const q = query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [currentUser.uid]);

  // [ส่วนการทำงาน] Effect 3: ดึงสถานะออนไลน์จาก Realtime Database
  useEffect(() => {
    const statusRef = ref(rtdb, '/status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const statuses = snapshot.val() || {};
      setOnlineStatus(statuses);
    });
    return () => unsubscribe();
  }, []);

  // [ส่วนการทำงาน] ฟังก์ชันออกจากระบบ
  const handleLogout = () => { signOut(auth); };

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับเริ่มต้นแชท 1:1 จากแท็บ "All Users"
  const handleStartNewChat = async (targetUser) => {
    const members = [currentUser.uid, targetUser.uid].sort();
    const chatQuery = query(collection(db, 'chats'), where('members', '==', members), where('isGroup', '==', false));
    const querySnapshot = await getDocs(chatQuery);
    
    if (querySnapshot.empty) {
      // ถ้ายังไม่มีห้องแชท -> สร้างใหม่พร้อม unreadCount
      const unreadCount = { [currentUser.uid]: 0, [targetUser.uid]: 0 };
      const newChatRef = await addDoc(collection(db, 'chats'), {
        members: members,
        createdAt: serverTimestamp(),
        isGroup: false,
        typingUsers: [],
        unreadCount: unreadCount,
      });
      const newChatDoc = await getDoc(newChatRef);
      onSelectChat({ id: newChatDoc.id, ...newChatDoc.data() });
    } else {
      // ถ้ามีห้องแชทอยู่แล้ว -> เปิดห้องนั้น
      onSelectChat({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
    }
  };

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับหาข้อมูลคู่สนทนาในแชท 1:1
  const getChatPartner = (members) => {
    const partnerId = members.find(uid => uid !== currentUser.uid);
    return usersInfo[partnerId];
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <span>{currentUser.displayName || currentUser.email}</span>
        <div>
          <button onClick={onShowCreateGroup} className="new-group-btn" title="Create Group">➕</button>
          <button onClick={onShowProfile} className="profile-btn">Profile</button>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>
      
      <div className="tab-switcher">
        <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => setActiveTab('chats')}>Chats</button>
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>All Users</button>
      </div>

      <div className="user-list-container">
        {activeTab === 'chats' && (
          chats.map((chat) => {
            const partner = !chat.isGroup ? getChatPartner(chat.members) : null;
            const chatName = chat.isGroup ? chat.groupName : (partner?.displayName || partner?.email);
            const avatarChar = (chatName || 'C').charAt(0).toUpperCase();
            const isActive = selectedChat?.id === chat.id;
            const unread = chat.unreadCount ? chat.unreadCount[currentUser.uid] : 0;
            const isOnline = partner && onlineStatus[partner.uid]?.state === 'online';

            if (!chat.isGroup && !partner) return null;

            return (
              <div key={chat.id} className={`user-item ${isActive ? 'active' : ''}`} onClick={() => onSelectChat(chat)}>
                <div className="user-avatar-wrapper">
                  <div className="user-avatar">{avatarChar}</div>
                  {!chat.isGroup && isOnline && <div className="online-indicator"></div>}
                </div>
                <div className="user-info">
                  <span className="user-email">{chatName}</span>
                </div>
                {unread > 0 && (
                  <div className="unread-badge">{unread}</div>
                )}
              </div>
            );
          })
        )}
        {activeTab === 'users' && (
          allUsers.map((user) => {
            const isOnline = onlineStatus[user.uid]?.state === 'online';
            const userName = user.displayName || user.email;
            const avatarChar = (userName).charAt(0).toUpperCase();
            return (
              <div key={user.uid} className="user-item" onClick={() => handleStartNewChat(user)}>
                <div className="user-avatar-wrapper">
                  <div className="user-avatar">{avatarChar}</div>
                  {isOnline && <div className="online-indicator"></div>}
                </div>
                <div className="user-info">
                    <span className="user-email">{userName}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}

export default ChatList;