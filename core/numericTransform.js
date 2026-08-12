import * as THREE from "three";
import { setTransformMode, setAxis, getTransformSpace } from "./transform.js";
import { getSelected } from "./selection.js";
import { pushHistory } from "./history.js";

let mode = null;
let axis = null;
let buffer = "";
let active = false;
let startState = null;
let fromGizmo = false;
let freeGizmoMove = false;
let statusEl = null;

export function initNumericTransform() {
    if (window.__modelForgeNumericTransform) return;
    window.__modelForgeNumericTransform = true;
    installStatusStyles();
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
            axis = detail.axis ? String(detail.axis).toLowerCase() : null;
            freeGizmoMove = !axis && mode === "translate";
            active = true;
            startState = capture(object);
            showStatus();
            syncStatusFromObject(object);
            return;
        }

        fromGizmo = false;
        freeGizmoMove = false;
        if (active) {
            syncStatusFromObject(object);
            hideStatusSoon();
        }
    });

    window.addEventListener("editor:gizmo-change", event => {
        if (!fromGizmo) return;
        const detail = event.detail || {};
        const object = detail.object || getSelected();
        if (!object) return;
        mode = detail.mode || mode;
        axis = detail.axis ? String(detail.axis).toLowerCase() : null;
        freeGizmoMove = !axis && mode === "translate";
        showStatus();
        syncStatusFromObject(object);
    });

    window.addEventListener("editor:transform-mode", event => {
        if (!active) return;
        mode = event.detail || mode;
        updateStatus();
    });

    window.addEventListener("editor:transform-axis", event => {
        if (!active) return;
        axis = event.detail ? String(event.detail).toLowerCase() : null;
        freeGizmoMove = fromGizmo && !axis && mode === "translate";
        syncStatusFromObject(getSelected());
    });

    window.addEventListener("editor:transform-space", updateStatus);
}

function onKeyDown(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

    const key = event.key.toLowerCase();
    const selected = getSelected();

    if (key === "g" || key === "r" || key === "s") {
        if (!selected) return;
        fromGizmo = false;
        freeGizmoMove = false;
        mode = key === "g" ? "translate" : key === "r" ? "rotate" : "scale";
        setTransformMode(mode);
        axis = null;
        setAxis(null);
        buffer = "";
        active = true;
        startState = capture(selected);
        showStatus();
        updateStatus();
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
        updateStatus();
        return;
    }

    if (/^[0-9.]$/.test(event.key) || (event.key === "-" && buffer.length === 0)) {
        if (event.key === "." && buffer.includes(".")) return;
        buffer += event.key;
        applyPreview(selected);
        updateStatus();
    }

    if (event.key === "Backspace") {
        buffer = buffer.slice(0, -1);
        applyPreview(selected);
        updateStatus();
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

function showStatus() {
    if (statusEl && document.body.contains(statusEl)) return;
    const host = document.querySelector("#statusBar .status-left") || document.getElementById("statusBar");
    if (!host) return;
    statusEl = document.createElement("span");
    statusEl.id = "numericTransformStatus";
    statusEl.setAttribute("aria-live", "polite");
    host.appendChild(statusEl);
}

function syncStatusFromObject(object) {
    if (!object) return;
    showStatus();
    if (!statusEl) return;

    if (fromGizmo && mode === "translate" && freeGizmoMove && startState) {
        const dx = object.position.x - startState.position.x;
        const dy = object.position.y - startState.position.y;
        const dz = object.position.z - startState.position.z;
        statusEl.innerHTML = `<strong>Move</strong><span class="nt-sep">•</span><span>Free</span><span class="nt-delta">ΔX ${fmtSigned(dx)}</span><span class="nt-delta">ΔY ${fmtSigned(dy)}</span><span class="nt-delta">ΔZ ${fmtSigned(dz)}</span>`;
        return;
    }

    const value = getAxisValue(object);
    const axisLabel = axis ? axis.toUpperCase() : "Free";
    const displayValue = fromGizmo && startState && axis ? getGizmoDelta(object) : (fromGizmo ? value : (buffer || value));
    statusEl.innerHTML = `<strong>${modeName()}</strong><span class="nt-sep">•</span><span>${axisLabel}</span><span class="nt-value">${fmtValue(displayValue)}</span><span class="nt-space">${getTransformSpace().toUpperCase()}</span>`;
}

function getGizmoDelta(object) {
    if (!startState || !axis) return 0;
    if (mode === "translate") return object.position[axis] - startState.position[axis];
    if (mode === "rotate") return THREE.MathUtils.radToDeg(object.rotation[axis] - startState.rotation[axis]);
    if (mode === "scale") return object.scale[axis] - startState.scale[axis];
    return 0;
}

function getAxisValue(object) {
    if (!axis) return 0;
    if (mode === "translate") return object.position[axis];
    if (mode === "rotate") return THREE.MathUtils.radToDeg(object.rotation[axis]);
    if (mode === "scale") return object.scale[axis];
    return 0;
}

function modeName() {
    return ({ translate: "Move", rotate: "Rotate", scale: "Scale" })[mode] || "Transform";
}

function fmtSigned(value) {
    const rounded = Number(value.toFixed(3));
    return `${rounded >= 0 ? "+" : ""}${rounded}`;
}

function fmtValue(value) {
    if (!Number.isFinite(Number(value))) return "0";
    return String(Number(Number(value).toFixed(3)));
}

function updateStatus() {
    showStatus();
    if (!statusEl) return;
    const axisLabel = axis ? axis.toUpperCase() : "Free";
    statusEl.innerHTML = `<strong>${modeName()}</strong><span class="nt-sep">•</span><span>${axisLabel}</span><span class="nt-value">${buffer || "0"}</span><span class="nt-space">${getTransformSpace().toUpperCase()}</span>`;
}

function installStatusStyles() {
    if (document.getElementById("modelForgeNumericStatusStyles")) return;
    const style = document.createElement("style");
    style.id = "modelForgeNumericStatusStyles";
    style.textContent = `
        #numericTransformStatus{display:inline-flex;align-items:center;gap:7px;margin-left:10px;color:#8f949f;font-size:10px;white-space:nowrap}
        #numericTransformStatus strong{color:#e7e9ed;font-weight:650}
        #numericTransformStatus .nt-sep{color:#555a64}
        #numericTransformStatus .nt-value{color:#f2f3f5;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:600}
        #numericTransformStatus .nt-space{color:#a7acb6;font-size:8px;font-weight:700;letter-spacing:.45px}
        #numericTransformStatus .nt-delta{color:#b6bbc4;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
        @media(max-width:760px){#numericTransformStatus{gap:5px;margin-left:7px;font-size:9px}.nt-delta{font-size:8px}}
    `;
    document.head.appendChild(style);
}

function hideStatusSoon() {
    window.setTimeout(() => {
        if (fromGizmo || active) return;
        statusEl?.remove();
        statusEl = null;
    }, 180);
}

function cancel() {
    active = false;
    fromGizmo = false;
    freeGizmoMove = false;
    mode = null;
    axis = null;
    buffer = "";
    startState = null;
    setAxis(null);
    statusEl?.remove();
    statusEl = null;
}
