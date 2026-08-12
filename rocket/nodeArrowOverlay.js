import * as THREE from "three";
import { scene } from "../core/scene.js?v=20260811-runtime-fix";

let initialized = false;

function initNodeArrowOverlay(sceneRef) {
    if (!sceneRef || initialized) return;
    initialized = true;
    rebuildNodeArrows(sceneRef);
    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) rebuildNodeArrows(sceneRef);
    });
    window.addEventListener("editor:rocket-node-change", () => {
        requestAnimationFrame(() => rebuildNodeArrows(sceneRef));
    });
    window.addEventListener("editor:attachment-node-mode", () => {
        requestAnimationFrame(() => refreshArrowAppearance(sceneRef));
    });
}

function rebuildNodeArrows(sceneRef) {
    sceneRef.traverse(object => {
        if (!object.userData?.attachmentNode) return;
        object.children.filter(child => child.userData?.attachmentNodeArrowOverlay).forEach(child => {
            object.remove(child);
            child.traverse(node => {
                node.geometry?.dispose?.();
                if (Array.isArray(node.material)) node.material.forEach(material => material?.dispose?.());
                else node.material?.dispose?.();
            });
        });
        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            0.7,
            0x67d4ff,
            0.18,
            0.1
        );
        arrow.name = `${object.name || "Node"} Vector`;
        arrow.userData = {
            attachmentNodeArrowOverlay: true,
            attachmentNodeArrow: true,
            attachmentNodeId: object.userData.attachmentNodeId,
            editorOnly: true,
            selectable: false
        };
        arrow.renderOrder = 1400;
        if (arrow.line?.material) {
            arrow.line.material.depthTest = false;
            arrow.line.material.depthWrite = false;
        }
        if (arrow.cone?.material) {
            arrow.cone.material.depthTest = false;
            arrow.cone.material.depthWrite = false;
        }
        object.add(arrow);
    });
    refreshArrowAppearance(sceneRef);
}

function refreshArrowAppearance(sceneRef) {
    const visible = window.__modelForgeNodeEditMode === true;
    sceneRef.traverse(object => {
        if (!object.userData?.attachmentNodeArrowOverlay) return;
        object.visible = visible;
        object.line?.material?.color?.setHex(0x67d4ff);
        object.cone?.material?.color?.setHex(0x67d4ff);
    });
}

initNodeArrowOverlay(scene);
