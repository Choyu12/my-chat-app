import { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../firebase';
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
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'; 
import EmojiPicker from 'emoji-picker-react';

function ChatRoom({ currentUser, chat, onBack, onShowSettings }) { 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [membersInfo, setMembersInfo] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageAreaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true);

  const chatRoomId = chat.id;

  // --- Logic Hooks ---
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

  useEffect(() => {
    if (!chatRoomId) return;
    const messagesQuery = query(collection(db, 'chats', chatRoomId, 'messages'), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    isInitialLoad.current = true; 
    return () => unsubscribe();
  }, [chatRoomId, currentUser.uid]);

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

  // [แก้ไข] Effect ควบคุมการ Scroll (แบบไม่อัตโนมัติสำหรับคนอื่น)
  useEffect(() => { 
    if (!messagesEndRef.current || !messageAreaRef.current) return;

    // 1. โหลดครั้งแรก: ไปล่างสุดทันที
    if (isInitialLoad.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        isInitialLoad.current = false;
        return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // 2. ถ้าเป็นข้อความที่เราส่งเอง: เลื่อนลงให้ (เพื่อให้เห็นว่าส่งไปแล้ว)
    const isMyMessage = lastMessage.senderId === currentUser.uid;
    if (isMyMessage) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // 3. ถ้าคนอื่นส่งมา: **ไม่ทำอะไรเลย** (ให้คนอ่านเลื่อนลงเอง)
    // ตัดโค้ด isNearBottom ออกทั้งหมด เพื่อป้องกันการกระตุก

  }, [messages, currentUser.uid]);


  // --- Handlers ---
  const handleTyping = () => {
    if (!chatRoomId) return;
    const chatRoomRef = doc(db, 'chats', chatRoomId);
    updateDoc(chatRoomRef, { typingUsers: arrayUnion(currentUser.uid) });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
        updateDoc(chatRoomRef, { typingUsers: arrayRemove(currentUser.uid) });
    }, 2000);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert("ขนาดไฟล์ต้องไม่เกิน 20MB");
        e.target.value = null; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const uploadImageWithProgress = (file) => {
    return new Promise((resolve, reject) => {
      const imageRef = storageRef(storage, `chat_images/${chatRoomId}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(imageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        }, 
        (error) => {
          reject(error);
        }, 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!chatRoomId || isUploading) return;
      const imageFile = fileInputRef.current.files[0];
      if (newMessage.trim() === '' && !imageFile) return;
      
      setIsUploading(true);
      setUploadProgress(0);

      try {
        const unreadCountUpdates = {};
        chat.members.forEach(memberId => {
          if (memberId !== currentUser.uid) {
            unreadCountUpdates[`unreadCount.${memberId}`] = increment(1);
          }
        });
        unreadCountUpdates.lastMessageAt = serverTimestamp();
        const chatDocRef = doc(db, 'chats', chatRoomId);
        await updateDoc(chatDocRef, unreadCountUpdates);

        let imageUrl = '';
        if (imageFile) {
          imageUrl = await uploadImageWithProgress(imageFile);
        }

        await addDoc(collection(db, 'chats', chatRoomId, 'messages'), {
            text: newMessage,
            createdAt: serverTimestamp(),
            senderId: currentUser.uid,
            email: currentUser.email,
            imageBase64: imageUrl,
            isRead: false,
        });
        
        setNewMessage('');
        setImagePreview(null); 
        if (fileInputRef.current) fileInputRef.current.value = null;

      } catch (error) {
        console.error("Error sending message:", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
  };

  const handleLogout = () => { signOut(auth); };
  
  const onEmojiClick = (emojiObject) => {
    setNewMessage(prevInput => prevInput + emojiObject.emoji);
  };

  const partner = chat.isGroup ? null : chat.members.find(uid => uid !== currentUser.uid);
  const chatName = chat.isGroup ? chat.groupName : (membersInfo[partner]?.displayName || membersInfo[partner]?.email);

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

      <div className="message-area" ref={messageAreaRef}>
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
        
        {imagePreview && (
          <div className="image-preview-container">
            <img src={imagePreview} alt="preview" />
            <button type="button" onClick={handleRemoveImage} className="remove-image-btn">
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="input-area">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*"
            id="image-upload"
            onChange={handleImageChange}
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
          <button 
            type="submit" 
            disabled={isUploading}
            style={{ minWidth: '80px' }}
          >
            {isUploading ? `${uploadProgress}%` : 'ส่ง'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatRoom;