import { useState } from 'react';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';
import ProfileScreen from './ProfileScreen';

function MainLayout({ currentUser }) {
  const [selectedChatUser, setSelectedChatUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const handleSelectChat = (chatUser) => {
    setShowProfile(false); // ปิดหน้าโปรไฟล์ (ถ้าเปิดอยู่)
    setSelectedChatUser(chatUser);
  };

  const handleShowProfile = () => {
    setSelectedChatUser(null); // ปิดหน้าแชท (ถ้าเปิดอยู่)
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
        <h2>Select a chat to start messaging</h2>
      </div>
    );
  };

  return (
    <div className="main-layout">
      <div className="sidebar">
        <ChatList 
          currentUser={currentUser} 
          onSelectChat={handleSelectChat} 
          onShowProfile={handleShowProfile} 
        />
      </div>
      <div className="chat-window">
        {renderRightPanel()}
      </div>
    </div>
  );
}

export default MainLayout;