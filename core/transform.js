import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { pushHistory } from "./history.js";
import { refreshInspector } from "../ui/inspector.js";

let transform = null;
let snapEnabled = false;
let snapValues = { translation: 1, rotation: 15, scale: 0.1 };
let startState = null;
let pivotState = null;
let spaceMode = "world";
let transformEnabled = true;

export function setupTransform(camera, renderer, scene, orbitControls) {
    transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSize(0.85);
    applyTransformSpace();
    transform.enabled = true;
    transform.visible = true;
    scene.add(transform.getHelper());
    applySnapSettings();

    transform.addEventListener("dragging-changed", event => {
        if (orbitControls) orbitControls.enabled = !event.value;
        const object = pivotState?.object || transform.object;

        window.dispatchEvent(new CustomEvent("editor:gizmo-drag", {
            detail: {
                active: !!event.value,
                object: object || null,
                mode: transform.mode,
                axis: transform.axis || null,
                space: spaceMode
            }
        }));

        if (!object) return;

        if (event.value) {
            object.updateMatrixWorld(true);
            startState = captureWorld(object);
            return;
        }

        object.updateMatrixWorld(true);
        const endState = captureWorld(object);
        if (!startState || statesEqual(startState, endState)) {
            startState = null;
            return;
        }

        const historyObject = object;
        pushHistory({
            label: `${transform.mode} ${spaceMode} transform`,
            undo: () => { restoreWorld(historyObject, startState); refreshInspector(); },
            redo: () => { restoreWorld(historyObject, endState); refreshInspector(); }
        });
        startState = null;
        refreshInspector();
        dispatchModeChange();
    });

    transform.addEventListener("objectChange", () => {
        refreshInspector();
        const object = pivotState?.object || transform.object;
        if (object) {
            window.dispatchEvent(new CustomEvent("editor:gizmo-change", {
                detail: {
                    object,
                    mode: transform.mode,
                    axis: transform.axis || null,
                    space: spaceMode
                }
            }));
        }
    });
    return transform;
}

export function attachTransform(object) {
    if (!transform || !object || !transformEnabled) return;
    clearPivot();
    transform.attach(object);
    applyTransformSpace();
    transform.visible = true;
    refreshInspector();
}

export function attachTransformPivot(object, worldPoint) {
    if (!transform || !object || !worldPoint || object === transform.getHelper() || !transformEnabled) return false;
    if (!object.parent) return false;

    clearPivot();
    object.updateMatrixWorld(true);

    const parent = object.parent;
    const pivot = new THREE.Group();
    pivot.name = "__editorTransformPivot";
    pivot.userData = {
        editorOnly: true,
        editorTransformPivot: true,
        pivotTarget: object.uuid,
        pivotPoint: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z }
    };

    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(worldPoint.clone()));
    pivot.quaternion.identity();
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);

    pivot.attach(object);
    pivot.updateMatrixWorld(true);

    pivotState = { pivot, object, parent, worldPoint: worldPoint.clone() };
    transform.attach(pivot);
    applyTransformSpace();
    transform.visible = true;
    refreshInspector();
    window.dispatchEvent(new CustomEvent("editor:transform-pivot-change", {
        detail: { object, point: worldPoint.clone(), active: true, pivot }
    }));
    return true;
}

export function clearPivot() {
    if (!pivotState) return;

    const { pivot, object, parent } = pivotState;
    const world = new THREE.Matrix4();
    object.updateMatrixWorld(true);
    world.copy(object.matrixWorld);

    transform?.detach();
    if (object && parent) {
        parent.attach(object);
        restoreWorld(object, world);
    }

    pivot.parent?.remove(pivot);
    pivotState = null;
    startState = null;

    window.dispatchEvent(new CustomEvent("editor:transform-pivot-change", { detail: { active: false } }));
    refreshInspector();
}

export function hasTransformPivot() { return !!pivotState; }
export function getTransformPivot() { return pivotState?.pivot || null; }
export function getTransformPivotTarget() { return pivotState?.object || null; }
export function getTransformPivotPoint() { return pivotState?.worldPoint?.clone() || null; }

export function detachTransform() {
    clearPivot();
    transform?.detach();
    if (transform) transform.visible = false;
}

export function setTransformEnabled(enabled) {
    transformEnabled = !!enabled;
    if (transform) {
        transform.enabled = transformEnabled;
        transform.visible = transformEnabled && !!transform.object;
        if (!transformEnabled) {
            clearPivot();
            transform.detach();
        }
    }
    return transformEnabled;
}

export function isTransformEnabled() { return transformEnabled; }

export function setTransformMode(mode) {
    if (!transform || !["translate", "rotate", "scale"].includes(mode)) return;
    transform.setMode(mode);
    window.dispatchEvent(new CustomEvent("editor:transform-mode", { detail: mode }));
}

export function getTransformMode() { return transform?.mode || "translate"; }

export function setTransformSpace(space) {
    const normalized = String(space || "").toLowerCase();
    if (!transform || !["world", "local"].includes(normalized)) return spaceMode;
    spaceMode = normalized;
    applyTransformSpace();
    window.dispatchEvent(new CustomEvent("editor:transform-space", { detail: spaceMode }));
    return spaceMode;
}

export function toggleTransformSpace() {
    return setTransformSpace(spaceMode === "world" ? "local" : "world");
}

export function getTransformSpace() { return spaceMode; }

export function setAxis(axis) {
    if (!transform || !["X", "Y", "Z", null].includes(axis)) return;
    transform.setAxis(axis);
    window.dispatchEvent(new CustomEvent("editor:transform-axis", { detail: axis }));
}

export function getAxis() { return transform?.axis || null; }

export function setSnapEnabled(enabled) {
    snapEnabled = !!enabled;
    applySnapSettings();
    window.dispatchEvent(new CustomEvent("editor:snap-change", { detail: snapEnabled }));
    return snapEnabled;
}

export function toggleSnap() { return setSnapEnabled(!snapEnabled); }
export function isSnapEnabled() { return snapEnabled; }

export function setSnapValues(values = {}) {
    if (Number.isFinite(values.translation) && values.translation > 0) snapValues.translation = values.translation;
    if (Number.isFinite(values.rotation) && values.rotation > 0) snapValues.rotation = values.rotation;
    if (Number.isFinite(values.scale) && values.scale > 0) snapValues.scale = values.scale;
    applySnapSettings();
    window.dispatchEvent(new CustomEvent("editor:snap-values", { detail: { ...snapValues } }));
    return { ...snapValues };
}

export function getSnapValues() { return { ...snapValues }; }
export function isDraggingTransform() { return !!transform?.dragging; }
export function getTransform() { return transform; }

function applyTransformSpace() {
    if (!transform) return;
    transform.setSpace(spaceMode);
}

function applySnapSettings() {
    if (!transform) return;
    transform.setTranslationSnap(snapEnabled ? snapValues.translation : null);
    transform.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(snapValues.rotation) : null);
    transform.setScaleSnap(snapEnabled ? snapValues.scale : null);
}

function captureWorld(object) {
    object.updateMatrixWorld(true);
    return object.matrixWorld.clone();
}

function restoreWorld(object, matrix) {
    if (!object || !matrix) return;
    const local = matrix.clone();
    if (object.parent) {
        object.parent.updateMatrixWorld(true);
        local.premultiply(object.parent.matrixWorld.clone().invert());
    }
    local.decompose(object.position, object.quaternion, object.scale);
    object.updateMatrixWorld(true);
}

function statesEqual(a, b) {
    const ae = a.elements;
    const be = b.elements;
    for (let i = 0; i < 16; i++) {
        if (Math.abs(ae[i] - be[i]) > 1e-7) return false;
    }
    return true;
}

function dispatchModeChange() {
    window.dispatchEvent(new CustomEvent("editor:transform-change", { detail: transform?.mode }));
}
