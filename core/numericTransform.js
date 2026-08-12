import * as THREE from "three";
import { getTransform, setTransformMode, setAxis, getTransformSpace } from "./transform.js";
import { getSelected } from "./selection.js";
import { pushHistory } from "./history.js";

let mode = null;
let axis = null;
let buffer = "";
let active = false;
let startState = null;
let fromGizmo = false;

export function initNumericTransform() {
    if (window.__modelForgeNumericTransform) return;
    window.__modelForgeNumericTransform = true;

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", event => {
        if (!active || fromGizmo) return;
        if (event.target?.closest?.("canvas")) return;
        cancel();
    }, { passive: true });

    window.addEventListener("editor:gizmo-drag", event => {
        const detail = event.detail || {};
        const object = detail.object || getSelected();
        if (!object) return;
        if (detail.active) {
            fromGizmo = true;
            mode = detail.mode || mode || "translate";
            axis = detail.axis ? String(detail.axis).toLowerCase() : axis;
            active = true;
            startState = startState || capture(object);
            showHUD();
            syncHUDFromObject(object);
            return;
        }
        fromGizmo = false;
        if (active) {
            syncHUDFromObject(object);
            hideHUDSoon();
        }
    });

    window.addEventListener("editor:gizmo-change", event => {
        if (!fromGizmo) return;
        const detail = event.detail || {};
        const object = detail.object || getSelected();
        if (!object) return;
        mode = detail.mode || mode;
        axis = detail.axis ? String(detail.axis).toLowerCase() : axis;
        showHUD();
        syncHUDFromObject(object);
    });

    window.addEventListener("editor:transform-mode", event => {
        if (!active) return;
        mode = event.detail || mode;
        updateHUD();
    });

    window.addEventListener("editor:transform-axis", event => {
        if (!active) return;
        axis = event.detail ? String(event.detail).toLowerCase() : null;
        syncHUDFromObject(getSelected());
    });

    window.addEventListener("editor:transform-space", updateHUD);
}

function onKeyDown(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    const key = event.key.toLowerCase();
    const selected = getSelected();

    if (key === "g" || key === "r" || key === "s") {
        if (!selected) return;
        fromGizmo = false;
        mode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        setTransformMode(mode);
        axis = null;
        setAxis(null);
        buffer = "";
        active = true;
        startState = capture(selected);
        showHUD();
        updateHUD();
        return;
    }

    if (!active || fromGizmo) return;

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
        buffer = "";
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
    if (!object || !startState || !buffer || !axis) return;
    const value = Number(buffer);
    if (!Number.isFinite(value)) return;

    restore(object, startState, { emit: false });
    if (mode === "translate") object.position[axis] = startState.position[axis] + value;
    else if (mode === "rotate") object.rotation[axis] = startState.rotation[axis] + THREE.MathUtils.degToRad(value);
    else if (mode === "scale") object.scale[axis] = startState.scale[axis] * value;
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

function restore(object, state, options = {}) {
    if (!object || !state) return;
    object.position.copy(state.position);
    object.rotation.copy(state.rotation);
    object.scale.copy(state.scale);
    object.updateMatrixWorld(true);
    if (options.emit !== false) refresh();
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
    hud.innerHTML = `
        <div class="numeric-hud-main">
            <strong id="numericMode">Move</strong>
            <span class="numeric-hud-sep">•</span>
            <span id="numericAxis">Free</span>
            <code id="numericValue">0</code>
        </div>
        <div class="numeric-hud-meta">
            <span id="numericSpace">WORLD</span>
            <span>Enter Apply</span>
            <span>Esc Cancel</span>
        </div>
    `;
    hud.style.cssText = `
        position:fixed;
        right:14px;
        bottom:31px;
        z-index:45;
        min-width:158px;
        padding:7px 9px;
        border:1px solid #30333b;
        border-radius:6px;
        background:rgba(23,24,29,.94);
        color:#cfd2da;
        font:11px system-ui,sans-serif;
        box-shadow:0 8px 24px rgba(0,0,0,.28);
        backdrop-filter:blur(8px);
        pointer-events:none;
        user-select:none;
    `;
    const style = document.createElement("style");
    style.textContent = `#numericTransformHUD .numeric-hud-main{display:flex;align-items:center;gap:7px;line-height:1.2}#numericTransformHUD .numeric-hud-main strong{font-weight:650;color:#f0f1f3}#numericTransformHUD .numeric-hud-sep{color:#626671}#numericTransformHUD #numericAxis{color:#b5b8c0}#numericTransformHUD code{margin-left:auto;color:#fff;font:600 11px ui-monospace,SFMono-Regular,Consolas,monospace}#numericTransformHUD .numeric-hud-meta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;padding-top:5px;border-top:1px solid #2a2c33;color:#6f737d;font-size:8px;text-transform:uppercase;letter-spacing:.35px}#numericTransformHUD #numericSpace{color:#aeb2bd;font-weight:700}@media(max-width:760px){#numericTransformHUD{right:10px!important;bottom:32px!important;min-width:146px!important;padding:6px 8px!important}}`;
    document.head.appendChild(style);
    document.body.appendChild(hud);
}

function syncHUDFromObject(object) {
    if (!object) return;
    const value = getAxisValue(object);
    if (value === null) return;
    buffer = formatValue(value);
    updateHUD();
}

function getAxisValue(object) {
    if (!axis) return 0;
    if (mode === "translate") return object.position[axis];
    if (mode === "rotate") return THREE.MathUtils.radToDeg(object.rotation[axis]);
    if (mode === "scale") return object.scale[axis];
    return 0;
}

function formatValue(value) {
    if (!Number.isFinite(value)) return "0";
    return String(Number(value.toFixed(4)));
}

function updateHUD() {
    const hud = document.getElementById("numericTransformHUD");
    if (!hud) return;
    const names = { translate: "Move", rotate: "Rotate", scale: "Scale" };
    hud.querySelector("#numericMode").textContent = names[mode] || "Transform";
    hud.querySelector("#numericAxis").textContent = axis ? axis.toUpperCase() : "Free";
    hud.querySelector("#numericValue").textContent = buffer || "0";
    const space = getTransformSpace?.() || "world";
    hud.querySelector("#numericSpace").textContent = space.toUpperCase();
}

function hideHUDSoon() {
    window.setTimeout(() => {
        if (!fromGizmo && !active) document.getElementById("numericTransformHUD")?.remove();
    }, 120);
}

function cancel() {
    active = false;
    fromGizmo = false;
    mode = null;
    axis = null;
    buffer = "";
    startState = null;
    setAxis(null);
    document.getElementById("numericTransformHUD")?.remove();
}
