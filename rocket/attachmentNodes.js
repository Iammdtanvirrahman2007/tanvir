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
let nodeTransformBusy = false;

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
    window.addEventListener("editor:rocket-part-mode", () => {
        ensureModelRootMetadata();
        reparentHelperRoot();
        refreshAttachmentNodeHelpers();
    });
    window.addEventListener("editor:rocket-part-change", () => {
        ensureModelRootMetadata();
        reparentHelperRoot();
        refreshAttachmentNodeHelpers();
    });
    window.addEventListener("editor:rocket-node-transform", event => {
        nodeTransformBusy = !!event.detail?.active;
    });

    initNodeTransform(sceneRef, renderer, camera, orbitControls);
    ensureModelRootMetadata();
    reparentHelperRoot();
    refreshAttachmentNodeHelpers();
}

export function getModelRoot() {
    if (!sceneRef) return null;
    const meta = readRocketPart(sceneRef);
    const uuid = meta?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const byUuid = sceneRef.getObjectByProperty("uuid", uuid);
        if (byUuid && !byUuid.userData?.editorOnly) return byUuid;
    }

    const candidates = sceneRef.children.filter(object =>
        object !== helperRoot &&
        !object.userData?.editorOnly &&
        object.userData?.editorObject
    );

    const group = candidates.find(object => object.isGroup);
    return group || candidates[0] || null;
}

export function getModelLocalBounds() {
    const root = getModelRoot();
    if (!root) return null;

    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const bounds = new THREE.Box3();
    let found = false;

    root.traverse(object => {
        if (!object.isMesh || object.userData?.editorOnly || !object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (!object.geometry.boundingBox) return;
        const localMatrix = inverseRoot.clone().multiply(object.matrixWorld);
        const meshBox = object.geometry.boundingBox.clone().applyMatrix4(localMatrix);
        bounds.union(meshBox);
        found = true;
    });

    return found && !bounds.isEmpty() ? bounds : null;
}

export function ensureModelRootMetadata() {
    if (!sceneRef) return null;
    const root = getModelRoot();
    if (!root) return null;
    const current = readRocketPart(sceneRef) || {};
    const currentUUID = current.coordinateSystem?.modelRootUUID;
    if (currentUUID !== root.uuid) {
        updateRocketPart(sceneRef, {
            coordinateSystem: { modelRootUUID: root.uuid }
        });
    }
    return root;
}

function reparentHelperRoot() {
    if (!helperRoot || !sceneRef) return;
    const root = getModelRoot();
    if (root) {
        if (helperRoot.parent !== root) root.add(helperRoot);
    } else if (helperRoot.parent !== sceneRef) {
        sceneRef.add(helperRoot);
    }
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
    ensureModelRootMetadata();
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

export function upsertPresetNode(preset) {
    const existing = getAttachmentNodes().find(node => node.name === preset.name);
    if (existing) {
        updateAttachmentNode(existing.id, preset);
        selectAttachmentNode(existing.id);
        return getAttachmentNodes().find(node => node.id === existing.id) || null;
    }
    return addAttachmentNode(preset);
}

export function autoPlaceNode(preset) {
    const bounds = getModelLocalBounds();
    if (!bounds) return null;

    const center = bounds.getCenter(new THREE.Vector3());
    let position = center.clone();
    let direction = new THREE.Vector3(0, 1, 0);
    let type = "structural";
    let compatibleCategories = ["custom"];

    switch (preset) {
        case "top":
            position.set(center.x, bounds.max.y, center.z);
            direction.set(0, 1, 0);
            type = "structural";
            compatibleCategories = ["tank", "decoupler", "nose-cone", "custom"];
            break;
        case "bottom":
            position.set(center.x, bounds.min.y, center.z);
            direction.set(0, -1, 0);
            type = "structural";
            compatibleCategories = ["tank", "engine", "decoupler", "custom"];
            break;
        case "engine":
            position.set(center.x, bounds.min.y, center.z);
            direction.set(0, -1, 0);
            type = "engine";
            compatibleCategories = ["engine", "custom"];
            break;
        case "dock":
            position.set(center.x, center.y, bounds.max.z);
            direction.set(0, 0, 1);
            type = "dock";
            compatibleCategories = ["dock", "custom"];
            break;
        default:
            return null;
    }

    return upsertPresetNode({
        name: preset === "top" ? "Top Mount" :
            preset === "bottom" ? "Bottom Mount" :
            preset === "engine" ? "Engine Mount" : "Docking Point",
        type,
        position: position.toArray(),
        direction: direction.toArray(),
        rotation: [0, 0, 0],
        compatibleCategories
    });
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

    if (Array.isArray(patch.rotation)) {
        node.rotation = normalizeVector(patch.rotation);
        node.direction = directionFromRotation(node.rotation);
    } else if (Array.isArray(patch.direction)) {
        node.direction = normalizeDirection(patch.direction);
        node.rotation = rotationFromDirection(node.direction);
    }

    if (Array.isArray(patch.compatibleCategories)) {
        node.compatibleCategories = [...new Set(patch.compatibleCategories.map(String))];
    }

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
    reparentHelperRoot();
    const nodes = getAttachmentNodes();
    const wanted = new Set(nodes.map(node => node.id));
    const bounds = getModelLocalBounds();
    const radius = bounds ? Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.035, 0.04) : 0.08;
    const arrowLength = radius * 5;

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
        syncHelper(helper, node, radius, arrowLength);
    }
    updateHelperHighlight();
}

function createNodeHelper(node) {
    const group = new THREE.Group();
    group.name = `Node_${node.id}`;
    group.userData = { editorOnly: true, attachmentNodeHelper: true, nodeId: node.id };

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x67d4ff, depthTest: false })
    );
    sphere.renderOrder = 999;
    sphere.userData = group.userData;
    group.add(sphere);

    const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        1,
        0x67d4ff,
        0.25,
        0.16
    );
    arrow.line.renderOrder = 999;
    arrow.cone.renderOrder = 999;
    arrow.line.material.depthTest = false;
    arrow.cone.material.depthTest = false;
    group.add(arrow);

    const label = makeLabel(node.name || node.id);
    label.position.set(1.7, 1.25, 0);
    group.add(label);
    return group;
}

function syncHelper(helper, node, radius = 0.08, arrowLength = 0.42) {
    helper.position.set(...node.position);
    helper.rotation.set(...node.rotation.map(value => THREE.MathUtils.degToRad(value)));
    helper.userData.nodeId = node.id;

    const sphere = helper.children.find(child => child.isMesh);
    if (sphere) {
        sphere.scale.setScalar(radius);
        sphere.material.color.setHex(activeNodeId === node.id ? 0xffc857 : colorForType(node.type));
    }

    const arrow = helper.children.find(child => child.type === "ArrowHelper");
    if (arrow) {
        const dir = new THREE.Vector3(...node.direction).normalize();
        arrow.setDirection(dir);
        arrow.setLength(arrowLength, radius * 1.8, radius * 1.1);
        const color = activeNodeId === node.id ? 0xffc857 : colorForType(node.type);
        arrow.setColor(color);
    }

    const sprite = helper.children.find(child => child.userData?.attachmentNodeLabel);
    if (sprite) {
        sprite.position.set(radius * 2.1, radius * 1.5, 0);
        sprite.scale.set(radius * 11, radius * 2.75, 1);
        updateLabel(sprite, node.name || node.id);
    }
}

function updateHelperHighlight() {
    for (const [id, helper] of helpers) {
        const node = getAttachmentNodes().find(item => item.id === id);
        if (node) syncHelper(helper, node);
    }
}

function onCanvasClick(event) {
    if (!canvas || !camera || event.button !== 0 || nodeTransformBusy) return;
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

function directionFromRotation(rotation) {
    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rotation[0]),
        THREE.MathUtils.degToRad(rotation[1]),
        THREE.MathUtils.degToRad(rotation[2]),
        "XYZ"
    );
    return new THREE.Vector3(0, 1, 0).applyEuler(euler).normalize().toArray();
}

function rotationFromDirection(direction) {
    const dir = new THREE.Vector3(...normalizeDirection(direction));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
    return [
        THREE.MathUtils.radToDeg(euler.x),
        THREE.MathUtils.radToDeg(euler.y),
        THREE.MathUtils.radToDeg(euler.z)
    ];
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
