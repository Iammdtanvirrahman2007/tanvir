import * as THREE from "three";
import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";
import { selectObject, clearSelection, getSelected } from "../core/selection.js";

let sceneRef = null;
let activeNodeId = null;
let initialized = false;
let syncing = false;
let nodeTransformActive = false;
let nodeEditMode = false;
let nodesVisible = true;
const nodeObjects = new Map();

export function initAttachmentNodeEditor(scene) {
    sceneRef = scene;
    if (!sceneRef || initialized) return;
    initialized = true;
    window.__modelForgeNodeEditMode = false;
    window.__modelForgeNodesVisible = true;
    rebuildNodeObjects();
    installNodeVisibilityButton();
    syncNodeVisibilityButton();

    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) {
            rebuildNodeObjects();
            setNodeObjectsVisible(nodesVisible);
        } else {
            setNodeEditMode(false);
            activeNodeId = null;
            setNodeObjectsVisible(nodesVisible);
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
export function areNodesVisible() { return nodesVisible; }

export function setNodesVisible(visible) {
    nodesVisible = !!visible;
    window.__modelForgeNodesVisible = nodesVisible;
    setNodeObjectsVisible(nodesVisible);
    if (!nodesVisible) {
        activeNodeId = null;
        syncing = true;
        try { clearSelection(); } finally { syncing = false; }
    }
    syncNodeVisibilityButton();
    window.dispatchEvent(new CustomEvent("editor:node-visibility", { detail: nodesVisible }));
    return nodesVisible;
}

export function toggleNodesVisible() { return setNodesVisible(!nodesVisible); }

export function setNodeEditMode(enabled) {
    const next = !!enabled;
    if (next === nodeEditMode) return nodeEditMode;
    nodeEditMode = next;
    window.__modelForgeNodeEditMode = nodeEditMode;
    activeNodeId = null;
    syncing = true;
    try { clearSelection(); } finally { syncing = false; }
    setNodeObjectsVisible(nodesVisible);
    highlightNodes();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-mode", { detail: nodeEditMode }));
    return nodeEditMode;
}

export function toggleNodeEditMode() { return setNodeEditMode(!nodeEditMode); }

export function getAttachmentNodes() { return readRocketPart(sceneRef)?.attachmentNodes || []; }
export function getActiveAttachmentNodeId() { return activeNodeId; }

export function selectAttachmentNode(nodeId) {
    if (!nodeEditMode || !nodesVisible) return null;
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
    const parent = getModelRoot() || sceneRef;
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
    createNodeObject(node, parent);
    setNodeObjectsVisible(nodesVisible);
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

function getModelRoot() {
    if (!sceneRef) return null;
    const selected = getSelected?.();
    if (selected && !selected.userData?.attachmentNode && !selected.userData?.editorOnly) return selected;
    return sceneRef.children.find(object => object.userData?.editorObject && !object.userData?.attachmentNode && !object.userData?.editorOnly)
        || sceneRef.children.find(object => !object.userData?.attachmentNode && !object.userData?.editorOnly && object !== sceneRef)
        || null;
}

function createNodeObject(node, preferredParent = null) {
    if (!sceneRef) return null;
    const parent = preferredParent || getModelRoot() || sceneRef;
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
    parent.add(object);

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
        editorOnly: true
    };
    arrow.renderOrder = 1201;
    arrow.line?.material && (arrow.line.material.depthTest = false, arrow.line.material.depthWrite = false);
    arrow.cone?.material && (arrow.cone.material.depthTest = false, arrow.cone.material.depthWrite = false);
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
    setNodeObjectsVisible(nodesVisible);
    highlightNodes();
}

function setNodeObjectsVisible(visible) {
    for (const object of nodeObjects.values()) {
        object.visible = !!visible;
        const arrow = object.children.find(child => child.userData?.attachmentNodeArrow);
        if (arrow) arrow.visible = !!visible;
    }
}

function clearNodeObjects() {
    for (const object of nodeObjects.values()) {
        object.parent?.remove(object);
        disposeNodeObject(object);
    }
    nodeObjects.clear();
}

function applyMetadataToObject(node) {
    const object = nodeObjects.get(node.id);
    if (!object || syncing) return;
    syncing = true;
    try {
        object.name = node.name || `Node ${node.id}`;
        object.updateMatrixWorld(true);

        const desiredWorldPosition = new THREE.Vector3(...normalizeVector(node.position));
        const desiredWorldQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            THREE.MathUtils.degToRad(Number(node.rotation?.[0] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[1] || 0)),
            THREE.MathUtils.degToRad(Number(node.rotation?.[2] || 0)),
            "XYZ"
        ));

        const parent = object.parent || sceneRef;
        parent.updateWorldMatrix(true, true);
        object.position.copy(parent.worldToLocal(desiredWorldPosition.clone()));

        const parentWorldQuaternion = new THREE.Quaternion();
        parent.getWorldQuaternion(parentWorldQuaternion);
        object.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion));
        object.scale.set(1, 1, 1);
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

    object.updateWorldMatrix(true, true);
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    object.getWorldPosition(worldPosition);
    object.getWorldQuaternion(worldQuaternion);
    const euler = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");

    const next = current.slice();
    next[index] = {
        ...current[index],
        name: object.name,
        position: worldPosition.toArray(),
        rotation: [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ],
        direction: new THREE.Vector3(0, 1, 0).applyQuaternion(object.quaternion).normalize().toArray()
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
    arrow.visible = nodesVisible;
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

function installNodeVisibilityButton() {
    const host = document.querySelector(".viewport-top-right");
    const grid = document.getElementById("gridBtn");
    if (!host || !grid || document.getElementById("nodeVisibilityBtn")) return;
    const button = document.createElement("button");
    button.id = "nodeVisibilityBtn";
    button.className = "viewport-btn";
    button.type = "button";
    button.title = "Show/Hide attachment nodes";
    button.addEventListener("click", toggleNodesVisible);
    grid.insertAdjacentElement("afterend", button);
}

function syncNodeVisibilityButton() {
    const button = document.getElementById("nodeVisibilityBtn");
    if (!button) return;
    button.textContent = nodesVisible ? "Nodes On" : "Nodes Off";
    button.classList.toggle("active", nodesVisible);
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
