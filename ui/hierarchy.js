import { selectObject, clearSelection } from "../core/selection.js";
import { updateInspector } from "./inspector.js";

let activeUuid = null;
let filterText = "";
let sceneRoot = null;

const TYPE_ICONS = {
    Group: "▣",
    Mesh: "◇",
    default: "◇"
};

export function initHierarchy(scene) {
    sceneRoot = scene;

    const search = document.getElementById("sceneSearch");
    if (search) {
        search.addEventListener("input", event => {
            filterText = event.target.value.trim().toLowerCase();
            rebuildHierarchy();
        });
    }

    rebuildHierarchy();
}

export function addToHierarchy() {
    rebuildHierarchy();
}

export function removeFromHierarchy() {
    rebuildHierarchy();
}

export function rebuildHierarchy() {
    const tree = document.getElementById("sceneTree");
    if (!tree || !sceneRoot) return;

    tree.replaceChildren();

    const roots = sceneRoot.children.filter(isVisibleEditorObject);
    roots.forEach(object => {
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
    if (!matchesFilter(object)) {
        const matchingChild = object.children.some(child => isVisibleEditorObject(child) && matchesTreeBranch(child));
        if (!matchingChild) return null;
    }

    const item = document.createElement("li");
    item.dataset.uuid = object.uuid;

    const row = document.createElement("div");
    row.className = `tree-row${object.uuid === activeUuid ? " active" : ""}`;
    row.style.paddingLeft = `${6 + depth * 12}px`;
    row.title = object.name || object.type;

    const children = object.children.filter(isVisibleEditorObject);
    const hasChildren = children.length > 0;

    const arrow = document.createElement("span");
    arrow.className = "tree-arrow";
    arrow.textContent = hasChildren ? "▸" : "";

    const icon = document.createElement("span");
    icon.className = "tree-icon";
    icon.textContent = TYPE_ICONS[object.type] || TYPE_ICONS.default;

    const name = document.createElement("span");
    name.className = "tree-name";
    name.textContent = object.name || object.type;

    const kind = document.createElement("span");
    kind.className = "tree-kind";
    kind.textContent = object.isGroup ? "GROUP" : "";

    row.append(arrow, icon, name, kind);
    item.appendChild(row);

    let childList = null;
    let expanded = object.userData.hierarchyExpanded === true;

    if (hasChildren) {
        childList = document.createElement("ul");
        childList.className = `tree-children${expanded ? " open" : ""}`;

        children.forEach(child => {
            const childItem = createTreeItem(child, depth + 1);
            if (childItem) childList.appendChild(childItem);
        });

        if (childList.children.length) item.appendChild(childList);
        arrow.textContent = expanded ? "▾" : "▸";
    }

    row.addEventListener("click", event => {
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) {
            selectObject(object, { toggle: true });
        } else {
            selectObject(object);
        }
    });

    arrow.addEventListener("click", event => {
        event.stopPropagation();
        object.userData.hierarchyExpanded = !expanded;
        rebuildHierarchy();
    });

    row.addEventListener("dblclick", event => {
        event.stopPropagation();
        beginRename(name, object);
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

    const finish = () => {
        const nextName = input.value.trim();
        if (nextName) object.name = nextName;
        input.replaceWith(label);
        label.textContent = object.name || object.type;
        updateInspector(object);
        rebuildHierarchy();
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Renamed to ${object.name}` }));
    };

    input.addEventListener("blur", finish, { once: true });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") {
            input.removeEventListener("blur", finish);
            input.replaceWith(label);
        }
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

function isVisibleEditorObject(object) {
    if (!object || object.userData?.editorOnly) return false;
    return object.isMesh || object.isGroup || object.userData?.selectable === true;
}

function matchesFilter(object) {
    if (!filterText) return true;
    return `${object.name || ""} ${object.type || ""}`.toLowerCase().includes(filterText);
}

function matchesTreeBranch(object) {
    return matchesFilter(object) || object.children.some(child => isVisibleEditorObject(child) && matchesTreeBranch(child));
}
