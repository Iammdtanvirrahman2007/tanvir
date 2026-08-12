import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;
let lastSnapshot = "";
let queued = false;

export function initNodeModelFollow() {
    if (initialized || !scene) return;
    initialized = true;
    window.addEventListener("editor:rocket-part-mode", queueSync);
    window.addEventListener("editor:project-opened", queueSync);
    requestAnimationFrame(tick);
}

function tick() {
    // Nodes are children of the model root, so Three.js already moves them
    // with the model. We only persist their current world transform here.
    syncNodeMetadata(false);
    requestAnimationFrame(tick);
}

function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        lastSnapshot = "";
        syncNodeMetadata(true);
    });
}

function syncNodeMetadata(force = false) {
    const raw = scene.userData?.rocketPart;
    const list = raw?.attachmentNodes;
    if (!Array.isArray(list) || !list.length) return;

    const updated = new Map();
    scene.traverse(object => {
        if (!object.userData?.attachmentNode) return;
        const id = object.userData.attachmentNodeId;
        const current = list.find(node => node.id === id);
        if (!current) return;

        object.updateWorldMatrix(true, true);
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        object.getWorldPosition(worldPosition);
        object.getWorldQuaternion(worldQuaternion);
        const euler = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");
        const worldDirection = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(worldQuaternion)
            .normalize();

        updated.set(id, {
            ...current,
            position: worldPosition.toArray(),
            rotation: [
                THREE.MathUtils.radToDeg(euler.x),
                THREE.MathUtils.radToDeg(euler.y),
                THREE.MathUtils.radToDeg(euler.z)
            ],
            direction: worldDirection.toArray()
        });
    });

    if (!updated.size) return;
    const nextList = list.map(node => updated.get(node.id) || node);
    const snapshot = JSON.stringify(nextList);
    if (!force && snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;

    // Do not call updateRocketPart() here. That dispatches rocket-part-change
    // and rebuilds node objects while the model is being transformed, which
    // is what caused nodes to jump back when Rocket Part Mode was reopened.
    raw.attachmentNodes = nextList;
    raw.updatedAt = new Date().toISOString();
}

initNodeModelFollow();
