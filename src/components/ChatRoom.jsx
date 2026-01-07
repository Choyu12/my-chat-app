import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../firebase'; // ตรวจสอบ path ให้ถูก
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function ChatRoom({ currentUser, chat, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const dummy = useRef();
  const fileInputRef = useRef();

  // ดึงข้อความแชทแบบ Realtime
  useEffect(() => {
    if (!chat?.id) return;

    const messagesRef = collection(db, 'chats', chat.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      
      // เมื่อมีข้อความใหม่ ให้เคลียร์ unreadCount ของเรา
      if (msgs.length > 0) {
        clearUnreadCount(chat.id);
      }
    });

    return () => unsubscribe();
  }, [chat?.id]);

  // เลื่อนจอลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    dummy.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearUnreadCount = async (chatId) => {
    if (!currentUser) return;
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (chatSnap.exists()) {
        const currentUnread = chatSnap.data().unreadCount || {};
        // อัปเดตเฉพาะ unreadCount ของตัวเราให้เป็น 0
        await updateDoc(chatRef, {
            [`unreadCount.${currentUser.uid}`]: 0
        });
      }
    } catch (error) {
      console.error("Error clearing unread count:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if ((!newMessage.trim() && !image) || uploading) return;

    const msgText = newMessage;
    setNewMessage(''); // เคลียร์ช่องพิมพ์ทันทีเพื่อให้ลื่นไหล

    try {
      let imageUrl = null;

      // ถ้ามีการแนบรูปภาพ
      if (image) {
        setUploading(true);
        const storageRef = ref(storage, `chat-images/${Date.now()}_${image.name}`);
        
        // จำลอง Progress Bar (เพราะ Firebase SDK บางตัวไม่คืนค่า progress ง่ายๆ)
        const interval = setInterval(() => {
           setUploadProgress((old) => (old < 90 ? old + 10 : old));
        }, 100);

        const snapshot = await uploadBytes(storageRef, image);
        clearInterval(interval);
        setUploadProgress(100);
        
        imageUrl = await getDownloadURL(snapshot.ref);
        setUploading(false);
        setImage(null);
        setUploadProgress(0);
      }

      // เตรียมข้อมูล Unread Count (บวกเพิ่มให้เพื่อนทุกคนในห้อง ยกเว้นเรา)
      const unreadUpdates = {};
      if (chat.members) {
         // ต้องดึงค่า unread เก่ามาก่อน หรือใช้ increment ของ Firestore ก็ได้
         // เพื่อความชัวร์เราจะใช้วิธี update map แบบง่ายๆ
         // (ในระบบจริงควรใช้ runTransaction หรือ increment)
         const chatRef = doc(db, 'chats', chat.id);
         const chatSnap = await getDoc(chatRef);
         const currentCounts = chatSnap.data()?.unreadCount || {};
         
         chat.members.forEach(memberId => {
            if (memberId !== currentUser.uid) {
                unreadUpdates[`unreadCount.${memberId}`] = (currentCounts[memberId] || 0) + 1;
            }
         });
      }

      // ส่งข้อความเข้า Firestore
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        text: msgText,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderPhoto: currentUser.photoURL || null
      });

      // อัปเดตข้อมูลล่าสุดที่ตัวห้องแชท (Last Message) และ Unread Count
      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        lastMessage: imageUrl ? "ส่งรูปภาพ" : msgText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...unreadUpdates // กระจาย object เพื่อนับจำนวน unread
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setUploading(false);
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  // ชื่อห้องแชท (ถ้าเป็นกลุ่มใช้ชื่อกลุ่ม ถ้าส่วนตัวใช้ชื่อเพื่อน)
  const chatTitle = chat.isGroup 
    ? chat.groupName 
    : (chat.otherUserName || "Chat");

  return (
    <>
      {/* 1. ส่วนหัว (Header) - ลบปุ่ม Logout ออกแล้ว */}
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>
          ← กลับ
        </button>
        
        <div className="avatar" style={{width: 35, height: 35, fontSize: 14}}>
            {chat.isGroup ? "G" : chatTitle.charAt(0)}
        </div>
        <span>{chatTitle}</span>
      </div>

      {/* 2. พื้นที่ข้อความ (Message Area) */}
      <div className="message-area">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          return (
            <div key={msg.id} className={`message-wrapper ${isMe ? 'sent' : 'received'}`}>
              {!isMe && chat.isGroup && (
                 <span className="message-sender-name">{msg.senderName}</span>
              )}
              
              <div className={`message ${isMe ? 'sent' : 'received'}`}>
                {msg.text && <p>{msg.text}</p>}
                {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="sent content" onClick={() => window.open(msg.imageUrl, '_blank')} />
                )}
                {/* เวลาส่งข้อความ (ถ้าต้องการ) */}
                {/* <span className="timestamp">{msg.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> */}
              </div>
            </div>
          );
        })}
        {/* ตัวดัน Scroll ให้ลงล่างสุด */}
        <div ref={dummy}></div>
      </div>

      {/* 3. ส่วนแนบรูป (Preview Image) */}
      {image && (
        <div className="image-preview-container">
            <div style={{position: 'relative'}}>
                <img src={URL.createObjectURL(image)} alt="preview" />
                <button className="remove-image-btn" onClick={() => setImage(null)}>×</button>
            </div>
            {uploading ? (
                <span style={{fontSize: 12, color: '#666'}}>กำลังส่ง... {uploadProgress}%</span>
            ) : (
                <span style={{fontSize: 12, color: '#666'}}>พร้อมส่ง</span>
            )}
        </div>
      )}

      {/* 4. ช่องพิมพ์ข้อความ (Input Area) */}
      <div className="input-area-wrapper">
        <form className="input-area" onSubmit={handleSendMessage}>
          <input 
            type="file" 
            id="file-input" 
            ref={fileInputRef}
            accept="image/*" 
            onChange={handleImageChange}
            style={{display: 'none'}} 
          />
          <button 
            type="button" 
            className="attach-btn" 
            onClick={() => fileInputRef.current.click()}
            title="แนบรูปภาพ"
          >
            📷
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            disabled={uploading}
          />
          
          <button type="submit" disabled={!newMessage.trim() && !image}>
            ส่ง
          </button>
        </form>
      </div>
    </>
  );
}

export default ChatRoom;