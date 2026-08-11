import { listMaterials, registerMaterial, applyMaterial, deleteMaterial, renameMaterial } from "../core/materialLibrary.js";
import { getInspectorObject, refreshInspector } from "./inspector.js";

let observer;
let refreshing = false;

export function initMaterialLibraryPanel() {
    if (observer) return;
    const target = document.getElementById("inspectorContent");
    if (!target) return;
    const refresh = () => {
        if (refreshing || !document.querySelector('.inspector-tab[data-tab="material"]')?.classList.contains("active")) return;
        refreshing = true;
        const existing = target.querySelector(".material-library-section");
        existing?.remove();
        target.appendChild(buildPanel());
        requestAnimationFrame(() => { refreshing = false; });
    };
    observer = new MutationObserver(() => { if (!refreshing) requestAnimationFrame(refresh); });
    observer.observe(target, { childList: true });
    document.querySelectorAll('.inspector-tab[data-tab="material"]').forEach(tab => tab.addEventListener("click", () => setTimeout(refresh, 0)));
    window.addEventListener("editor:material-library-change", () => setTimeout(refresh, 0));
    refresh();
}

function buildPanel() {
    const section = document.createElement("section"); section.className = "inspector-section material-library-section";
    const head = document.createElement("button"); head.className = "section-head"; head.innerHTML = `<span class="section-chevron">▾</span>Material Library`;
    const body = document.createElement("div"); body.className = "section-body";
    const actions = document.createElement("div"); actions.className = "inspector-actions"; actions.append(button("Save Current", saveCurrent), button("Refresh", refreshPanel)); body.appendChild(actions);
    const list = document.createElement("div"); list.className = "material-library-list";
    listMaterials().forEach(item => {
        const row = document.createElement("div"); row.className = "material-library-item";
        const name = document.createElement("span"); name.textContent = item.name; name.title = "Double-click to rename";
        name.addEventListener("dblclick", () => { const next = prompt("Rename material", item.name); if (next?.trim() && renameMaterial(item.name, next.trim())) refreshPanel(); });
        const use = button("Use", () => { const object = getInspectorObject(); if (!object) return status("Select an object first"); if (applyMaterial(object, item.name)) { refreshInspector(); window.dispatchEvent(new CustomEvent("editor:hierarchy-refresh")); status(`Applied ${item.name}`); } });
        const remove = button("×", () => { if (confirm(`Delete ${item.name}?`)) deleteMaterial(item.name); });
        row.append(name, use, remove); list.appendChild(row);
    });
    if (!list.children.length) { const empty = document.createElement("p"); empty.className = "empty-inspector"; empty.textContent = "No saved materials yet."; body.appendChild(empty); }
    body.appendChild(list);
    head.addEventListener("click", () => { body.hidden = !body.hidden; head.querySelector(".section-chevron").textContent = body.hidden ? "▸" : "▾"; });
    section.append(head, body); return section;
}

function saveCurrent() {
    const object = getInspectorObject();
    const material = object && (Array.isArray(object.material) ? object.material[0] : object.material);
    if (!material) return status("No material selected");
    const name = prompt("Material name", material.name || `${object.name || "Object"} Material`);
    if (!name?.trim()) return;
    registerMaterial(name.trim(), material);
    status(`Saved ${name.trim()}`);
}

function refreshPanel() {
    const target = document.getElementById("inspectorContent");
    if (!target || refreshing) return;
    const old = target.querySelector(".material-library-section"); old?.remove(); target.appendChild(buildPanel());
}
function button(label, onClick) { const b = document.createElement("button"); b.className = "icon-action"; b.type = "button"; b.textContent = label; b.addEventListener("click", onClick); return b; }
function status(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }
