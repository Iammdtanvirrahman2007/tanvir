import * as THREE from "three";
import { readRocketPart, updateRocketPart } from "./rocketPart.js";

let sceneRef = null;
let root = null;
let visible = false;
let originHelper = null;
let topHelper = null;
let bottomHelper = null;

export function initReferenceGuides(scene) {
    sceneRef = scene;
    if (!sceneRef) return;
    root?.removeFromParent();
    root = new THREE.Group();
    root.name = "__editorRocketReferenceGuides";
    root.userData = { editorOnly: true, rocketReferenceGuides: true };
    root.visible = visible;
    sceneRef.add(root);
    refreshReferenceGuides();
}

export function isReferenceGuidesVisible() { return visible; }

export function toggleReferenceGuides() {
    visible = !visible;
    if (root) root.visible = visible;
    if (visible) refreshReferenceGuides();
    return visible;
}

export function setOriginToModelCenter() {
    const box = measureModel();
    if (!box) return false;
    const center = box.getCenter(new THREE.Vector3());
    updateRocketPart(sceneRef, { coordinateSystem: { origin: [center.x, center.y, center.z] } });
    refreshReferenceGuides();
    return true;
}

export function setBottomPlaneFromModel() {
    const box = measureModel();
    if (!box) return false;
    const current = readRocketPart(sceneRef) || {};
    const coordinateSystem = current.coordinateSystem || {};
    updateRocketPart(sceneRef, { coordinateSystem: { bottomPlaneY: box.min.y, topPlaneY: Number.isFinite(coordinateSystem.topPlaneY) ? coordinateSystem.topPlaneY : box.max.y } });
    refreshReferenceGuides();
    return true;
}

export function setTopPlaneFromModel() {
    const box = measureModel();
    if (!box) return false;
    const current = readRocketPart(sceneRef) || {};
    const coordinateSystem = current.coordinateSystem || {};
    updateRocketPart(sceneRef, { coordinateSystem: { topPlaneY: box.max.y, bottomPlaneY: Number.isFinite(coordinateSystem.bottomPlaneY) ? coordinateSystem.bottomPlaneY : box.min.y } });
    refreshReferenceGuides();
    return true;
}

export function refreshReferenceGuides() {
    if (!root || !sceneRef) return;
    clearRoot();
    const box = measureModel();
    const part = readRocketPart(sceneRef) || {};
    const cs = part.coordinateSystem || {};
    const fallback = box ? box : new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const center = fallback.getCenter(new THREE.Vector3());
    const origin = Array.isArray(cs.origin) ? new THREE.Vector3(...cs.origin) : center.clone();
    const bottomY = Number.isFinite(Number(cs.bottomPlaneY)) ? Number(cs.bottomPlaneY) : fallback.min.y;
    const topY = Number.isFinite(Number(cs.topPlaneY)) ? Number(cs.topPlaneY) : fallback.max.y;
    const width = Math.max(fallback.max.x - fallback.min.x, 2) * 1.25;
    const depth = Math.max(fallback.max.z - fallback.min.z, 2) * 1.25;

    originHelper = createOrigin(origin);
    bottomHelper = createPlane(bottomY, width, depth, "BOTTOM PLANE", 0x4f7cff);
    topHelper = createPlane(topY, width, depth, "TOP PLANE", 0x6ee7a8);
    root.add(originHelper, bottomHelper, topHelper);
    root.visible = visible;
}

function measureModel() {
    if (!sceneRef) return null;
    const box = new THREE.Box3();
    let found = false;
    sceneRef.children.forEach(rootObject => {
        if (rootObject.userData?.editorOnly || !rootObject.userData?.editorObject) return;
        rootObject.traverse(object => {
            if (!object.isMesh || object.userData?.editorOnly) return;
            box.expandByObject(object);
            found = true;
        });
    });
    return found && !box.isEmpty() ? box : null;
}

function clearRoot() {
    while (root?.children.length) {
        const child = root.children.pop();
        dispose(child);
    }
}

function createOrigin(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData = { editorOnly: true, referenceGuide: "origin" };
    const axes = new THREE.AxesHelper(0.5);
    axes.renderOrder = 1000;
    group.add(axes);
    const label = makeLabel("ORIGIN", 0xf5d06f);
    label.position.set(0.15, 0.12, 0);
    group.add(label);
    return group;
}

function createPlane(y, width, depth, text, color) {
    const group = new THREE.Group();
    group.position.y = y;
    group.userData = { editorOnly: true, referenceGuide: text.toLowerCase().replace(/ /g, "-") };
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 900;
    plane.userData = group.userData;
    group.add(plane);

    const halfW = width / 2;
    const halfD = depth / 2;
    const points = [
        new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(halfW, 0, -halfD),
        new THREE.Vector3(halfW, 0, halfD), new THREE.Vector3(-halfW, 0, halfD),
        new THREE.Vector3(-halfW, 0, -halfD)
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = 1001;
    group.add(line);

    const label = makeLabel(text, color);
    label.position.set(-halfW + 0.2, 0.06, -halfD + 0.2);
    group.add(label);
    return group;
}

function makeLabel(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#0b0d11";
    ctx.lineWidth = 6;
    ctx.strokeText(text, 6, 40);
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fillText(text, 6, 40);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(1.8, 0.225, 1);
    sprite.renderOrder = 1002;
    sprite.userData = { editorOnly: true, referenceGuideLabel: true };
    return sprite;
}

function dispose(object) {
    object.traverse?.(child => {
        child.geometry?.dispose?.();
        const material = child.material;
        if (Array.isArray(material)) material.forEach(item => item.dispose?.());
        else material?.dispose?.();
    });
}
