import { useState } from 'react';
import { db, storage, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function ProfileScreen({ currentUser, onBack }) {
  const [displayName, setDisplayName] = useState(currentUser.displayName || currentUser.email.split('@')[0]);
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentUser.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      
      // ตรวจสอบขนาดไฟล์ (จำกัดที่ 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('ขนาดไฟล์ต้องไม่เกิน 2MB');
        return;
      }
      
      setProfileImage(file);
      
      // สร้าง preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      alert('กรุณาใส่ชื่อแสดง');
      return;
    }

    setIsUploading(true);
    try {
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
        displayName: displayName.trim(),
        photoURL: newPhotoURL,
      });
      
      alert('อัปเดตโปรไฟล์สำเร็จ!');
      onBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์');
    } finally {
      setIsUploading(false);
    }
  };

  const getAvatarUrl = () => {
    if (previewUrl) return previewUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName.charAt(0))}&size=256&background=667eea&color=fff&bold=true`;
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button onClick={onBack} className="back-btn">{'< Back'}</button>
        <h2>แก้ไขโปรไฟล์</h2>
      </div>
      
      <div className="profile-form">
        <div className="avatar-preview">
          <img src={getAvatarUrl()} alt="Profile" />
          <label htmlFor="profile-image-upload" className="avatar-upload-btn">
            📷
          </label>
        </div>
        
        <input 
          type="file" 
          id="profile-image-upload"
          accept="image/*" 
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
        
        <div className="form-group">
          <label>ชื่อแสดง</label>
          <input 
            type="text" 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ใส่ชื่อของคุณ"
            maxLength={50}
          />
        </div>
        
        <div className="form-group">
          <label>อีเมล</label>
          <input 
            type="email" 
            value={currentUser.email}
            disabled
            className="disabled-input"
          />
        </div>
        
        <button 
          onClick={handleSaveProfile} 
          disabled={isUploading}
          className="save-btn"
        >
          {isUploading && <span className="loading-spinner"></span>}
          {isUploading ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
        </button>
      </div>
    </div>
  );
}

export default ProfileScreen;