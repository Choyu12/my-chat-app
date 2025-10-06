import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';
import ProfileScreen from './ProfileScreen';
import CreateGroupScreen from './CreateGroupScreen';
import GroupSettingsScreen from './GroupSettingsScreen';

function MainLayout({ currentUser }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const prevTotalUnreadCount = useRef(0);
  const isInitialLoad = useRef(true);

  // [ส่วนการทำงาน] ดึง "ห้องแชท" ทั้งหมดที่ currentUser เป็นสมาชิก
  useEffect(() => {
    if (!currentUser.uid) return;

    const q = query(collection(db, 'chats'), where('members', 'array-contains', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatsData);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // [ส่วนการทำงาน] เล่นเสียงแจ้งเตือนแบบ Global
  useEffect(() => {
    // คำนวณจำนวนข้อความที่ยังไม่อ่านทั้งหมด
    const currentTotalUnreadCount = chats.reduce((sum, chat) => {
      return sum + (chat.unreadCount ? chat.unreadCount[currentUser.uid] : 0);
    }, 0);

    // ถ้าเป็นการโหลดครั้งแรก ให้แค่บันทึกค่าไว้
    if (isInitialLoad.current) {
        prevTotalUnreadCount.current = currentTotalUnreadCount;
        isInitialLoad.current = false;
        return;
    }
    
    // ถ้าจำนวนที่ยังไม่อ่าน "เพิ่มขึ้น" จากครั้งก่อนหน้า แสดงว่ามีข้อความใหม่เข้ามา
    if (currentTotalUnreadCount > prevTotalUnreadCount.current) {
      new Audio('/notification.mp3').play().catch(e => console.log("Audio play failed.", e));
    }
    
    // อัปเดตค่าล่าสุดไว้สำหรับการเปรียบเทียบครั้งต่อไป
    prevTotalUnreadCount.current = currentTotalUnreadCount;
  }, [chats, currentUser.uid]);

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับกลับไปหน้าหลัก
  const handleBack = () => {
    setSelectedChat(null);
    setShowProfile(false);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
  };

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับเลือกแชท
  const handleSelectChat = (chatObject) => {
    setShowProfile(false);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
    setSelectedChat(chatObject);
  };

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับเปิดหน้าโปรไฟล์
  const handleShowProfile = () => {
    setSelectedChat(null);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
    setShowProfile(true);
  };
  
  // [ส่วนการทำงาน] ฟังก์ชันสำหรับเปิดหน้าสร้างกลุ่ม
  const handleShowCreateGroup = () => {
    setSelectedChat(null);
    setShowProfile(false);
    setShowGroupSettings(false);
    setShowCreateGroup(true);
  };

  // [ส่วนการทำงาน] ฟังก์ชันสำหรับเปิดหน้าตั้งค่ากลุ่ม
  const handleShowGroupSettings = () => {
    setShowGroupSettings(true);
  };

  // [ส่วนการทำงาน] ฟังก์ชันหลักในการเลือกแสดง Component ฝั่งขวา
  const renderRightPanel = () => {
    if (showGroupSettings && selectedChat) {
      return <GroupSettingsScreen currentUser={currentUser} chat={selectedChat} onBack={handleBack} />;
    }
    if (showCreateGroup) {
      return <CreateGroupScreen currentUser={currentUser} onBack={handleBack} onGroupCreated={handleBack} />;
    }
    if (showProfile) {
      return <ProfileScreen currentUser={currentUser} onBack={handleBack} />;
    }
    if (selectedChat) {
      return <ChatRoom currentUser={currentUser} chat={selectedChat} onBack={handleBack} onShowSettings={handleShowGroupSettings} />;
    }
    return (
      <div className="welcome-screen">
        <h2>เลือกแชทเพื่อเริ่มการสนทนา</h2>
      </div>
    );
  };

  const isRightPanelActive = selectedChat || showProfile || showCreateGroup || showGroupSettings;

  return (
    <div className="main-layout">
      <div className={`sidebar ${isRightPanelActive ? '' : 'active'}`}>
        <ChatList 
          currentUser={currentUser} 
          chats={chats} // ส่ง 'chats' ที่ดึงมาแล้วลงไป
          onSelectChat={handleSelectChat} 
          onShowProfile={handleShowProfile} 
          onShowCreateGroup={handleShowCreateGroup}
          selectedChat={selectedChat}
        />
      </div>
      
      <div className={`chat-window ${isRightPanelActive ? 'active' : ''}`}>
        {renderRightPanel()}
      </div>
    </div>
  );
}

export default MainLayout;