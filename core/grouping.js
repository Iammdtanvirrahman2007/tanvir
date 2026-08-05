import * as THREE from "three";

// ==========================================
// Multi Selection Storage
// ==========================================

let multiSelection = [];

// ==========================================
// Toggle Multi Select
// ==========================================

export function toggleMultiSelect(object) {

    const index = multiSelection.indexOf(object);

    if (index === -1) {

        multiSelection.push(object);

        console.log("Added:", object.name);

    } else {

        multiSelection.splice(index, 1);

        console.log("Removed:", object.name);
    }

    console.log("Multi Selection:", multiSelection);
}

// ==========================================
// Get Multi Selection
// ==========================================

export function getMultiSelection() {
    return multiSelection;
}

// ==========================================
// Clear Multi Selection
// ==========================================

export function clearMultiSelection() {
    multiSelection = [];
}

// ==========================================
// Group Selected Objects
// ==========================================

export function groupSelected(scene) {

    if (multiSelection.length < 2) {

        alert("Select at least 2 objects using Ctrl + Click");

        return null;
    }

    const group = new THREE.Group();

    group.name = "Group " + Date.now();

    group.userData.selectable = true;

    // Scene এ আগে add করো
    scene.add(group);

    // Selected objects group এর ভিতরে নাও
    multiSelection.forEach(obj => {

        if (obj.parent) {
            group.attach(obj);
        }
    });

    // Group নিজেই selected থাকবে
    multiSelection = [group];

    console.log("Grouped Successfully");

    return group;
}

// ==========================================
// Ungroup Selected Group
// ==========================================

export function ungroupSelected(scene, group) {

    if (!group) {
        alert("No group selected");
        return;
    }

    if (group.type !== "Group") {
        alert("Selected object is not a group");
        return;
    }

    const children = [...group.children];

    children.forEach(child => {

        scene.attach(child);

        child.userData.selectable = true;
    });

    scene.remove(group);

    multiSelection = children;

    console.log("Ungrouped Successfully");
}
