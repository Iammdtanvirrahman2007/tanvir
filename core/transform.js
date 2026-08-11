import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { pushHistory } from "./history.js";
import { refreshInspector } from "../ui/inspector.js";

let transform = null;
let snapEnabled = false;
let startState = null;

export function setupTransform(camera, renderer, scene, orbitControls) {
    transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSize(0.85);
    scene.add(transform.getHelper());

    transform.addEventListener("dragging-changed", event => {
        if (orbitControls) orbitControls.enabled = !event.value;
        const object = transform.object;
        if (!object) return;

        if (event.value) {
            startState = capture(object);
            return;
        }

        const endState = capture(object);
        if (!startState || statesEqual(startState, endState)) {
            startState = null;
            return;
        }

        pushHistory({
            undo: () => { restore(object, startState); refreshInspector(); },
            redo: () => { restore(object, endState); refreshInspector(); }
        });
        startState = null;
        refreshInspector();
        dispatchModeChange();
    });

    transform.addEventListener("objectChange", () => {
        refreshInspector();
    });

    return transform;
}

export function attachTransform(object) {
    if (!transform || !object) return;
    transform.attach(object);
    refreshInspector();
}

export function detachTransform() {
    transform?.detach();
}

export function setTransformMode(mode) {
    if (!transform) return;
    if (!["translate", "rotate", "scale"].includes(mode)) return;
    transform.setMode(mode);
    window.dispatchEvent(new CustomEvent("editor:transform-mode", { detail: mode }));
}

export function getTransformMode() {
    return transform?.mode || "translate";
}

export function toggleSnap() {
    if (!transform) return false;
    snapEnabled = !snapEnabled;
    transform.setTranslationSnap(snapEnabled ? 1 : null);
    transform.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(15) : null);
    transform.setScaleSnap(snapEnabled ? 0.1 : null);
    window.dispatchEvent(new CustomEvent("editor:snap-change", { detail: snapEnabled }));
    return snapEnabled;
}

export function isSnapEnabled() {
    return snapEnabled;
}

export function isDraggingTransform() {
    return !!transform?.dragging;
}

export function getTransform() {
    return transform;
}

function capture(object) {
    return {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone()
    };
}

function restore(object, state) {
    object.position.copy(state.position);
    object.rotation.copy(state.rotation);
    object.scale.copy(state.scale);
    object.updateMatrixWorld(true);
}

function statesEqual(a, b) {
    return a.position.equals(b.position) && a.rotation.equals(b.rotation) && a.scale.equals(b.scale);
}

function dispatchModeChange() {
    window.dispatchEvent(new CustomEvent("editor:transform-change", { detail: transform?.mode }));
}
