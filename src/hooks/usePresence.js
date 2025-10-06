import { useEffect } from 'react';
import { rtdb } from '../firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';

export function usePresence(uid) {
  useEffect(() => {
    if (!uid) return;

    const userStatusDatabaseRef = ref(rtdb, '/status/' + uid);

    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };
    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };

    const connectedRef = ref(rtdb, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) {
        // ถ้า mất kết nối tạm thời, không làm gì cả
        return;
      }

      // เมื่อ user ตัดการเชื่อมต่อ (ปิดแท็บ/เน็ตหลุด)
      // ให้ Realtime Database อัปเดตสถานะเป็น 'offline' อัตโนมัติ
      onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
        // เมื่อ user เชื่อมต่อ
        // ให้อัปเดตสถานะเป็น 'online'
        set(userStatusDatabaseRef, isOnlineForDatabase);
      });
    });

    return () => unsubscribe();
  }, [uid]);
}