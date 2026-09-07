import * as THREE from "three";
import "./meshEditAutoBoot.js";
import "./builderAutoBoot.js?v=20260908-builder-2";
import { attachTransform, detachTransform, isDraggingTransform, getTransform } from "./transform.js?v=20260812-transform-axis-fix-4";
import { updateInspector } from "../ui/inspector.js";
import { highlight, highlightMultiple, clearHighlight } from "./highlight.js";
import { toggleMultiSelect, clearMultiSelection, getMultiSelection, setMultiSelection } from "./grouping.js";
import { setActiveHierarchy, clearHierarchySelection } from "../ui/hierarchy.js";
import { consumeFocusTarget } from "./focus.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const CLICK_DRAG_THRESHOLD = 5;
let selected = null, selectionScene = null, selectionCanvas = null, boxStart = null, boxElement = null, boxDragging = false, groupSyncInstalled = false, pointerStart = null, pointerMoved = false;
export function getSelected() { return selected; }

export function setupSelection(renderer, camera, scene) {
    selectionCanvas = renderer?.domElement || null;
    selectionScene = scene || null;
    if (!selectionCanvas) return;
    selectionCanvas.addEventListener("pointerdown", onPointerDown, true);
    selectionCanvas.addEventListener("pointerup", onPointerUp, true);
    selectionCanvas.addEventListener("pointermove", onPointerMove, true);
    selectionCanvas.addEventListener("contextmenu", e => { if (window.__modelForgeMeshEditMode) e.preventDefault(); });
    if (!groupSyncInstalled) {
        groupSyncInstalled = true;
        window.addEventListener("editor:group-selection-sync", event => {
            const objects = event.detail?.objects || [];
            if (event.detail?.mode === "multiple") selectMultiple(objects);
            else if (objects[0]) selectObject(objects[0]);
        });
    }
}

function onPointerDown(event) {
    if (window.__modelForgeMeshEditMode === true) return;
    pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    pointerMoved = false;
}

function onPointerMove(event) {
    if (!pointerStart || window.__modelForgeMeshEditMode === true) return;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > CLICK_DRAG_THRESHOLD) pointerMoved = true;
}

function onPointerUp(event) {
    if (!selectionCanvas || !selectionScene || window.__modelForgeMeshEditMode === true) return;
    const start = pointerStart;
    pointerStart = null;
    if (!start || pointerMoved || event.button !== 0) return;
    const rect = selectionCanvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const camera = window.__modelForgeCamera;
    if (!camera) return;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(selectionScene.children, true).filter(hit => !isEditorOnlyHit(hit.object));
    const object = hits[0] ? findSelectable(hits[0].object) : null;
    if (!object) {
        clearSelection();
        return;
    }
    if (event.shiftKey) toggleMultiSelect(object);
    else selectObject(object);
}

function isEditorOnlyHit(object) {
    let current = object;
    while (current) {
        if (current.userData?.editorOnly) return true;
        if (current.name === "VoxelWorkspace" || current.name === "MeshEditOverlay") return true;
        current = current.parent;
    }
    return false;
}

function findSelectable(object) {
    let current = object;
    while (current && current !== selectionScene) {
        if (current.userData?.selectable !== false && current.userData?.editorObject === true) return current;
        current = current.parent;
    }
    return null;
}

export function selectObject(object) {
    if (!object || object.userData?.editorOnly) return null;
    selected = object;
    setMultiSelection([object]);
    updateSelectionVisuals();
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: object }));
    return object;
}

export function selectMultiple(objects = []) {
    const valid = [...new Set(objects.filter(o => o && o.userData?.editorObject && !o.userData?.editorOnly))];
    selected = valid[0] || null;
    setMultiSelection(valid);
    updateSelectionVisuals();
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: selected, objects: valid }));
    return valid;
}

export function clearSelection() {
    selected = null;
    clearMultiSelection();
    clearHighlight();
    try { detachTransform(); } catch {}
    clearHierarchySelection();
    updateInspector(null);
    window.dispatchEvent(new CustomEvent("editor:selection-change", { detail: null, objects: [] }));
}

function updateSelectionVisuals() {
    const objects = getMultiSelection();
    if (objects.length > 1) highlightMultiple(objects);
    else if (objects[0]) highlight(objects[0]);
    else clearHighlight();
    const active = selected || objects[0] || null;
    if (active) {
        try { attachTransform(active); } catch (error) { console.warn("Transform attach skipped", error); }
        updateInspector(active);
        setActiveHierarchy(active);
    }
}
