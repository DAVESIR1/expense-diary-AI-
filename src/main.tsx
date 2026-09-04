import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for browser WebAPK / PWA only; never intercept native assets in Capacitor
if ('serviceWorker' in navigator) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
        console.log('ServiceWorker registered with scope:', reg.scope);
      }).catch((err) => {
        console.log('SW registration error:', err);
      });
    });
  }
}

