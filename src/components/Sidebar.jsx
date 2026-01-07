import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase"; 

const Sidebar = ({ setSelectedChat }) => {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' หรือ 'users'
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]); // รายชื่อ User ทั้งหมด
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // State สำหรับ Modal สร้างกลุ่ม
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]); 

  // 1. รอตรวจสอบสถานะ User
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 2. ดึงข้อมูล Chats (ห้องแชทที่มีเราอยู่)
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChats(chatData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. ดึงข้อมูล Users ทั้งหมด (สำหรับแท็บ All Users และสำหรับเลือกเข้ากลุ่ม)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const usersList = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          .filter(u => u.uid !== currentUser.uid); // ไม่เอาตัวเอง
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, [currentUser]);

  // ฟังก์ชันเลือก Chat (จากแท็บ Chats)
  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  // ฟังก์ชันเลือก User (จากแท็บ All Users -> เริ่มแชทส่วนตัว)
  const handleSelectUser = async (otherUser) => {
    // เช็คว่ามีห้องแชทส่วนตัวกับคนนี้หรือยัง
    const combinedId = currentUser.uid > otherUser.uid 
        ? currentUser.uid + otherUser.uid 
        : otherUser.uid + currentUser.uid;

    try {
        const res = await getDoc(doc(db, "chats", combinedId));
        
        if (!res.exists()) {
            // สร้างห้องแชทใหม่ถ้ายังไม่มี
            await setDoc(doc(db, "chats", combinedId), {
                members: [currentUser.uid, otherUser.uid],
                isGroup: false,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                lastMessage: "เริ่มการสนทนา",
                unreadCount: {}
            });
            // ส่งข้อมูล Chat object กลับไปให้หน้าหลักแสดงผลทันที
            setSelectedChat({
                id: combinedId,
                members: [currentUser.uid, otherUser.uid],
                isGroup: false,
                otherUserName: otherUser.displayName || otherUser.email
            });
        } else {
            // ถ้ามีอยู่แล้วก็ดึงมาใช้เลย
            setSelectedChat({ 
                id: res.id, 
                ...res.data(),
                otherUserName: otherUser.displayName || otherUser.email 
            });
        }
    } catch (err) {
        console.error("Error selecting user:", err);
    }
  };

  // ฟังก์ชันสร้างกลุ่ม
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("กรุณาใส่ชื่อกลุ่ม");
    if (selectedUsers.length === 0) return alert("กรุณาเลือกเพื่อนเข้ากลุ่ม");

    try {
      const members = [currentUser.uid, ...selectedUsers];
      
      const newGroupRef = await addDoc(collection(db, "chats"), {
        groupName: groupName,
        isGroup: true,
        members: members,
        adminId: currentUser.uid,
        lastMessage: "กลุ่มใหม่ถูกสร้างแล้ว",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        unreadCount: {} 
      });

      setShowGroupModal(false);
      setGroupName("");
      setSelectedUsers([]);
      // เปลี่ยนกลับมาหน้า Chats เพื่อให้เห็นกลุ่มใหม่
      setActiveTab("chats");
      
    } catch (error) {
      console.error("Error creating group:", error);
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
      {/* 1. Header (User Info) */}
      <div className="sidebar-header-profile">
        <div className="user-info">
            <span className="user-email">{currentUser?.email}</span>
        </div>
        <div className="header-actions">
            <button className="profile-btn">Profile</button>
            <button className="logout-btn" onClick={() => signOut(auth)}>Logout</button>
        </div>
      </div>

      {/* 2. Tabs Switcher */}
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

      {/* 3. Action Bar (เฉพาะหน้า Chats) เพื่อวางปุ่มสร้างกลุ่ม */}
      {activeTab === "chats" && (
          <div className="chats-action-bar">
              <span>รายการแชท</span>
              <button 
                className="create-group-icon-btn" 
                onClick={() => setShowGroupModal(true)}
                title="สร้างกลุ่มใหม่"
              >
                  +
              </button>
          </div>
      )}

      {/* 4. List Content */}
      <div className="chat-list">
        {loading ? <p className="loading-text">กำลังโหลด...</p> : (
            <>
                {/* แสดงรายการแชท (Chats Tab) */}
                {activeTab === "chats" && (
                    chats.length === 0 ? <p className="empty-text">ยังไม่มีการสนทนา</p> :
                    chats.map(chat => {
                         const chatName = chat.isGroup ? chat.groupName : "User"; 
                         return (
                            <div key={chat.id} className="chat-item" onClick={() => handleSelectChat(chat)}>
                                <div className={`avatar ${chat.isGroup ? 'group' : ''}`}>
                                    {chat.isGroup ? "G" : chatName.charAt(0).toUpperCase()}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-name">{chatName}</div>
                                    <div className="last-message">{chat.lastMessage}</div>
                                </div>
                            </div>
                         );
                    })
                )}

                {/* แสดงรายชื่อผู้ใช้ทั้งหมด (All Users Tab) */}
                {activeTab === "users" && (
                    users.map(user => (
                        <div key={user.uid} className="chat-item" onClick={() => handleSelectUser(user)}>
                            <div className="avatar">{user.email?.charAt(0).toUpperCase()}</div>
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

      {/* 5. Modal สร้างกลุ่ม */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
                <h3>สร้างกลุ่มใหม่</h3>
                <button className="close-btn" onClick={() => setShowGroupModal(false)}>×</button>
            </div>
            <div className="modal-body">
                <input 
                    type="text" 
                    placeholder="ชื่อกลุ่ม..." 
                    className="group-name-input"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                />
                <div className="user-selection-list">
                    <p>เลือกสมาชิก:</p>
                    {users.map(user => (
                        <div key={user.uid} className="user-checkbox-item">
                            <input 
                                type="checkbox"
                                checked={selectedUsers.includes(user.uid)}
                                onChange={() => toggleUserSelection(user.uid)}
                            />
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