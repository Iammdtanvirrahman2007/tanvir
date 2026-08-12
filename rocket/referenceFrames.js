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

export function setCoordinateSystemPatch(patch = {}) {
    if (!sceneRef) return null;
    const part = readRocketPart(sceneRef);
    const current = part?.coordinateSystem || {};
    const next = { ...current };
    if (patch.upAxis) next.upAxis = normalizeAxis(patch.upAxis, current.upAxis || "Y");
    if (patch.forwardAxis) next.forwardAxis = normalizeForwardAxis(patch.forwardAxis, next.upAxis || "Y");
    if (Array.isArray(patch.origin)) next.origin = normalizeVector(patch.origin);
    if (patch.bottomPlaneY != null && Number.isFinite(Number(patch.bottomPlaneY))) next.bottomPlaneY = Number(patch.bottomPlaneY);
    if (patch.topPlaneY != null && Number.isFinite(Number(patch.topPlaneY))) next.topPlaneY = Number(patch.topPlaneY);
    if (next.forwardAxis === next.upAxis) next.forwardAxis = next.upAxis === "Y" ? "Z" : "Y";
    updateRocketPart(sceneRef, { coordinateSystem: next });
    refreshReferenceFrames();
    return next;
}

export function setOriginToModelCenter() {
    const box = getModelLocalBounds();
    if (!box) return null;
    const part = readRocketPart(sceneRef);
    const cs = part?.coordinateSystem || {};
    const upAxis = normalizeAxis(cs.upAxis, "Y");
    const center = box.getCenter(new THREE.Vector3());
    const minUp = getAxisValue(box.min, upAxis);
    const maxUp = getAxisValue(box.max, upAxis);
    const originUp = getAxisValue(center, upAxis);
    const origin = center.toArray();
    const result = {
        origin,
        bottomPlaneY: minUp - originUp,
        topPlaneY: maxUp - originUp
    };
    updateRocketPart(sceneRef, { coordinateSystem: result });
    refreshReferenceFrames();
    return result;
}

export function setBottomPlaneFromModel() {
    const box = getModelLocalBounds();
    if (!box) return null;
    const part = readRocketPart(sceneRef);
    const cs = part?.coordinateSystem || {};
    const upAxis = normalizeAxis(cs.upAxis, "Y");
    const origin = normalizeVector(cs.origin);
    const value = getAxisValue(box.min, upAxis) - getAxisValue(new THREE.Vector3(...origin), upAxis);
    updateRocketPart(sceneRef, { coordinateSystem: { bottomPlaneY: value } });
    refreshReferenceFrames();
    return value;
}

export function setTopPlaneFromModel() {
    const box = getModelLocalBounds();
    if (!box) return null;
    const part = readRocketPart(sceneRef);
    const cs = part?.coordinateSystem || {};
    const upAxis = normalizeAxis(cs.upAxis, "Y");
    const origin = normalizeVector(cs.origin);
    const value = getAxisValue(box.max, upAxis) - getAxisValue(new THREE.Vector3(...origin), upAxis);
    updateRocketPart(sceneRef, { coordinateSystem: { topPlaneY: value } });
    refreshReferenceFrames();
    return value;
}

export function getModelBounds() { return getModelLocalBounds(); }

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
    const upAxis = normalizeAxis(cs.upAxis, "Y");
    const forwardAxis = normalizeForwardAxis(cs.forwardAxis, upAxis);
    const origin = new THREE.Vector3(...normalizeVector(cs.origin));
    const originUp = getAxisValue(origin, upAxis);
    const bottomOffset = Number.isFinite(Number(cs.bottomPlaneY)) ? Number(cs.bottomPlaneY) : getAxisValue(box.min, upAxis) - originUp;
    const topOffset = Number.isFinite(Number(cs.topPlaneY)) ? Number(cs.topPlaneY) : getAxisValue(box.max, upAxis) - originUp;
    const size = box.getSize(new THREE.Vector3());
    const guideSize = Math.max(size.length() * 0.18, 0.4);

    root.add(makeAxes(origin, guideSize, upAxis, forwardAxis));
    root.add(makePlaneGuide("Bottom Plane", originUp + bottomOffset, box, upAxis, 0x67d4ff));
    root.add(makePlaneGuide("Top Plane", originUp + topOffset, box, upAxis, 0xffc857));
}

function getModelRoot() {
    if (!sceneRef) return null;
    const meta = readRocketPart(sceneRef);
    const uuid = meta?.coordinateSystem?.modelRootUUID;
    if (uuid) {
        const object = sceneRef.getObjectByProperty("uuid", uuid);
        if (object && !object.userData?.editorOnly && !object.userData?.attachmentNode) return object;
    }
    return sceneRef.children.find(object => !object.userData?.editorOnly && object.userData?.editorObject && !object.userData?.attachmentNode) || null;
}

function getModelLocalBounds() {
    const modelRoot = getModelRoot();
    if (!modelRoot) return null;
    modelRoot.updateWorldMatrix(true, true);
    const inverseRoot = modelRoot.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    let found = false;
    modelRoot.traverse(object => {
        if (!object.isMesh || object.userData?.editorOnly || object.userData?.attachmentNode || !object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (!object.geometry.boundingBox) return;
        const relativeMatrix = inverseRoot.clone().multiply(object.matrixWorld);
        box.union(object.geometry.boundingBox.clone().applyMatrix4(relativeMatrix));
        found = true;
    });
    return found && !box.isEmpty() ? box : null;
}

function hideReferenceFrames() { if (root) root.visible = false; }

function makeAxes(origin, size, upAxis, forwardAxis) {
    const group = new THREE.Group();
    group.userData = { editorOnly: true, rocketReferenceGuide: true };
    const up = axisVector(upAxis);
    const forward = axisVector(forwardAxis);
    const side = new THREE.Vector3().crossVectors(forward, up).normalize();
    const directions = [
        [side, 0xff6666],
        [up, 0x67d4ff],
        [forward, 0x8ef0a5]
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

function makePlaneGuide(name, coordinate, box, upAxis, color) {
    const group = new THREE.Group();
    group.name = `__${name.replace(/\s+/g, "_")}`;
    group.userData = { editorOnly: true, rocketReferenceGuide: true };
    const axes = planeAxes(upAxis);
    const width = Math.max(getAxisSpan(box, axes.a), 0.5) * 0.75;
    const depth = Math.max(getAxisSpan(box, axes.b), 0.5) * 0.75;
    const geo = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthTest: false });
    const mesh = new THREE.Mesh(geo, mat);
    orientPlane(mesh, upAxis);
    const center = box.getCenter(new THREE.Vector3());
    setAxisValue(center, upAxis, coordinate);
    mesh.position.copy(center);
    mesh.renderOrder = 995;
    mesh.userData = group.userData;
    group.add(mesh);
    return group;
}

function planeAxes(upAxis) {
    if (upAxis === "X") return { a: "Y", b: "Z" };
    if (upAxis === "Z") return { a: "X", b: "Y" };
    return { a: "X", b: "Z" };
}

function orientPlane(mesh, upAxis) {
    if (upAxis === "X") mesh.rotation.y = Math.PI / 2;
    else if (upAxis === "Z") mesh.rotation.x = 0;
    else mesh.rotation.x = -Math.PI / 2;
}

function getAxisValue(vector, axis) { return axis === "X" ? vector.x : axis === "Z" ? vector.z : vector.y; }
function setAxisValue(vector, axis, value) { if (axis === "X") vector.x = value; else if (axis === "Z") vector.z = value; else vector.y = value; }
function getAxisSpan(box, axis) { return axis === "X" ? box.max.x - box.min.x : axis === "Z" ? box.max.z - box.min.z : box.max.y - box.min.y; }
function axisVector(axis) { return axis === "X" ? new THREE.Vector3(1, 0, 0) : axis === "Z" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0); }
function normalizeAxis(value, fallback = "Y") { const axis = String(value || fallback).toUpperCase(); return ["X", "Y", "Z"].includes(axis) ? axis : fallback; }
function normalizeForwardAxis(value, upAxis) { const axis = normalizeAxis(value, "Z"); return axis === upAxis ? (upAxis === "Y" ? "Z" : "Y") : axis; }
function normalizeVector(value) { return [0,1,2].map(i => Number.isFinite(Number(value?.[i])) ? Number(value[i]) : 0); }
