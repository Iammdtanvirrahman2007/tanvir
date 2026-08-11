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
        average.add(object.getWorldPosition(new THREE.Vector3()));
    }
    average.multiplyScalar(1 / objects.length);
    return focusPoint(average, group, options);
}

export function getFocusObjects(group) {
    const result = [];
    group.traverse(child => {
        if (child === group) return;
        if (child.userData?.editorOnly) return;
        if (child.isMesh || child.userData?.selectable === true || child.userData?.editorObject === true) result.push(child);
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
        let inside = false;
        while (current) {
            if (current === pendingGroup) { inside = true; break; }
            current = current.parent;
        }
        if (!inside) return false;
        pendingGroup = null;
        pendingMode = null;
        focusObject(object, { duration: 360 });
        window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: null, mode: null } }));
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
    const offset = options.offset instanceof THREE.Vector3 ? options.offset.clone() : getCameraOffset(object, target);
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

function getCameraOffset(object, target) {
    const currentOffset = camera.position.clone().sub(controls.target);
    if (currentOffset.lengthSq() > 0.0001) {
        const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 0.5);
        const distance = Math.max(radius * 2.8, currentOffset.length() * 0.45, 1.2);
        return currentOffset.normalize().multiplyScalar(distance);
    }
    return new THREE.Vector3(3, 2.5, 3);
}
