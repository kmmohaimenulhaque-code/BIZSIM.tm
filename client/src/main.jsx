import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/app.css';
import './lib/jobHandlers.js';
import App from './App.jsx';
import { pairFromUrl } from './lib/api.js';
import { refreshStatus } from './lib/useStatus.js';
import { toast } from './components/ui.jsx';
import { initNative } from './lib/native.js';
import { initNotifications } from './lib/notify.js';

// Opened from a desktop pairing QR in a phone browser (#pair=CODE.SECRET):
// complete the pairing, then remove the secret from the address bar.
if (/[#&]pair=/.test(location.hash)) {
  const link = location.href;
  history.replaceState(null, '', location.pathname + location.search);
  pairFromUrl(link)
    .then(() => {
      refreshStatus();
      toast('Connected to your computer');
    })
    .catch((e) => toast(e.message, 'error'));
}

initNative();
initNotifications().catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support and installability (PWA). Not used inside native shells.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http') && !window.Capacitor) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
