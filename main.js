import * as THREE from "three";
import { setupUpload } from "./core/upload.js";
import { saveScene } from "./core/save.js";
import { loadScene } from "./core/load.js";
import { setupExporter } from "./core/exporter.js";
import { setupImporter } from "./core/importer.js";
import { setupCopyPaste } from "./core/copyPaste.js";
import { setupDuplicate } from "./core/duplicate.js";
import { toggleSnap, setupTransform, setTransformMode } from "./core/transform.js";
import { undo, redo, canUndo, canRedo } from "./core/history.js";
import { initScene, scene, renderer, camera, controls, createDefaultCube, grid, resetCamera, getFPS } from "./core/scene.js";
import { setupDelete } from "./core/delete.js";
import { setupSelection, clearSelection, getSelected } from "./core/selection.js";
import { addObject, getObjects } from "./core/objectManager.js";
import { addToHierarchy, initHierarchy, rebuildHierarchy } from "./ui/hierarchy.js";
import { initInspector, updateInspector } from "./ui/inspector.js";
import { createObject } from "./objects/factory.js";
import { groupSelected, ungroupSelected } from "./core/grouping.js";

const state = { transformMode: "translate", lastStatus: "Ready" };
boot();

function boot() {
    initScene();
    setupSelection(renderer, camera, scene);
    setupTransform(camera, renderer, scene, controls);
    initInspector();
    initHierarchy(scene);
    setupDelete(scene);
    setupDuplicate(scene);
    setupCopyPaste(scene);
    setupImporter(scene);
    setupExporter(scene);
    setupUpload(scene);
    const defaultCube = createDefaultCube();
    addToHierarchy(defaultCube);
    updateInspector(null);
    bindUI();
    bindEditorEvents();
    bindKeyboard();
    updateObjectCount();
    updateHistoryButtons();
    setStatus("Ready");
}

function bindUI() {
    document.getElementById("sceneAddBtn")?.addEventListener("click", e => { e.stopPropagation(); toggleAddMenu(e.currentTarget); });
    document.getElementById("addMenuBtn")?.addEventListener("click", e => toggleAddMenu(e.currentTarget));
    document.getElementById("undoBtn")?.addEventListener("click", () => { if (undo()) setStatus("Undo"); });
    document.getElementById("redoBtn")?.addEventListener("click", () => { if (redo()) setStatus("Redo"); });
    document.getElementById("saveBtn")?.addEventListener("click", () => { saveScene(scene); setStatus("Scene saved"); });
    document.getElementById("loadBtn")?.addEventListener("click", () => { loadScene(scene); setStatus("Choose a scene file"); });
    document.getElementById("gridBtn")?.addEventListener("click", () => { grid.visible = !grid.visible; setStatus(grid.visible ? "Grid enabled" : "Grid hidden"); });
    document.getElementById("frameBtn")?.addEventListener("click", frameSelected);
    document.getElementById("cameraResetBtn")?.addEventListener("click", () => { resetCamera(); setStatus("View reset"); });
    document.getElementById("selectBtn")?.addEventListener("click", () => activateTool("select"));
    document.getElementById("moveBtn")?.addEventListener("click", () => activateTool("translate"));
    document.getElementById("rotateBtn")?.addEventListener("click", () => activateTool("rotate"));
    document.getElementById("scaleBtn")?.addEventListener("click", () => activateTool("scale"));
    document.getElementById("snapBtn")?.addEventListener("click", () => { const enabled = toggleSnap(); const button = document.getElementById("snapBtn"); button.textContent = enabled ? "Snap On" : "Snap Off"; button.classList.toggle("snap-on", enabled); });
    document.getElementById("groupBtn")?.addEventListener("click", () => { const group = groupSelected(scene); setStatus(group ? `Grouped ${group.name}` : "Select two or more objects with Ctrl-click"); rebuildHierarchy(); });
    document.getElementById("ungroupBtn")?.addEventListener("click", () => { const children = ungroupSelected(scene, getSelected()); setStatus(children.length ? "Group ungrouped" : "Select a group first"); });
    document.getElementById("addCollectionBtn")?.addEventListener("click", () => setStatus("Collections are represented by Groups. Ctrl-click objects, then Group."));
    document.getElementById("sceneOptionsBtn")?.addEventListener("click", () => setStatus(`${getObjects().length} editor objects`));
    document.addEventListener("pointerdown", event => { const popover = document.getElementById("menuPopover"); if (popover && !popover.hidden && !popover.contains(event.target) && !event.target.closest("#sceneAddBtn,#addMenuBtn")) closeMenu(); });
}

function bindEditorEvents() {
    window.addEventListener("editor:selection-change", event => { const selection = event.detail || []; if (selection.length === 1) setStatus(`Selected ${selection[0].name || selection[0].type}`); else if (selection.length > 1) setStatus(`${selection.length} objects selected`); else setStatus("Ready"); updateObjectCount(); });
    window.addEventListener("editor:status", event => setStatus(event.detail || "Ready"));
    window.addEventListener("editor:hierarchy-refresh", rebuildHierarchy);
    window.addEventListener("editor:history-change", updateHistoryButtons);
    window.addEventListener("editor:frame", event => { const fps = event.detail?.fps ?? getFPS(); const el = document.getElementById("fpsCounter"); if (el) el.textContent = fps; });
    window.addEventListener("editor:transform-mode", event => { state.transformMode = event.detail; syncToolButtons(); });
}

function bindKeyboard() {
    window.addEventListener("keydown", event => {
        const target = event.target;
        const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
        if (editing) return;
        const key = event.key.toLowerCase();
        if (event.ctrlKey && key === "z") { event.preventDefault(); if (undo()) setStatus("Undo"); return; }
        if (event.ctrlKey && key === "y") { event.preventDefault(); if (redo()) setStatus("Redo"); return; }
        if (key === "w") activateTool("select");
        if (key === "g") activateTool("translate");
        if (key === "r") activateTool("rotate");
        if (key === "s") activateTool("scale");
        if (key === "f") frameSelected();
        if (key === "escape") clearSelection();
    });
}

function activateTool(mode) {
    if (mode === "select") { state.transformMode = "select"; syncToolButtons(); setStatus("Select tool"); return; }
    setTransformMode(mode); state.transformMode = mode; syncToolButtons(); setStatus(`${mode[0].toUpperCase()}${mode.slice(1)} tool`);
}
function syncToolButtons() { const map = { select: "selectBtn", translate: "moveBtn", rotate: "rotateBtn", scale: "scaleBtn" }; Object.values(map).forEach(id => document.getElementById(id)?.classList.remove("active")); document.getElementById(map[state.transformMode])?.classList.add("active"); }
function add(type) { const object = createObject(type); if (!object) return; addObject(scene, object); addToHierarchy(object); setStatus(`Added ${object.name}`); updateObjectCount(); }
function toggleAddMenu(anchor) { const popover = document.getElementById("menuPopover"); if (!popover) return; if (!popover.hidden) return closeMenu(); popover.innerHTML = `<button data-add="cube">Cube <span class="shortcut">Shift+C</span></button><button data-add="sphere">Sphere</button><button data-add="cylinder">Cylinder</button><button data-add="cone">Cone</button><button data-add="plane">Plane</button>`; popover.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => { add(button.dataset.add); closeMenu(); })); const rect = anchor.getBoundingClientRect(); popover.style.left = `${Math.min(rect.left, window.innerWidth - 205)}px`; popover.style.top = `${rect.bottom + 4}px`; popover.hidden = false; }
function closeMenu() { const popover = document.getElementById("menuPopover"); if (popover) popover.hidden = true; }
function frameSelected() { const object = getSelected(); if (!object) return setStatus("Nothing selected"); const box = new THREE.Box3().setFromObject(object); const sphere = box.getBoundingSphere(new THREE.Sphere()); const distance = Math.max(sphere.radius * 3, 2); const direction = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(sphere.center).add(direction.multiplyScalar(distance)); controls.target.copy(sphere.center); controls.update(); setStatus(`Framed ${object.name || object.type}`); }
function updateObjectCount() { const count = document.getElementById("objectCount"); if (count) count.textContent = getObjects().length; }
function updateHistoryButtons() { const undoButton = document.getElementById("undoBtn"); const redoButton = document.getElementById("redoBtn"); if (undoButton) undoButton.disabled = !canUndo(); if (redoButton) redoButton.disabled = !canRedo(); }
function setStatus(message) { state.lastStatus = message; const text = document.getElementById("statusText"); if (text) text.textContent = message; }
