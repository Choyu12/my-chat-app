import React, { useState, useEffect, useRef } from "react";
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  getDocs, doc, getDoc, setDoc, updateDoc
} from "firebase/firestore";
import { ref as rtdbRef, onValue } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { auth, db, rtdb, storage } from "../firebase"; 

const Sidebar = ({ setSelectedChat }) => {
  const [activeTab, setActiveTab] = useState("chats");
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});

  // Modal State: Create Group
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]); 

  // Modal State: Profile
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef();

  // 1. Check Auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setNewDisplayName(user.displayName || "");
      } else {
        setCurrentUser(null);
        setLoading(false);
        setChats([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. Realtime Presence
  useEffect(() => {
    const statusRef = rtdbRef(rtdb, '/status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.val()) setOnlineStatus(snapshot.val());
    });
    return () => unsubscribe();
  }, []);

  // 3. Fetch Chats (เรียงลำดับ Client-side)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "chats"), where("members", "array-contains", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // เรียงแชทใหม่สุดขึ้นก่อน
      chatData.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setChats(chatData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 4. Fetch All Users
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })).filter(u => u.uid !== currentUser.uid); 
        setUsers(usersList);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const getFriendData = (chat) => {
    if (chat.isGroup) return null;
    const friendId = chat.members.find(id => id !== currentUser.uid);
    return users.find(u => u.uid === friendId); 
  };

  const handleSelectChat = (chat) => {
    if (!chat.isGroup) {
        const friend = getFriendData(chat);
        setSelectedChat({
            ...chat,
            otherUserName: friend ? (friend.displayName || friend.email) : "Unknown User",
            photoURL: friend?.photoURL,
            isOnline: friend ? onlineStatus[friend.uid]?.state === 'online' : false
        });
    } else {
        setSelectedChat(chat);
    }
  };

  const handleSelectUser = async (otherUser) => {
    const combinedId = currentUser.uid > otherUser.uid ? currentUser.uid + otherUser.uid : otherUser.uid + currentUser.uid;
    try {
        const res = await getDoc(doc(db, "chats", combinedId));
        if (!res.exists()) {
            await setDoc(doc(db, "chats", combinedId), {
                members: [currentUser.uid, otherUser.uid], isGroup: false, updatedAt: serverTimestamp(), createdAt: serverTimestamp(), lastMessage: "เริ่มการสนทนา", unreadCount: {}
            });
        }
        handleSelectChat({ id: combinedId, members: [currentUser.uid, otherUser.uid], isGroup: false, otherUserName: otherUser.displayName, photoURL: otherUser.photoURL });
        setActiveTab("chats");
    } catch (err) { console.error("Error selecting user:", err); }
  };

  const handleUpdateProfile = async () => {
    if (uploadingProfile) return;
    setUploadingProfile(true);
    try {
        let finalPhotoURL = currentUser.photoURL;
        if (imageFile) {
            const imageRef = storageRef(storage, `profile_images/${currentUser.uid}`);
            const snapshot = await uploadBytes(imageRef, imageFile);
            finalPhotoURL = await getDownloadURL(snapshot.ref);
        }
        await updateProfile(auth.currentUser, { displayName: newDisplayName, photoURL: finalPhotoURL });
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { displayName: newDisplayName, photoURL: finalPhotoURL });
        alert("อัปเดตโปรไฟล์สำเร็จ!");
        setShowProfileModal(false);
        setImageFile(null);
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        setUploadingProfile(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) setImageFile(e.target.files[0]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("กรุณาใส่ชื่อกลุ่ม");
    if (selectedUsers.length === 0) return alert("กรุณาเลือกเพื่อนเข้ากลุ่ม");
    try {
      const members = [currentUser.uid, ...selectedUsers];
      await addDoc(collection(db, "chats"), {
        groupName, isGroup: true, members, adminId: currentUser.uid,
        lastMessage: "กลุ่มใหม่ถูกสร้างแล้ว", updatedAt: serverTimestamp(), createdAt: serverTimestamp(), unreadCount: {} 
      });
      setShowGroupModal(false); setGroupName(""); setSelectedUsers([]); setActiveTab("chats");
    } catch (error) { console.error("Error creating group:", error); }
  };

  const toggleUserSelection = (uid) => {
    if (selectedUsers.includes(uid)) setSelectedUsers(selectedUsers.filter(id => id !== uid));
    else setSelectedUsers([...selectedUsers, uid]);
  };

  return (
    <div className="sidebar">
      {/* Header Profile */}
      <div className="sidebar-header-profile">
        <div className="user-info">
            <div className="avatar" style={{width: 32, height: 32, marginRight: 10}}>
                {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="me" /> : currentUser?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="user-email" style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px'}}>
              {currentUser?.displayName || currentUser?.email}
            </span>
        </div>
        <div className="header-actions">
            <button className="profile-btn" onClick={() => setShowProfileModal(true)}>Profile</button>
            <button className="logout-btn" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button className={`tab-btn ${activeTab === "chats" ? "active" : ""}`} onClick={() => setActiveTab("chats")}>Chats</button>
        <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>All Users</button>
      </div>

      {activeTab === "chats" && (<div className="chats-action-bar"><span>รายการแชท</span><button className="create-group-icon-btn" onClick={() => setShowGroupModal(true)}>+</button></div>)}

      {/* Chat List */}
      <div className="chat-list">
        {loading ? <p className="loading-text">กำลังโหลด...</p> : (
            <>
                {/* Tab: Chats */}
                {activeTab === "chats" && (
                    chats.map(chat => {
                         const friend = getFriendData(chat);
                         const chatName = chat.isGroup ? chat.groupName : (friend ? (friend.displayName || friend.email) : "User");
                         const photoURL = chat.isGroup ? null : (friend?.photoURL || null);
                         const isOnline = friend && onlineStatus[friend.uid]?.state === 'online';
                         
                         // [ส่วนสำคัญ] ดึงจำนวนข้อความที่ยังไม่ได้อ่าน
                         const myUnreadCount = chat.unreadCount?.[currentUser.uid] || 0;

                         return (
                            <div key={chat.id} className="chat-item" onClick={() => handleSelectChat(chat)}>
                                <div className={`avatar ${chat.isGroup ? 'group' : ''}`}>
                                    {photoURL ? <img src={photoURL} alt="profile" /> : (chat.isGroup ? "G" : chatName.charAt(0).toUpperCase())}
                                    {!chat.isGroup && isOnline && <div className="online-status-dot"></div>}
                                </div>
                                
                                <div className="chat-info">
                                    <div className="chat-name">{chatName}</div>
                                    <div className="last-message" style={{
                                        fontWeight: myUnreadCount > 0 ? 'bold' : 'normal',
                                        color: myUnreadCount > 0 ? '#333' : '#94a3b8'
                                    }}>
                                      {chat.lastMessage && chat.lastMessage.length > 20 ? chat.lastMessage.substring(0, 20) + "..." : chat.lastMessage}
                                    </div>
                                </div>

                                {/* แสดงตัวเลข Badge */}
                                {myUnreadCount > 0 && (
                                    <div className="unread-badge">
                                        {myUnreadCount > 99 ? '99+' : myUnreadCount}
                                    </div>
                                )}
                            </div>
                         );
                    })
                )}
                
                {/* Tab: All Users */}
                {activeTab === "users" && (
                    users.map(user => {
                        const isOnline = onlineStatus[user.uid]?.state === 'online';
                        return (
                            <div key={user.uid} className="chat-item" onClick={() => handleSelectUser(user)}>
                                <div className="avatar">
                                    {user.photoURL ? <img src={user.photoURL} alt="profile" /> : user.email?.charAt(0).toUpperCase()}
                                    {isOnline && <div className="online-status-dot"></div>}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-name">{user.displayName || user.email}</div>
                                    <div className="last-message">คลิกเพื่อเริ่มแชท</div>
                                </div>
                            </div>
                        )
                    })
                )}
            </>
        )}
      </div>

      {/* Modal: Create Group */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>สร้างกลุ่มใหม่</h3><button className="close-btn" onClick={() => setShowGroupModal(false)}>×</button></div>
            <div className="modal-body">
                <input type="text" placeholder="ชื่อกลุ่ม..." className="group-name-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <div className="user-selection-list"><p>เลือกสมาชิก:</p>{users.map(u => (<div key={u.uid} className="user-checkbox-item"><input type="checkbox" checked={selectedUsers.includes(u.uid)} onChange={() => toggleUserSelection(u.uid)} /><label>{u.displayName || u.email}</label></div>))}</div>
            </div>
            <div className="modal-footer"><button className="confirm-btn" onClick={handleCreateGroup}>สร้างเลย</button></div>
          </div>
        </div>
      )}

      {/* Modal: Edit Profile */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>แก้ไขโปรไฟล์</h3><button className="close-btn" onClick={() => !uploadingProfile && setShowProfileModal(false)}>×</button></div>
            <div className="modal-body">
                <label style={{display:'block', marginBottom:'5px', fontWeight:'bold'}}>ชื่อแสดงผล:</label>
                <input type="text" placeholder="ชื่อของคุณ..." className="group-name-input" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} disabled={uploadingProfile} />
                <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', marginTop:'15px'}}>รูปโปรไฟล์:</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px'}}>
                    <div className="avatar" style={{width: 60, height: 60}}>
                        {imageFile ? <img src={URL.createObjectURL(imageFile)} alt="preview" /> : currentUser?.photoURL ? <img src={currentUser.photoURL} alt="current" /> : currentUser?.email?.charAt(0).toUpperCase()}
                    </div>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{display: 'none'}} />
                    <button onClick={() => fileInputRef.current.click()} disabled={uploadingProfile} style={{padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer'}}>เปลี่ยนรูปภาพ...</button>
                </div>
            </div>
            <div className="modal-footer">
                <button className="confirm-btn" onClick={handleUpdateProfile} disabled={uploadingProfile} style={{opacity: uploadingProfile ? 0.7 : 1, cursor: uploadingProfile ? 'not-allowed' : 'pointer'}}>
                    {uploadingProfile ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;