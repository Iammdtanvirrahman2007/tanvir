import * as THREE from "three";
import { scene } from "../core/scene.js";
import { readRocketPart } from "../rocket/rocketPart.js";
import { validateRocketPart } from "../rocket/validation.js";

let installed = false;
let section = null;
let lastResult = null;

export function initRocketValidationPanel() {
    if (installed) return;
    installed = true;
    const refresh = () => queueMicrotask(render);
    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) refresh();
        else remove();
    });
    window.addEventListener("editor:rocket-part-change", refresh);
    window.addEventListener("editor:rocket-node-change", refresh);
    refresh();
}

function render() {
    const body = document.getElementById("rocketPartBody");
    if (!body || body.closest("[hidden]")) return;

    if (!section) {
        section = document.createElement("section");
        section.id = "rocketValidationSection";
        section.className = "rocket-validation-section";
        body.appendChild(section);
        installStyles();
    } else if (!body.contains(section)) {
        body.appendChild(section);
    }

    const part = readRocketPart(scene);
    const schemaResult = validateRocketPart(part || {});
    const modelPresent = hasModelGeometry();
    const warnings = [];

    if (!part?.description?.trim()) warnings.push("Description is empty");
    if (!part?.model?.modelUrl) warnings.push("Model URL is not set yet");
    if (!part?.model?.thumbnailUrl) warnings.push("Thumbnail URL is not set yet");
    if (!Array.isArray(part?.attachmentNodes) || part.attachmentNodes.length === 0) {
        warnings.push("No attachment nodes defined");
    }

    const publishReady = schemaResult.valid && modelPresent;
    lastResult = { valid: publishReady, schemaValid: schemaResult.valid, errors: schemaResult.errors, warnings };

    section.innerHTML = `
        <div class="rocket-validation-head">
            <div>
                <span class="eyebrow">Quality Gate</span>
                <strong>Publish Readiness</strong>
            </div>
            <span class="rocket-validation-badge ${publishReady ? "ready" : "blocked"}">${publishReady ? "READY" : "BLOCKED"}</span>
        </div>
        <div class="rocket-validation-summary">
            <div class="validation-stat"><span>Schema</span><b class="${schemaResult.valid ? "ok" : "bad"}">${schemaResult.valid ? "PASS" : "FAIL"}</b></div>
            <div class="validation-stat"><span>Geometry</span><b class="${modelPresent ? "ok" : "bad"}">${modelPresent ? "FOUND" : "MISSING"}</b></div>
            <div class="validation-stat"><span>Warnings</span><b class="${warnings.length ? "warn" : "ok"}">${warnings.length}</b></div>
        </div>
        <div class="rocket-validation-list">
            ${schemaResult.errors.length ? `<div class="validation-group"><div class="validation-title bad">Errors</div>${schemaResult.errors.map(item => `<div class="validation-row bad-row"><span>×</span>${escapeHtml(item)}</div>`).join("")}</div>` : ""}
            ${!modelPresent ? `<div class="validation-group"><div class="validation-title bad">Errors</div><div class="validation-row bad-row"><span>×</span>No editable model geometry was found.</div></div>` : ""}
            ${warnings.length ? `<div class="validation-group"><div class="validation-title warn">Warnings</div>${warnings.map(item => `<div class="validation-row warn-row"><span>!</span>${escapeHtml(item)}</div>`).join("")}</div>` : ""}
            ${!schemaResult.errors.length && modelPresent && !warnings.length ? `<div class="validation-row ok-row"><span>✓</span>Part is clean and ready for the next publishing stage.</div>` : ""}
        </div>
        <button type="button" class="rocket-validation-refresh">Revalidate Part</button>
    `;

    section.querySelector(".rocket-validation-refresh")?.addEventListener("click", () => {
        render();
        window.dispatchEvent(new CustomEvent("editor:status", { detail: publishReady ? "Rocket part validation passed" : "Rocket part validation blocked" }));
    });
}

function hasModelGeometry() {
    let found = false;
    scene?.children?.forEach(root => {
        if (root?.userData?.editorOnly || !root?.userData?.editorObject) return;
        root.traverse(object => {
            if (object?.isMesh && !object.userData?.editorOnly) found = true;
        });
    });
    return found;
}

function remove() {
    section?.remove();
    section = null;
    lastResult = null;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
}

function installStyles() {
    if (document.getElementById("rocketValidationStyles")) return;
    const style = document.createElement("style");
    style.id = "rocketValidationStyles";
    style.textContent = `
        .rocket-validation-section{margin:10px;border:1px solid #30333a;border-radius:6px;background:#15171b;overflow:hidden}.rocket-validation-head{display:flex;align-items:center;justify-content:space-between;padding:9px;border-bottom:1px solid #282b31}.rocket-validation-head strong{display:block;margin-top:2px;color:#e7e9ed;font-size:12px}.rocket-validation-badge{padding:4px 7px;border-radius:4px;font:700 8px system-ui;letter-spacing:.08em}.rocket-validation-badge.ready{background:#12301e;color:#7ddc9c;border:1px solid #275f3b}.rocket-validation-badge.blocked{background:#321616;color:#f08b8b;border:1px solid #6b2d2d}.rocket-validation-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:8px}.validation-stat{padding:6px;border:1px solid #2f323a;border-radius:4px;background:#121419}.validation-stat span{display:block;color:#747a85;font-size:8px;text-transform:uppercase;letter-spacing:.06em}.validation-stat b{display:block;margin-top:3px;font-size:9px}.validation-stat b.ok{color:#7ddc9c}.validation-stat b.bad{color:#f08b8b}.validation-stat b.warn{color:#f5d06f}.rocket-validation-list{display:grid;gap:6px;padding:0 8px 8px}.validation-group{display:grid;gap:3px}.validation-title{font:700 8px system-ui;text-transform:uppercase;letter-spacing:.08em}.validation-title.bad{color:#f08b8b}.validation-title.warn{color:#f5d06f}.validation-row{display:flex;align-items:flex-start;gap:6px;padding:6px 7px;border:1px solid #2d3037;border-radius:4px;font:9px/1.35 system-ui}.validation-row span{font-weight:800}.bad-row{background:#201416;color:#c7a2a2}.bad-row span{color:#f08b8b}.warn-row{background:#211d12;color:#b7aa83}.warn-row span{color:#f5d06f}.ok-row{background:#121e17;color:#9fb9a8}.ok-row span{color:#7ddc9c}.rocket-validation-refresh{width:calc(100% - 16px);margin:0 8px 8px;padding:7px;border:1px solid #3a3e48;border-radius:4px;background:#202329;color:#bfc4cd;font:600 9px system-ui;cursor:pointer}.rocket-validation-refresh:hover{background:#2d3138;color:#fff}
    `;
    document.head.appendChild(style);
}

void THREE;
void lastResult;
