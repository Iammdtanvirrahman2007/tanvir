import * as THREE from "three";
import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";
import { selectObject, clearSelection } from "../core/selection.js";

let sceneRef = null;
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
    rebuildNodeObjects();

    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) {
            rebuildNodeObjects();
            setNodeObjectsVisible(true);
        } else {
            setNodeEditMode(false);
            activeNodeId = null;
            setNodeObjectsVisible(false);
            clearNodeObjects();
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
    activeNodeId = null;
    syncing = true;
    try { clearSelection(); } finally { syncing = false; }
    setNodeObjectsVisible(true);
    highlightNodes();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-mode", { detail: nodeEditMode }));
    return nodeEditMode;
}

export function toggleNodeEditMode() { return setNodeEditMode(!nodeEditMode); }

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
    if (!sceneRef) return null;
    const current = getAttachmentNodes();
    const node = createAttachmentNode({
        name: source.name || `Node ${current.length + 1}`,
        type: source.type || "structural",
        position: source.position || [0, 0, 0],
        rotation: source.rotation || [0, 0, 0],
        direction: source.direction || [0, 1, 0],
        compatibleCategories: source.compatibleCategories || []
    });

    updateRocketPart(sceneRef, { attachmentNodes: [...current, node] });
    createNodeObject(node);
    setNodeObjectsVisible(true);
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
    if (Array.isArray(patch.direction)) node.direction = normalizeDirection(patch.direction);
    const next = current.slice();
    next[index] = node;
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
        disposeNodeObject(object);
        nodeObjects.delete(nodeId);
    }
    updateRocketPart(sceneRef, { attachmentNodes: next });
    if (activeNodeId === nodeId) clearAttachmentNodeSelection();
    dispatchNodeChange(null, false);
    return true;
}

export function refreshAttachmentNodeHelpers() { rebuildNodeObjects(); }

function createNodeObject(node) {
    if (!sceneRef) return null;
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
    sceneRef.add(object);

    const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        0.55,
        0x67d4ff,
        0.14,
        0.075
    );
    arrow.name = `${object.name} Direction`;
    arrow.userData = {
        attachmentNodeArrow: true,
        attachmentNodeId: node.id,
        selectable: false,
        editorOnly: false
    };
    arrow.renderOrder = 1201;
    arrow.line?.material && (arrow.line.material.depthTest = false);
    arrow.cone?.material && (arrow.cone.material.depthTest = false);
    object.add(arrow);

    nodeObjects.set(node.id, object);
    applyMetadataToObject(node);
    return object;
}

function rebuildNodeObjects() {
    if (!sceneRef) return;
    const nodes = getAttachmentNodes();
    const wanted = new Set(nodes.map(n => n.id));

    for (const [id, object] of nodeObjects) {
        if (wanted.has(id)) continue;
        object.parent?.remove(object);
        disposeNodeObject(object);
        nodeObjects.delete(id);
    }

    for (const node of nodes) {
        if (!nodeObjects.has(node.id)) createNodeObject(node);
        else applyMetadataToObject(node);
    }
    highlightNodes();
}

function clearNodeObjects() {
    for (const object of nodeObjects.values()) {
        object.parent?.remove(object);
        disposeNodeObject(object);
    }
    nodeObjects.clear();
}

function setNodeObjectsVisible(visible) {
    for (const object of nodeObjects.values()) object.visible = visible;
}

function applyMetadataToObject(node) {
    const object = nodeObjects.get(node.id);
    if (!object || syncing) return;
    syncing = true;
    try {
        object.name = node.name || `Node ${node.id}`;
        object.position.set(
            Number(node.position?.[0] || 0),
            Number(node.position?.[1] || 0),
            Number(node.position?.[2] || 0)
        );
        object.rotation.set(
            THREE.MathUtils.degToRad(Number(node.rotation?.[0] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[1] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[2] || 0))
        );
        updateNodeArrowVisual(object, node);
        object.updateMatrixWorld(true);
    } finally { syncing = false; }
}

function syncNodeFromObject(object) {
    if (!nodeEditMode) return;
    const nodeId = object.userData?.attachmentNodeId;
    const current = getAttachmentNodes();
    const index = current.findIndex(n => n.id === nodeId);
    if (index < 0) return;

    const next = current.slice();
    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, "XYZ");
    next[index] = {
        ...current[index],
        name: object.name,
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ],
        direction: directionFromQuaternion(object.quaternion)
    };

    syncing = true;
    try { updateRocketPart(sceneRef, { attachmentNodes: next }); }
    finally { syncing = false; }

    activeNodeId = nodeId;
    updateNodeArrowVisual(object, next[index]);
    dispatchNodeChange(next[index], true);
}

function updateNodeArrowVisual(object, node) {
    const arrow = object.children.find(child => child.userData?.attachmentNodeArrow);
    if (!arrow) return;
    const active = nodeEditMode && object.userData?.attachmentNodeId === activeNodeId;
    const color = active ? 0xffc857 : 0x67d4ff;
    arrow.line?.material?.color?.setHex(color);
    arrow.cone?.material?.color?.setHex(color);
    arrow.setDirection(normalizeDirection(node.direction || [0, 1, 0]));
}

function directionFromQuaternion(quaternion) {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize().toArray();
}

function normalizeDirection(value) {
    const [x, y, z] = normalizeVector(value);
    const length = Math.hypot(x, y, z);
    return length > 1e-8 ? [x / length, y / length, z / length] : [0, 1, 0];
}

function highlightNodes() {
    for (const [id, object] of nodeObjects) {
        const active = id === activeNodeId && nodeEditMode;
        object.material?.color?.setHex(active ? 0xffc857 : 0x67d4ff);
        updateNodeArrowVisual(object, getAttachmentNodes().find(node => node.id === id) || {});
    }
}

function dispatchNodeChange(node, transforming = false) {
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: { node, transforming } }));
}

function normalizeVector(value) {
    return [0, 1, 2].map(i => Number.isFinite(Number(value?.[i])) ? Number(value[i]) : 0);
}

function disposeNodeObject(object) {
    if (!object) return;
    object.traverse(child => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach(material => material?.dispose?.());
        else child.material?.dispose?.();
    });
}

export function autoPlaceNode() { return null; }
export function upsertPresetNode() { return null; }
