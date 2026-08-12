import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;
const arrows = new Map();

const UP = new THREE.Vector3(0, 1, 0);

export function initNodeVectorRenderer() {
    if (initialized || !scene) return;
    initialized = true;
    tick();
}

function tick() {
    sync();
    requestAnimationFrame(tick);
}

function sync() {
    const visible = window.__modelForgeNodesVisible !== false;
    const wanted = new Set();

    scene.traverse(node => {
        if (!node.userData?.attachmentNode) return;

        const id = node.userData.attachmentNodeId;
        if (!id) return;
        wanted.add(id);

        let arrow = arrows.get(id);
        if (!arrow) {
            arrow = createArrow(node.name || "Node");
            scene.add(arrow);
            arrows.set(id, arrow);
        }

        node.updateWorldMatrix(true, false);

        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        node.getWorldPosition(position);
        node.getWorldQuaternion(quaternion);

        const direction = UP.clone().applyQuaternion(quaternion).normalize();
        arrow.position.copy(position);
        arrow.quaternion.setFromUnitVectors(UP, direction);
        arrow.visible = visible;

        const active = window.__modelForgeNodeEditMode === true && id === window.__modelForgeActiveNodeId;
        const color = active ? 0xffc857 : 0x67d4ff;
        arrow.userData.arrowColor = color;
        arrow.traverse(part => {
            if (part.material?.color) part.material.color.setHex(color);
            part.visible = visible;
        });
    });

    for (const [id, arrow] of arrows) {
        if (wanted.has(id)) continue;
        arrow.removeFromParent();
        dispose(arrow);
        arrows.delete(id);
    }
}

function createArrow(name) {
    const group = new THREE.Group();
    group.name = `${name} Vector Arrow`;
    group.userData = { editorOnly: true, attachmentNodeVectorArrow: true };
    group.renderOrder = 5000;

    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.58, 10),
        new THREE.MeshBasicMaterial({
            color: 0x67d4ff,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        })
    );
    shaft.position.y = 0.29;
    shaft.renderOrder = 5000;

    const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.085, 0.22, 12),
        new THREE.MeshBasicMaterial({
            color: 0x67d4ff,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        })
    );
    head.position.y = 0.69;
    head.renderOrder = 5000;

    group.add(shaft, head);
    group.frustumCulled = false;
    return group;
}

function dispose(object) {
    object.traverse(part => {
        part.geometry?.dispose?.();
        part.material?.dispose?.();
    });
}

initNodeVectorRenderer();
