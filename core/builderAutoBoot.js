import { scene, renderer, camera, controls } from "./scene.js?v=20260811-runtime-fix";

let started = false;
let attempts = 0;

function start() {
    if (started) return;
    if (!scene || !renderer || !camera) {
        if (attempts++ < 240) requestAnimationFrame(start);
        return;
    }
    started = true;
    import("./builderTools.js?v=20260908-builder-1")
        .then(({ initBuilderTools }) => initBuilderTools({ scene, renderer, camera, controls }))
        .catch(error => {
            console.error("ModelForge 3D Builder boot failed", error);
            started = false;
        });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
