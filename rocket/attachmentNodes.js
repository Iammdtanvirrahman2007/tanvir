import * as THREE from "three";
import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";
import { selectObject, clearSelection } from "../core/selection.js";

let sceneRef = null;
let modelRoot = null;
let activeNodeId = null;
let initialized = false;
let syncing = false;
let nodeTransformActive = false;
let nodeEditMode = false;
const nodeObjects = new Map();

export function initAttachmentNodeEditor(scene) {
    sceneRef = scene;
    if (!sceneRef || initialized) return;
    initialized = true;
    window.__modelForgeNodeEditMode = false;
    ensureModelRootMetadata();
    rebuildNodeObjects();

    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) {
            ensureModelRootMetadata();
            rebuildNodeObjects();
        } else {
            setNodeEditMode(false);
            activeNodeId = null;
        }
    });

    window.addEventListener("editor:gizmo-drag", event => {
        const object = event.detail?.object;
        const isNode = !!object?.userData?.attachmentNode;
        nodeTransformActive = !!event.detail?.active && isNode;
        if (!nodeTransformActive && !event.detail?.active && isNode) {
            const nodeId = object.userData.attachmentNodeId;
            requestAnimationFrame(() => {
                const currentObject = nodeObjects.get(nodeId);
                if (!currentObject || !nodeEditMode) return;
                activeNodeId = nodeId;
                syncing = true;
                try { selectObject(currentObject); }
                finally { syncing = false; }
                highlightNodes();
            });
        }
    });

    window.addEventListener("editor:rocket-part-change", () => {
        if (nodeTransformActive) return;
        rebuildNodeObjects();
    });

    window.addEventListener("editor:selection-change", event => {
        if (syncing) return;
        const selection = event.detail || [];
        const node = selection.length === 1 && selection[0]?.userData?.attachmentNode ? selection[0] : null;
        activeNodeId = node?.userData?.attachmentNodeId || null;
        highlightNodes();
        window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", {
            detail: activeNodeId ? getAttachmentNodes().find(n => n.id === activeNodeId) || null : null
        }));
    });

    window.addEventListener("editor:gizmo-change", event => {
        const object = event.detail?.object;
        if (!object?.userData?.attachmentNode || syncing || !nodeEditMode) return;
        syncNodeFromObject(object);
    });
}

export function isNodeEditMode() { return nodeEditMode; }

export function setNodeEditMode(enabled) {
    const next = !!enabled;
    if (next === nodeEditMode) return nodeEditMode;

    nodeEditMode = next;
    window.__modelForgeNodeEditMode = nodeEditMode;

    if (nodeEditMode) {
        // Entering Node Mode starts from a clean selection so the normal
        // object's gizmo cannot remain active underneath the node workflow.
        activeNodeId = null;
        syncing = true;
        try { clearSelection(); } finally { syncing = false; }
    } else {
        // Exiting Node Mode returns the editor to its ordinary selection logic.
        activeNodeId = null;
        syncing = true;
        try { clearSelection(); } finally { syncing = false; }
    }

    highlightNodes();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-mode", { detail: nodeEditMode }));
    return nodeEditMode;
}

export function toggleNodeEditMode() {
    return setNodeEditMode(!nodeEditMode);
}

export function getModelRoot() {
    if (!sceneRef) return null;
    const uuid = readRocketPart(sceneRef)?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const found = sceneRef.getObjectByProperty("uuid", uuid);
        if (found && !found.userData?.editorOnly && !found.userData?.attachmentNode) return found;
    }
    return sceneRef.children.find(o => o.userData?.editorObject && !o.userData?.editorOnly && !o.userData?.attachmentNode) || null;
}

export function ensureModelRootMetadata() {
    modelRoot = getModelRoot() || modelRoot;
    if (!modelRoot || !sceneRef) return modelRoot;
    const current = readRocketPart(sceneRef) || {};
    if (current.coordinateSystem?.modelRootUUID !== modelRoot.uuid) {
        updateRocketPart(sceneRef, { coordinateSystem: { modelRootUUID: modelRoot.uuid } });
    }
    return modelRoot;
}

export function getAttachmentNodes() { return readRocketPart(sceneRef)?.attachmentNodes || []; }
export function getActiveAttachmentNodeId() { return activeNodeId; }

export function selectAttachmentNode(nodeId) {
    if (!nodeEditMode) return null;
    const object = nodeObjects.get(nodeId);
    if (!object) return null;
    activeNodeId = nodeId;
    syncing = true;
    try { selectObject(object); } finally { syncing = false; }
    highlightNodes();
    return getAttachmentNodes().find(n => n.id === nodeId) || null;
}

export function clearAttachmentNodeSelection() {
    activeNodeId = null;
    syncing = true;
    try { clearSelection(); } finally { syncing = false; }
    highlightNodes();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
}

export function addAttachmentNode(source = {}) {
    ensureModelRootMetadata();
    if (!sceneRef || !modelRoot) return null;
    const current = getAttachmentNodes();
    const node = createAttachmentNode({
        name: source.name || `Node ${current.length + 1}`,
        type: "structural",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        direction: [0, 1, 0],
        compatibleCategories: []
    });
    updateRocketPart(sceneRef, { attachmentNodes: [...current, node] });
    createNodeObject(node);
    activeNodeId = node.id;
    if (!nodeEditMode) setNodeEditMode(true);
    highlightNodes();
    selectAttachmentNode(node.id);
    dispatchNodeChange(node, false);
    return node;
}

export function updateAttachmentNode(nodeId, patch = {}) {
    const current = getAttachmentNodes();
    const index = current.findIndex(n => n.id === nodeId);
    if (index < 0) return null;
    const node = { ...current[index] };
    if (patch.name != null) node.name = String(patch.name).trim() || node.name;
    if (Array.isArray(patch.position)) node.position = normalizeVector(patch.position);
    if (Array.isArray(patch.rotation)) node.rotation = normalizeVector(patch.rotation);
    const next = current.slice(); next[index] = node;
    updateRocketPart(sceneRef, { attachmentNodes: next });
    applyMetadataToObject(node);
    dispatchNodeChange(node, false);
    return node;
}

export function removeAttachmentNode(nodeId) {
    const current = getAttachmentNodes();
    const next = current.filter(n => n.id !== nodeId);
    if (next.length === current.length) return false;
    const object = nodeObjects.get(nodeId);
    if (object) {
        object.parent?.remove(object);
        object.geometry?.dispose?.();
        object.material?.dispose?.();
        nodeObjects.delete(nodeId);
    }
    updateRocketPart(sceneRef, { attachmentNodes: next });
    if (activeNodeId === nodeId) clearAttachmentNodeSelection();
    dispatchNodeChange(null, false);
    return true;
}

export function refreshAttachmentNodeHelpers() { rebuildNodeObjects(); }

function createNodeObject(node) {
    if (!modelRoot) return null;
    const object = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0x67d4ff, depthTest: false, depthWrite: false })
    );
    object.name = node.name || `Node ${node.id}`;
    object.userData = {
        selectable: true,
        editorObject: true,
        attachmentNode: true,
        attachmentNodeId: node.id,
        attachmentNodeExcludeFromExport: true,
        editorOnly: false
    };
    object.renderOrder = 1200;
    modelRoot.add(object);
    nodeObjects.set(node.id, object);
    applyMetadataToObject(node);
    return object;
}

function rebuildNodeObjects() {
    ensureModelRootMetadata();
    if (!modelRoot) return;
    const nodes = getAttachmentNodes();
    const wanted = new Set(nodes.map(n => n.id));
    for (const [id, object] of nodeObjects) {
        if (!wanted.has(id)) {
            object.parent?.remove(object);
            object.geometry?.dispose?.(); object.material?.dispose?.();
            nodeObjects.delete(id);
        }
    }
    for (const node of nodes) {
        if (!nodeObjects.has(node.id)) createNodeObject(node);
        else applyMetadataToObject(node);
    }
    highlightNodes();
}

function applyMetadataToObject(node) {
    const object = nodeObjects.get(node.id);
    if (!object || syncing) return;
    syncing = true;
    try {
        object.name = node.name || `Node ${node.id}`;
        object.position.set(...normalizeVector(node.position));
        object.rotation.set(
            THREE.MathUtils.degToRad(Number(node.rotation?.[0] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[1] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[2] || 0))
        );
        object.updateMatrixWorld(true);
    } finally { syncing = false; }
}

function syncNodeFromObject(object) {
    if (!nodeEditMode) return;
    const nodeId = object.userData?.attachmentNodeId;
    const current = getAttachmentNodes();
    const index = current.findIndex(n => n.id === nodeId);
    if (index < 0) return;
    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, "XYZ");
    const next = current.slice();
    next[index] = {
        ...current[index],
        name: object.name,
        position: object.position.toArray(),
        rotation: [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ]
    };
    syncing = true;
    try { updateRocketPart(sceneRef, { attachmentNodes: next }); }
    finally { syncing = false; }
    activeNodeId = nodeId;
    dispatchNodeChange(next[index], true);
}

function highlightNodes() {
    for (const [id, object] of nodeObjects) {
        if (object.material?.color) object.material.color.setHex(id === activeNodeId && nodeEditMode ? 0xffc857 : 0x67d4ff);
    }
}

function dispatchNodeChange(node, transforming = false) {
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: { node, transforming } }));
}

function normalizeVector(value) { return [0,1,2].map(i => Number.isFinite(Number(value?.[i])) ? Number(value[i]) : 0); }
export function autoPlaceNode() { return null; }
export function upsertPresetNode() { return null; }
