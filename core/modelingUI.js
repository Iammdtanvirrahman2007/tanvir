import { scene } from "./scene.js?v=20260811-runtime-fix";
import { getSelection } from "./selection.js";
import { duplicateObject, mirrorObject, arrayDuplicate } from "./modelingTools.js";

let initialized = false;

export function initModelingUI() {
    if (initialized) return;
    initialized = true;
    const host = document.getElementById("bottomToolbar");
    if (!host) return;
    const shelf = document.createElement("div");
    shelf.id = "modelingShelf";
    shelf.innerHTML = `<span class="modeling-label">Model</span><button data-model="duplicate" title="Duplicate selected">Duplicate</button><button data-model="mirrorX" title="Mirror X">Mirror X</button><button data-model="mirrorY" title="Mirror Y">Mirror Y</button><button data-model="mirrorZ" title="Mirror Z">Mirror Z</button><button data-model="array" title="Create 3 copies on X">Array</button>`;
    host.parentElement?.insertBefore(shelf, host);
    shelf.addEventListener("click", event => {
        const action = event.target.closest("[data-model]")?.dataset.model;
        if (action) run(action);
    });
    window.addEventListener("keydown", onKey, { passive: false });
    window.addEventListener("editor:selection-change", refreshState);
    refreshState();
}

function selected() { return getSelection()[0] || null; }

function run(action) {
    const object = selected();
    if (!object) return setStatus("Select an object first");
    if (action === "duplicate") duplicateObject(object, scene);
    if (action === "mirrorX") mirrorObject(object, "x");
    if (action === "mirrorY") mirrorObject(object, "y");
    if (action === "mirrorZ") mirrorObject(object, "z");
    if (action === "array") arrayDuplicate(object, scene, 3, { x: 2, y: 0, z: 0 });
    setStatus(`Model: ${action}`);
}

function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping()) return;
    const key = event.key.toLowerCase();
    if (key === "d") { event.preventDefault(); run("duplicate"); }
    else if (key === "m") { event.preventDefault(); run(event.shiftKey ? "mirrorX" : "mirrorY"); }
}

function refreshState() {
    const hasSelection = !!selected();
    document.querySelectorAll("#modelingShelf button").forEach(button => { button.disabled = !hasSelection; });
}

function isTyping() { const el = document.activeElement; return el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName); }
function setStatus(text) { const el = document.getElementById("statusText"); if (el) el.textContent = text; }
