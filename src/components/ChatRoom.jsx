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
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

function ChatRoom({ currentUser, chatUser, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatRoomId, setChatRoomId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Effect 1: หาหรือสร้างห้องแชท
  useEffect(() => {
    const getOrCreateChatRoom = async () => {
      if (!currentUser || !chatUser) return;
      const members = [currentUser.uid, chatUser.uid].sort();
      const chatRoomIdString = members.join('');
      const chatQuery = query(collection(db, 'chats'), where('members', '==', members));
      const querySnapshot = await getDocs(chatQuery);
      if (querySnapshot.empty) {
        await addDoc(collection(db, 'chats'), {
          members: members,
          createdAt: serverTimestamp(),
          typingUsers: [],
        });
      }
      setChatRoomId(chatRoomIdString);
    };
    getOrCreateChatRoom();
  }, [currentUser, chatUser]);

  // Effect 2: ดักฟังข้อความใหม่ๆ ในห้องแชท
  useEffect(() => {
    if (!chatRoomId) return;
    const messagesQuery = query(
      collection(db, 'chats', chatRoomId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [chatRoomId]);
  
  // Effect 3: ดักฟังสถานะ "กำลังพิมพ์"
  useEffect(() => {
    if (!chatRoomId) return;
    const chatRoomRef = doc(db, 'chats', chatRoomId);
    const unsubscribe = onSnapshot(chatRoomRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsTyping(data.typingUsers?.includes(chatUser.uid));
      }
    });
    return () => unsubscribe();
  }, [chatRoomId, chatUser.uid]);

  // Effect 4: เลื่อนหน้าจอไปที่ข้อความล่าสุด
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ฟังก์ชันจัดการการพิมพ์
  const handleTyping = () => {
    if (!chatRoomId) return;
    const chatRoomRef = doc(db, 'chats', chatRoomId);
    updateDoc(chatRoomRef, {
      typingUsers: arrayUnion(currentUser.uid)
    });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(chatRoomRef, {
        typingUsers: arrayRemove(currentUser.uid)
      });
    }, 2000);
  };
  
  // ฟังก์ชันแปลงไฟล์เป็น Base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
  
  // ฟังก์ชันส่งข้อความ
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatRoomId) return;
    const imageFile = fileInputRef.current.files[0];
    if (newMessage.trim() === '' && !imageFile) return;
    let imageBase64 = '';
    if (imageFile) {
        if (imageFile.size > 1024 * 1024) {
            alert("Error: Image size should not exceed 1MB.");
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
    });
    setNewMessage('');
    if (fileInputRef.current) {
        fileInputRef.current.value = null;
    }
  };

  // ฟังก์ชันออกจากระบบ
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn">{'< Back'}</button>
        <span>{chatUser?.email}</span>
        <button onClick={handleLogout} className="logout-btn" style={{ marginLeft: 'auto' }}>
          Logout
        </button>
      </div>

      <div className="message-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-wrapper ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`}>
            {msg.senderId !== currentUser.uid && (
              <div className="avatar">
                {msg.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`}>
              {/* Header in bubble is removed for LINE style */}
              {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
              {msg.imageBase64 && (
                <img
                  src={msg.imageBase64}
                  alt="content"
                  style={{ maxWidth: '200px', borderRadius: '8px' }}
                />
              )}
            </div>
          </div>
        ))}
        
        <div className="typing-indicator-container">
          {isTyping && <span>{chatUser.email} is typing...</span>}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="input-area">
        <input type="file" ref={fileInputRef} accept="image/*"/>
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
  );
}

export default ChatRoom;