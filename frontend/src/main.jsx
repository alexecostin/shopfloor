import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('SW registered:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New SW available');
            }
          });
        });
      })
      .catch((err) => console.warn('SW registration failed:', err));

    // Listen for sync messages
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'SYNC_DONE') {
        const event = new CustomEvent('sw-sync-done', { detail: { count: e.data.count } });
        window.dispatchEvent(event);
      }
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
