import * as THREE from "three";
import { getSelected } from "../core/selection.js";
import { attachTransformPivot, clearPivot, getTransformPivotPoint, hasTransformPivot } from "../core/transform.js";

let installed = false;
let scheduled = false;

export function initPivotControl() {
    if (installed) return;
    installed = true;

    const refresh = () => {
        scheduled = false;
        requestAnimationFrame(renderPivotControl);
    };

    window.addEventListener("editor:selection-change", refresh);
    window.addEventListener("editor:inspector-refresh", refresh);
    window.addEventListener("editor:transform-pivot-change", refresh);
    window.addEventListener("resize", refresh, { passive: true });
    refresh();
}

function renderPivotControl() {
    const panel = document.getElementById("inspectorContent");
    const object = getSelected();
    if (!panel || !object) return;

    panel.querySelector(".pivot-control-section")?.remove();

    const section = document.createElement("section");
    section.className = "inspector-section pivot-control-section";

    const head = document.createElement("button");
    head.type = "button";
    head.className = "section-head";
    head.innerHTML = `<span class="section-chevron">▾</span>Pivot`;

    const body = document.createElement("div");
    body.className = "section-body";

    const info = document.createElement("div");
    info.className = "pivot-control-info";

    const point = getTransformPivotPoint();
    if (hasTransformPivot() && point) {
        info.innerHTML = `<strong>Custom pivot</strong><span>${format(point.x)} · ${format(point.y)} · ${format(point.z)}</span>`;
    } else {
        info.innerHTML = `<strong>Object center</strong><span>Default transform pivot</span>`;
    }

    const actions = document.createElement("div");
    actions.className = "pivot-control-actions";

    const centerButton = action("Center", () => {
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return status("Unable to calculate object center");
        const center = box.getCenter(new THREE.Vector3());
        if (attachTransformPivot(object, center)) {
            status("Pivot centered");
            refreshLater();
        }
    });

    const resetButton = action("Reset", () => {
        if (!hasTransformPivot()) return status("Pivot is already at object center");
        clearPivot();
        status("Pivot reset");
        refreshLater();
    });

    actions.append(centerButton, resetButton);
    body.append(info, actions);
    section.append(head, body);

    head.addEventListener("click", () => {
        body.hidden = !body.hidden;
        head.querySelector(".section-chevron").textContent = body.hidden ? "▸" : "▾";
    });

    installStyles();
    panel.appendChild(section);
}

function action(labelText, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-action pivot-action";
    button.textContent = labelText;
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return button;
}

function refreshLater() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        renderPivotControl();
    });
}

function format(value) { return Number(value.toFixed(3)); }
function status(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }

function installStyles() {
    if (document.getElementById("modelForgePivotControlStyles")) return;
    const style = document.createElement("style");
    style.id = "modelForgePivotControlStyles";
    style.textContent = `
        .pivot-control-section .section-body{padding-bottom:9px}
        .pivot-control-info{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px;color:#8b909b;font-size:9px;line-height:1.4}
        .pivot-control-info strong{color:#cfd2da;font-size:10px;font-weight:600}
        .pivot-control-info span{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right;color:#858a95}
        .pivot-control-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px}
        .pivot-action{width:100%;min-height:30px}
    `;
    document.head.appendChild(style);
}
