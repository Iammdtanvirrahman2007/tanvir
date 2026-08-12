(() => {
  const register = () => {
    if ('serviceWorker' in navigator) {
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
    }
    import('./rocket/nodeModelFollow.js?v=20260812-node-follow-3')
      .catch(error => console.warn('ModelForge node follow failed:', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
