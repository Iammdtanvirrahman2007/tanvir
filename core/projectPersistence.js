import { serializeScene } from "./save.js";
import { renderer, camera, controls, grid } from "./scene.js?v=20260811-runtime-fix";

const KEY = "modelforge:project-autosave:v1";
const INTERVAL = 8000;
let sceneRef = null;
let timer = 0;
let dirty = false;

export function initProjectPersistence(scene) {
    sceneRef = scene;
    window.addEventListener("editor:status", markDirty, { passive: true });
    window.addEventListener("editor:selection-change", markDirty, { passive: true });
    window.addEventListener("editor:transform-change", markDirty, { passive: true });
    window.addEventListener("editor:material-applied", markDirty, { passive: true });
    window.addEventListener("editor:material-library-change", markDirty, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveRecovery(); }, { passive: true });
    window.addEventListener("beforeunload", saveRecovery, { passive: true });
    timer = window.setInterval(() => { if (dirty) saveRecovery(); }, INTERVAL);
    return getRecoveryInfo();
}

export function markDirty() { dirty = true; }

export function saveRecovery() {
    if (!sceneRef) return false;
    try {
        const data = serializeScene(sceneRef);
        data.project = { name: "ModelForge Project", savedAt: new Date().toISOString(), version: 1, viewport: captureViewport() };
        localStorage.setItem(KEY, JSON.stringify(data));
        dirty = false;
        window.dispatchEvent(new CustomEvent("editor:autosave", { detail: data.project.savedAt }));
        return true;
    } catch (error) {
        console.warn("ModelForge autosave failed", error);
        return false;
    }
}

export function getRecoveryInfo() {
    try {
        const data = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!data?.project?.savedAt) return null;
        return { savedAt: data.project.savedAt, objectCount: Array.isArray(data.objects) ? data.objects.length : 0 };
    } catch { return null; }
}

export function clearRecovery() { localStorage.removeItem(KEY); }
export function disposeProjectPersistence() { if (timer) clearInterval(timer); timer = 0; }

function captureViewport() {
    return {
        cameraPosition: camera?.position?.toArray?.() || [0, 0, 0],
        target: controls?.target?.toArray?.() || [0, 0, 0],
        gridVisible: !!grid?.visible,
        pixelRatio: renderer?.getPixelRatio?.() || 1
    };
}
