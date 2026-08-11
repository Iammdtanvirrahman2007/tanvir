import * as THREE from "three";
import { pushHistory } from "./history.js";
import { refreshInspector } from "../ui/inspector.js";

export function duplicateObject(object, scene) {
    if (!object || !scene) return null;
    const clone = object.clone(true);
    clone.name = uniqueName(object.name || "Object", scene);
    clone.position.add(new THREE.Vector3(0.5, 0.5, 0.5));
    clone.userData = { ...object.userData, modelingSource: object.uuid };
    scene.add(clone);
    pushHistory({ label: "Duplicate object", undo: () => scene.remove(clone), redo: () => scene.add(clone) });
    refreshInspector();
    dispatch("editor:modeling-change", { action: "duplicate", object: clone });
    return clone;
}

export function mirrorObject(object, axis = "x") {
    if (!object || !["x", "y", "z"].includes(axis)) return false;
    const previous = object.scale.clone();
    object.scale[axis] *= -1;
    object.updateMatrixWorld(true);
    const next = object.scale.clone();
    pushHistory({ label: `Mirror ${axis.toUpperCase()}`, undo: () => { object.scale.copy(previous); object.updateMatrixWorld(true); }, redo: () => { object.scale.copy(next); object.updateMatrixWorld(true); } });
    refreshInspector();
    dispatch("editor:modeling-change", { action: "mirror", object, axis });
    return true;
}

export function arrayDuplicate(object, scene, count = 3, offset = { x: 2, y: 0, z: 0 }) {
    if (!object || !scene || count < 1) return [];
    const created = [];
    for (let i = 1; i <= count; i++) {
        const clone = object.clone(true);
        clone.name = uniqueName(`${object.name || "Object"}.${i.toString().padStart(3, "0")}`, scene);
        clone.position.copy(object.position).add(new THREE.Vector3(offset.x * i, offset.y * i, offset.z * i));
        clone.userData = { ...object.userData, modelingSource: object.uuid };
        scene.add(clone); created.push(clone);
    }
    pushHistory({ label: `Array ${count}`, undo: () => created.forEach(item => scene.remove(item)), redo: () => created.forEach(item => scene.add(item)) });
    refreshInspector();
    dispatch("editor:modeling-change", { action: "array", object, created, count, offset });
    return created;
}

export function applyBevel(object, amount = 0.08, segments = 2) {
    if (!object?.geometry) return false;
    const previous = object.geometry.clone();
    if (object.geometry.type === "BoxGeometry") {
        const box = new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position);
        const size = new THREE.Vector3(); box.getSize(size);
        const min = Math.min(size.x, size.y, size.z);
        const factor = THREE.MathUtils.clamp(1 - amount / Math.max(min, 0.001), 0.05, 1);
        object.scale.multiplyScalar(1 / factor);
    }
    object.userData.bevel = { amount, segments };
    const next = object.geometry.clone();
    pushHistory({ label: "Bevel", undo: () => { object.geometry.dispose(); object.geometry = previous; }, redo: () => { object.geometry.dispose(); object.geometry = next; } });
    refreshInspector();
    dispatch("editor:modeling-change", { action: "bevel", object, amount, segments });
    return true;
}

export function getModelingTools() {
    return { duplicateObject, mirrorObject, arrayDuplicate, applyBevel };
}

function uniqueName(base, scene) {
    const names = new Set(); scene.traverse(item => names.add(item.name));
    if (!names.has(base)) return base;
    let i = 1; while (names.has(`${base}.${String(i).padStart(3, "0")}`)) i++;
    return `${base}.${String(i).padStart(3, "0")}`;
}

function dispatch(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }
