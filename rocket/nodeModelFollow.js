import * as THREE from "three";
import { scene } from "../core/scene.js";
import { readRocketPart, updateRocketPart } from "./rocketPart.js";

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
    syncNodeMetadata();
    requestAnimationFrame(tick);
}

function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
        queued = false;
        lastSnapshot = "";
        syncNodeMetadata();
    });
}

function syncNodeMetadata() {
    const part = readRocketPart(scene);
    const list = part?.attachmentNodes;
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
        const localDirection = new THREE.Vector3(0, 1, 0)
            .applyQuaternion(object.quaternion)
            .normalize();

        updated.set(id, {
            ...current,
            position: worldPosition.toArray(),
            rotation: [
                THREE.MathUtils.radToDeg(euler.x),
                THREE.MathUtils.radToDeg(euler.y),
                THREE.MathUtils.radToDeg(euler.z)
            ],
            direction: localDirection.toArray()
        });
    });

    if (!updated.size) return;
    const nextList = list.map(node => updated.get(node.id) || node);
    const snapshot = JSON.stringify(nextList);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    updateRocketPart(scene, { attachmentNodes: nextList });
}

initNodeModelFollow();
