import * as THREE from "three";
import { scene as sceneRef } from "../core/scene.js";

let initialized = false;
const arrows = new Map();
const UP = new THREE.Vector3(0, 1, 0);

export function initNodeVectorRenderer(sceneOverride = null) {
    const scene = sceneOverride || sceneRef;
    if (initialized || !scene) return false;
    initialized = true;
    tick(scene);
    return true;
}

function tick(scene) {
    sync(scene);
    requestAnimationFrame(() => tick(scene));
}

function sync(scene) {
    const visible = window.__modelForgeNodesVisible !== false;
    const wanted = new Set();

    scene.traverse(node => {
        // নিশ্চিত করুন আপনার নোডে এই userData গুলোর যেকোনো একটি সঠিকভাবে সেট করা আছে
        if (!node.userData?.attachmentNode && !node.userData?.attachmentNodeId) return;
        
        const id = node.userData.attachmentNodeId || node.uuid;
        wanted.add(id);

        let arrow = arrows.get(id);
        if (!arrow) {
            arrow = createArrow(node.name || "Node");
            scene.add(arrow);
            arrows.set(id, arrow);
        }

        node.updateWorldMatrix(true, true);
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        node.getWorldPosition(position);
        node.getWorldQuaternion(quaternion);

        const direction = UP.clone().applyQuaternion(quaternion).normalize();
        arrow.position.copy(position);
        arrow.quaternion.setFromUnitVectors(UP, direction);
        arrow.visible = visible;

        arrow.traverse(part => {
            part.visible = visible;
            part.renderOrder = 9999; // রেন্ডার অর্ডার বাড়িয়ে দেওয়া হয়েছে যাতে সবার উপরে থাকে
            part.frustumCulled = false;
        });

        arrow.updateMatrixWorld(true);
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
    group.renderOrder = 9999;
    group.frustumCulled = false;

    // কমন ম্যাটেরিয়াল যা ডেপথ টেস্ট বাইপাস করবে
    const material = new THREE.MeshBasicMaterial({
        color: 0x67d4ff,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
    });

    const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.62, 12),
        material
    );
    shaft.position.y = 0.31;
    shaft.renderOrder = 9999;

    const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.095, 0.24, 12),
        material
    );
    head.position.y = 0.74;
    head.renderOrder = 9999;

    group.add(shaft, head);
    return group;
}

function dispose(object) {
    object.traverse(part => {
        part.geometry?.dispose?.();
        if (Array.isArray(part.material)) {
            part.material.forEach(material => material?.dispose?.());
        } else {
            part.material?.dispose?.();
        }
    });
}
