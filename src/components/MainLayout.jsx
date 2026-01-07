import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // ตรวจสอบ path ให้ถูกต้อง
import Sidebar from "./Sidebar";
import ChatRoom from "./ChatRoom";

const MainLayout = ({ currentUser }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const prevUnreadCount = useRef(0);

  // 1. ตรวจสอบขนาดหน้าจอ (เพื่อปรับ Layout มือถือ/คอม)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 2. ระบบเสียงแจ้งเตือน (Global Sound Notification)
  // ฟังข้อมูลแชททั้งหมด เพื่อดูว่ามีข้อความใหม่ (Unread) เพิ่มขึ้นไหม
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.unreadCount && data.unreadCount[currentUser.uid]) {
          totalUnread += data.unreadCount[currentUser.uid];
        }
      });

      // ถ้าจำนวนที่ยังไม่อ่าน "เพิ่มขึ้น" ให้เล่นเสียง
      if (totalUnread > prevUnreadCount.current) {
        try {
          const audio = new Audio("/notification.mp3");
          audio.play().catch((err) => console.log("Audio play error:", err));
        } catch (e) {
          console.error("Sound error", e);
        }
      }
      prevUnreadCount.current = totalUnread;
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ฟังก์ชันกดปุ่ม Back (สำหรับมือถือ)
  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="main-layout" style={{ overflow: "hidden" }}>
      {/* Style Block พิเศษ:
         บังคับ CSS สำหรับ Layout นี้โดยเฉพาะ เพื่อแก้ปัญหา Sidebar บนมือถือ
         โดยไม่ต้องไปแก้ไฟล์ style.css หลัก
      */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-wrapper {
            width: 100% !important;
            display: ${selectedChat ? "none" : "flex"} !important;
            flex: 1;
          }
          /* บังคับให้ Sidebar ภายในยืดเต็มจอ */
          .sidebar-wrapper .sidebar {
            width: 100% !important;
            min-width: 0 !important;
            border-right: none !important;
          }
          .chat-window-wrapper {
            width: 100% !important;
            display: ${selectedChat ? "flex" : "none"} !important;
            flex: 1;
            height: 100%;
          }
        }
      `}</style>

      {/* --- ส่วน Sidebar (ด้านซ้าย) --- */}
      <div className="sidebar-wrapper">
        <Sidebar setSelectedChat={setSelectedChat} />
      </div>

      {/* --- ส่วน Chat Room (ด้านขวา) --- */}
      <div className="chat-window-wrapper chat-window">
        {selectedChat ? (
          <ChatRoom
            currentUser={currentUser}
            data={selectedChat} // ส่งข้อมูลห้องแชทไป
            chat={selectedChat} // เผื่อ ChatRoom ใช้ชื่อ prop นี้
            onBack={handleBack}
          />
        ) : (
          <div className="welcome-screen">
            <h2>ยินดีต้อนรับสู่ Sonthana</h2>
            <p>เลือกแชทเพื่อเริ่มการสนทนา</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;