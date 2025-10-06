import { useState } from 'react';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';
import ProfileScreen from './ProfileScreen';
import CreateGroupScreen from './CreateGroupScreen';
import GroupSettingsScreen from './GroupSettingsScreen';

function MainLayout({ currentUser }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  // ... (ฟังก์ชัน handle ต่างๆ เหมือนเดิม) ...
  // ฟังก์ชันสำหรับกลับไปหน้าหลัก (ปิดทุกหน้าต่างย่อย)
  const handleBack = () => {
    setSelectedChat(null);
    setShowProfile(false);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
  };

  // ฟังก์ชันสำหรับเลือกแชท
  const handleSelectChat = (chatObject) => {
    setShowProfile(false);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
    setSelectedChat(chatObject);
  };

  // ฟังก์ชันสำหรับเปิดหน้าโปรไฟล์
  const handleShowProfile = () => {
    setSelectedChat(null);
    setShowCreateGroup(false);
    setShowGroupSettings(false);
    setShowProfile(true);
  };
  
  // ฟังก์ชันสำหรับเปิดหน้าสร้างกลุ่ม
  const handleShowCreateGroup = () => {
    setSelectedChat(null);
    setShowProfile(false);
    setShowGroupSettings(false);
    setShowCreateGroup(true);
  };

  // ฟังก์ชันสำหรับเปิดหน้าตั้งค่ากลุ่ม
  const handleShowGroupSettings = () => {
    // ไม่ต้องปิด selectedChat เพราะต้องใช้ข้อมูลกลุ่ม
    setShowProfile(false);
    setShowCreateGroup(false);
    setShowGroupSettings(true);
  };

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

  // VVVVVVVV [แก้ไข className ตรงนี้] VVVVVVVV
  const isRightPanelActive = selectedChat || showProfile || showCreateGroup || showGroupSettings;

  return (
    <div className="main-layout">
      {/* Sidebar (ฝั่งซ้าย) จะ active เมื่อไม่มีการเลือกอะไร */}
      <div className={`sidebar ${isRightPanelActive ? '' : 'active'}`}>
        <ChatList 
          currentUser={currentUser} 
          onSelectChat={handleSelectChat} 
          onShowProfile={handleShowProfile} 
          onShowCreateGroup={handleShowCreateGroup}
          selectedChat={selectedChat} // 👈 [เพิ่ม] ส่ง state นี้ลงไป
        />
      </div>
      
      {/* Chat Window (ฝั่งขวา) จะ active เมื่อมีการเลือกแชท, โปรไฟล์, หรือสร้างกลุ่ม */}
      <div className={`chat-window ${isRightPanelActive ? 'active' : ''}`}>
        {renderRightPanel()}
      </div>
    </div>
  );
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
}

export default MainLayout;