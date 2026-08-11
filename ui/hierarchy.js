import { selectObject, clearSelection } from "../core/selection.js";
import { updateInspector } from "./inspector.js";
import { openGroupFocusDialog } from "./focusDialog.js";

let activeUuid = null;
let filterText = "";
let sceneRoot = null;
let draggedObject = null;

const TYPE_ICONS = { Group: "▣", Mesh: "◇", default: "◇" };

export function initHierarchy(scene) {
    sceneRoot = scene;
    document.getElementById("sceneSearch")?.addEventListener("input", event => {
        filterText = event.target.value.trim().toLowerCase();
        rebuildHierarchy();
    });
    rebuildHierarchy();
}

export function addToHierarchy() { rebuildHierarchy(); }
export function removeFromHierarchy() { rebuildHierarchy(); }
export function rebuildHierarchy() {
    const tree = document.getElementById("sceneTree");
    if (!tree || !sceneRoot) return;
    tree.replaceChildren();
    sceneRoot.children.filter(isEditorObject).forEach(object => {
        const item = createTreeItem(object, 0);
        if (item) tree.appendChild(item);
    });
    if (!tree.children.length) {
        const empty = document.createElement("li");
        empty.className = "tree-empty";
        empty.textContent = filterText ? "No matching objects" : "Scene is empty";
        tree.appendChild(empty);
    }
}

function createTreeItem(object, depth) {
    const children = object.children.filter(isEditorObject);
    if (!matchesFilter(object) && !children.some(matchesTreeBranch)) return null;

    const item = document.createElement("li");
    item.dataset.uuid = object.uuid;
    item.draggable = true;

    const row = document.createElement("div");
    row.className = `tree-row${object.uuid === activeUuid ? " active" : ""}${object.visible === false ? " hidden-object" : ""}`;
    row.dataset.uuid = object.uuid;
    row.style.paddingLeft = `${6 + depth * 12}px`;
    row.title = "Click select · Double-click rename · Drag to reparent/reorder · Right-click actions";

    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.textContent = TYPE_ICONS[object.type] || TYPE_ICONS.default;
    const label = document.createElement("span");
    label.className = "tree-name";
    label.textContent = object.name || object.type;
    const kind = document.createElement("span");
    kind.className = "tree-kind";
    kind.textContent = object.isGroup ? "GROUP" : "";

    const actions = document.createElement("span");
    actions.className = "tree-actions";
    const visibility = makeAction(object.visible === false ? "○" : "●", object.visible === false ? "Show" : "Hide");
    const lock = makeAction(object.userData?.editorLocked ? "🔒" : "□", object.userData?.editorLocked ? "Unlock" : "Lock");
    actions.append(visibility, lock);
    if (object.userData?.editorGroup === true) {
        const focus = makeAction("◎", "Focus group");
        focus.classList.add("tree-focus-action");
        focus.addEventListener("click", event => {
            event.stopPropagation();
            openGroupFocusDialog(object);
        });
        actions.append(focus);
    }
    row.append(arrow, icon, label, kind, actions);
    item.appendChild(row);

    const childList = document.createElement("ul");
    childList.className = "tree-children";
    const expanded = object.userData.hierarchyExpanded !== false;
    if (children.length) {
        arrow.textContent = expanded ? "▾" : "▸";
        if (expanded) childList.classList.add("open");
        children.forEach(child => {
            const childItem = createTreeItem(child, depth + 1);
            if (childItem) childList.appendChild(childItem);
        });
        if (childList.children.length) item.appendChild(childList);
    }

    row.addEventListener("click", event => {
        if (event.target.closest(".tree-actions")) return;
        event.stopPropagation();
        if (object.userData?.editorLocked) return;
        selectObject(object, { toggle: event.ctrlKey || event.metaKey, additive: event.shiftKey });
        setActiveHierarchy(object);
    });

    visibility.addEventListener("click", event => {
        event.stopPropagation();
        object.visible = !object.visible;
        visibility.textContent = object.visible ? "●" : "○";
        row.classList.toggle("hidden-object", !object.visible);
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `${object.visible ? "Shown" : "Hidden"} ${object.name}` }));
    });

    lock.addEventListener("click", event => {
        event.stopPropagation();
        object.userData.editorLocked = !object.userData.editorLocked;
        lock.textContent = object.userData.editorLocked ? "🔒" : "□";
        row.classList.toggle("locked-object", object.userData.editorLocked);
        if (object.userData.editorLocked && activeUuid === object.uuid) clearSelection?.();
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `${object.userData.editorLocked ? "Locked" : "Unlocked"} ${object.name}` }));
    });

    if (children.length) {
        arrow.addEventListener("click", event => {
            event.stopPropagation();
            object.userData.hierarchyExpanded = !expanded;
            rebuildHierarchy();
        });
    }

    row.addEventListener("dblclick", event => {
        if (event.target.closest(".tree-actions")) return;
        event.stopPropagation();
        beginRename(label, object);
    });

    row.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        selectObject(object);
        setActiveHierarchy(object);
        showContextMenu(event.clientX, event.clientY, object);
    });

    item.addEventListener("dragstart", event => {
        if (object.userData?.editorLocked) { event.preventDefault(); return; }
        draggedObject = object;
        item.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", object.uuid);
    });
    item.addEventListener("dragend", () => { draggedObject = null; item.classList.remove("dragging"); document.querySelectorAll(".tree-drop-target").forEach(el => el.classList.remove("tree-drop-target")); });
    row.addEventListener("dragover", event => {
        if (!draggedObject || draggedObject === object || draggedObject === sceneRoot || draggedObject.getObjectById?.(object.id)) return;
        event.preventDefault();
        row.classList.add("tree-drop-target");
        event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("dragleave", () => row.classList.remove("tree-drop-target"));
    row.addEventListener("drop", event => {
        event.preventDefault();
        row.classList.remove("tree-drop-target");
        if (!draggedObject || draggedObject === object || draggedObject === sceneRoot || draggedObject.getObjectById?.(object.id)) return;
        object.add(draggedObject);
        object.userData.hierarchyExpanded = true;
        rebuildHierarchy();
        selectObject(draggedObject);
        setActiveHierarchy(draggedObject);
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `${draggedObject.name} parented to ${object.name}` }));
    });

    return item;
}

function makeAction(text, title) {
    const button = document.createElement("button");
    button.className = "tree-action";
    button.type = "button";
    button.textContent = text;
    button.title = title;
    return button;
}

function showContextMenu(x, y, object) {
    document.getElementById("hierarchyContextMenu")?.remove();
    const menu = document.createElement("div");
    menu.id = "hierarchyContextMenu";
    menu.className = "hierarchy-context-menu";
    const entries = [
        ["Rename", () => { const row = document.querySelector(`.tree-row[data-uuid="${object.uuid}"] .tree-name`); if (row) beginRename(row, object); }],
        [object.visible === false ? "Show" : "Hide", () => { object.visible = !object.visible; rebuildHierarchy(); }],
        [object.userData?.editorLocked ? "Unlock" : "Lock", () => { object.userData.editorLocked = !object.userData.editorLocked; rebuildHierarchy(); }],
        ["Frame Selected", () => document.getElementById("frameBtn")?.click()],
        ["Focus", () => { if (object.userData?.editorGroup) openGroupFocusDialog(object); else window.dispatchEvent(new CustomEvent("editor:focus-object", { detail: object })); }],
        ["Delete", () => window.dispatchEvent(new CustomEvent("editor:delete-object", { detail: object }))]
    ];
    entries.forEach(([text, action]) => { const button = document.createElement("button"); button.textContent = text; button.addEventListener("click", () => { menu.remove(); action(); }); menu.appendChild(button); });
    document.body.appendChild(menu);
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - 8)}px`;
    const close = event => { if (!menu.contains(event.target)) { menu.remove(); document.removeEventListener("pointerdown", close); } };
    setTimeout(() => document.addEventListener("pointerdown", close), 0);
}

function beginRename(label, object) {
    const input = document.createElement("input");
    input.className = "tree-rename";
    input.value = object.name || object.type;
    label.replaceWith(input);
    input.focus();
    input.select();
    let cancelled = false;
    const finish = () => {
        if (cancelled) return;
        const next = input.value.trim();
        if (next) object.name = next;
        input.replaceWith(label);
        label.textContent = object.name || object.type;
        updateInspector(object);
        rebuildHierarchy();
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Renamed to ${object.name}` }));
    };
    input.addEventListener("blur", finish, { once: true });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") { cancelled = true; input.replaceWith(label); }
    });
}

export function setActiveHierarchy(object) {
    activeUuid = object?.uuid || null;
    document.querySelectorAll(".tree-row.active").forEach(row => row.classList.remove("active"));
    if (!activeUuid) return;
    const row = document.querySelector(`.tree-row[data-uuid="${activeUuid}"]`);
    if (row) { row.classList.add("active"); row.scrollIntoView({ block: "nearest" }); }
}

export function clearHierarchySelection() {
    activeUuid = null;
    document.querySelectorAll(".tree-row.active").forEach(row => row.classList.remove("active"));
}

function isEditorObject(object) { return !!object && !object.userData?.editorOnly && (object.isMesh || object.isGroup || object.userData?.selectable === true); }
function matchesFilter(object) { return !filterText || `${object.name || ""} ${object.type || ""}`.toLowerCase().includes(filterText); }
function matchesTreeBranch(object) { return matchesFilter(object) || object.children.some(child => isEditorObject(child) && matchesTreeBranch(child)); }
