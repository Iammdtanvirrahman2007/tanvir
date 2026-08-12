import * as THREE from "three";
import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";
import { selectObject, clearSelection } from "../core/selection.js";

let sceneRef = null;
let activeNodeId = null;
let nodeObjects = new Map();
let modelRoot = null;
let initialized = false;
let syncGuard = false;

export function initAttachmentNodeEditor(scene) {
    sceneRef = scene || null;
    if (!sceneRef || initialized) return;
    initialized = true;

    ensureModelRootMetadata();
    rebuildNodeObjects();

    window.addEventListener("editor:rocket-part-mode", event => {
        if (!event.detail) {
            clearNodeSelectionOnly();
            return;
        }
        ensureModelRootMetadata();
        rebuildNodeObjects();
    });

    window.addEventListener("editor:rocket-part-change", () => {
        ensureModelRootMetadata();
        rebuildNodeObjects();
    });

    window.addEventListener("editor:selection-change", event => {
        if (syncGuard) return;
        const selected = event.detail || [];
        const node = selected.find(object => object?.userData?.attachmentNode === true);
        if (node) {
            activeNodeId = node.userData.attachmentNodeId;
            highlightNodeObjects();
            window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", {
                detail: getAttachmentNodes().find(item => item.id === activeNodeId) || null
            }));
        } else if (activeNodeId) {
            activeNodeId = null;
            highlightNodeObjects();
            window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
        }
    });

    // Normal ModelForge TransformControls emit this event for every drag update.
    // Attachment nodes use the exact same object transform path as ordinary objects.
    window.addEventListener("editor:gizmo-change", event => {
        const object = event.detail?.object;
        if (!object?.userData?.attachmentNode || syncGuard) return;
        syncNodeMetadataFromObject(object);
    });
}

export function getModelRoot() {
    if (!sceneRef) return null;

    const meta = readRocketPart(sceneRef);
    const uuid = meta?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const found = sceneRef.getObjectByProperty("uuid", uuid);
        if (found && !found.userData?.attachmentNode && !found.userData?.editorOnly) return found;
    }

    const candidate = sceneRef.children.find(object =>
        !object.userData?.editorOnly &&
        object.userData?.editorObject &&
        !object.userData?.attachmentNode
    );
    return candidate || null;
}

export function ensureModelRootMetadata() {
    if (!sceneRef) return null;
    const root = getModelRoot();
    if (!root) return modelRoot;

    modelRoot = root;
    const current = readRocketPart(sceneRef) || {};
    if (current.coordinateSystem?.modelRootUUID !== modelRoot.uuid) {
        updateRocketPart(sceneRef, {
            coordinateSystem: { modelRootUUID: modelRoot.uuid }
        });
    }
    return modelRoot;
}

export function getAttachmentNodes() {
    return readRocketPart(sceneRef)?.attachmentNodes || [];
}

export function getActiveAttachmentNodeId() {
    return activeNodeId;
}

export function selectAttachmentNode(nodeId) {
    const object = nodeObjects.get(nodeId);
    if (!object) return null;

    activeNodeId = nodeId;
    highlightNodeObjects();
    syncGuard = true;
    try {
        selectObject(object);
    } finally {
        syncGuard = false;
    }

    const node = getAttachmentNodes().find(item => item.id === nodeId) || null;
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: node }));
    return node;
}

export function clearAttachmentNodeSelection() {
    activeNodeId = null;
    highlightNodeObjects();
    syncGuard = true;
    try {
        clearSelection();
    } finally {
        syncGuard = false;
    }
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
}

export function addAttachmentNode(source = {}) {
    ensureModelRootMetadata();
    if (!sceneRef || !modelRoot) return null;

    const current = getAttachmentNodes();
    const node = createAttachmentNode({
        name: source.name || `Node ${current.length + 1}`,
        id: source.id,
        type: "structural",
        position: Array.isArray(source.position) ? normalizeVector(source.position) : [0, 0, 0],
        rotation: Array.isArray(source.rotation) ? normalizeVector(source.rotation) : [0, 0, 0],
        direction: [0, 1, 0],
        compatibleCategories: []
    });

    updateRocketPart(sceneRef, { attachmentNodes: [...current, node] });
    createNodeObject(node);
    activeNodeId = node.id;
    highlightNodeObjects();
    selectAttachmentNode(node.id);
    dispatchNodeChange(node);
    return node;
}

export function updateAttachmentNode(nodeId, patch = {}) {
    if (!sceneRef) return null;
    const current = getAttachmentNodes();
    const index = current.findIndex(node => node.id === nodeId);
    if (index < 0) return null;

    const node = { ...current[index] };
    if (patch.name != null) node.name = String(patch.name).trim() || node.name;
    if (Array.isArray(patch.position)) node.position = normalizeVector(patch.position);
    if (Array.isArray(patch.rotation)) node.rotation = normalizeVector(patch.rotation);

    const next = current.slice();
    next[index] = node;
    updateRocketPart(sceneRef, { attachmentNodes: next });

    const object = nodeObjects.get(nodeId);
    if (object && document.activeElement !== object) syncNodeObjectFromMetadata(nodeId);
    dispatchNodeChange(node);
    return node;
}

export function removeAttachmentNode(nodeId) {
    if (!sceneRef) return false;
    const current = getAttachmentNodes();
    const next = current.filter(node => node.id !== nodeId);
    if (next.length === current.length) return false;

    const object = nodeObjects.get(nodeId);
    object?.parent?.remove(object);
    disposeNodeObject(object);
    nodeObjects.delete(nodeId);
    updateRocketPart(sceneRef, { attachmentNodes: next });

    if (activeNodeId === nodeId) {
        activeNodeId = null;
        syncGuard = true;
        try { clearSelection(); } finally { syncGuard = false; }
    }

    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
    dispatchNodeChange(null);
    return true;
}

export function refreshAttachmentNodeHelpers() {
    rebuildNodeObjects();
}

function rebuildNodeObjects() {
    ensureModelRootMetadata();
    if (!modelRoot) return;

    const nodes = getAttachmentNodes();
    const wanted = new Set(nodes.map(node => node.id));

    for (const [id, object] of nodeObjects) {
        if (wanted.has(id)) continue;
        object.parent?.remove(object);
        disposeNodeObject(object);
        nodeObjects.delete(id);
    }

    for (const node of nodes) {
        let object = nodeObjects.get(node.id);
        if (!object) object = createNodeObject(node);
        syncNodeObjectFromMetadata(node.id);
    }
}

function createNodeObject(node) {
    if (!modelRoot) return null;

    const object = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 24, 16),
        new THREE.MeshStandardMaterial({
            color: 0x67d4ff,
            roughness: 0.38,
            metalness: 0.08,
            emissive: 0x123247,
            emissiveIntensity: 0.35
        })
    );

    object.name = node.name || `Node ${node.id}`;
    object.userData = {
        selectable: true,
        attachmentNode: true,
        attachmentNodeId: node.id,
        attachmentNodeExcludeFromExport: true,
        editorObject: false,
        editorOnly: false
    };
    object.castShadow = false;
    object.receiveShadow = false;
    object.renderOrder = 998;

    // A node is a real child of the part root, so its transform behaves exactly
    // like any ordinary child object and all position/rotation values are local
    // to the Rocket Part origin.
    modelRoot.add(object);
    nodeObjects.set(node.id, object);
    syncNodeObjectFromMetadata(node.id);
    return object;
}

function syncNodeObjectFromMetadata(nodeId) {
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    const object = nodeObjects.get(nodeId);
    if (!node || !object || syncGuard) return;

    syncGuard = true;
    try {
        object.name = node.name || `Node ${node.id}`;
        object.position.set(...normalizeVector(node.position));
        object.rotation.set(
            THREE.MathUtils.degToRad(Number(node.rotation?.[0] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[1] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[2] || 0))
        );
        object.updateMatrixWorld(true);
    } finally {
        syncGuard = false;
    }
}

function syncNodeMetadataFromObject(object) {
    const nodeId = object.userData?.attachmentNodeId;
    if (!nodeId || syncGuard) return;

    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, "XYZ");
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    if (!node) return;

    const patch = {
        position: object.position.toArray(),
        rotation: [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ]
    };

    syncGuard = true;
    try {
        const current = getAttachmentNodes();
        const index = current.findIndex(item => item.id === nodeId);
        if (index < 0) return;
        const next = current.slice();
        next[index] = { ...current[index], ...patch };
        updateRocketPart(sceneRef, { attachmentNodes: next });
        dispatchNodeChange(next[index]);
    } finally {
        syncGuard = false;
    }
}

function highlightNodeObjects() {
    for (const [id, object] of nodeObjects) {
        const active = id === activeNodeId;
        const material = object.material;
        if (!material) continue;
        material.color.setHex(active ? 0xffc857 : 0x67d4ff);
        material.emissive.setHex(active ? 0x543b0c : 0x123247);
    }
}

function dispatchNodeChange(node) {
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: node }));
}

function normalizeVector(value) {
    return [0, 1, 2].map(index => Number.isFinite(Number(value?.[index])) ? Number(value[index]) : 0);
}

function disposeNodeObject(object) {
    if (!object) return;
    object.geometry?.dispose?.();
    object.material?.dispose?.();
}

// Kept for API compatibility with the later placement stage. Step 1 does not
// auto-place, rotate, or draw special node gizmos.
export function autoPlaceNode() { return null; }
export function upsertPresetNode() { return null; }
