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

const COMMAND_STYLE = `
#commandCenterHost{position:fixed;inset:0;z-index:1000;pointer-events:none}
#commandCenterBackdrop{position:fixed;inset:0;background:rgba(5,6,9,.42);backdrop-filter:blur(2px);pointer-events:auto}
#commandCenter{position:fixed;width:min(330px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 90px));overflow:auto;padding:6px;border:1px solid #363941;border-radius:8px;background:rgba(24,25,30,.98);box-shadow:0 22px 70px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.35);color:#e7e8eb;pointer-events:auto;backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
#commandCenter[hidden],#commandCenterBackdrop[hidden]{display:none!important}
.command-head{display:flex;align-items:center;justify-content:space-between;padding:8px 9px 9px;border-bottom:1px solid #2a2c32;margin-bottom:4px}
.command-head>div{min-width:0}.command-kicker{display:block;color:#777c87;font-size:8px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:3px}.command-head strong{display:block;color:#f0f1f4;font-size:13px;font-weight:650}
#commandClose{width:28px;height:28px;border:1px solid #30333a;border-radius:5px;background:#1a1c21;color:#9ca1ab;cursor:pointer;font-size:18px;line-height:1}#commandClose:hover{background:#292c33;color:#fff}
#commandList{display:flex;flex-direction:column;gap:2px}.command-item{width:100%;min-height:46px;display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 8px;border:1px solid transparent;border-radius:5px;background:transparent;color:#d5d8de;text-align:left;cursor:pointer}.command-item:hover{background:#2a2d34;border-color:#383b44}.command-item:active{background:#33363e}.command-icon{width:28px;height:28px;display:grid;place-items:center;border:1px solid #30333a;border-radius:5px;background:#1a1c21;color:#aeb3bd;font-size:13px}.command-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.command-copy strong{font-size:11px;font-weight:550;color:#dfe1e6}.command-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#747985;font-size:9px;line-height:1.2}.command-item:hover .command-copy small{color:#9297a2}.command-item kbd{min-width:34px;padding:3px 5px;border:1px solid #30333a;border-radius:4px;background:#17191d;color:#727783;font:9px ui-monospace,SFMono-Regular,Consolas,monospace;text-align:center}
#commandCenter::-webkit-scrollbar{width:7px}#commandCenter::-webkit-scrollbar-thumb{background:#353840;border-radius:8px}
@media(max-width:760px){#commandCenter{width:calc(100vw - 16px);max-height:72vh;border-radius:12px;padding:7px}.command-item{min-height:50px;padding:8px}.command-copy strong{font-size:11px}.command-copy small{font-size:9px}.command-head{padding:9px 8px 10px}}
`;

export function initCommandCenter() {
    if (host) return;

    const style = document.createElement("style");
    style.id = "commandCenterStyles";
    style.textContent = COMMAND_STYLE;
    document.head.appendChild(style);

    host = document.createElement("div");
    host.id = "commandCenterHost";
    host.innerHTML = `
        <div id="commandCenterBackdrop" hidden></div>
        <section id="commandCenter" hidden role="menu" aria-label="ModelForge commands">
            <div class="command-head">
                <div>
                    <span class="command-kicker">ModelForge</span>
                    <strong id="commandTitle">Add Object</strong>
                </div>
                <button id="commandClose" aria-label="Close">×</button>
            </div>
            <div id="commandList"></div>
        </section>`;

    document.body.appendChild(host);
    panel = host.querySelector("#commandCenter");

    host.querySelector("#commandClose")?.addEventListener("click", closeCommandCenter);
    host.querySelector("#commandCenterBackdrop")?.addEventListener("click", closeCommandCenter);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && panel && !panel.hidden) closeCommandCenter();
    });
}

export function openCommandCenter(section = "add", anchor = null) {
    if (!host) initCommandCenter();

    renderSection(section);

    const rect = anchor?.getBoundingClientRect?.();
    panel.hidden = false;
    host.querySelector("#commandCenterBackdrop").hidden = false;

    if (window.innerWidth <= 760 || !rect) {
        panel.style.left = "50%";
        panel.style.top = "50%";
        panel.style.transform = "translate(-50%, -50%)";
    } else {
        const width = 330;
        const height = Math.min(panel.scrollHeight || 390, window.innerHeight - 90);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const top = Math.max(52, Math.min(rect.bottom + 6, window.innerHeight - height - 8));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.transform = "none";
    }
}

export function closeCommandCenter() {
    if (!host) return;
    panel.hidden = true;
    host.querySelector("#commandCenterBackdrop").hidden = true;
}

function renderSection(section) {
    const titles = {
        add: "Add Object",
        file: "File",
        edit: "Edit",
        view: "View",
        more: "All Features"
    };

    panel.querySelector("#commandTitle").textContent = titles[section] || "All Features";

    const commands = section === "add"
        ? addCommands()
        : section === "file"
            ? fileCommands()
            : section === "edit"
                ? editCommands()
                : section === "view"
                    ? viewCommands()
                    : moreCommands();

    const list = panel.querySelector("#commandList");
    list.innerHTML = commands.map((command, index) => `
        <button class="command-item" data-command-index="${index}" role="menuitem">
            <span class="command-icon">${command.icon || "•"}</span>
            <span class="command-copy">
                <strong>${command.label}</strong>
                <small>${command.detail || ""}</small>
            </span>
            <kbd>${command.shortcut || ""}</kbd>
        </button>`).join("");

    list.querySelectorAll("[data-command-index]").forEach(button => {
        button.addEventListener("click", () => {
            const command = commands[Number(button.dataset.commandIndex)];
            if (command?.run) command.run();
        });
    });
}

function addCommands() {
    return ["cube", "sphere", "cylinder", "cone", "plane"].map(type => ({
        icon: "◇",
        label: type[0].toUpperCase() + type.slice(1),
        detail: "Create a new editor object",
        run: () => add(type)
    }));
}

function fileCommands() {
    return [
        { icon: "＋", label: "New Scene", detail: "Clear editable objects", run: newScene },
        { icon: "↥", label: "Open", detail: "Open a saved ModelForge project", run: () => click("loadBtn") },
        { icon: "↓", label: "Save", detail: "Save the current ModelForge project", run: () => click("saveBtn") },
        { icon: "⇩", label: "Import", detail: "Bring GLTF / GLB or supported model data into the scene", run: () => click("importBtn") },
        { icon: "⇧", label: "Export", detail: "Export the current scene to a supported format", run: () => click("exportBtn") }
    ];
}

function editCommands() {
    return [
        { icon: "↶", label: "Undo", detail: "Undo the last editor action", shortcut: "Ctrl Z", run: () => { undo(); status("Undo"); closeCommandCenter(); } },
        { icon: "↷", label: "Redo", detail: "Redo the last editor action", shortcut: "Ctrl Y", run: () => { redo(); status("Redo"); closeCommandCenter(); } },
        { icon: "⧉", label: "Duplicate", detail: "Duplicate the selected object", shortcut: "Ctrl D", run: () => { const copy = duplicateObject(scene, getSelected()); status(copy ? `Duplicated ${copy.name}` : "Nothing selected"); closeCommandCenter(); } },
        { icon: "⌫", label: "Delete", detail: "Delete the current selection", shortcut: "Del", run: () => key("Delete") },
        { icon: "⧉", label: "Copy", detail: "Copy selected object", shortcut: "Ctrl C", run: () => key("c", true) },
        { icon: "▣", label: "Paste", detail: "Paste the copied object", shortcut: "Ctrl V", run: () => key("v", true) },
        { icon: "▦", label: "Group", detail: "Group the current multi-selection", run: () => { const group = groupSelected(scene); rebuildHierarchy(); status(group ? `Grouped ${group.name}` : "Select objects first"); closeCommandCenter(); } },
        { icon: "□", label: "Ungroup", detail: "Remove the selected group", run: () => { const result = ungroupSelected(scene, getSelected()); rebuildHierarchy(); status(result.length ? "Group ungrouped" : "Select a group"); closeCommandCenter(); } },
        { icon: "×", label: "Clear Selection", detail: "Deselect all objects", shortcut: "Esc", run: () => { clearSelection(); updateInspector(null); status("Selection cleared"); closeCommandCenter(); } }
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
    scene.children
        .filter(object => object.userData?.editorObject && !object.userData?.editorOnly)
        .slice()
        .forEach(object => {
            removeObject(scene, object);
            removeFromHierarchy(object);
        });
    clearSelection();
    rebuildHierarchy();
    updateInspector(null);
    status("New scene");
    closeCommandCenter();
}

function frameSelected() {
    const selected = getSelected();
    if (!selected) {
        status("Nothing selected");
        return;
    }

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
    const center = selected
        ? new THREE.Box3().setFromObject(selected).getCenter(new THREE.Vector3())
        : controls.target.clone();
    const distance = selected
        ? Math.max(new THREE.Box3().setFromObject(selected).getBoundingSphere(new THREE.Sphere()).radius * 3, 3)
        : 6;
    const offsets = {
        x: new THREE.Vector3(distance, 0, 0),
        y: new THREE.Vector3(0, distance, 0),
        z: new THREE.Vector3(0, 0, distance)
    };
    camera.position.copy(center).add(offsets[axis]);
    controls.target.copy(center);
    controls.update();
    status(`${axis.toUpperCase()} axis view`);
    closeCommandCenter();
}

function click(id) {
    document.getElementById(id)?.click();
    closeCommandCenter();
}

function key(keyValue, modifier = false) {
    window.dispatchEvent(new KeyboardEvent("keydown", {
        key: keyValue,
        ctrlKey: modifier,
        metaKey: false,
        bubbles: true
    }));
    closeCommandCenter();
}

function status(message) {
    window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));
}
