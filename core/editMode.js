import * as THREE from "three";
import { refreshInspector } from "../ui/inspector.js";

let active = false;
let mode = "vertex";
let target = null;
const selected = new Set();

export function enterEditMode(object) {
    if (!object?.isMesh) return false;
    target = object;
    active = true;
    selected.clear();
    mode = "vertex";
    object.userData.editMode = true;
    object.userData.editSelection = { mode, indices: [] };
    object.updateMatrixWorld(true);
    notify("enter");
    refreshInspector();
    return true;
}

export function exitEditMode() {
    if (!target) return false;
    target.userData.editMode = false;
    target.userData.editSelection = { mode, indices: [...selected] };
    selected.clear();
    target = null;
    active = false;
    notify("exit");
    refreshInspector();
    return true;
}

export function isEditMode() { return active; }
export function getEditObject() { return target; }
export function getEditMode() { return mode; }

export function setEditSelectionMode(nextMode) {
    if (!active || !["vertex", "edge", "face"].includes(nextMode)) return false;
    mode = nextMode;
    selected.clear();
    target.userData.editSelection = { mode, indices: [] };
    notify("selection-mode");
    return true;
}

export function toggleEditSelection(index, additive = false) {
    if (!active || !Number.isInteger(index) || index < 0) return false;
    if (!additive) selected.clear();
    if (selected.has(index)) selected.delete(index); else selected.add(index);
    target.userData.editSelection = { mode, indices: [...selected] };
    notify("selection");
    return true;
}

export function clearEditSelection() {
    selected.clear();
    if (target) target.userData.editSelection = { mode, indices: [] };
    notify("selection-clear");
}

export function getEditSelection() { return { mode, indices: [...selected] }; }

export function getEditGeometryStats() {
    const geometry = target?.geometry;
    if (!geometry) return { vertices: 0, triangles: 0 };
    const vertices = geometry.attributes.position?.count || 0;
    const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3;
    return { vertices, triangles };
}

export function focusEditSelection(camera, controls) {
    if (!target || !camera || !controls) return false;
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return false;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.7, 1);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.65, radius));
    camera.lookAt(center);
    controls.update();
    return true;
}

function notify(action) {
    window.dispatchEvent(new CustomEvent("editor:edit-mode-change", { detail: { action, active, mode, object: target, selection: [...selected] } }));
}
