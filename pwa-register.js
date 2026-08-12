(() => {
  const register = () => {
    if (!('serviceWorker' in navigator)) return;

    const swUrl = '/tanvir/sw.js';
    const scope = '/tanvir/';

    navigator.serviceWorker.register(swUrl, { scope, updateViaCache: 'none' })
      .then(registration => {
        registration.update().catch(() => {});
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(error => console.warn('ModelForge PWA registration failed:', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
