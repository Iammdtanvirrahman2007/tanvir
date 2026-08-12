import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;
let vectorRoot = null;
const arrows = new Map();
let raf = 0;

export function initNodeVectorRestore() {
    if (initialized || !scene) return;
    initialized = true;

    vectorRoot = new THREE.Group();
    vectorRoot.name = "__editorNodeVectors";
    vectorRoot.userData = { editorOnly: true, nodeVectorOverlay: true };
    scene.add(vectorRoot);

    window.addEventListener("editor:rocket-part-mode", scheduleRefresh);
    window.addEventListener("editor:rocket-node-change", scheduleRefresh);
    window.addEventListener("editor:node-visibility", scheduleRefresh);
    window.addEventListener("editor:attachment-node-mode", scheduleRefresh);
    window.addEventListener("editor:selection-change", scheduleRefresh);

    scheduleRefresh();
}

function scheduleRefresh() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refresh);
}

function refresh() {
    if (!vectorRoot) return;
    const visible = window.__modelForgeNodesVisible !== false;
    vectorRoot.visible = visible;

    const liveIds = new Set();
    scene.traverse(node => {
        if (!node.userData?.attachmentNode) return;
        const id = node.userData.attachmentNodeId;
        if (!id) return;
        liveIds.add(id);

        let arrow = arrows.get(id);
        if (!arrow) {
            arrow = new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0),
                0.9,
                0x67d4ff,
                0.24,
                0.12
            );
            arrow.name = `${node.name || "Node"} Vector`;
            arrow.userData = {
                editorOnly: true,
                attachmentNodeVectorArrow: true,
                attachmentNodeId: id,
                selectable: false
            };
            arrow.line?.material && Object.assign(arrow.line.material, { depthTest: false, depthWrite: false });
            arrow.cone?.material && Object.assign(arrow.cone.material, { depthTest: false, depthWrite: false });
            arrow.line && (arrow.line.frustumCulled = false);
            arrow.cone && (arrow.cone.frustumCulled = false);
            vectorRoot.add(arrow);
            arrows.set(id, arrow);
        }

        node.updateWorldMatrix(true, false);
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        node.getWorldPosition(worldPosition);
        node.getWorldQuaternion(worldQuaternion);
        const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuaternion).normalize();

        arrow.position.copy(worldPosition);
        arrow.setDirection(direction);
        arrow.setLength(0.9, 0.24, 0.12);
        arrow.visible = visible;
        arrow.renderOrder = 5000;
        arrow.line && (arrow.line.renderOrder = 5000, arrow.line.frustumCulled = false);
        arrow.cone && (arrow.cone.renderOrder = 5000, arrow.cone.frustumCulled = false);

        const selected = window.__modelForgeNodeEditMode === true && id === window.__modelForgeActiveNodeId;
        const color = selected ? 0xffc857 : 0x67d4ff;
        arrow.line?.material?.color?.setHex(color);
        arrow.cone?.material?.color?.setHex(color);
    });

    for (const [id, arrow] of arrows) {
        if (liveIds.has(id)) continue;
        arrow.removeFromParent();
        arrows.delete(id);
    }

    vectorRoot.updateMatrixWorld(true);
}

initNodeVectorRestore();
