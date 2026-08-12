import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;

export function initNodeVectorRestore() {
    if (initialized || !scene) return;
    initialized = true;
    refresh();
    window.addEventListener("editor:rocket-part-mode", refresh);
    window.addEventListener("editor:rocket-node-change", refresh);
    window.addEventListener("editor:node-visibility", refresh);
    requestAnimationFrame(refresh);
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
                0.8,
                0x67d4ff,
                0.22,
                0.11
            );
            arrow.name = `${object.name || "Node"} Vector`;
            arrow.userData = {
                attachmentNodeVectorArrow: true,
                attachmentNodeId: object.userData.attachmentNodeId,
                editorOnly: true,
                selectable: false
            };
            arrow.frustumCulled = false;
            arrow.renderOrder = 1301;
            if (arrow.line?.material) {
                arrow.line.material.depthTest = false;
                arrow.line.material.depthWrite = false;
                arrow.line.material.transparent = true;
                arrow.line.material.opacity = 1;
            }
            if (arrow.cone?.material) {
                arrow.cone.material.depthTest = false;
                arrow.cone.material.depthWrite = false;
                arrow.cone.material.transparent = true;
                arrow.cone.material.opacity = 1;
            }
            object.add(arrow);
        }

        const node = nodes.find(entry => entry.id === object.userData.attachmentNodeId);
        const direction = normalizeDirection(node?.direction || [0, 1, 0]);
        arrow.setDirection(new THREE.Vector3(...direction));
        arrow.position.set(0, 0, 0);
        arrow.visible = visible;

        const active = window.__modelForgeNodeEditMode === true && object.userData?.selected === true;
        const hex = active ? 0xffc857 : 0x67d4ff;
        arrow.line?.material?.color?.setHex(hex);
        arrow.cone?.material?.color?.setHex(hex);
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
