import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase"; 

const Sidebar = ({ setSelectedChat }) => {
  const [activeTab, setActiveTab] = useState("chats");
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]); 

  // 1. เช็ค User (แก้ปัญหาต้องล็อกอินใหม่ถึงจะเห็น)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setLoading(false);
        setChats([]); // เคลียร์แชทเมื่อ logout
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. ดึงแชท + แก้ปัญหาไม่ Realtime (ใช้ Client-side Sort)
  useEffect(() => {
    if (!currentUser) return;

    // [แก้จุดที่ 1] เอา orderBy ออกจาก Query เพื่อเลี่ยงปัญหา Index ของ Firebase
    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // [แก้จุดที่ 2] มาเรียงลำดับที่นี่แทน (ใหม่สุดอยู่บน)
      // ใช้ ?.seconds เพื่อป้องกันกรณี timestamp ยังไม่มา
      chatData.sort((a, b) => {
        const timeA = a.updatedAt?.seconds || 0;
        const timeB = b.updatedAt?.seconds || 0;
        return timeB - timeA; 
      });

      setChats(chatData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. ดึงรายชื่อ User ทั้งหมด
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          .filter(u => u.uid !== currentUser.uid); 
        setUsers(usersList);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // --- ฟังก์ชัน Helper ---
  const getFriendData = (chat) => {
    if (chat.isGroup) return null;
    const friendId = chat.members.find(id => id !== currentUser.uid);
    return users.find(u => u.uid === friendId); 
  };

  const handleSelectChat = (chat) => {
    if (!chat.isGroup) {
        const friend = getFriendData(chat);
        const chatWithFriendName = {
            ...chat,
            otherUserName: friend ? (friend.displayName || friend.email) : "Unknown User",
            photoURL: friend?.photoURL
        };
        setSelectedChat(chatWithFriendName);
    } else {
        setSelectedChat(chat);
    }
  };

  const handleSelectUser = async (otherUser) => {
    // ป้องกันการสร้างห้องซ้ำ
    const combinedId = currentUser.uid > otherUser.uid 
        ? currentUser.uid + otherUser.uid 
        : otherUser.uid + currentUser.uid;

    try {
        const res = await getDoc(doc(db, "chats", combinedId));
        if (!res.exists()) {
            await setDoc(doc(db, "chats", combinedId), {
                members: [currentUser.uid, otherUser.uid],
                isGroup: false,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                lastMessage: "เริ่มการสนทนา",
                unreadCount: {}
            });
            setSelectedChat({
                id: combinedId,
                members: [currentUser.uid, otherUser.uid],
                isGroup: false,
                otherUserName: otherUser.displayName || otherUser.email,
                photoURL: otherUser.photoURL
            });
        } else {
            setSelectedChat({ 
                id: res.id, 
                ...res.data(),
                otherUserName: otherUser.displayName || otherUser.email,
                photoURL: otherUser.photoURL
            });
        }
        setActiveTab("chats");
    } catch (err) {
        console.error("Error selecting user:", err);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("กรุณาใส่ชื่อกลุ่ม");
    if (selectedUsers.length === 0) return alert("กรุณาเลือกเพื่อนเข้ากลุ่ม");

    try {
      const members = [currentUser.uid, ...selectedUsers];
      
      // สร้างกลุ่ม
      await addDoc(collection(db, "chats"), {
        groupName: groupName,
        isGroup: true,
        members: members,
        adminId: currentUser.uid,
        lastMessage: "กลุ่มใหม่ถูกสร้างแล้ว",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadCount: {} 
      });

      // รีเซ็ตค่าและกลับไปหน้าแชท
      setShowGroupModal(false);
      setGroupName("");
      setSelectedUsers([]);
      setActiveTab("chats"); // เด้งกลับมาหน้าแชททันที
      
    } catch (error) {
      console.error("Error creating group:", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    }
  };

  const toggleUserSelection = (uid) => {
    if (selectedUsers.includes(uid)) {
        setSelectedUsers(selectedUsers.filter(id => id !== uid));
    } else {
        setSelectedUsers([...selectedUsers, uid]);
    }
  };

  return (
    <div className="sidebar">
      {/* Header Profile */}
      <div className="sidebar-header-profile">
        <div className="user-info">
            <span className="user-email">
              {currentUser?.email}
            </span>
        </div>
        <div className="header-actions">
            <button className="logout-btn" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="sidebar-tabs">
        <button 
            className={`tab-btn ${activeTab === "chats" ? "active" : ""}`}
            onClick={() => setActiveTab("chats")}
        >
            Chats
        </button>
        <button 
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
        >
            All Users
        </button>
      </div>

      {activeTab === "chats" && (
          <div className="chats-action-bar">
              <span>รายการแชท</span>
              <button className="create-group-icon-btn" onClick={() => setShowGroupModal(true)} title="สร้างกลุ่มใหม่">+</button>
          </div>
      )}

      {/* Chat List */}
      <div className="chat-list">
        {loading ? (
           <p className="loading-text">กำลังโหลด...</p>
        ) : (
            <>
                {/* Tab: Chats */}
                {activeTab === "chats" && (
                    chats.length === 0 ? <p className="empty-text">ยังไม่มีการสนทนา</p> :
                    chats.map(chat => {
                         const friend = getFriendData(chat);
                         const chatName = chat.isGroup ? chat.groupName : (friend ? (friend.displayName || friend.email) : "User");
                         const photoURL = chat.isGroup ? null : (friend?.photoURL || null);

                         return (
                            <div key={chat.id} className="chat-item" onClick={() => handleSelectChat(chat)}>
                                <div className={`avatar ${chat.isGroup ? 'group' : ''}`}>
                                    {photoURL ? <img src={photoURL} alt="profile" /> : (chat.isGroup ? "G" : chatName.charAt(0).toUpperCase())}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-name">{chatName}</div>
                                    <div className="last-message">
                                      {chat.lastMessage && chat.lastMessage.length > 20 ? chat.lastMessage.substring(0, 20) + "..." : chat.lastMessage}
                                    </div>
                                </div>
                            </div>
                         );
                    })
                )}

                {/* Tab: All Users */}
                {activeTab === "users" && (
                    users.map(user => (
                        <div key={user.uid} className="chat-item" onClick={() => handleSelectUser(user)}>
                            <div className="avatar">
                                {user.photoURL ? <img src={user.photoURL} alt="profile" /> : user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="chat-info">
                                <div className="chat-name">{user.displayName || user.email}</div>
                                <div className="last-message">คลิกเพื่อเริ่มแชท</div>
                            </div>
                        </div>
                    ))
                )}
            </>
        )}
      </div>

      {/* Modal สร้างกลุ่ม */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
                <h3>สร้างกลุ่มใหม่</h3>
                <button className="close-btn" onClick={() => setShowGroupModal(false)}>×</button>
            </div>
            <div className="modal-body">
                <input type="text" placeholder="ชื่อกลุ่ม..." className="group-name-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <div className="user-selection-list">
                    <p>เลือกสมาชิก:</p>
                    {users.map(user => (
                        <div key={user.uid} className="user-checkbox-item">
                            <input type="checkbox" checked={selectedUsers.includes(user.uid)} onChange={() => toggleUserSelection(user.uid)} />
                            <label>{user.displayName || user.email}</label>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer">
                <button className="confirm-btn" onClick={handleCreateGroup}>สร้างเลย</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;