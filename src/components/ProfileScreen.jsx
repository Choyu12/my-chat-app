import { useState, useEffect } from 'react';
import { db, auth } from '../firebase'; // [แก้ไข] ไม่ต้อง import storage แล้ว
import { doc, updateDoc, getDoc } from 'firebase/firestore';

function ProfileScreen({ currentUser, onBack }) {
  // [เพิ่ม] State สำหรับเก็บข้อมูล user ล่าสุด
  const [userData, setUserData] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // [เพิ่ม] ดึงข้อมูลโปรไฟล์ล่าสุดจาก Firestore ตอนเปิดหน้า
  useEffect(() => {
    const fetchUserData = async () => {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setDisplayName(data.displayName || '');
        setPreviewUrl(data.photoURL || '');
      }
    };
    fetchUserData();
  }, [currentUser.uid]);
  
  // [แก้ไข] ฟังก์ชันจัดการการเปลี่ยนรูป
  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 2 * 1024 * 1024) { // จำกัดขนาดไฟล์ที่ 2MB
        alert('ขนาดไฟล์ต้องไม่เกิน 2MB');
        return;
      }
      
      // แปลงไฟล์รูปเป็น Base64 เพื่อใช้แสดงผลและบันทึก
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // VVVVVVVV [แก้ไขฟังก์ชันนี้ทั้งหมด] VVVVVVVV
  // [ส่วนการทำงาน] ฟังก์ชันบันทึกโปรไฟล์ (ใช้ Base64)
  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      alert('กรุณาใส่ชื่อแสดง');
      return;
    }

    setIsSaving(true);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);

      // บันทึกชื่อที่แสดงและ URL รูป (ซึ่งเป็น Base64 string) ลง Firestore
      await updateDoc(userDocRef, {
        displayName: displayName.trim(),
        photoURL: previewUrl,
      });
      
      alert('อัปเดตโปรไฟล์สำเร็จ!');
      onBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์');
    } finally {
      setIsSaving(false);
    }
  };
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  const getAvatarUrl = () => {
    if (previewUrl) return previewUrl;
    if (userData?.photoURL) return userData.photoURL;
    // รูปโปรไฟล์สำรองกรณีไม่มีรูป
    return `https://ui-avatars.com/api/?name=${encodeURIComponent((displayName || 'A').charAt(0))}&size=256&background=667eea&color=fff&bold=true`;
  };

  if (!userData) {
    return <div>Loading...</div>; // แสดงหน้า loading ขณะดึงข้อมูล
  }

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
          disabled={isSaving}
          className="save-btn"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
        </button>
      </div>
    </div>
  );
}

export default ProfileScreen;