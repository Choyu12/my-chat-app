import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  increment,
} from 'firebase/firestore';
import EmojiPicker from 'emoji-picker-react';

function ChatRoom({ currentUser, chat, onBack, onShowSettings }) { 
  // --- State Management ---
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [membersInfo, setMembersInfo] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  
  // --- Refs ---
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true); // Ref สำหรับเช็คการโหลดครั้งแรกของห้อง

  const chatRoomId = chat.id;

  // --- Logic Hooks (useEffect) ---

  // [ส่วนการทำงาน] Effect 1: ดึงข้อมูลสมาชิกทุกคนในห้องแชท
  useEffect(() => {
    if (!chat.members) return;
    const fetchMembersInfo = async () => {
      const membersData = {};
      for (const uid of chat.members) {
        if (!membersInfo[uid]) {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                membersData[uid] = userDoc.data();
            }
        }
      }
      setMembersInfo(prev => ({ ...prev, ...membersData }));
    };
    fetchMembersInfo();
  }, [chat.members]);

  // [ส่วนการทำงาน] Effect 2: ดักฟังข้อความใหม่ๆ และเล่นเสียงแจ้งเตือน
  useEffect(() => {
    if (!chatRoomId) return;
    const messagesQuery = query(collection(db, 'chats', chatRoomId, 'messages'), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      // Logic เล่นเสียงจะอยู่ในนี้
      snapshot.docChanges().forEach(change => {
        // เช็คว่าเป็นข้อความที่ "ถูกเพิ่ม" เข้ามาใหม่ และไม่ใช่การโหลดครั้งแรก
        if (change.type === "added" && !isInitialLoad.current) {
          const messageData = change.doc.data();
          // เช็คว่าเป็นข้อความจากคนอื่น
          if (messageData.senderId !== currentUser.uid) {
            new Audio('/notification.mp3').play().catch(e => console.log("Audio play failed.", e));
          }
        }
      });

      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // เอาธง initial load ลงหลังจากประมวลผลครั้งแรกเสร็จ
      isInitialLoad.current = false;
    });

    // รีเซ็ตธงทุกครั้งที่เปลี่ยนห้องแชท
    isInitialLoad.current = true; 
    return () => unsubscribe();
  }, [chatRoomId, currentUser.uid]);

  // [ส่วนการทำงาน] Effect 3: ดักฟังสถานะ "กำลังพิมพ์"
  useEffect(() => {
    if (!chatRoomId) return;
    const chatRoomRef = doc(db, 'chats', chatRoomId);
    const unsubscribe = onSnapshot(chatRoomRef, (doc) => {
      if (doc.exists()) {
        const typingUIDs = doc.data().typingUsers?.filter(uid => uid !== currentUser.uid) || [];
        setTypingUsers(typingUIDs);
      }
    });
    return () => unsubscribe();
  }, [chatRoomId, currentUser.uid]);

  // [ส่วนการทำงาน] Effect 4: รีเซ็ต unreadCount และอัปเดตสถานะ "อ่านแล้ว"
  useEffect(() => {
    if (!chatRoomId) return;
    const chatDocRef = doc(db, 'chats', chatRoomId);
    updateDoc(chatDocRef, { [`unreadCount.${currentUser.uid}`]: 0 });

    if (chat && !chat.isGroup && messages.length > 0) {
      const partnerId = chat.members.find(uid => uid !== currentUser.uid);
      if (!partnerId) return;
      const unreadMessages = messages.filter(msg => msg.senderId === partnerId && !msg.isRead);
      if (unreadMessages.length > 0) {
        unreadMessages.forEach(async (msg) => {
          const msgRef = doc(db, 'chats', chatRoomId, 'messages', msg.id);
          await updateDoc(msgRef, { isRead: true });
        });
      }
    }
  }, [chatRoomId, currentUser.uid, messages, chat]);

  // [ส่วนการทำงาน] Effect 5: เลื่อนหน้าจอไปที่ข้อความล่าสุด
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- Handler Functions ---

  // [ส่วนการทำงาน] ฟังก์ชันจัดการการพิมพ์
  const handleTyping = () => {
    if (!chatRoomId) return;
    const chatRoomRef = doc(db, 'chats', chatRoomId);
    updateDoc(chatRoomRef, { typingUsers: arrayUnion(currentUser.uid) });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
        updateDoc(chatRoomRef, { typingUsers: arrayRemove(currentUser.uid) });
    }, 2000);
  };

  // [ส่วนการทำงาน] ฟังก์ชันแปลงไฟล์เป็น Base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
  });

  // [ส่วนการทำงาน] ฟังก์ชันส่งข้อความ
  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!chatRoomId) return;
      const imageFile = fileInputRef.current.files[0];
      if (newMessage.trim() === '' && !imageFile) return;
      
      const unreadCountUpdates = {};
      chat.members.forEach(memberId => {
        if (memberId !== currentUser.uid) {
          unreadCountUpdates[`unreadCount.${memberId}`] = increment(1);
        }
      });
      const chatDocRef = doc(db, 'chats', chatRoomId);
      await updateDoc(chatDocRef, unreadCountUpdates);

      let imageBase64 = '';
      if (imageFile) {
        if (imageFile.size > 2 * 1024 * 1024) {
            alert("ขนาดไฟล์ต้องไม่เกิน 2MB");
            return;
        }
        imageBase64 = await fileToBase64(imageFile);
      }
      await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
          text: newMessage,
          createdAt: serverTimestamp(),
          senderId: currentUser.uid,
          email: currentUser.email,
          imageBase64: imageBase64,
          isRead: false,
      });
      setNewMessage('');
      if (fileInputRef.current) fileInputRef.current.value = null;
  };

  // [ส่วนการทำงาน] ฟังก์ชันออกจากระบบ
  const handleLogout = () => { signOut(auth); };
  
  // [ส่วนการทำงาน] ฟังก์ชันสำหรับรับค่าเมื่อคลิก Emoji
  const onEmojiClick = (emojiObject) => {
    setNewMessage(prevInput => prevInput + emojiObject.emoji);
  };

  const partner = chat.isGroup ? null : chat.members.find(uid => uid !== currentUser.uid);
  const chatName = chat.isGroup ? chat.groupName : (membersInfo[partner]?.displayName || membersInfo[partner]?.email);

  // --- Render JSX ---

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn">{'< Back'}</button>
        <div className="avatar">
          {chat.isGroup ? (chatName || 'G').charAt(0).toUpperCase() : (membersInfo[partner]?.photoURL ? <img src={membersInfo[partner].photoURL} alt="p" /> : (chatName || 'U').charAt(0).toUpperCase())}
        </div>
        <span>{chatName}</span>
        {chat.isGroup && (
          <button onClick={onShowSettings} className="settings-btn" title="Group Settings">⚙️</button>
        )}
        <button onClick={handleLogout} className="logout-btn" style={{ marginLeft: 'auto' }}>
          Logout
        </button>
      </div>

      <div className="message-area">
        {messages.map((msg) => {
          const sender = membersInfo[msg.senderId];
          const senderName = sender?.displayName || sender?.email;
          const isSentByMe = msg.senderId === currentUser.uid;

          return (
            <div key={msg.id} className={`message-wrapper ${isSentByMe ? 'sent' : 'received'}`}>
              {!isSentByMe && (
                <div className="avatar">
                  {sender?.photoURL ? <img src={sender.photoURL} alt="s"/> : (senderName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`message ${isSentByMe ? 'sent' : 'received'}`}>
                {chat.isGroup && !isSentByMe && (
                  <div className="message-sender-name">{senderName}</div>
                )}
                {msg.text && <p style={{margin: 0}}>{msg.text}</p>}
                {msg.imageBase64 && (
                    <div className="message-image-wrapper">
                        <img src={msg.imageBase64} alt="content" onClick={() => window.open(msg.imageBase64, '_blank')} />
                    </div>
                )}
                {isSentByMe && msg.isRead && !chat.isGroup && (
                  <div className="read-receipt">Read</div>
                )}
              </div>
            </div>
          )
        })}
        
        <div className="typing-indicator-container">
          {typingUsers.length > 0 && (
            <span>
              {typingUsers.map(uid => membersInfo[uid]?.displayName || membersInfo[uid]?.email).join(', ')}
              {typingUsers.length > 1 ? ' are typing...' : ' is typing...'}
            </span>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area-wrapper">
        {showPicker && (
          <div className="emoji-picker-container">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
        <form onSubmit={handleSendMessage} className="input-area">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*"
            id="image-upload"
          />
          <label htmlFor="image-upload" title="แนบรูปภาพ" className="attach-btn">
            📎
          </label>
          <button type="button" onClick={() => setShowPicker(val => !val)} className="emoji-btn">
            😊
          </button>
          <input
              type="text"
              placeholder="พิมพ์ข้อความ..."
              value={newMessage}
              onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
              }}
          />
          <button type="submit">ส่ง</button>
        </form>
      </div>
    </div>
  );
}

export default ChatRoom;