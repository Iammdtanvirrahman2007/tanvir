import * as THREE from "three";
import { camera, controls } from "./scene.js";

let pendingGroup = null;
let pendingMode = null;
let animationFrame = 0;

export function focusObject(object, options = {}) {
    if (!object || !camera || !controls) return false;
    object.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    return focusPoint(center, object, options);
}

export function focusGroupAverage(group, options = {}) {
    if (!group) return false;
    const objects = getFocusObjects(group);
    if (!objects.length) return focusObject(group, options);

    const average = new THREE.Vector3();
    for (const object of objects) {
        object.updateMatrixWorld(true);
        average.add(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()));
    }
    average.multiplyScalar(1 / objects.length);
    return focusPoint(average, group, options);
}

export function getFocusObjects(group) {
    const result = [];
    group.traverse(child => {
        if (child === group || child.userData?.editorOnly || !child.isMesh) return;
        let parent = child.parent;
        let nestedMesh = false;
        while (parent && parent !== group) {
            if (parent.isMesh) { nestedMesh = true; break; }
            parent = parent.parent;
        }
        if (!nestedMesh) result.push(child);
    });
    return result;
}

export function setFocusMode(group, mode) {
    pendingGroup = group || null;
    pendingMode = mode || null;
    window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: pendingGroup, mode: pendingMode } }));
}

export function consumeFocusTarget(object) {
    if (!object) return false;
    if (pendingMode === "select" && pendingGroup) {
        let current = object;
        while (current && current !== pendingGroup) current = current.parent;
        if (current !== pendingGroup) {
            window.dispatchEvent(new CustomEvent("editor:status", { detail: `Select an item inside ${pendingGroup.name || "the group"}` }));
            return true;
        }
        pendingGroup = null;
        pendingMode = null;
        focusObject(object, { duration: 360 });
        window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: null, mode: null } }));
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Focused ${object.name || object.type}` }));
        return true;
    }
    return false;
}

export function clearFocusMode() {
    pendingGroup = null;
    pendingMode = null;
    window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: null, mode: null } }));
}

export function getFocusMode() {
    return { group: pendingGroup, mode: pendingMode };
}

function focusPoint(target, object, options) {
    const duration = Math.max(0, Number(options.duration ?? 420));
    const offset = options.offset instanceof THREE.Vector3 ? options.offset.clone() : getCameraOffset(object);
    const endPosition = target.clone().add(offset);
    cancelAnimationFrame(animationFrame);

    if (!duration) {
        camera.position.copy(endPosition);
        controls.target.copy(target);
        controls.update();
        return true;
    }

    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const start = performance.now();
    const tick = now => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(startPosition, endPosition, eased);
        controls.target.lerpVectors(startTarget, target, eased);
        controls.update();
        if (t < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return true;
}

function getCameraOffset(object) {
    const currentOffset = camera.position.clone().sub(controls.target);
    if (currentOffset.lengthSq() > 0.0001) {
        const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 0.5);
        const distance = Math.max(radius * 2.8, currentOffset.length() * 0.45, 1.2);
        return currentOffset.normalize().multiplyScalar(distance);
    }
    return new THREE.Vector3(3, 2.5, 3);
}
