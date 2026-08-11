import * as THREE from "three";
import { attachTransform, detachTransform, isDraggingTransform, getTransform } from "./transform.js";
import { updateInspector } from "../ui/inspector.js";
import { highlight } from "./highlight.js";
import { toggleMultiSelect, clearMultiSelection, getMultiSelection, setMultiSelection } from "./grouping.js";
import { setActiveHierarchy, clearHierarchySelection } from "../ui/hierarchy.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selected = null;
let selectionScene = null;
let selectionCanvas = null;
let boxStart = null;
let boxElement = null;
let boxDragging = false;

export function getSelected() { return selected; }
export function getSelection() { return selected ? [selected] : getMultiSelection(); }

export function clearSelection() {
    selected = null;
    clearMultiSelection();
    detachTransform();
    highlight(null);
    updateInspector(null);
    clearHierarchySelection();
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: [] }));
}

export function selectObject(object, options = {}) {
    if (!object) return clearSelection();

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

export function selectMultiple(objects, options = {}) {
    const valid = [...new Set(objects.filter(Boolean))];
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
        clearHierarchySelection();
        if (options.highlight !== false) valid.forEach(object => highlight(object));
    }
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: valid }));
}

export function setupSelection(renderer, camera, scene) {
    const canvas = renderer.domElement;
    selectionCanvas = canvas;
    selectionScene = scene;

    canvas.addEventListener("pointerdown", event => {
        // TransformControls owns the pointer while a gizmo interaction is active.
        // Never let the scene raycaster deselect the object underneath a gizmo.
        const tc = getTransform();
        if (event.button !== 0 || isDraggingTransform() || tc?.axis) return;

        if (event.shiftKey && event.pointerType !== "touch") {
            startBoxSelection(event, camera);
            return;
        }

        const target = pick(event, camera, scene);
        if (!target) {
            if (!(event.ctrlKey || event.metaKey)) clearSelection();
            return;
        }
        selectObject(target, { toggle: event.ctrlKey || event.metaKey });
    }, { passive: true });

    canvas.addEventListener("pointermove", event => {
        if (!boxDragging || !boxStart) return;
        updateBox(event);
    }, { passive: true });

    canvas.addEventListener("pointerup", event => {
        if (!boxDragging) return;
        finishBoxSelection(event, camera, scene);
    });
    canvas.addEventListener("pointercancel", cancelBoxSelection);
}

function pick(event, camera, scene) {
    const rect = selectionCanvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
        const target = findSelectableRoot(hit.object, scene);
        if (target) return target;
    }
    return null;
}

function startBoxSelection(event, camera) {
    boxDragging = true;
    boxStart = { x: event.clientX, y: event.clientY };
    selectionCanvas.setPointerCapture?.(event.pointerId);
    boxElement = document.createElement("div");
    boxElement.className = "selection-box-overlay";
    boxElement.style.cssText = "position:fixed;z-index:70;pointer-events:none;border:1px solid #d97706;background:rgba(217,119,6,.10);box-sizing:border-box";
    document.body.appendChild(boxElement);
    updateBox(event);
}

function updateBox(event) {
    if (!boxElement || !boxStart) return;
    const left = Math.min(boxStart.x, event.clientX);
    const top = Math.min(boxStart.y, event.clientY);
    const width = Math.abs(event.clientX - boxStart.x);
    const height = Math.abs(event.clientY - boxStart.y);
    Object.assign(boxElement.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

function finishBoxSelection(event, camera, scene) {
    if (!boxDragging) return;
    const start = boxStart;
    const end = { x: event.clientX, y: event.clientY };
    const rect = selectionCanvas.getBoundingClientRect();
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    const picked = [];

    for (const object of scene.children) {
        const root = findSelectableRoot(object, scene);
        if (!root || root !== object) continue;
        const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
        const projected = center.project(camera);
        const x = rect.left + (projected.x + 1) * 0.5 * rect.width;
        const y = rect.top + (1 - projected.y) * 0.5 * rect.height;
        if (x >= left && x <= right && y >= top && y <= bottom) picked.push(root);
    }

    removeBoxElement();
    if (picked.length) selectMultiple(picked);
    else if (!(event.ctrlKey || event.metaKey)) clearSelection();
}

function cancelBoxSelection() {
    boxDragging = false;
    boxStart = null;
    removeBoxElement();
}

function removeBoxElement() {
    boxElement?.remove();
    boxElement = null;
    boxDragging = false;
    boxStart = null;
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
