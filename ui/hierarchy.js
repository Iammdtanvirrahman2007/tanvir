import {
    selectObject
} from "../core/selection.js";

import {
    updateInspector
} from "./inspector.js";

let activeItem = null;

// ==========================================
// Create Tree Item
// ==========================================

function createTreeItem(object) {

    const item = document.createElement("li");

    item.id = object.uuid;
    item.dataset.uuid = object.uuid;

    item.style.listStyle = "none";
    item.style.marginBottom = "2px";

    // --------------------------------------
    // Row
    // --------------------------------------

    const row = document.createElement("div");

    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.cursor = "pointer";
    row.style.padding = "6px";
    row.style.borderRadius = "6px";

    // --------------------------------------
    // Expand Button
    // --------------------------------------

    const children = object.children.filter(c =>
        c.isMesh || c.isGroup || c.type === "Group"
    );

    const expand = document.createElement("span");

    expand.style.width = "16px";
    expand.style.display = "inline-block";

    // --------------------------------------
    // Children List
    // --------------------------------------

    const childList = document.createElement("ul");

    childList.style.paddingLeft = "18px";
    childList.style.marginTop = "2px";
    childList.style.display = "none";

    if (children.length > 0) {

        expand.textContent = "▶";

        expand.onclick = e => {

            e.stopPropagation();

            const open = childList.style.display === "block";

            childList.style.display = open ? "none" : "block";

            expand.textContent = open ? "▶" : "▼";
        };

        children.forEach(child => {
            childList.appendChild(createTreeItem(child));
        });

    } else {
        expand.textContent = "";
    }

    // --------------------------------------
    // Icon
    // --------------------------------------

    const icon = document.createElement("span");

    if (object.isGroup || object.type === "Group") {
        icon.textContent = "📦";
    } else {
        icon.textContent = "🟦";
    }

    // --------------------------------------
    // Name
    // --------------------------------------

    const label = document.createElement("span");

    label.textContent = object.name || object.type;

    // --------------------------------------
    // Single Click
    // --------------------------------------

    row.onclick = () => {

        selectObject(object);

        setActiveHierarchy(object);
    };

    // --------------------------------------
    // Double Click Rename
    // --------------------------------------

    row.ondblclick = e => {

        e.stopPropagation();

        const input = document.createElement("input");

        input.type = "text";
        input.value = object.name || object.type;
        input.style.width = "120px";

        label.replaceWith(input);

        input.focus();
        input.select();

        function finish() {

            object.name = input.value.trim() || object.name;

            label.textContent = object.name;

            input.replaceWith(label);

            updateInspector(object);
        }

        input.onblur = finish;

        input.onkeydown = ev => {
            if (ev.key === "Enter") finish();
        };
    };

    row.appendChild(expand);
    row.appendChild(icon);
    row.appendChild(label);

    item.appendChild(row);
    item.appendChild(childList);

    return item;
}

// ==========================================
// Add To Hierarchy
// ==========================================

export function addToHierarchy(object) {

    const tree = document.getElementById("sceneTree");

    tree.appendChild(createTreeItem(object));
}

// ==========================================
// Remove From Hierarchy
// ==========================================

export function removeFromHierarchy(object) {

    const item = document.getElementById(object.uuid);

    if (item) item.remove();
}

// ==========================================
// Set Active Item
// ==========================================

export function setActiveHierarchy(object) {

    if (activeItem) {

        activeItem.style.background = "";
        activeItem.style.color = "";
    }

    if (!object) {

        activeItem = null;

        return;
    }

    const item = document.getElementById(object.uuid);

    if (!item) return;

    activeItem = item.querySelector("div") || item;

    activeItem.style.background = "#2563eb";
    activeItem.style.color = "white";
}