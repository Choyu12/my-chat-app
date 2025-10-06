import { useState } from 'react';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';
import ProfileScreen from './ProfileScreen';

function MainLayout({ currentUser }) {
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const handleSelectChat = (chatUser) => {
    setShowProfile(false);
    setSelectedChatUser(chatUser);
  };

  const handleShowProfile = () => {
    setSelectedChatUser(null);
    setShowProfile(true);
  };

  const handleBack = () => {
    setSelectedChatUser(null);
    setShowProfile(false);
  };

  const renderRightPanel = () => {
    if (showProfile) {
      return <ProfileScreen currentUser={currentUser} onBack={handleBack} />;
    }
    if (selectedChatUser) {
      return <ChatRoom currentUser={currentUser} chatUser={selectedChatUser} onBack={handleBack} />;
    }
    return (
      <div className="welcome-screen">
        <h2>เลือกแชทเพื่อเริ่มการสนทนา</h2>
        <p>หรือสร้างการสนทนาใหม่จากรายชื่อผู้ใช้</p>
      </div>
    );
  };

  return (
    <div className="main-layout">
      {/* Sidebar - ซ่อนเมื่อมีการเปิดแชทหรือโปรไฟล์บนมือถือ */}
      <div className={`sidebar ${!selectedChatUser && !showProfile ? 'active' : ''}`}>
        <ChatList 
          currentUser={currentUser} 
          onSelectChat={handleSelectChat} 
          onShowProfile={handleShowProfile} 
        />
      </div>
      
      {/* Chat Window - แสดงเฉพาะเมื่อมีการเลือกแชทหรือโปรไฟล์ */}
      <div className={`chat-window ${selectedChatUser ? 'has-chat' : ''} ${showProfile ? 'has-profile' : ''}`}>
        {renderRightPanel()}
      </div>
    </div>
  );
}

export default MainLayout;