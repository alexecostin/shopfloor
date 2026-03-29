const CACHE_NAME = 'shopfloor-v1';
const STATIC_ASSETS = ['/', '/index.html'];
const DB_NAME = 'shopfloor-offline';
const PENDING_STORE = 'pending_actions';

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request.clone())
        .then((resp) => {
          if (resp.ok && e.request.method === 'GET') {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-pending') {
    e.waitUntil(syncPending());
  }
});

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

async function syncPending() {
  const db = await openDB();
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_STORE);
  const all = await new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });

  let synced = 0;
  for (const item of all) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (resp.ok) {
        const delTx = db.transaction(PENDING_STORE, 'readwrite');
        delTx.objectStore(PENDING_STORE).delete(item.id);
        synced++;
      }
    } catch (_) {
      // Will retry next sync
    }
  }

  if (synced > 0) {
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'SYNC_DONE', count: synced }));
    });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', async (e) => {
  if (e.data?.type === 'QUEUE_ACTION') {
    const db = await openDB();
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).add(e.data.payload);
  }
});
