import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'shopfloor-offline';
const PENDING_STORE = 'pending_actions';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function usePendingCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(PENDING_STORE, 'readonly');
      const req = tx.objectStore(PENDING_STORE).count();
      req.onsuccess = () => setCount(req.result);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return { count, refresh };
}

export async function queueAction({ url, method = 'POST', headers = {}, body }) {
  try {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).add({ url, method, headers, body, queuedAt: new Date().toISOString() });
    // Request background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const sw = await navigator.serviceWorker.ready;
      await sw.sync.register('sync-pending');
    }
  } catch (e) {
    console.error('Queue action failed:', e);
  }
}
