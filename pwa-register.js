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

    import('./rocket/nodeVectorRenderer.js?v=20260812-node-vector-render-4')
      .then(module => {
        const start = () => {
          try { module.initNodeVectorRenderer(); }
          catch (error) { console.warn('ModelForge node vector renderer failed:', error); }
        };
        requestAnimationFrame(() => requestAnimationFrame(start));
      })
      .catch(error => console.warn('ModelForge node vector renderer load failed:', error));

    import('./core/voxel/editor.js?v=20260818-voxel-ui-1')
      .then(async ({ initVoxelEditor }) => {
        const { scene, renderer, camera, controls } = await import('./core/scene.js?v=20260811-runtime-fix');
        const start = () => {
          if (window.__modelForgeVoxelEditor) return;
          try {
            window.__modelForgeVoxelEditor = initVoxelEditor({ scene, renderer, camera, controls });
          } catch (error) {
            console.warn('ModelForge voxel editor failed:', error);
          }
        };
        requestAnimationFrame(() => requestAnimationFrame(start));
        requestAnimationFrame(() => requestAnimationFrame(() => import('./core/voxel/voxelTransformsUI.js?v=20260818-vtx-1').then(module => module.initVoxelTransformUI()).catch(error => console.warn('ModelForge voxel transform UI failed:', error))));
      })
      .catch(error => console.warn('ModelForge voxel editor load failed:', error));

    import('./core/voxel/previewController.js?v=20260818-voxel-opt-1')
      .then(module => {
        try {
          window.__modelForgeVoxelPreview = module.initVoxelPreviewController();
        } catch (error) {
          console.warn('ModelForge voxel preview controller failed:', error);
        }
      })
      .catch(error => console.warn('ModelForge voxel preview controller load failed:', error));

    import('./core/productionAssetUI.js?v=20260818-production-asset-1')
      .then(async module => {
        try {
          const { scene } = await import('./core/scene.js?v=20260811-runtime-fix');
          module.initProductionAssetUI(scene);
        } catch (error) {
          console.warn('ModelForge production asset UI failed:', error);
        }
      })
      .catch(error => console.warn('ModelForge production asset UI load failed:', error));

    Promise.all([
      import('./core/aiAssistant.js?v=20260817-ai-1'),
      import('./core/selection.js'),
      import('./core/objectManager.js'),
      import('./core/transform.js?v=20260812-transform-axis-fix-4')
    ]).then(([ai, selection, objectManager, transform]) => {
      const toTransform = object => object ? {
        name: object.name,
        type: object.type,
        position: object.position?.toArray?.() ?? null,
        rotation: object.rotation?.toArray?.() ?? null,
        scale: object.scale?.toArray?.() ?? null
      } : null;
      ai.initAIAssistant({
        getSceneContext: () => {
          const objects = objectManager.getObjects();
          const selected = selection.getSelected();
          return {
            transformSpace: transform.getTransformSpace(),
            selected: toTransform(selected),
            objectCount: objects.length,
            objects: objects.map(toTransform)
          };
        }
      });
    }).catch(error => console.warn('ModelForge AI assistant load failed:', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
