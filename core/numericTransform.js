import * as THREE from "three";
import { getTransform, setTransformMode, setAxis, getAxis } from "./transform.js";
import { getSelected } from "./selection.js";
import { pushHistory } from "./history.js";

let mode = null;
let axis = null;
let buffer = "";
let active = false;
let preview = null;
let startState = null;

export function initNumericTransform() {
    if (window.__modelForgeNumericTransform) return;
    window.__modelForgeNumericTransform = true;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", () => { if (!active) return; cancel(); });
}

function onKeyDown(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    const key = event.key.toLowerCase();
    const selected = getSelected();

    if (key === "g" || key === "r" || key === "s") {
        if (!selected) return;
        mode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        setTransformMode(mode);
        setAxis(null);
        axis = null;
        buffer = "";
        active = true;
        startState = capture(selected);
        showHUD();
        updateHUD();
        return;
    }

    if (!active) return;

    if (key === "escape") {
        restore(selected, startState);
        cancel();
        return;
    }

    if (key === "enter") {
        commit(selected);
        return;
    }

    if (key === "x" || key === "y" || key === "z") {
        axis = axis === key ? null : key;
        setAxis(axis ? axis.toUpperCase() : null);
        updateHUD();
        return;
    }

    if (/^[0-9.]$/.test(event.key) || (event.key === "-" && buffer.length === 0)) {
        if (event.key === "." && buffer.includes(".")) return;
        buffer += event.key;
        applyPreview(selected);
        updateHUD();
    }
    if (event.key === "Backspace") {
        buffer = buffer.slice(0, -1);
        applyPreview(selected);
        updateHUD();
    }
}

function applyPreview(object) {
    if (!object || !startState) return;
    const value = Number(buffer);
    if (!Number.isFinite(value)) return;
    restore(object, startState);

    if (mode === "translate") {
        if (axis) object.position[axis] = startState.position[axis] + value;
    } else if (mode === "rotate") {
        const radians = THREE.MathUtils.degToRad(value);
        if (axis) object.rotation[axis] = startState.rotation[axis] + radians;
    } else if (mode === "scale") {
        const factor = value;
        if (axis) object.scale[axis] = startState.scale[axis] * factor;
    }
    object.updateMatrixWorld(true);
    window.dispatchEvent(new CustomEvent("editor:numeric-transform", { detail: { mode, axis, value } }));
}

function commit(object) {
    if (!object || !startState) return cancel();
    const endState = capture(object);
    const changed = !statesEqual(startState, endState);
    if (changed) {
        pushHistory({
            label: `${mode} ${axis ? axis.toUpperCase() + " " : ""}${buffer}`,
            undo: () => { restore(object, startState); refresh(); },
            redo: () => { restore(object, endState); refresh(); }
        });
    }
    cancel();
    window.dispatchEvent(new CustomEvent("editor:status", { detail: changed ? "Transform applied" : "Transform unchanged" }));
}

function capture(object) {
    return { position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() };
}
function restore(object, state) {
    if (!object || !state) return;
    object.position.copy(state.position);
    object.rotation.copy(state.rotation);
    object.scale.copy(state.scale);
    object.updateMatrixWorld(true);
    refresh();
}
function statesEqual(a, b) {
    return a.position.equals(b.position) && a.rotation.equals(b.rotation) && a.scale.equals(b.scale);
}
function refresh() {
    window.dispatchEvent(new CustomEvent("editor:inspector-refresh"));
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: getSelected() ? [getSelected()] : [] }));
}

function showHUD() {
    let hud = document.getElementById("numericTransformHUD");
    if (hud) return;
    hud = document.createElement("div");
    hud.id = "numericTransformHUD";
    hud.innerHTML = `<strong id="numericMode">Move</strong><span id="numericAxis">Free</span><code id="numericValue">0</code><small>Enter Apply · Esc Cancel</small>`;
    hud.style.cssText = "position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:90;display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #3a3d45;border-radius:7px;background:#15161df2;color:#cfd2da;font:12px system-ui,sans-serif;box-shadow:0 12px 30px #0008;pointer-events:none";
    document.body.appendChild(hud);
}
function updateHUD() {
    const hud = document.getElementById("numericTransformHUD");
    if (!hud) return;
    const names = { translate: "Move", rotate: "Rotate", scale: "Scale" };
    hud.querySelector("#numericMode").textContent = names[mode] || "Transform";
    hud.querySelector("#numericAxis").textContent = axis ? axis.toUpperCase() : "Free";
    hud.querySelector("#numericValue").textContent = buffer || "0";
}
function cancel() {
    active = false;
    mode = null;
    axis = null;
    buffer = "";
    startState = null;
    setAxis(null);
    document.getElementById("numericTransformHUD")?.remove();
}
