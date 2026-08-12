import * as THREE from "three";
import { scene } from "../core/scene.js";
import {
    initReferenceGuides,
    toggleReferenceGuides,
    setOriginToModelCenter,
    setBottomPlaneFromModel,
    setTopPlaneFromModel,
    isReferenceGuidesVisible,
    refreshReferenceGuides
} from "./referenceGuides.js";
import { readRocketPart } from "./rocketPart.js";

let installed = false;
let section = null;

export function initReferenceGuidesUI() {
    if (installed) return;
    installed = true;
    initReferenceGuides(scene);
    const tryInstall = () => installOrRefresh();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryInstall, { once: true });
    else tryInstall();
    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) {
            setTimeout(installOrRefresh, 0);
            refreshReferenceGuides();
        } else {
            section?.remove();
            section = null;
        }
    });
    window.addEventListener("editor:rocket-part-change", () => {
        refreshReferenceGuides();
        renderValues();
    });
}

function installOrRefresh() {
    const body = document.getElementById("rocketPartBody");
    if (!body) return;
    if (!section) {
        section = document.createElement("section");
        section.className = "rocket-reference-section";
        section.innerHTML = `
            <div class="rocket-reference-head">
                <div><span class="eyebrow">Alignment</span><strong>Reference Planes</strong></div>
                <button type="button" data-guides-toggle></button>
            </div>
            <div class="rocket-reference-values">
                <div><span>Origin Y</span><strong data-origin>0.00</strong></div>
                <div><span>Bottom Y</span><strong data-bottom>0.00</strong></div>
                <div><span>Top Y</span><strong data-top>0.00</strong></div>
            </div>
            <div class="rocket-reference-actions">
                <button type="button" data-origin-set>Set Origin Center</button>
                <button type="button" data-bottom-set>Set Bottom From Model</button>
                <button type="button" data-top-set>Set Top From Model</button>
            </div>
            <div class="rocket-reference-hint">Editor-only guides for rocket alignment. They are not part of the exported model.</div>
        `;
        body.appendChild(section);
        section.querySelector("[data-guides-toggle]")?.addEventListener("click", () => {
            const visible = toggleReferenceGuides();
            updateToggle(visible);
            renderValues();
        });
        section.querySelector("[data-origin-set]")?.addEventListener("click", () => apply(setOriginToModelCenter, "Origin set to model center"));
        section.querySelector("[data-bottom-set]")?.addEventListener("click", () => apply(setBottomPlaneFromModel, "Bottom plane set from model"));
        section.querySelector("[data-top-set]")?.addEventListener("click", () => apply(setTopPlaneFromModel, "Top plane set from model"));
        installStyles();
    }
    renderValues();
    updateToggle(isReferenceGuidesVisible());
}

function apply(action, message) {
    const ok = action();
    window.dispatchEvent(new CustomEvent("editor:status", { detail: ok ? message : "No model geometry available" }));
    renderValues();
}

function renderValues() {
    if (!section) return;
    const part = readRocketPart(scene) || {};
    const cs = part.coordinateSystem || {};
    const originY = Number(Array.isArray(cs.origin) ? cs.origin[1] : 0);
    const bottom = Number.isFinite(Number(cs.bottomPlaneY)) ? Number(cs.bottomPlaneY) : 0;
    const top = Number.isFinite(Number(cs.topPlaneY)) ? Number(cs.topPlaneY) : 0;
    section.querySelector("[data-origin]").textContent = originY.toFixed(2);
    section.querySelector("[data-bottom]").textContent = bottom.toFixed(2);
    section.querySelector("[data-top]").textContent = top.toFixed(2);
}

function updateToggle(visible) {
    const button = section?.querySelector("[data-guides-toggle]");
    if (!button) return;
    button.textContent = visible ? "Hide Guides" : "Show Guides";
    button.classList.toggle("active", visible);
}

function installStyles() {
    if (document.getElementById("rocketReferenceGuideStyles")) return;
    const style = document.createElement("style");
    style.id = "rocketReferenceGuideStyles";
    style.textContent = `
        .rocket-reference-section{border:1px solid #2b2e35;border-radius:6px;margin-bottom:8px;background:#17191e;overflow:hidden}.rocket-reference-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #262930}.rocket-reference-head strong{display:block;margin-top:2px;color:#e7e9ed;font-size:10px}.rocket-reference-head button,.rocket-reference-actions button{border:1px solid #343842;border-radius:4px;background:#202329;color:#bfc4cd;padding:6px 8px;font:600 9px system-ui;cursor:pointer}.rocket-reference-head button:hover,.rocket-reference-actions button:hover,.rocket-reference-head button.active{background:#31353d;color:#fff}.rocket-reference-values{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;padding:8px}.rocket-reference-values div{padding:6px;border:1px solid #2f323a;border-radius:4px;background:#121419}.rocket-reference-values span{display:block;color:#747a85;font-size:8px;text-transform:uppercase;letter-spacing:.06em}.rocket-reference-values strong{display:block;margin-top:3px;color:#d8dbe0;font-size:10px}.rocket-reference-actions{display:grid;grid-template-columns:1fr;gap:5px;padding:0 8px 8px}.rocket-reference-hint{margin:0 8px 8px;padding:7px;border:1px dashed #343842;border-radius:4px;color:#757b86;font:9px/1.45 system-ui}.rocket-reference-actions button{width:100%;text-align:left}
    `;
    document.head.appendChild(style);
}

void THREE;
