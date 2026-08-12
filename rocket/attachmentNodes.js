import * as THREE from "three";
import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";
import { initNodeTransform } from "./nodeTransform.js";

let sceneRef = null;
let helperRoot = null;
let helpers = new Map();
let activeNodeId = null;
let canvas = null;
let camera = null;
let nodeRaycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();

export function initAttachmentNodeEditor(scene, renderer, activeCamera, orbitControls = null) {
    sceneRef = scene;
    canvas = renderer?.domElement || null;
    camera = activeCamera || null;
    if (!sceneRef) return;

    helperRoot?.parent?.remove(helperRoot);
    helperRoot = new THREE.Group();
    helperRoot.name = "__editorAttachmentNodes";
    helperRoot.userData = { editorOnly: true, attachmentNodeHelpers: true };
    sceneRef.add(helperRoot);

    canvas?.addEventListener("click", onCanvasClick, true);
    window.addEventListener("editor:rocket-part-mode", () => refreshAttachmentNodeHelpers());
    window.addEventListener("editor:rocket-part-change", () => refreshAttachmentNodeHelpers());
    initNodeTransform(sceneRef, renderer, camera, orbitControls);
    refreshAttachmentNodeHelpers();
}

export function getAttachmentNodes() {
    return readRocketPart(sceneRef)?.attachmentNodes || [];
}

export function getActiveAttachmentNodeId() { return activeNodeId; }

export function selectAttachmentNode(nodeId) {
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    if (!node) return null;
    activeNodeId = node.id;
    updateHelperHighlight();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: node }));
    return node;
}

export function clearAttachmentNodeSelection() {
    activeNodeId = null;
    updateHelperHighlight();
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
}

export function addAttachmentNode(source = {}) {
    if (!sceneRef) return null;
    const current = getAttachmentNodes();
    const node = createAttachmentNode({
        name: source.name || `Node ${current.length + 1}`,
        id: source.id,
        type: source.type || "structural",
        position: source.position || [0, 0, 0],
        rotation: source.rotation || [0, 0, 0],
        direction: source.direction || [0, 1, 0],
        compatibleCategories: source.compatibleCategories || ["custom"]
    });
    updateRocketPart(sceneRef, { attachmentNodes: [...current, node] });
    activeNodeId = node.id;
    refreshAttachmentNodeHelpers();
    dispatchChange(node);
    return node;
}

export function updateAttachmentNode(nodeId, patch = {}) {
    if (!sceneRef) return null;
    const current = getAttachmentNodes();
    const index = current.findIndex(node => node.id === nodeId);
    if (index < 0) return null;

    const node = { ...current[index] };
    if (patch.name != null) node.name = String(patch.name).trim() || node.name;
    if (patch.type != null) node.type = String(patch.type);
    if (Array.isArray(patch.position)) node.position = normalizeVector(patch.position);
    if (Array.isArray(patch.rotation)) node.rotation = normalizeVector(patch.rotation);
    if (Array.isArray(patch.direction)) node.direction = normalizeDirection(patch.direction);
    if (Array.isArray(patch.compatibleCategories)) node.compatibleCategories = [...new Set(patch.compatibleCategories.map(String))];

    const next = current.slice();
    next[index] = node;
    updateRocketPart(sceneRef, { attachmentNodes: next });
    refreshAttachmentNodeHelpers();
    dispatchChange(node);
    return node;
}

export function removeAttachmentNode(nodeId) {
    if (!sceneRef) return false;
    const current = getAttachmentNodes();
    const next = current.filter(node => node.id !== nodeId);
    if (next.length === current.length) return false;
    updateRocketPart(sceneRef, { attachmentNodes: next });
    if (activeNodeId === nodeId) activeNodeId = null;
    refreshAttachmentNodeHelpers();
    dispatchChange(null);
    return true;
}

export function refreshAttachmentNodeHelpers() {
    if (!helperRoot || !sceneRef) return;
    const nodes = getAttachmentNodes();
    const wanted = new Set(nodes.map(node => node.id));

    for (const [id, helper] of helpers) {
        if (wanted.has(id)) continue;
        helper.removeFromParent();
        disposeHelper(helper);
        helpers.delete(id);
    }

    for (const node of nodes) {
        let helper = helpers.get(node.id);
        if (!helper) {
            helper = createNodeHelper(node);
            helpers.set(node.id, helper);
            helperRoot.add(helper);
        }
        syncHelper(helper, node);
    }
    updateHelperHighlight();
}

function createNodeHelper(node) {
    const group = new THREE.Group();
    group.name = `Node_${node.id}`;
    group.userData = { editorOnly: true, attachmentNodeHelper: true, nodeId: node.id };

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x67d4ff, depthTest: false })
    );
    sphere.renderOrder = 999;
    sphere.userData = group.userData;
    group.add(sphere);

    const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        0.42,
        0x67d4ff,
        0.12,
        0.07
    );
    arrow.line.renderOrder = 999;
    arrow.cone.renderOrder = 999;
    arrow.line.material.depthTest = false;
    arrow.cone.material.depthTest = false;
    group.add(arrow);

    const label = makeLabel(node.name || node.id);
    label.position.set(0.12, 0.08, 0);
    group.add(label);
    return group;
}

function syncHelper(helper, node) {
    helper.position.set(...node.position);
    helper.rotation.set(...node.rotation.map(value => THREE.MathUtils.degToRad(value)));
    helper.userData.nodeId = node.id;
    helper.children[0]?.material && (helper.children[0].material.color.setHex(activeNodeId === node.id ? 0xffc857 : colorForType(node.type)));

    const arrow = helper.children.find(child => child.type === "ArrowHelper");
    if (arrow) {
        const dir = new THREE.Vector3(...node.direction).normalize();
        arrow.setDirection(dir);
        arrow.setLength(0.42, 0.12, 0.07);
        const color = activeNodeId === node.id ? 0xffc857 : colorForType(node.type);
        arrow.setColor(color);
    }
    const sprite = helper.children.find(child => child.userData?.attachmentNodeLabel);
    if (sprite) updateLabel(sprite, node.name || node.id);
}

function updateHelperHighlight() {
    for (const [id, helper] of helpers) {
        const node = getAttachmentNodes().find(item => item.id === id);
        if (node) syncHelper(helper, node);
    }
}

function onCanvasClick(event) {
    if (!canvas || !camera || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    nodeRaycaster.setFromCamera(pointer, camera);

    const hits = nodeRaycaster.intersectObjects(helperRoot?.children || [], true);
    const hit = hits.find(item => item.object?.userData?.nodeId);
    if (!hit) return;
    event.stopImmediatePropagation();
    selectAttachmentNode(hit.object.userData.nodeId);
}

function makeLabel(text) {
    const canvasEl = document.createElement("canvas");
    canvasEl.width = 256;
    canvasEl.height = 64;
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,240,247,.96)";
    ctx.strokeStyle = "rgba(10,12,16,.9)";
    ctx.lineWidth = 5;
    ctx.strokeText(text, 4, 39);
    ctx.fillText(text, 4, 39);

    const texture = new THREE.CanvasTexture(canvasEl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.9, 0.225, 1);
    sprite.renderOrder = 1000;
    sprite.userData = { editorOnly: true, attachmentNodeLabel: true };
    return sprite;
}

function updateLabel(sprite, text) {
    const texture = sprite.material?.map;
    const canvasEl = texture?.image;
    if (!(canvasEl instanceof HTMLCanvasElement)) return;
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillStyle = "rgba(235,240,247,.96)";
    ctx.strokeStyle = "rgba(10,12,16,.9)";
    ctx.lineWidth = 5;
    ctx.strokeText(text, 4, 39);
    ctx.fillText(text, 4, 39);
    texture.needsUpdate = true;
}

function disposeHelper(helper) {
    helper.traverse(object => {
        if (object.geometry?.dispose) object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach(item => item.dispose?.());
        else material?.dispose?.();
    });
}

function normalizeVector(value) {
    const input = Array.isArray(value) ? value : [0, 0, 0];
    return input.slice(0, 3).map(item => Number.isFinite(Number(item)) ? Number(item) : 0);
}

function normalizeDirection(value) {
    const [x, y, z] = normalizeVector(value);
    const length = Math.hypot(x, y, z);
    return length > 1e-8 ? [x / length, y / length, z / length] : [0, 1, 0];
}

function colorForType(type) {
    return { structural: 0x67d4ff, fuel: 0x6ee7a8, engine: 0xff8a65, dock: 0xc9a7ff, utility: 0xf5d06f, custom: 0xc4cad4 }[type] || 0xc4cad4;
}

function dispatchChange(node) {
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: node }));
}
