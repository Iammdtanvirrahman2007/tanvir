import { scene, renderer, camera, controls } from "./scene.js?v=20260811-runtime-fix";

let started = false;
let attempts = 0;

function boot() {
    if (started) return;
    if (!scene || !renderer || !camera) {
        if (attempts++ < 240) requestAnimationFrame(boot);
        return;
    }
    started = true;
    import("./meshEdit.js?v=20260908-mesh-edit-1")
        .then(({ initMeshEditMode }) => initMeshEditMode({ scene, renderer, camera, controls }))
        .catch(error => console.error("ModelForge mesh edit failed", error));
}

requestAnimationFrame(boot);
