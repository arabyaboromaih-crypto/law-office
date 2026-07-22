import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// اعتراض روابط البلوب وحفظ كائن الملف الحقيقي لتمريره بأمان وبسرعة مذهلة إلى عارض ملفات PDF المستقل في التبويب الجديد
const originalCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = function (obj: any) {
  const url = originalCreateObjectURL(obj);
  if (!(window as any).activePdfBlobs) {
    (window as any).activePdfBlobs = {};
  }
  (window as any).activePdfBlobs[url] = obj;

  if (obj instanceof Blob) {
    try {
      const dbRequest = indexedDB.open('PdfViewerDBV2', 1);
      dbRequest.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('pdfBlobs')) {
          db.createObjectStore('pdfBlobs');
        }
      };
      dbRequest.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('pdfBlobs', 'readwrite');
          const store = tx.objectStore('pdfBlobs');
          store.put(obj, url);
        } catch (err) {
          console.error('Failed to store blob in IndexedDB:', err);
        }
      };
    } catch (dbErr) {
      console.error('IndexedDB open error in createObjectURL:', dbErr);
    }
  }

  return url;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// تسجيل ملف الـ Service Worker لتمكين تثبيت التطبيق كـ PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // In dev, the service worker is served at /dev-sw.js by vite-plugin-pwa, 
    // but in production it is at /sw.js. We can register dynamically or standard sw.js.
    const swUrl = (import.meta as any).env?.DEV ? '/dev-sw.js?dev-fallback' : '/sw.js';
    navigator.serviceWorker.register(swUrl, { type: (import.meta as any).env?.DEV ? 'module' : 'classic' })
      .then((reg) => {
        console.log('Service Worker registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  });
}

