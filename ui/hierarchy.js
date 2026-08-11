import { selectObject } from "../core/selection.js";
import { updateInspector } from "./inspector.js";

let activeUuid = null;
let filterText = "";
let sceneRoot = null;

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
        empty.style.cssText = "padding:18px 10px;color:#626671;font-size:11px;text-align:center";
        empty.textContent = filterText ? "No matching objects" : "Scene is empty";
        tree.appendChild(empty);
    }
}

function createTreeItem(object, depth) {
    const children = object.children.filter(isEditorObject);
    if (!matchesFilter(object) && !children.some(matchesTreeBranch)) return null;

    const item = document.createElement("li");
    item.dataset.uuid = object.uuid;
    const row = document.createElement("div");
    row.className = `tree-row${object.uuid === activeUuid ? " active" : ""}`;
    row.dataset.uuid = object.uuid;
    row.style.paddingLeft = `${6 + depth * 12}px`;

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
    row.append(arrow, icon, label, kind);
    item.appendChild(row);

    let childList = null;
    const expanded = object.userData.hierarchyExpanded !== false;
    if (children.length) {
        arrow.textContent = expanded ? "▾" : "▸";
        childList = document.createElement("ul");
        childList.className = `tree-children${expanded ? " open" : ""}`;
        children.forEach(child => {
            const childItem = createTreeItem(child, depth + 1);
            if (childItem) childList.appendChild(childItem);
        });
        if (childList.children.length) item.appendChild(childList);
    }

    row.addEventListener("click", event => {
        event.stopPropagation();
        selectObject(object, { toggle: event.ctrlKey || event.metaKey });
    });

    if (children.length) {
        arrow.addEventListener("click", event => {
            event.stopPropagation();
            object.userData.hierarchyExpanded = !expanded;
            rebuildHierarchy();
        });
    }

    row.addEventListener("dblclick", event => {
        event.stopPropagation();
        beginRename(label, object);
    });

    row.addEventListener("contextmenu", event => {
        event.preventDefault();
        selectObject(object);
    });

    return item;
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
    if (row) {
        row.classList.add("active");
        row.scrollIntoView({ block: "nearest" });
    }
}

export function clearHierarchySelection() {
    activeUuid = null;
    document.querySelectorAll(".tree-row.active").forEach(row => row.classList.remove("active"));
}

function isEditorObject(object) {
    return !!object && !object.userData?.editorOnly && (object.isMesh || object.isGroup || object.userData?.selectable === true);
}
function matchesFilter(object) { return !filterText || `${object.name || ""} ${object.type || ""}`.toLowerCase().includes(filterText); }
function matchesTreeBranch(object) { return matchesFilter(object) || object.children.some(child => isEditorObject(child) && matchesTreeBranch(child)); }
