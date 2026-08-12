import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { getAttachmentNodes, getActiveAttachmentNodeId, updateAttachmentNode } from "./attachmentNodes.js";
import { controls as defaultOrbitControls } from "../core/scene.js";
import { setTransformEnabled } from "../core/transform.js";

let controls = null;
let sceneRef = null;
let orbitControls = null;
let active = false;
let mode = "translate";
let targetHelper = null;

export function initNodeTransform(scene, renderer, camera, orbit = null) {
    if (controls || !scene || !renderer || !camera) return;
    sceneRef = scene;
    orbitControls = orbit || defaultOrbitControls || null;
    controls = new TransformControls(camera, renderer.domElement);
    controls.setMode(mode);
    controls.setSize(0.72);
    controls.setSpace("world");
    controls.setTranslationSnap(null);
    controls.setRotationSnap(null);
    controls.enabled = true;
    controls.visible = false;
    scene.add(controls.getHelper());

    controls.addEventListener("dragging-changed", event => {
        // Keep the camera completely isolated from node editing.
        if (orbitControls) orbitControls.enabled = !event.value;
        window.dispatchEvent(new CustomEvent("editor:rocket-node-transform", {
            detail: { active: !!event.value, mode, nodeId: getActiveAttachmentNodeId() }
        }));
        if (!event.value) syncNodeFromHelper();
    });

    controls.addEventListener("objectChange", syncNodeFromHelper);

    window.addEventListener("editor:attachment-node-selected", event => {
        attachNode(event.detail?.id || null);
    });
    window.addEventListener("editor:selection-change", () => {
        // Selecting a normal scene object exits node-edit mode cleanly.
        if (active) detachNode();
    });
    window.addEventListener("editor:rocket-part-mode", event => {
        if (!event.detail) detachNode();
    });

    document.addEventListener("keydown", onKeyDown, true);
}

export function setNodeTransformMode(next) {
    if (!controls || !["translate", "rotate"].includes(next)) return;
    mode = next;
    controls.setMode(mode);
    controls.setSpace(mode === "rotate" ? "local" : "world");
    updateTransformLabel();
}

export function getNodeTransformMode() { return mode; }

function attachNode(nodeId) {
    if (!controls) return;
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    if (!node || !sceneRef) return detachNode();
    const helper = sceneRef.getObjectByName(`Node_${node.id}`);
    if (!helper) return detachNode();

    // Never allow the normal object gizmo to run together with the node gizmo.
    setTransformEnabled(false);

    targetHelper = helper;
    active = true;
    controls.setMode(mode);
    controls.setSpace(mode === "rotate" ? "local" : "world");
    controls.attach(helper);
    controls.enabled = true;
    controls.visible = true;

    // While a node is actively selected, camera orbit is disabled so the
    // same pointer gesture cannot rotate/pan the whole scene underneath it.
    if (orbitControls) orbitControls.enabled = false;
    updateTransformLabel();
}

function detachNode() {
    active = false;
    targetHelper = null;
    if (controls) {
        controls.detach();
        controls.enabled = false;
        controls.visible = false;
    }
    if (orbitControls) orbitControls.enabled = true;
    setTransformEnabled(true);
    window.dispatchEvent(new CustomEvent("editor:rocket-node-transform", {
        detail: { active: false, mode, nodeId: null }
    }));
    updateTransformLabel();
}

function syncNodeFromHelper() {
    if (!active || !targetHelper) return;
    const id = getActiveAttachmentNodeId();
    if (!id) return;
    const node = getAttachmentNodes().find(item => item.id === id);
    if (!node) return;

    if (mode === "translate") {
        updateAttachmentNode(id, {
            position: [targetHelper.position.x, targetHelper.position.y, targetHelper.position.z]
        });
    } else if (mode === "rotate") {
        updateAttachmentNode(id, {
            rotation: [
                THREE.MathUtils.radToDeg(targetHelper.rotation.x),
                THREE.MathUtils.radToDeg(targetHelper.rotation.y),
                THREE.MathUtils.radToDeg(targetHelper.rotation.z)
            ]
        });
    }
}

function onKeyDown(event) {
    if (!active) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const key = event.key.toLowerCase();
    if (key === "g" || key === "r") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setNodeTransformMode(key === "g" ? "translate" : "rotate");
    }
}

function updateTransformLabel() {
    const label = document.getElementById("rocketNodeTransformMode");
    if (label) label.textContent = mode === "translate" ? "Move" : "Rotate";
}
