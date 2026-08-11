import * as THREE from "three";
import { camera, controls } from "./scene.js";
import { attachTransformPivot, attachTransform, hasTransformPivot } from "./transform.js";

let pendingGroup = null;
let pendingMode = null;
let animationFrame = 0;

export function focusObject(object, options = {}) {
    if (!object || !camera || !controls) return false;

    object.updateMatrixWorld(true);
    const { center, radius } = getFocusBounds(object);

    if (options.setPivotFor && options.setPivotFor !== object) {
        attachTransformPivot(options.setPivotFor, center);
    }

    const currentDirection = camera.position.clone().sub(controls.target);
    if (currentDirection.lengthSq() < 0.000001) currentDirection.set(1, 0.7, 1);
    currentDirection.normalize();

    const distance = Math.max(radius * 3.2, 1.5);
    const endPosition = center.clone().add(currentDirection.multiplyScalar(distance));
    const duration = Math.max(0, Number(options.duration ?? 420));

    cancelAnimationFrame(animationFrame);

    if (!duration) {
        camera.position.copy(endPosition);
        controls.target.copy(center);
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
        controls.target.lerpVectors(startTarget, center, eased);
        controls.update();
        if (t < 1) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return true;
}

export function focusGroupAverage(group, options = {}) {
    if (!group || !camera || !controls) return false;

    const objects = getFocusObjects(group);
    const average = new THREE.Vector3();

    if (objects.length) {
        for (const object of objects) {
            const bounds = getFocusBounds(object);
            average.add(bounds.center);
        }
        average.multiplyScalar(1 / objects.length);
    } else {
        average.copy(getFocusBounds(group).center);
    }

    group.userData.focusPoint = { x: average.x, y: average.y, z: average.z };
    group.userData.focusPointMode = "average";
    attachTransformPivot(group, average);
    return focusPoint(average, group, { ...options, duration: options.duration ?? 420 });
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
    if (pendingMode !== "select" || !pendingGroup) return false;

    let current = object;
    let inside = false;
    while (current) {
        if (current === pendingGroup) { inside = true; break; }
        current = current.parent;
    }

    if (!inside) {
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Select an item inside ${pendingGroup.name || "the group"}` }));
        return true;
    }

    const { center: targetCenter } = getFocusBounds(object);
    pendingGroup.userData.focusPoint = { x: targetCenter.x, y: targetCenter.y, z: targetCenter.z };
    pendingGroup.userData.focusPointMode = "object";
    pendingGroup.userData.focusPointObject = object.uuid;
    attachTransformPivot(pendingGroup, targetCenter);
    pendingGroup.updateMatrixWorld(true);

    const focusedName = object.name || object.type || "item";
    pendingGroup = null;
    pendingMode = null;
    focusPoint(targetCenter, object, { duration: 360 });
    window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: null, mode: null } }));
    window.dispatchEvent(new CustomEvent("editor:status", { detail: `Focused ${focusedName} · group pivot set` }));
    return true;
}

export function clearFocusMode() {
    pendingGroup = null;
    pendingMode = null;
    window.dispatchEvent(new CustomEvent("editor:focus-mode", { detail: { group: null, mode: null } }));
}

export function getFocusMode() { return { group: pendingGroup, mode: pendingMode }; }

export function clearFocusPivot() {
    if (hasTransformPivot()) attachTransform(null);
}

function focusPoint(target, object, options = {}) {
    if (!camera || !controls) return false;
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

function getFocusBounds(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        return { center, radius: Math.max(sphere.radius, 0.25) };
    }

    // Some ModelForge scene/group wrapper objects have no direct geometry.
    // They are still valid focus targets, so fall back to their world position
    // instead of reporting "Unable to focus selected object".
    const center = object.getWorldPosition(new THREE.Vector3());
    let radius = 0.5;

    object.traverse?.(child => {
        if (!child.isMesh || !child.geometry) return;
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
        if (child.geometry.boundingSphere) {
            const worldScale = child.getWorldScale(new THREE.Vector3());
            radius = Math.max(
                radius,
                child.geometry.boundingSphere.radius * Math.max(worldScale.x, worldScale.y, worldScale.z)
            );
        }
    });

    return { center, radius };
}

function getCameraOffset(object) {
    const currentOffset = camera.position.clone().sub(controls.target);
    if (currentOffset.lengthSq() > 0.0001) {
        const { radius } = getFocusBounds(object);
        const distance = Math.max(radius * 2.8, currentOffset.length() * 0.45, 1.2);
        return currentOffset.normalize().multiplyScalar(distance);
    }
    return new THREE.Vector3(3, 2.5, 3);
}
