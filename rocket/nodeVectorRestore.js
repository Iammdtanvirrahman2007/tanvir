import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;

export function initNodeVectorRestore() {
    if (initialized || !scene) return;
    initialized = true;
    refresh();
    window.addEventListener("editor:rocket-part-mode", scheduleRefresh);
    window.addEventListener("editor:rocket-node-change", scheduleRefresh);
    window.addEventListener("editor:node-visibility", scheduleRefresh);
    window.addEventListener("editor:attachment-node-mode", scheduleRefresh);
    requestAnimationFrame(refresh);
}

let raf = 0;
function scheduleRefresh() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(refresh);
}

function refresh() {
    const visible = window.__modelForgeNodesVisible !== false;
    const metadata = scene.userData?.rocketPart;
    const nodes = Array.isArray(metadata?.attachmentNodes) ? metadata.attachmentNodes : [];

    scene.traverse(object => {
        if (!object.userData?.attachmentNode) return;

        let arrow = object.children.find(child => child.userData?.attachmentNodeVectorArrow);
        if (!arrow) {
            arrow = new THREE.ArrowHelper(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(0, 0, 0),
                0.9,
                0x67d4ff,
                0.24,
                0.12
            );
            arrow.name = `${object.name || "Node"} Vector`;
            arrow.userData = {
                attachmentNodeVectorArrow: true,
                attachmentNodeId: object.userData.attachmentNodeId,
                editorOnly: true,
                selectable: false
            };
            arrow.frustumCulled = false;
            arrow.renderOrder = 5000;
            arrow.position.set(0, 0, 0);
            object.add(arrow);
        }

        const node = nodes.find(entry => entry.id === object.userData.attachmentNodeId);
        const direction = normalizeDirection(node?.direction || [0, 1, 0]);
        arrow.setDirection(new THREE.Vector3(...direction));
        arrow.setLength(0.9, 0.24, 0.12);
        arrow.position.set(0, 0, 0);
        arrow.visible = visible;
        arrow.traverse(part => {
            part.visible = visible;
            part.frustumCulled = false;
            part.renderOrder = 5000;
            if (part.isLine || part.isMesh) {
                const material = part.material;
                if (material) {
                    material.depthTest = false;
                    material.depthWrite = false;
                    material.transparent = false;
                    material.opacity = 1;
                    material.color?.setHex(window.__modelForgeNodeEditMode && object.userData?.attachmentNodeId === window.__modelForgeActiveNodeId ? 0xffc857 : 0x67d4ff);
                }
            }
        });
        object.updateMatrixWorld(true);
    });
}

function normalizeDirection(value) {
    const x = Number(value?.[0] ?? 0);
    const y = Number(value?.[1] ?? 1);
    const z = Number(value?.[2] ?? 0);
    const length = Math.hypot(x, y, z);
    return length > 1e-8 ? [x / length, y / length, z / length] : [0, 1, 0];
}

initNodeVectorRestore();