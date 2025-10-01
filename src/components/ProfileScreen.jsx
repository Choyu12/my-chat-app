import { useState } from 'react';
import { db, storage, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function ProfileScreen({ currentUser, onBack }) {
  const [displayName, setDisplayName] = useState(currentUser.displayName || currentUser.email.split('@')[0]);
  const [profileImage, setProfileImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      setProfileImage(e.target.files[0]);
    }
  };

  const handleSaveProfile = async () => {
    setIsUploading(true);
    const userDocRef = doc(db, 'users', currentUser.uid);

    let newPhotoURL = currentUser.photoURL;

    // 1. อัปโหลดรูปใหม่ (ถ้ามี)
    if (profileImage) {
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
      await uploadBytes(storageRef, profileImage);
      newPhotoURL = await getDownloadURL(storageRef);
    }

    // 2. อัปเดตข้อมูลใน Firestore
    await updateDoc(userDocRef, {
      displayName: displayName,
      photoURL: newPhotoURL,
    });
    
    setIsUploading(false);
    alert('Profile updated successfully!');
    onBack(); // กลับไปหน้า Home
  };

  return (
    <div className="profile-container">
      <button onClick={onBack} className="back-btn">{'< Back'}</button>
      <h2>Edit Profile</h2>
      <div className="profile-form">
        <div className="avatar-preview">
          <img src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&size=128`} alt="Profile" />
        </div>
        <input type="file" accept="image/*" onChange={handleImageChange} />
        <input 
          type="text" 
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Enter your display name"
        />
        <button onClick={handleSaveProfile} disabled={isUploading}>
          {isUploading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

export default ProfileScreen;