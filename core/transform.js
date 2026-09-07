import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { pushHistory } from "./history.js";
import { refreshInspector } from "../ui/inspector.js";

let transform = null;
let snapEnabled = false;
let surfaceSnapEnabled = true;
let snapValues = { translation: 1, rotation: 15, scale: 0.1 };
let startState = null;
let pivotState = null;
let spaceMode = "world";
let transformEnabled = true;
let editorScene = null;

export function setupTransform(camera, renderer, scene, orbitControls) {
    editorScene = scene;
    transform = new TransformControls(camera, renderer.domElement);
    transform.setMode("translate");
    transform.setSize(0.85);
    applyTransformSpace();
    transform.enabled = true;
    transform.visible = true;
    scene.add(transform.getHelper());
    applySnapSettings();

    transform.addEventListener("dragging-changed", event => {
        if (orbitControls) orbitControls.enabled = !event.value;
        const object = pivotState?.object || transform.object;

        window.dispatchEvent(new CustomEvent("editor:gizmo-drag", {
            detail: {
                active: !!event.value,
                object: object || null,
                mode: transform.mode,
                axis: transform.axis || null,
                space: spaceMode
            }
        }));

        if (!object) return;

        if (event.value) {
            object.updateMatrixWorld(true);
            startState = captureWorld(object);
            return;
        }

        if (transform.mode === "translate" && surfaceSnapEnabled && object.userData?.selectable !== false) {
            snapObjectToNearbySurface(object);
        }

        object.updateMatrixWorld(true);
        const endState = captureWorld(object);
        if (!startState || statesEqual(startState, endState)) {
            startState = null;
            return;
        }

        const historyObject = object;
        pushHistory({
            label: `${transform.mode} ${spaceMode} transform`,
            undo: () => { restoreWorld(historyObject, startState); refreshInspector(); },
            redo: () => { restoreWorld(historyObject, endState); refreshInspector(); }
        });
        startState = null;
        refreshInspector();
        dispatchModeChange();
    });

    transform.addEventListener("objectChange", () => {
        refreshInspector();
        const object = pivotState?.object || transform.object;
        if (object) {
            window.dispatchEvent(new CustomEvent("editor:gizmo-change", {
                detail: {
                    object,
                    mode: transform.mode,
                    axis: transform.axis || null,
                    space: spaceMode
                }
            }));
        }
    });
    return transform;
}

export function attachTransform(object) {
    if (!transform || !object || !transformEnabled) return;
    clearPivot();
    transform.attach(object);
    applyTransformSpace();
    transform.visible = true;
    refreshInspector();
}

export function attachTransformPivot(object, worldPoint) {
    if (!transform || !object || !worldPoint || object === transform.getHelper() || !transformEnabled) return false;
    if (!object.parent) return false;

    clearPivot();
    object.updateMatrixWorld(true);

    const parent = object.parent;
    const pivot = new THREE.Group();
    pivot.name = "__editorTransformPivot";
    pivot.userData = {
        editorOnly: true,
        editorTransformPivot: true,
        pivotTarget: object.uuid,
        pivotPoint: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z }
    };

    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(worldPoint.clone()));
    pivot.quaternion.identity();
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);

    pivot.attach(object);
    pivot.updateMatrixWorld(true);

    pivotState = { pivot, object, parent, worldPoint: worldPoint.clone() };
    transform.attach(pivot);
    applyTransformSpace();
    transform.visible = true;
    refreshInspector();
    window.dispatchEvent(new CustomEvent("editor:transform-pivot-change", {
        detail: { object, point: worldPoint.clone(), active: true, pivot }
    }));
    return true;
}

export function clearPivot() {
    if (!pivotState) return;

    const { pivot, object, parent } = pivotState;
    const world = new THREE.Matrix4();
    object.updateMatrixWorld(true);
    world.copy(object.matrixWorld);

    transform?.detach();
    if (object && parent) {
        parent.attach(object);
        restoreWorld(object, world);
    }

    pivot.parent?.remove(pivot);
    pivotState = null;
    startState = null;

    window.dispatchEvent(new CustomEvent("editor:transform-pivot-change", { detail: { active: false } }));
    refreshInspector();
}

export function hasTransformPivot() { return !!pivotState; }
export function getTransformPivot() { return pivotState?.pivot || null; }
export function getTransformPivotTarget() { return pivotState?.object || null; }
export function getTransformPivotPoint() { return pivotState?.worldPoint?.clone() || null; }

export function detachTransform() {
    clearPivot();
    transform?.detach();
    if (transform) transform.visible = false;
}

export function setTransformEnabled(enabled) {
    transformEnabled = !!enabled;
    if (transform) {
        transform.enabled = transformEnabled;
        transform.visible = transformEnabled && !!transform.object;
        if (!transformEnabled) {
            clearPivot();
            transform.detach();
        }
    }
    return transformEnabled;
}

export function isTransformEnabled() { return transformEnabled; }

export function setTransformMode(mode) {
    if (!transform || !["translate", "rotate", "scale"].includes(mode)) return;
    transform.setMode(mode);
    window.dispatchEvent(new CustomEvent("editor:transform-mode", { detail: mode }));
}

export function getTransformMode() { return transform?.mode || "translate"; }

export function setTransformSpace(space) {
    const normalized = String(space || "").toLowerCase();
    if (!transform || !["world", "local"].includes(normalized)) return spaceMode;
    spaceMode = normalized;
    applyTransformSpace();
    window.dispatchEvent(new CustomEvent("editor:transform-space", { detail: spaceMode }));
    return spaceMode;
}

export function toggleTransformSpace() {
    return setTransformSpace(spaceMode === "world" ? "local" : "world");
}

export function getTransformSpace() { return spaceMode; }

export function setAxis(axis) {
    if (!transform || !["X", "Y", "Z", null].includes(axis)) return;
    transform.axis = axis;
    window.dispatchEvent(new CustomEvent("editor:transform-axis", { detail: axis }));
}

export function getAxis() { return transform?.axis || null; }

export function setSnapEnabled(enabled) {
    snapEnabled = !!enabled;
    applySnapSettings();
    window.dispatchEvent(new CustomEvent("editor:snap-change", { detail: snapEnabled }));
    return snapEnabled;
}

export function toggleSnap() { return setSnapEnabled(!snapEnabled); }
export function isSnapEnabled() { return snapEnabled; }

export function setSurfaceSnapEnabled(enabled) {
    surfaceSnapEnabled = !!enabled;
    window.dispatchEvent(new CustomEvent("editor:surface-snap-change", { detail: surfaceSnapEnabled }));
    return surfaceSnapEnabled;
}
export function toggleSurfaceSnap() { return setSurfaceSnapEnabled(!surfaceSnapEnabled); }
export function isSurfaceSnapEnabled() { return surfaceSnapEnabled; }

export function setSnapValues(values = {}) {
    if (Number.isFinite(values.translation) && values.translation > 0) snapValues.translation = values.translation;
    if (Number.isFinite(values.rotation) && values.rotation > 0) snapValues.rotation = values.rotation;
    if (Number.isFinite(values.scale) && values.scale > 0) snapValues.scale = values.scale;
    applySnapSettings();
    window.dispatchEvent(new CustomEvent("editor:snap-values", { detail: { ...snapValues } }));
    return { ...snapValues };
}

export function getSnapValues() { return { ...snapValues }; }
export function isDraggingTransform() { return !!transform?.dragging; }
export function getTransform() { return transform; }

function applyTransformSpace() {
    if (!transform) return;
    transform.setSpace(spaceMode);
}

function applySnapSettings() {
    if (!transform) return;
    transform.setTranslationSnap(snapEnabled ? snapValues.translation : null);
    transform.setRotationSnap(snapEnabled ? THREE.MathUtils.degToRad(snapValues.rotation) : null);
    transform.setScaleSnap(snapEnabled ? snapValues.scale : null);
}

function snapObjectToNearbySurface(object) {
    if (!editorScene || !object || object.parent?.userData?.editorOnly) return false;
    object.updateMatrixWorld(true);
    const movingBox = new THREE.Box3().setFromObject(object);
    if (movingBox.isEmpty()) return false;

    const candidates=[];
    editorScene.traverse(other=>{
        if (other===object || !other.visible || other.userData?.editorOnly || other.userData?.selectable===false) return;
        if (!other.isMesh && !other.isGroup) return;
        other.updateMatrixWorld(true);
        const box=new THREE.Box3().setFromObject(other);
        if (box.isEmpty()) return;
        candidates.push({object:other,box});
    });
    if (!candidates.length) return false;

    const center=movingBox.getCenter(new THREE.Vector3());
    let best=null;
    for(const item of candidates){
        const b=item.box;
        const overlapX=Math.min(movingBox.max.x,b.max.x)-Math.max(movingBox.min.x,b.min.x);
        const overlapZ=Math.min(movingBox.max.z,b.max.z)-Math.max(movingBox.min.z,b.min.z);
        const overlapY=Math.min(movingBox.max.y,b.max.y)-Math.max(movingBox.min.y,b.min.y);
        const sizeX=Math.max(movingBox.max.x-movingBox.min.x,b.max.x-b.min.x);
        const sizeZ=Math.max(movingBox.max.z-movingBox.min.z,b.max.z-b.min.z);
        const xRatio=overlapX/Math.max(sizeX,1e-6),zRatio=overlapZ/Math.max(sizeZ,1e-6);
        const horizontalGood=xRatio>.35&&zRatio>.35;
        if(!horizontalGood) continue;

        const gapTop=Math.abs(movingBox.min.y-b.max.y);
        const gapBottom=Math.abs(movingBox.max.y-b.min.y);
        const gap=Math.min(gapTop,gapBottom);
        const tolerance=Math.max(.18,Math.min(sizeX,sizeZ)*.22);
        if(gap>tolerance) continue;

        const targetTop=gapTop<=gapBottom;
        const desiredY=targetTop?b.max.y-(movingBox.min.y-center.y):b.min.y-(movingBox.max.y-center.y);
        const verticalGap=gap;
        const score=verticalGap-(xRatio+zRatio)*.05;
        if(!best||score<best.score)best={score,desiredY,centerY:center.y,targetTop};
    }
    if(!best) return false;
    object.position.y += best.desiredY-center.y;
    object.updateMatrixWorld(true);
    window.dispatchEvent(new CustomEvent("editor:surface-snapped",{detail:{object,mode:best.targetTop?"top":"bottom"}}));
    return true;
}

function captureWorld(object) {
    object.updateMatrixWorld(true);
    return object.matrixWorld.clone();
}

function restoreWorld(object, matrix) {
    if (!object || !matrix) return;
    const local = matrix.clone();
    if (object.parent) {
        object.parent.updateMatrixWorld(true);
        local.premultiply(object.parent.matrixWorld.clone().invert());
    }
    local.decompose(object.position, object.quaternion, object.scale);
    object.updateMatrixWorld(true);
}

function statesEqual(a, b) {
    const ae = a.elements;
    const be = b.elements;
    for (let i = 0; i < 16; i++) {
        if (Math.abs(ae[i] - be[i]) > 1e-7) return false;
    }
    return true;
}

function dispatchModeChange() {
    window.dispatchEvent(new CustomEvent("editor:transform-change", { detail: transform?.mode }));
}
