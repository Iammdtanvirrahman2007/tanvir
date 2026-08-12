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
    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) refreshReferenceFrames();
        else hideReferenceFrames();
    });
    window.addEventListener("editor:rocket-part-change", refreshReferenceFrames);
    refreshReferenceFrames();
}

export function setReferenceGuidesVisible(visible) {
    guidesVisible = !!visible;
    if (root) root.visible = guidesVisible;
}

export function areReferenceGuidesVisible() { return guidesVisible; }

export function setOriginToModelCenter() {
    const box = getModelLocalBounds();
    if (!box) return null;
    const center = box.getCenter(new THREE.Vector3());
    const result = {
        origin: [center.x, center.y, center.z],
        bottomPlaneY: box.min.y,
        topPlaneY: box.max.y
    };
    updateRocketPart(sceneRef, { coordinateSystem: result });
    refreshReferenceFrames();
    return result;
}

export function setBottomPlaneFromModel() {
    const box = getModelLocalBounds();
    if (!box) return null;
    updateRocketPart(sceneRef, { coordinateSystem: { bottomPlaneY: box.min.y } });
    refreshReferenceFrames();
    return box.min.y;
}

export function setTopPlaneFromModel() {
    const box = getModelLocalBounds();
    if (!box) return null;
    updateRocketPart(sceneRef, { coordinateSystem: { topPlaneY: box.max.y } });
    refreshReferenceFrames();
    return box.max.y;
}

export function getModelBounds() {
    return getModelLocalBounds();
}

export function refreshReferenceFrames() {
    if (!root || !sceneRef) return;

    const part = readRocketPart(sceneRef);
    const box = getModelLocalBounds();
    root.visible = guidesVisible;
    root.clear();
    if (!part || !box) return;

    const modelRoot = getModelRoot();
    if (modelRoot && root.parent !== modelRoot) modelRoot.add(root);

    const cs = part.coordinateSystem || {};
    const origin = Array.isArray(cs.origin) ? cs.origin : [0, 0, 0];
    const bottomY = Number.isFinite(Number(cs.bottomPlaneY)) ? Number(cs.bottomPlaneY) : box.min.y;
    const topY = Number.isFinite(Number(cs.topPlaneY)) ? Number(cs.topPlaneY) : box.max.y;
    const size = box.getSize(new THREE.Vector3());
    const guideSize = Math.max(size.length() * 0.18, 0.4);

    root.add(makeAxes(new THREE.Vector3(...origin), guideSize));
    root.add(makePlaneGuide("Bottom Plane", bottomY, box, 0x67d4ff));
    root.add(makePlaneGuide("Top Plane", topY, box, 0xffc857));
}

function getModelRoot() {
    if (!sceneRef) return null;
    const meta = readRocketPart(sceneRef);
    const uuid = meta?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const object = sceneRef.getObjectByProperty("uuid", uuid);
        if (object && !object.userData?.editorOnly) return object;
    }
    return sceneRef.children.find(object =>
        !object.userData?.editorOnly && object.userData?.editorObject
    ) || null;
}

function getModelLocalBounds() {
    const modelRoot = getModelRoot();
    if (!modelRoot) return null;

    modelRoot.updateWorldMatrix(true, true);
    const inverseRoot = modelRoot.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    let found = false;

    modelRoot.traverse(object => {
        if (!object.isMesh || object.userData?.editorOnly || !object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (!object.geometry.boundingBox) return;
        const relativeMatrix = inverseRoot.clone().multiply(object.matrixWorld);
        box.union(object.geometry.boundingBox.clone().applyMatrix4(relativeMatrix));
        found = true;
    });

    return found && !box.isEmpty() ? box : null;
}

function hideReferenceFrames() { if (root) root.visible = false; }

function makeAxes(origin, size) {
    const group = new THREE.Group();
    group.userData = { editorOnly: true, rocketReferenceGuide: true };
    const directions = [
        [new THREE.Vector3(1, 0, 0), 0xff6666],
        [new THREE.Vector3(0, 1, 0), 0x67d4ff],
        [new THREE.Vector3(0, 0, 1), 0x8ef0a5]
    ];
    directions.forEach(([dir, color]) => {
        const arrow = new THREE.ArrowHelper(dir, origin, size, color, size * 0.13, size * 0.08);
        arrow.line.material.depthTest = false;
        arrow.cone.material.depthTest = false;
        arrow.renderOrder = 998;
        arrow.line.renderOrder = 998;
        arrow.cone.renderOrder = 998;
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
