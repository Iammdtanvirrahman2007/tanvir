import * as THREE from "three";
import { scene } from "../core/scene.js";

let initialized = false;
let previousModelMatrix = null;
let previousModelUuid = null;
let applying = false;

export function initNodeModelFollow() {
    if (initialized || !scene) return;
    initialized = true;
    resetBaseline();
    window.addEventListener("editor:rocket-part-mode", resetBaseline);
    window.addEventListener("editor:project-opened", resetBaseline);
    window.addEventListener("editor:selection-change", () => requestAnimationFrame(resetBaseline));
    requestAnimationFrame(tick);
}

function tick() {
    try {
        const model = getModelRoot();
        if (!model) {
            previousModelMatrix = null;
            previousModelUuid = null;
        } else {
            model.updateWorldMatrix(true, true);
            const current = model.matrixWorld.clone();
            if (!previousModelMatrix || previousModelUuid !== model.uuid) {
                previousModelMatrix = current;
                previousModelUuid = model.uuid;
            } else if (!matricesEqual(current, previousModelMatrix) && !applying) {
                const delta = current.clone().multiply(previousModelMatrix.clone().invert());
                moveNodesByModelDelta(delta);
                previousModelMatrix = current;
            }
        }
    } catch (error) {
        console.warn("ModelForge node follow failed:", error);
    }
    requestAnimationFrame(tick);
}

function moveNodesByModelDelta(delta) {
    const nodes = getNodeObjects();
    if (!nodes.length) return;
    applying = true;
    try {
        for (const nodeObject of nodes) {
            if (!nodeObject.visible) continue;
            nodeObject.updateMatrix();
            nodeObject.matrix.premultiply(delta);
            nodeObject.matrix.decompose(nodeObject.position, nodeObject.quaternion, nodeObject.scale);
            nodeObject.updateMatrixWorld(true);
            syncNodeMetadata(nodeObject);
        }
    } finally {
        applying = false;
    }
}

function syncNodeMetadata(nodeObject) {
    const meta = scene.userData?.rocketPart;
    const list = meta?.attachmentNodes;
    const id = nodeObject.userData?.attachmentNodeId;
    if (!Array.isArray(list) || !id) return;
    const entry = list.find(node => node.id === id);
    if (!entry) return;

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    nodeObject.getWorldPosition(worldPosition);
    nodeObject.getWorldQuaternion(worldQuaternion);
    const euler = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");
    const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuaternion).normalize();

    entry.position = worldPosition.toArray();
    entry.rotation = [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z)
    ];
    entry.direction = direction.toArray();
    meta.updatedAt = new Date().toISOString();

    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", {
        detail: { node: entry, transforming: true, source: "model-follow" }
    }));
}

function getNodeObjects() {
    const result = [];
    scene.traverse(object => {
        if (object.userData?.attachmentNode) result.push(object);
    });
    return result;
}

function getModelRoot() {
    const metadata = scene.userData?.rocketPart;
    const uuid = metadata?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const found = scene.getObjectByProperty("uuid", uuid);
        if (found && !found.userData?.attachmentNode && !found.userData?.editorOnly) return found;
    }
    return scene.children.find(object =>
        object.userData?.editorObject &&
        !object.userData?.attachmentNode &&
        !object.userData?.editorOnly
    ) || null;
}

function resetBaseline() {
    requestAnimationFrame(() => {
        const model = getModelRoot();
        if (!model) {
            previousModelMatrix = null;
            previousModelUuid = null;
            return;
        }
        model.updateWorldMatrix(true, true);
        previousModelMatrix = model.matrixWorld.clone();
        previousModelUuid = model.uuid;
    });
}

function matricesEqual(a, b, epsilon = 1e-7) {
    const ae = a.elements;
    const be = b.elements;
    for (let i = 0; i < 16; i++) {
        if (Math.abs(ae[i] - be[i]) > epsilon) return false;
    }
    return true;
}

initNodeModelFollow();
