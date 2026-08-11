import { scene, grid, resetCamera, camera, controls } from "./scene.js?v=20260811-runtime-fix";
import { saveScene } from "./save.js";
import { downloadGLTF } from "./exporter.js";
import { undo, redo } from "./history.js";
import { duplicateObject } from "./duplicate.js";
import { getSelected, clearSelection } from "./selection.js";
import { groupSelected, ungroupSelected } from "./grouping.js";
import { createObject } from "../objects/factory.js";
import { addObject, removeObject } from "./objectManager.js";
import { addToHierarchy, rebuildHierarchy, removeFromHierarchy } from "../ui/hierarchy.js";
import { updateInspector } from "../ui/inspector.js";
import * as THREE from "three";

let host = null;
let panel = null;

export function initCommandCenter() {
    if (host) return;
    host = document.createElement("div");
    host.id = "commandCenterHost";
    host.innerHTML = `<div id="commandCenterBackdrop" hidden></div><section id="commandCenter" hidden role="menu" aria-label="ModelForge commands"><div class="command-head"><div><span class="command-kicker">ModelForge</span><strong id="commandTitle">Add Object</strong></div><button id="commandClose" aria-label="Close">×</button></div><div id="commandList"></div></section>`;
    document.body.appendChild(host);
    panel = host.querySelector("#commandCenter");
    host.querySelector("#commandClose")?.addEventListener("click", closeCommandCenter);
    host.querySelector("#commandCenterBackdrop")?.addEventListener("click", closeCommandCenter);
}

export function openCommandCenter(section = "add", anchor = null) {
    if (!host) initCommandCenter();
    renderSection(section);
    const rect = anchor?.getBoundingClientRect?.();
    if (window.innerWidth <= 760 || !rect) { panel.style.left = "50%"; panel.style.top = "50%"; panel.style.transform = "translate(-50%, -50%)"; }
    else { panel.style.left = `${Math.min(rect.left, window.innerWidth - 310)}px`; panel.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 390)}px`; panel.style.transform = "none"; }
    panel.hidden = false;
    host.querySelector("#commandCenterBackdrop").hidden = false;
}

export function closeCommandCenter() {
    if (!host) return;
    panel.hidden = true;
    host.querySelector("#commandCenterBackdrop").hidden = true;
}

function renderSection(section) {
    const titles = { add: "Add Object", file: "File", edit: "Edit", view: "View", more: "All Features" };
    panel.querySelector("#commandTitle").textContent = titles[section] || "All Features";
    const commands = section === "add" ? addCommands() : section === "file" ? fileCommands() : section === "edit" ? editCommands() : section === "view" ? viewCommands() : moreCommands();
    const list = panel.querySelector("#commandList");
    list.innerHTML = commands.map((command, index) => `<button class="command-item" data-command-index="${index}" role="menuitem"><span class="command-icon">${command.icon || "•"}</span><span class="command-copy"><strong>${command.label}</strong><small>${command.detail || ""}</small></span><kbd>${command.shortcut || ""}</kbd></button>`).join("");
    list.querySelectorAll("[data-command-index]").forEach(button => button.addEventListener("click", () => commands[Number(button.dataset.commandIndex)].run()));
}

function addCommands() { return ["cube", "sphere", "cylinder", "cone", "plane"].map(type => ({ icon: "◇", label: type[0].toUpperCase() + type.slice(1), detail: "Create a new editor object", run: () => add(type) })); }

function fileCommands() {
    return [
        { icon: "＋", label: "New Scene", detail: "Clear editable objects", run: newScene },
        { icon: "↥", label: "Open Scene", detail: "Load a ModelForge JSON scene", run: () => click("loadBtn") },
        { icon: "↓", label: "Save Scene", detail: "Save the current editor scene", run: () => { saveScene(scene); status("Scene saved"); } },
        { icon: "⇩", label: "Import GLTF / GLB", detail: "Bring a model into the scene", run: () => click("importBtn") },
        { icon: "⇧", label: "Export GLTF", detail: "Export editable scene objects", run: () => downloadGLTF(scene) },
        { icon: "🚀", label: "Export Rocket Part", detail: "Export the current part as .rkp", run: () => click("uploadBtn") }
    ];
}

function editCommands() {
    return [
        { icon: "↶", label: "Undo", detail: "Undo the last editor action", shortcut: "Ctrl Z", run: () => { undo(); status("Undo"); } },
        { icon: "↷", label: "Redo", detail: "Redo the last editor action", shortcut: "Ctrl Y", run: () => { redo(); status("Redo"); } },
        { icon: "⧉", label: "Duplicate", detail: "Duplicate the selected object", shortcut: "Ctrl D", run: () => { const copy = duplicateObject(scene); status(copy ? `Duplicated ${copy.name}` : "Nothing selected"); } },
        { icon: "⌫", label: "Delete", detail: "Delete the selected object", shortcut: "Del", run: () => key("Delete") },
        { icon: "⧉", label: "Copy", detail: "Copy selected object", shortcut: "Ctrl C", run: () => key("c", true) },
        { icon: "▣", label: "Paste", detail: "Paste the copied object", shortcut: "Ctrl V", run: () => key("v", true) },
        { icon: "▦", label: "Group", detail: "Group the current selection", run: () => { const group = groupSelected(scene); rebuildHierarchy(); status(group ? `Grouped ${group.name}` : "Select objects first"); } },
        { icon: "□", label: "Ungroup", detail: "Remove the selected group", run: () => { const result = ungroupSelected(scene, getSelected()); rebuildHierarchy(); status(result.length ? "Group ungrouped" : "Select a group"); } },
        { icon: "×", label: "Clear Selection", detail: "Deselect all objects", shortcut: "Esc", run: () => { clearSelection(); updateInspector(null); status("Selection cleared"); } }
    ];
}

function viewCommands() {
    return [
        { icon: "▦", label: grid.visible ? "Hide Grid" : "Show Grid", detail: "Toggle the viewport grid", run: () => { grid.visible = !grid.visible; status(grid.visible ? "Grid enabled" : "Grid hidden"); closeCommandCenter(); } },
        { icon: "⌖", label: "Frame Selected", detail: "Center the selected object", shortcut: "F", run: frameSelected },
        { icon: "⟳", label: "Reset View", detail: "Restore the default camera", run: () => { resetCamera(); status("View reset"); closeCommandCenter(); } },
        { icon: "X", label: "Right View", detail: "Look along the X axis", run: () => align("x") },
        { icon: "Y", label: "Top View", detail: "Look along the Y axis", run: () => align("y") },
        { icon: "Z", label: "Front View", detail: "Look along the Z axis", run: () => align("z") }
    ];
}

function moreCommands() {
    return [
        ...addCommands(),
        { icon: "↶", label: "Undo", detail: "Undo", run: () => { undo(); closeCommandCenter(); } },
        { icon: "↷", label: "Redo", detail: "Redo", run: () => { redo(); closeCommandCenter(); } },
        { icon: "◇", label: "Scene", detail: "Open scene hierarchy", run: () => click("mobileSceneBtn") },
        { icon: "◈", label: "Inspector", detail: "Open object properties", run: () => click("mobileInspectorBtn") },
        { icon: "🚀", label: "Rocket Part", detail: "Export .rkp", run: () => click("uploadBtn") },
        { icon: "⌖", label: "Frame Selected", detail: "Focus the selected object", run: frameSelected },
        { icon: "▦", label: grid.visible ? "Hide Grid" : "Show Grid", detail: "Toggle grid", run: () => { grid.visible = !grid.visible; status(grid.visible ? "Grid enabled" : "Grid hidden"); closeCommandCenter(); } },
        { icon: "⟳", label: "Reset View", detail: "Restore camera", run: () => { resetCamera(); status("View reset"); closeCommandCenter(); } }
    ];
}

function add(type) {
    const object = createObject(type);
    if (!object) return;
    addObject(scene, object);
    addToHierarchy(object);
    status(`Added ${object.name}`);
    closeCommandCenter();
}

function newScene() {
    if (!confirm("Clear all editable objects from this scene?")) return;
    scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly).slice().forEach(object => { removeObject(scene, object); removeFromHierarchy(object); });
    clearSelection();
    rebuildHierarchy();
    updateInspector(null);
    status("New scene");
    closeCommandCenter();
}

function frameSelected() {
    const selected = getSelected();
    if (!selected) return status("Nothing selected");
    const box = new THREE.Box3().setFromObject(selected);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const distance = Math.max(sphere.radius * 3, 2);
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(sphere.center).add(direction.multiplyScalar(distance));
    controls.target.copy(sphere.center);
    controls.update();
    status(`Framed ${selected.name || selected.type}`);
    closeCommandCenter();
}

function align(axis) {
    const selected = getSelected();
    const center = selected ? new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3()) : controls.target.clone();
    const distance = selected ? Math.max(new THREE.Box3().setFromObject(selected).getBoundingSphere(new THREE.Sphere()).radius * 3, 3) : 6;
    const offsets = { x: new THREE.Vector3(distance, 0, 0), y: new THREE.Vector3(0, distance, 0), z: new THREE.Vector3(0, 0, distance) };
    camera.position.copy(center).add(offsets[axis]);
    controls.target.copy(center);
    controls.update();
    status(`${axis.toUpperCase()} axis view`);
    closeCommandCenter();
}

function click(id) { document.getElementById(id)?.click(); closeCommandCenter(); }
function key(keyValue, modifier = false) { window.dispatchEvent(new KeyboardEvent("keydown", { key: keyValue, ctrlKey: modifier, metaKey: false, bubbles: true })); closeCommandCenter(); }
function status(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }
