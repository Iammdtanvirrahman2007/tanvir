import * as THREE from "three";
import { attachTransform, detachTransform, isDraggingTransform, getTransform } from "./transform.js";
import { updateInspector } from "../ui/inspector.js";
import { highlight, highlightMultiple, clearHighlight } from "./highlight.js";
import { toggleMultiSelect, clearMultiSelection, getMultiSelection, setMultiSelection } from "./grouping.js";
import { setActiveHierarchy, clearHierarchySelection } from "../ui/hierarchy.js";
import { focusObject, consumeFocusTarget } from "./focus.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const CLICK_DRAG_THRESHOLD = 5;
const TOUCH_DOUBLE_TAP_MS = 330;
const TOUCH_DOUBLE_TAP_DISTANCE = 28;

let selected = null;
let selectionScene = null;
let selectionCanvas = null;
let boxStart = null;
let boxElement = null;
let boxDragging = false;
let groupSyncInstalled = false;
let pointerStart = null;
let pointerMoved = false;
let lastTouchTap = 0;
let lastTouchPoint = null;
let suppressNextClick = false;

export function getSelected() { return selected; }
export function getSelection() { return getMultiSelection(); }

export function clearSelection() {
    selected = null;
    clearMultiSelection();
    detachTransform();
    clearHighlight();
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
        applySelectionVisuals(selection);
        window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: selection }));
        return;
    }

    selected = object;
    setMultiSelection([object]);
    applySelectionVisuals([object]);
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: [object] }));
}

export function selectMultiple(objects, options = {}) {
    const valid = normalizeObjects(objects);
    if (!valid.length) return clearSelection();
    setMultiSelection(valid);
    selected = valid[valid.length - 1];
    applySelectionVisuals(valid, options);
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: valid }));
}

function applySelectionVisuals(selection, options = {}) {
    if (selection.length === 0) {
        detachTransform();
        clearHighlight();
        updateInspector(null);
        clearHierarchySelection();
        return;
    }

    if (selection.length === 1) {
        attachTransform(selection[0]);
        highlight(selection[0]);
        updateInspector(selection[0]);
        setActiveHierarchy(selection[0]);
        return;
    }

    detachTransform();
    if (options.highlight !== false) highlightMultiple(selection);
    else clearHighlight();
    updateInspector(null);
    clearHierarchySelection();
}

export function setupSelection(renderer, camera, scene) {
    const canvas = renderer.domElement;
    selectionCanvas = canvas;
    selectionScene = scene;
    installGroupSelectionSync();

    canvas.addEventListener("pointerdown", event => {
        const tc = getTransform();
        if (event.button !== 0 || isDraggingTransform() || tc?.axis) return;

        pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, shift: event.shiftKey };
        pointerMoved = false;
        suppressNextClick = false;
    }, { passive: true });

    canvas.addEventListener("pointermove", event => {
        if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;

        const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
        if (distance > CLICK_DRAG_THRESHOLD) pointerMoved = true;

        // Shift + drag becomes box selection. Shift + click remains normal multi-select.
        if (pointerStart.shift && event.pointerType !== "touch" && !boxDragging && distance > CLICK_DRAG_THRESHOLD) {
            startBoxSelection({ ...event, pointerId: pointerStart.pointerId }, pointerStart);
            suppressNextClick = true;
        }

        if (boxDragging) updateBox(event);
    }, { passive: true });

    canvas.addEventListener("pointerup", event => {
        if (event.pointerId !== pointerStart?.pointerId) return;

        if (boxDragging) {
            finishBoxSelection(event, camera, scene);
            suppressNextClick = true;
        }

        if (event.pointerType === "touch" && !pointerMoved && !boxDragging) {
            const now = performance.now();
            const point = { x: event.clientX, y: event.clientY };
            const closeEnough = lastTouchPoint && Math.hypot(point.x - lastTouchPoint.x, point.y - lastTouchPoint.y) < TOUCH_DOUBLE_TAP_DISTANCE;
            if (now - lastTouchTap < TOUCH_DOUBLE_TAP_MS && closeEnough) {
                const target = pickDeep(event, camera, scene);
                if (target) {
                    if (!consumeFocusTarget(target)) {
                        focusObject(target, { duration: 360 });
                        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Focused ${target.name || target.type}` }));
                    }
                }
                lastTouchTap = 0;
                lastTouchPoint = null;
            } else {
                lastTouchTap = now;
                lastTouchPoint = point;
            }
        }

        resetPointerState();
    }, { passive: true });

    canvas.addEventListener("pointercancel", () => {
        cancelBoxSelection();
        resetPointerState();
        suppressNextClick = true;
    }, { passive: true });

    // Native click is intentionally used for selection. OrbitControls consumes pointer
    // gestures, while click is only emitted for a completed click, not a camera drag.
    canvas.addEventListener("click", event => {
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        if (event.button !== 0 || isDraggingTransform()) return;
        const target = pick(event, camera, scene);
        const toggle = event.ctrlKey || event.metaKey || event.shiftKey;
        if (target) {
            selectObject(target, { toggle });
        } else if (!toggle) {
            clearSelection();
        }
    }, { passive: true });

    canvas.addEventListener("dblclick", event => {
        if (event.pointerType === "touch") return;
        const target = pickDeep(event, camera, scene);
        if (!target) return;
        if (consumeFocusTarget(target)) return;
        focusObject(target, { duration: 360 });
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Focused ${target.name || target.type}` }));
    }, { passive: true });
}

function resetPointerState() {
    pointerStart = null;
    pointerMoved = false;
}

function installGroupSelectionSync() {
    if (groupSyncInstalled) return;
    groupSyncInstalled = true;
    window.addEventListener("editor:group-selection-sync", event => {
        const detail = event.detail || {};
        const objects = normalizeObjects(detail.objects || []);
        if (detail.mode === "single" && objects[0]) selectObject(objects[0]);
        else if (detail.mode === "multiple") selectMultiple(objects);
        else clearSelection();
    });
}

function pick(event, camera, scene) {
    const hits = raycastAll(event, camera, scene);
    for (const hit of hits) {
        const target = findSelectableRoot(hit.object, scene);
        if (target) return target;
    }
    return null;
}

function pickDeep(event, camera, scene) {
    const hits = raycastAll(event, camera, scene);
    for (const hit of hits) {
        let current = hit.object;
        while (current && current !== scene) {
            if (current.userData?.editorObject && !current.userData?.editorOnly && (current.isMesh || current.userData?.selectable === true)) return current;
            current = current.parent;
        }
    }
    return null;
}

function raycastAll(event, camera, scene) {
    if (!selectionCanvas) return [];
    const rect = selectionCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(scene.children, true).filter(hit => !isEditorOnlyHit(hit.object));
}

function isEditorOnlyHit(object) {
    let current = object;
    while (current) {
        if (current.userData?.editorOnly) return true;
        current = current.parent;
    }
    return false;
}

function startBoxSelection(event, start) {
    boxDragging = true;
    boxStart = { x: start.x, y: start.y };
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
    if (picked.length) selectMultiple(picked, { highlight: true });
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

function normalizeObjects(objects) {
    return [...new Set((objects || []).filter(object => object?.userData?.editorObject && !object?.userData?.editorOnly))];
}

function findSelectableRoot(object, scene) {
    let current = object;
    let candidate = null;
    while (current && current !== scene) {
        if (current.userData?.selectable === true || current.userData?.editorGroup === true) candidate = current;
        current = current.parent;
    }
    return candidate;
}
