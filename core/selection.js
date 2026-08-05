import {
    setActiveHierarchy
} from "../ui/hierarchy.js";

import {
    attachTransform,
    detachTransform,
    isDraggingTransform
} from "./transform.js";

import * as THREE from "three";

import {
    updateInspector
} from "../ui/inspector.js";

import {
    highlight
} from "./highlight.js";

// Multi Select Support
import {
    toggleMultiSelect
} from "./grouping.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let selected = null;

// ==========================================
// Get Selected Object
// ==========================================

export function getSelected() {
    return selected;
}

// ==========================================
// Clear Selection
// ==========================================

export function clearSelection() {

    selected = null;

    detachTransform();

    highlight(null);

    updateInspector(null);

    setActiveHierarchy(null);
}

// ==========================================
// Select Object
// ==========================================

export function selectObject(object) {

    if (!object) {
        clearSelection();
        return;
    }

    selected = object;

    attachTransform(object);

    highlight(object);

    updateInspector(object);

    setActiveHierarchy(object);
}

// ==========================================
// Find Top Selectable Parent
// ==========================================

function findSelectableRoot(object, scene) {

    let current = object;
    let selectable = object;

    while (current.parent && current.parent !== scene) {

        current = current.parent;

        if (current.userData.selectable === true) {
            selectable = current;
        }
    }

    return selectable;
}

// ==========================================
// Selection System
// ==========================================

export function setupSelection(renderer, camera, scene) {

    renderer.domElement.addEventListener("pointerdown", event => {

        // Transform gizmo drag হলে ignore
        if (isDraggingTransform()) return;

        const rect = renderer.domElement.getBoundingClientRect();

        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // সব child সহ raycast[cite: 4]
        const hits = raycaster.intersectObjects(scene.children, true);

        let target = null;

        for (const hit of hits) {

            const obj = hit.object;

            // ==========================================
            // Ignore Scene
            // ==========================================

            if (obj === scene) {
                continue;
            }

            // ==========================================
            // Direct selectable object (Plane সহ সব শেপ পাবে)
            // ==========================================

            if (obj.userData.selectable === true) {

                target = findSelectableRoot(obj, scene);

                break;
            }

            // ==========================================
            // Search parent chain
            // ==========================================

            let parent = obj.parent;

            while (parent && parent !== scene) {

                if (parent.userData.selectable === true) {

                    target = findSelectableRoot(parent, scene);

                    break;
                }

                parent = parent.parent;
            }

            if (target) break;
        }

        // ==========================================
        // Nothing Selected
        // ==========================================

        if (!target) {

            clearSelection();

            console.log("Nothing Selected");

            return;
        }

        // ======================================
        // Ctrl + Click = Multi Select
        // ======================================

        if (event.ctrlKey) {

            toggleMultiSelect(target);

            console.log("Multi Selected:", target.name);

            return;
        }

        // ======================================
        // Normal Single Selection
        // ======================================

        selectObject(target);

        console.log("Selected:", target.name || target.type);
    });
}
