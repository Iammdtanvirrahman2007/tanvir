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

    // Node follow is intentionally NOT started here. Nodes are children of
    // their model, so Three.js already keeps them attached during normal
    // object transforms. A per-frame metadata sync would rebuild node objects
    // while dragging and make Node Mode impossible to transform reliably.

    import('./rocket/nodeVectorRenderer.js?v=20260812-node-vector-render-4')
      .then(module => {
        const start = () => {
          try { module.initNodeVectorRenderer(); }
          catch (error) { console.warn('ModelForge node vector renderer failed:', error); }
        };
        requestAnimationFrame(() => requestAnimationFrame(start));
      })
      .catch(error => console.warn('ModelForge node vector renderer load failed:', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
