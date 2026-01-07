import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';

function CreateGroupScreen({ currentUser, onBack, onGroupCreated }) {
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState('');

  // --- (useEffect สำหรับดึงรายชื่อเพื่อน เหมือนเดิม) ---
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().uid !== currentUser.uid) {
          usersData.push(doc.data());
        }
      });
      setUsers(usersData);
    });
    return () => unsubscribe();
   }, [currentUser.uid]);

  const handleMemberSelect = (uid) => {
    setSelectedMembers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // VVVVVVVV [แก้ไขฟังก์ชันนี้] VVVVVVVV
  const handleCreateGroup = async () => {
    if (groupName.trim() === '') {
      alert('Please enter a group name.');
      return;
    }
    if (selectedMembers.length < 1) {
      alert('Please select at least one member.');
      return;
    }

    const members = [currentUser.uid, ...selectedMembers].sort();

    // [เพิ่ม] สร้าง object unreadCount เริ่มต้น
    const unreadCount = {};
    members.forEach(uid => {
      unreadCount[uid] = 0;
    });

    try {
      await addDoc(collection(db, 'chats'), {
      groupName: groupName,        // ชื่อกลุ่ม
      isGroup: true,               // บอกว่าเป็นกลุ่ม
      members: allMembers,         // <--- ต้องมี ID เราอยู่ในนี้ด้วย
      adminId: currentUser.uid,    // เก็บไว้ดูว่าใครเป็นหัวหน้าห้อง
      lastMessage: "สร้างกลุ่มใหม่แล้ว",
      updatedAt: serverTimestamp(), // สำคัญสำหรับการเรียงลำดับ
      createdAt: serverTimestamp(),
      unreadCount: {}              // เตรียม object สำหรับนับข้อความที่ยังไม่อ่าน
      });
      alert('Group created successfully!');
      onGroupCreated();
    } catch (error) {
      console.error("Error creating group: ", error);
      alert('Failed to create group.');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button onClick={onBack} className="back-btn">{'< Back'}</button>
        <h2>Create New Group</h2>
      </div>
      <div className="profile-form">
        <div className="form-group">
          <label>Group Name</label>
          <input 
            type="text" 
            placeholder="Enter group name" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
        <div className="form-group" style={{width: '100%'}}>
            <label>Select Members</label>
            <div className="member-list">
            {users.map(user => (
                <div key={user.uid} className="member-item">
                <input 
                    type="checkbox"
                    id={user.uid}
                    checked={selectedMembers.includes(user.uid)}
                    onChange={() => handleMemberSelect(user.uid)}
                />
                <label htmlFor={user.uid} style={{width: '100%'}}>
                    <div className="user-avatar" style={{width: '40px', height: '40px', fontSize: '16px'}}>
                        {(user.displayName || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span>{user.displayName || user.email}</span>
                </label>
                </div>
            ))}
            </div>
        </div>
        <button onClick={handleCreateGroup} className="save-btn">Create Group</button>
      </div>
    </div>
  );
}

export default CreateGroupScreen;