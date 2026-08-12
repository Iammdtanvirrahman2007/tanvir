import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { getAttachmentNodes, getActiveAttachmentNodeId, updateAttachmentNode } from "./attachmentNodes.js";
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
    orbitControls = orbit;
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

    // The normal object gizmo and the node gizmo must never be active together.
    // Otherwise the same pointer drag can transform both the node and its model.
    setTransformEnabled(false);

    targetHelper = helper;
    active = true;
    controls.setMode(mode);
    controls.setSpace(mode === "rotate" ? "local" : "world");
    controls.attach(helper);
    controls.enabled = true;
    controls.visible = true;
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
    // Restore the normal ModelForge object transform gizmo after node editing.
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
