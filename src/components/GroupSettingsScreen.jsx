import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDocs, collection, where, query, deleteDoc, writeBatch } from 'firebase/firestore';

function GroupSettingsScreen({ currentUser, chat, onBack }) {
  const [groupName, setGroupName] = useState(chat.groupName);
  const [currentMembers, setCurrentMembers] = useState([]);
  const [usersToAdd, setUsersToAdd] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUsersData = async () => {
      const usersQuery = query(collection(db, 'users'));
      const querySnapshot = await getDocs(usersQuery);
      const allUsersData = {};
      querySnapshot.forEach(doc => {
        allUsersData[doc.id] = doc.data();
      });
      const current = chat.members.map(uid => allUsersData[uid]).filter(Boolean);
      const toAdd = Object.values(allUsersData).filter(user => !chat.members.includes(user.uid));
      setCurrentMembers(current);
      setUsersToAdd(toAdd);
    };
    fetchUsersData();
  }, [chat.members]);

  const handleMemberSelect = (uid) => {
    setSelectedMembers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };
  
  const handleRemoveMember = async (memberId) => {
    if (window.confirm(`Are you sure you want to remove this member?`)) {
      const chatDocRef = doc(db, 'chats', chat.id);
      try {
        await updateDoc(chatDocRef, {
          members: arrayRemove(memberId)
        });
        alert('Member removed.');
      } catch (error) {
        console.error("Error removing member:", error);
        alert('Failed to remove member.');
      }
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    const chatDocRef = doc(db, 'chats', chat.id);
    try {
      if (groupName.trim() !== '' && groupName.trim() !== chat.groupName) {
        await updateDoc(chatDocRef, { groupName: groupName.trim() });
      }
      if (selectedMembers.length > 0) {
        await updateDoc(chatDocRef, {
          members: arrayUnion(...selectedMembers)
        });
      }
      alert('Group updated successfully!');
      onBack();
    } catch (error) {
      console.error("Error updating group:", error);
      alert('Failed to update group.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (window.confirm(`Are you sure you want to delete "${chat.groupName}"?`)) {
      setIsSaving(true);
      try {
        const chatDocRef = doc(db, 'chats', chat.id);
        const messagesQuery = collection(db, 'chats', chat.id, 'messages');
        const messagesSnapshot = await getDocs(messagesQuery);
        const batch = writeBatch(db);
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        await deleteDoc(chatDocRef);
        alert('Group deleted.');
        onBack();
      } catch (error) {
        console.error("Error deleting group:", error);
        alert('Failed to delete group.');
        setIsSaving(false);
      }
    }
  };

  const isAdmin = currentUser.uid === chat.admin;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button onClick={onBack} className="back-btn">{'< Back'}</button>
        <h2>Group Settings</h2>
      </div>
      <div className="profile-form">
        <div className="form-group">
          <label>Group Name</label>
          <input 
            type="text" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <div className="form-group" style={{width: '100%'}}>
            <label>Current Members ({currentMembers.length})</label>
            <div className="member-list">
            {currentMembers.map(member => (
                <div key={member.uid} className="member-item">
                  <div className="user-avatar" style={{width: '40px', height: '40px'}}>
                    {(member.displayName || member.email).charAt(0).toUpperCase()}
                  </div>
                  <span>{member.displayName || member.email}</span>
                  {isAdmin && currentUser.uid !== member.uid && (
                    <button onClick={() => handleRemoveMember(member.uid)} className="remove-member-btn">Remove</button>
                  )}
                </div>
            ))}
            </div>
        </div>
        {isAdmin && usersToAdd.length > 0 && (
          <div className="form-group" style={{width: '100%'}}>
            <label>Add More Members</label>
            <div className="member-list">
              {usersToAdd.map(user => (
                <div key={user.uid} className="member-item">
                  <input 
                    type="checkbox"
                    id={`add-${user.uid}`}
                    checked={selectedMembers.includes(user.uid)}
                    onChange={() => handleMemberSelect(user.uid)}
                  />
                  <label htmlFor={`add-${user.uid}`} style={{width: '100%'}}>
                    <div className="user-avatar" style={{width: '40px', height: '40px'}}>
                        {(user.displayName || user.email).charAt(0).toUpperCase()}
                    </div>
                    <span>{user.displayName || user.email}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        {isAdmin && (
          <button onClick={handleSaveChanges} disabled={isSaving} className="save-btn">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
        {isAdmin && (
          <button onClick={handleDeleteGroup} disabled={isSaving} className="delete-btn">
            Delete Group
          </button>
        )}
      </div>
    </div>
  );
}

export default GroupSettingsScreen;