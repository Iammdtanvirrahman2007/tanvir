import * as THREE from "three";
import { readRocketPart, updateRocketPart } from "./rocketPart.js";

let sceneRef = null;
let root = null;
let guidesVisible = true;

export function initReferenceFrames(scene) {
    sceneRef = scene;
    if (!sceneRef) return;
    root?.removeFromParent();
    root = new THREE.Group();
    root.name = "__editorRocketReferenceFrames";
    root.userData = { editorOnly: true, rocketReferenceFrames: true };
    sceneRef.add(root);
    window.addEventListener("editor:rocket-part-mode", event => { if (event.detail) refreshReferenceFrames(); else hideReferenceFrames(); });
    window.addEventListener("editor:rocket-part-change", refreshReferenceFrames);
    refreshReferenceFrames();
}

export function setReferenceGuidesVisible(visible) {
    guidesVisible = !!visible;
    if (root) root.visible = guidesVisible;
}

export function areReferenceGuidesVisible() { return guidesVisible; }

export function setOriginToModelCenter() {
    if (!sceneRef) return null;
    const box = getModelBounds();
    if (!box) return null;
    const center = box.getCenter(new THREE.Vector3());
    const part = readRocketPart(sceneRef);
    updateRocketPart(sceneRef, { coordinateSystem: { origin: [center.x, center.y, center.z], bottomPlaneY: box.min.y, topPlaneY: box.max.y } });
    refreshReferenceFrames();
    return { origin: [center.x, center.y, center.z], bottomPlaneY: box.min.y, topPlaneY: box.max.y };
}

export function setBottomPlaneFromModel() {
    if (!sceneRef) return null;
    const box = getModelBounds();
    if (!box) return null;
    updateRocketPart(sceneRef, { coordinateSystem: { bottomPlaneY: box.min.y } });
    refreshReferenceFrames();
    return box.min.y;
}

export function setTopPlaneFromModel() {
    if (!sceneRef) return null;
    const box = getModelBounds();
    if (!box) return null;
    updateRocketPart(sceneRef, { coordinateSystem: { topPlaneY: box.max.y } });
    refreshReferenceFrames();
    return box.max.y;
}

export function getModelBounds() {
    if (!sceneRef) return null;
    const box = new THREE.Box3();
    let found = false;
    sceneRef.traverse(object => {
        if (object === sceneRef || object.userData?.editorOnly || !object.isMesh) return;
        if (object.userData?.editorAttachmentNodeHelper || object.userData?.attachmentNodeHelper) return;
        box.expandByObject(object);
        found = true;
    });
    return found && !box.isEmpty() ? box : null;
}

export function refreshReferenceFrames() {
    if (!root || !sceneRef) return;
    root.visible = guidesVisible;
    root.clear();
    const part = readRocketPart(sceneRef);
    const box = getModelBounds();
    if (!part || !box) return;
    const cs = part.coordinateSystem || {};
    const origin = Array.isArray(cs.origin) ? cs.origin : [0, 0, 0];
    const bottomY = Number.isFinite(Number(cs.bottomPlaneY)) ? Number(cs.bottomPlaneY) : box.min.y;
    const topY = Number.isFinite(Number(cs.topPlaneY)) ? Number(cs.topPlaneY) : box.max.y;
    root.add(makeAxes(new THREE.Vector3(...origin), Math.max(box.getSize(new THREE.Vector3()).length() * 0.18, 0.4)));
    root.add(makePlaneGuide("Bottom Plane", bottomY, box, 0x67d4ff));
    root.add(makePlaneGuide("Top Plane", topY, box, 0xffc857));
}

function hideReferenceFrames() { if (root) root.visible = false; }

function makeAxes(origin, size) {
    const group = new THREE.Group();
    group.userData = { editorOnly: true, rocketReferenceGuide: true };
    const directions = [
        [new THREE.Vector3(1, 0, 0), 0xff6666, "X"],
        [new THREE.Vector3(0, 1, 0), 0x67d4ff, "Y"],
        [new THREE.Vector3(0, 0, 1), 0x8ef0a5, "Z"]
    ];
    directions.forEach(([dir, color]) => {
        const arrow = new THREE.ArrowHelper(dir, origin, size, color, size * 0.13, size * 0.08);
        arrow.line.material.depthTest = false; arrow.cone.material.depthTest = false;
        arrow.renderOrder = 998; arrow.line.renderOrder = 998; arrow.cone.renderOrder = 998;
        group.add(arrow);
    });
    return group;
}

function makePlaneGuide(name, y, box, color) {
    const group = new THREE.Group();
    group.name = `__${name.replace(/\s+/g, "_")}`;
    group.userData = { editorOnly: true, rocketReferenceGuide: true };
    const width = Math.max(box.max.x - box.min.x, 0.5) * 0.75;
    const depth = Math.max(box.max.z - box.min.z, 0.5) * 0.75;
    const geo = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((box.min.x + box.max.x) / 2, y, (box.min.z + box.max.z) / 2);
    mesh.renderOrder = 995;
    mesh.userData = group.userData;
    group.add(mesh);
    return group;
}
