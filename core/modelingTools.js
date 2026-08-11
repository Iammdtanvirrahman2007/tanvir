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

/**
 * Mirror the object's transform across the selected WORLD axis.
 *
 * A mirror operation is a spatial reflection, not a negative-scale operation.
 * Therefore position is reflected while scale is preserved. Rotation is also
 * adjusted so the object's orientation follows the reflected coordinate frame.
 */
export function mirrorObject(object, axis = "x") {
    if (!object || !["x", "y", "z"].includes(axis)) return false;

    const previous = captureTransform(object);
    const next = captureTransform(object);

    // Reflect position through the corresponding world-origin plane.
    next.position[axis] *= -1;

    // Reflect Euler orientation across the same plane.
    // Scale intentionally remains unchanged.
    if (axis === "x") {
        next.rotation.y *= -1;
        next.rotation.z *= -1;
    } else if (axis === "y") {
        next.rotation.x *= -1;
        next.rotation.z *= -1;
    } else {
        next.rotation.x *= -1;
        next.rotation.y *= -1;
    }

    applyTransform(object, next);

    pushHistory({
        label: `Mirror ${axis.toUpperCase()}`,
        undo: () => applyTransform(object, previous),
        redo: () => applyTransform(object, next)
    });

    refreshInspector();
    dispatch("editor:modeling-change", { action: "mirror", object, axis, space: "world" });
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

function captureTransform(object) {
    return {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone()
    };
}

function applyTransform(object, transform) {
    object.position.copy(transform.position);
    object.rotation.copy(transform.rotation);
    object.scale.copy(transform.scale);
    object.updateMatrix();
    object.updateMatrixWorld(true);
}

function uniqueName(base, scene) {
    const names = new Set(); scene.traverse(item => names.add(item.name));
    if (!names.has(base)) return base;
    let i = 1; while (names.has(`${base}.${String(i).padStart(3, "0")}`)) i++;
    return `${base}.${String(i).padStart(3, "0")}`;
}

function dispatch(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }
