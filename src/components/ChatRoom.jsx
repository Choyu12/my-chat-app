import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  doc,
  getDocs,
  writeBatch,
  deleteDoc,
  arrayRemove,
  arrayUnion // [เพิ่ม] สำหรับเพิ่มคนเข้ากลุ่ม
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function ChatRoom({ currentUser, chat, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  // [เพิ่ม] State สำหรับ Modal เพิ่มคน
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);
  
  const dummy = useRef();
  const fileInputRef = useRef();

  useEffect(() => {
    if (!chat?.id) return;
    const messagesRef = collection(db, 'chats', chat.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      if (msgs.length > 0) clearUnreadCount(chat.id);
    });

    return () => unsubscribe();
  }, [chat?.id]);

  useEffect(() => {
    dummy.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // [เพิ่ม] โหลดรายชื่อ User ทั้งหมด เพื่อเตรียมไว้ให้เลือกเพิ่มเข้ากลุ่ม
  useEffect(() => {
    if (showAddMemberModal) {
        const fetchUsers = async () => {
            const usersRef = collection(db, "users");
            const snapshot = await getDocs(usersRef);
            // กรองเอาเฉพาะคนที่ "ยังไม่ได้อยู่ในกลุ่ม"
            const usersList = snapshot.docs
                .map(doc => ({ uid: doc.id, ...doc.data() }))
                .filter(u => !chat.members.includes(u.uid)); 
            setAllUsers(usersList);
        };
        fetchUsers();
    }
  }, [showAddMemberModal, chat.members]);

  const clearUnreadCount = async (chatId) => {
    if (!currentUser) return;
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, { [`unreadCount.${currentUser.uid}`]: 0 });
    } catch (error) {
      console.error("Error clearing unread:", error);
    }
  };

  // [เพิ่ม] ฟังก์ชันส่งข้อความระบบ (ตัวหนังสือเทาๆ)
  const sendSystemMessage = async (text) => {
    try {
        await addDoc(collection(db, 'chats', chat.id, 'messages'), {
            text: text,
            isSystem: true, // flag บอกว่าเป็นข้อความระบบ
            createdAt: serverTimestamp(),
            senderId: 'system',
        });
        
        // อัปเดต Last Message ของห้อง
        const chatRef = doc(db, 'chats', chat.id);
        await updateDoc(chatRef, {
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending system message:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !image) || uploading) return;
    const msgText = newMessage;
    setNewMessage('');

    try {
      let imageUrl = null;
      if (image) {
        setUploading(true);
        const storageRef = ref(storage, `chat-images/${chat.id}/${Date.now()}_${image.name}`);
        const snapshot = await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(snapshot.ref);
        setUploading(false);
        setImage(null);
      }

      const unreadUpdates = {};
      if (chat.members) {
         chat.members.forEach(memberId => {
            if (memberId !== currentUser.uid) {
                unreadUpdates[`unreadCount.${memberId}`] = (chat.unreadCount?.[memberId] || 0) + 1;
            }
         });
      }

      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        text: msgText,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderPhoto: currentUser.photoURL || null
      });

      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        lastMessage: imageUrl ? "ส่งรูปภาพ" : msgText,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...unreadUpdates
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setUploading(false);
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) setImage(e.target.files[0]);
  };

  const handleDeleteChat = async () => {
    const confirmMessage = chat.isGroup 
        ? "คุณแน่ใจหรือไม่ที่จะลบกลุ่มนี้และประวัติการแชททั้งหมด? (ไม่สามารถกู้คืนได้)"
        : "คุณแน่ใจหรือไม่ที่จะลบแชทนี้? (ไม่สามารถกู้คืนได้)";

    if (!window.confirm(confirmMessage)) return;

    try {
        setUploading(true);
        const messagesRef = collection(db, 'chats', chat.id, 'messages');
        const snapshot = await getDocs(messagesRef);
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        
        const chatRef = doc(db, "chats", chat.id);
        batch.delete(chatRef);
        await batch.commit();

        setUploading(false);
        onBack(); 
    } catch (error) {
        console.error("Error deleting chat:", error);
        setUploading(false);
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("คุณต้องการออกจากกลุ่มนี้ใช่หรือไม่?")) return;

    try {
        // [เพิ่ม] ส่งข้อความแจ้งเตือนก่อนออก
        const userName = currentUser.displayName || currentUser.email;
        await sendSystemMessage(`${userName} ได้ออกจากกลุ่ม`);

        const chatRef = doc(db, "chats", chat.id);
        await updateDoc(chatRef, {
            members: arrayRemove(currentUser.uid)
        });
        onBack(); 
    } catch (error) {
        console.error("Error leaving group:", error);
        alert("เกิดข้อผิดพลาดในการออกจากกลุ่ม");
    }
  };

  // [เพิ่ม] ฟังก์ชันกดปุ่มเพิ่มสมาชิก
  const handleAddMembers = async () => {
    if (selectedUsersToAdd.length === 0) return;

    try {
        const chatRef = doc(db, "chats", chat.id);
        
        // 1. อัปเดตสมาชิกใน Database
        await updateDoc(chatRef, {
            members: arrayUnion(...selectedUsersToAdd)
        });

        // 2. ส่งข้อความแจ้งเตือน (System Message)
        const adderName = currentUser.displayName || currentUser.email;
        // หาชื่อคนที่ถูกเพิ่มมาโชว์
        const addedNames = allUsers
            .filter(u => selectedUsersToAdd.includes(u.uid))
            .map(u => u.displayName || u.email)
            .join(", ");
            
        await sendSystemMessage(`${adderName} ได้เพิ่ม ${addedNames} เข้ากลุ่ม`);

        setShowAddMemberModal(false);
        setSelectedUsersToAdd([]);
        alert("เพิ่มสมาชิกเรียบร้อยแล้ว");
    } catch (error) {
        console.error("Error adding members:", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const toggleUserSelection = (uid) => {
    if (selectedUsersToAdd.includes(uid)) {
        setSelectedUsersToAdd(selectedUsersToAdd.filter(id => id !== uid));
    } else {
        setSelectedUsersToAdd([...selectedUsersToAdd, uid]);
    }
  };

  const chatTitle = chat.isGroup ? chat.groupName : (chat.otherUserName || "Chat");
  const isAdmin = chat.isGroup && chat.adminId === currentUser.uid;

  return (
    <>
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>← กลับ</button>
        <div className="avatar" style={{width: 35, height: 35, fontSize: 14}}>
            {chat.isGroup ? "G" : chatTitle.charAt(0)}
        </div>
        <span style={{flex: 1, fontWeight: 500}}>{chatTitle}</span>

        {/* เมนู 3 จุด */}
        <div style={{position: 'relative'}}>
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)} style={{background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 10px', color: '#555'}}>⋮</button>
            
            {showMenu && (
                <div className="dropdown-menu" style={{
                    position: 'absolute', top: '120%', right: 0, background: 'white',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.15)', borderRadius: '8px', padding: '5px',
                    zIndex: 999, minWidth: '180px', border: '1px solid #eee'
                }}>
                    {/* [เพิ่ม] ปุ่มเพิ่มสมาชิก (เฉพาะ Admin) */}
                    {isAdmin && (
                        <button 
                            onClick={() => { setShowAddMemberModal(true); setShowMenu(false); }}
                            style={{display: 'block', width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer'}}
                        >
                            + เพิ่มคนเข้ากลุ่ม
                        </button>
                    )}

                    {(isAdmin || !chat.isGroup) && (
                        <button 
                            onClick={handleDeleteChat}
                            disabled={uploading}
                            style={{display: 'block', width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}
                        >
                            {chat.isGroup ? "ลบกลุ่มและประวัติ" : "ลบแชทและประวัติ"}
                        </button>
                    )}

                    {chat.isGroup && !isAdmin && (
                        <button 
                            onClick={handleLeaveGroup}
                            style={{display: 'block', width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer'}}
                        >
                            ออกจากกลุ่ม
                        </button>
                    )}
                </div>
            )}
        </div>
      </div>

      <div className="message-area">
        {messages.map((msg) => {
          // [แก้ไข] ตรวจสอบว่าเป็นข้อความระบบหรือไม่
          if (msg.isSystem) {
            return (
                <div key={msg.id} className="message-wrapper system">
                    <div className="message system">
                        {msg.text}
                    </div>
                </div>
            );
          }

          const isMe = msg.senderId === currentUser.uid;
          return (
            <div key={msg.id} className={`message-wrapper ${isMe ? 'sent' : 'received'}`}>
              {!isMe && chat.isGroup && <span className="message-sender-name">{msg.senderName}</span>}
              <div className={`message ${isMe ? 'sent' : 'received'}`}>
                {msg.text && <p>{msg.text}</p>}
                {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="sent" onClick={() => window.open(msg.imageUrl, '_blank')} />
                )}
              </div>
            </div>
          );
        })}
        <div ref={dummy}></div>
      </div>

      {image && (
        <div className="image-preview-container">
            <div style={{position: 'relative'}}>
                <img src={URL.createObjectURL(image)} alt="preview" />
                <button className="remove-image-btn" onClick={() => setImage(null)}>×</button>
            </div>
            <span>{uploading ? `กำลังส่ง... ${uploadProgress}%` : "พร้อมส่ง"}</span>
        </div>
      )}

      <div className="input-area-wrapper">
        <form className="input-area" onSubmit={handleSendMessage}>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} style={{display: 'none'}} />
          <button type="button" className="attach-btn" onClick={() => fileInputRef.current.click()}>📷</button>
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="พิมพ์ข้อความ..." disabled={uploading} />
          <button type="submit" disabled={!newMessage.trim() && !image}>ส่ง</button>
        </form>
      </div>

      {/* [เพิ่ม] Modal สำหรับเพิ่มคนเข้ากลุ่ม */}
      {showAddMemberModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
                <h3>เพิ่มสมาชิกใหม่</h3>
                <button className="close-btn" onClick={() => setShowAddMemberModal(false)}>×</button>
            </div>
            <div className="modal-body">
                {allUsers.length === 0 ? (
                    <p style={{textAlign:'center', color:'#888'}}>ไม่มีเพื่อนให้เพิ่มแล้ว (ทุกคนอยู่ในกลุ่มหมดแล้ว)</p>
                ) : (
                    <div className="user-selection-list">
                        <p>เลือกเพื่อนที่ต้องการเพิ่ม:</p>
                        {allUsers.map(user => (
                            <div key={user.uid} className="user-checkbox-item">
                                <input 
                                    type="checkbox" 
                                    checked={selectedUsersToAdd.includes(user.uid)} 
                                    onChange={() => toggleUserSelection(user.uid)} 
                                />
                                <label>{user.displayName || user.email}</label>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="modal-footer">
                <button 
                    className="confirm-btn" 
                    onClick={handleAddMembers}
                    disabled={selectedUsersToAdd.length === 0}
                    style={{opacity: selectedUsersToAdd.length === 0 ? 0.5 : 1}}
                >
                    ยืนยันการเพิ่ม
                </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatRoom;