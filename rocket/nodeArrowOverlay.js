import * as THREE from "three";

let sceneRef = null;
let initialized = false;

export function initNodeArrowOverlay(scene) {
    sceneRef = scene;
    if (!sceneRef || initialized) return;
    initialized = true;

    rebuildNodeArrows();

    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) rebuildNodeArrows();
    });

    window.addEventListener("editor:rocket-node-change", () => {
        requestAnimationFrame(rebuildNodeArrows);
    });

    window.addEventListener("editor:selection-change", () => {
        requestAnimationFrame(refreshArrowAppearance);
    });
}

function rebuildNodeArrows() {
    if (!sceneRef) return;

    sceneRef.traverse(object => {
        if (!object.userData?.attachmentNode) return;

        const existing = object.children.filter(child => child.userData?.attachmentNodeArrowOverlay);
        for (const child of existing) {
            object.remove(child);
            child.traverse(node => {
                node.geometry?.dispose?.();
                if (Array.isArray(node.material)) node.material.forEach(material => material?.dispose?.());
                else node.material?.dispose?.();
            });
        }

        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            0.7,
            0x67d4ff,
            0.18,
            0.10
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
        arrow.line?.material && (arrow.line.material.depthTest = false, arrow.line.material.depthWrite = false);
        arrow.cone?.material && (arrow.cone.material.depthTest = false, arrow.cone.material.depthWrite = false);
        object.add(arrow);
    });

    refreshArrowAppearance();
}

function refreshArrowAppearance() {
    if (!sceneRef) return;
    const nodeMode = window.__modelForgeNodeEditMode === true;
    const activeId = findActiveNodeId();

    sceneRef.traverse(object => {
        if (!object.userData?.attachmentNodeArrowOverlay) return;
        const parent = object.parent;
        const active = nodeMode && parent?.userData?.attachmentNodeId === activeId;
        const color = active ? 0xffc857 : 0x67d4ff;
        object.line?.material?.color?.setHex(color);
        object.cone?.material?.color?.setHex(color);
        object.visible = nodeMode;
    });
}

function findActiveNodeId() {
    let active = null;
    sceneRef?.traverse(object => {
        if (object.userData?.attachmentNode && object.userData?.selected) {
            active = object.userData.attachmentNodeId;
        }
    });
    return active;
}
