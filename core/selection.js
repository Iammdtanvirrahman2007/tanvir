import * as THREE from "three";
import { attachTransform, detachTransform, isDraggingTransform } from "./transform.js";
import { updateInspector } from "../ui/inspector.js";
import { highlight } from "./highlight.js";
import { toggleMultiSelect, clearMultiSelection, getMultiSelection, setMultiSelection } from "./grouping.js";
import { setActiveHierarchy, clearHierarchySelection } from "../ui/hierarchy.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selected = null;

export function getSelected() {
    return selected;
}

export function getSelection() {
    return selected ? [selected] : getMultiSelection();
}

export function clearSelection() {
    selected = null;
    clearMultiSelection();
    detachTransform();
    highlight(null);
    updateInspector(null);
    clearHierarchySelection();
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: null }));
}

export function selectObject(object, options = {}) {
    if (!object) {
        clearSelection();
        return;
    }

    if (options.toggle) {
        toggleMultiSelect(object);
        const selection = getMultiSelection();
        selected = selection.length ? selection[selection.length - 1] : null;
        if (selection.length === 1) {
            attachTransform(selection[0]);
            highlight(selection[0]);
            updateInspector(selection[0]);
            setActiveHierarchy(selection[0]);
        } else {
            detachTransform();
            highlight(null);
            updateInspector(null);
        }
        window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: selection }));
        return;
    }

    selected = object;
    setMultiSelection([object]);
    attachTransform(object);
    highlight(object);
    updateInspector(object);
    setActiveHierarchy(object);
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: [object] }));
}

export function selectMultiple(objects) {
    const valid = objects.filter(Boolean);
    if (!valid.length) return clearSelection();

    setMultiSelection(valid);
    selected = valid[valid.length - 1];

    if (valid.length === 1) {
        attachTransform(selected);
        highlight(selected);
        updateInspector(selected);
        setActiveHierarchy(selected);
    } else {
        detachTransform();
        highlight(null);
        updateInspector(null);
    }

    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: valid }));
}

export function setupSelection(renderer, camera, scene) {
    const canvas = renderer.domElement;

    canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0 || isDraggingTransform()) return;

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const hits = raycaster.intersectObjects(scene.children, true);
        let target = null;

        for (const hit of hits) {
            target = findSelectableRoot(hit.object, scene);
            if (target) break;
        }

        if (!target) {
            clearSelection();
            return;
        }

        selectObject(target, { toggle: event.ctrlKey || event.metaKey });
    });
}

function findSelectableRoot(object, scene) {
    let current = object;
    let candidate = null;

    while (current && current !== scene) {
        if (current.userData?.selectable === true) candidate = current;
        current = current.parent;
    }

    return candidate;
}
