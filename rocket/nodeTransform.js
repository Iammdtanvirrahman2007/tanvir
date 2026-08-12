import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { getAttachmentNodes, getActiveAttachmentNodeId, getModelRoot, updateAttachmentNode } from "./attachmentNodes.js";
import { controls as defaultOrbitControls } from "../core/scene.js";
import { setTransformEnabled } from "../core/transform.js";

let controls = null;
let sceneRef = null;
let orbitControls = null;
let active = false;
let mode = "translate";
let proxy = null;

export function initNodeTransform(scene, renderer, camera, orbit = null) {
    if (controls || !scene || !renderer || !camera) return;
    sceneRef = scene;
    orbitControls = orbit || defaultOrbitControls || null;

    controls = new TransformControls(camera, renderer.domElement);
    controls.setMode(mode);
    controls.setSize(1.0);
    controls.setSpace("local");
    controls.setTranslationSnap(null);
    controls.setRotationSnap(null);
    controls.enabled = false;
    controls.visible = false;
    scene.add(controls.getHelper());

    proxy = new THREE.Group();
    proxy.name = "__editorAttachmentNodeProxy";
    proxy.userData = { editorOnly: true, attachmentNodeTransformProxy: true };
    proxy.visible = false;
    scene.add(proxy);

    controls.addEventListener("dragging-changed", event => {
        if (orbitControls) orbitControls.enabled = !event.value ? false : false;
        window.dispatchEvent(new CustomEvent("editor:rocket-node-transform", {
            detail: { active: !!event.value, mode, nodeId: getActiveAttachmentNodeId() }
        }));
        if (!event.value) syncNodeFromProxy();
    });

    controls.addEventListener("objectChange", syncNodeFromProxy);

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
    controls.setSpace("local");
    updateTransformLabel();
}

export function getNodeTransformMode() { return mode; }

function attachNode(nodeId) {
    if (!controls || !proxy || !sceneRef) return;
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    const modelRoot = getModelRoot();
    if (!node || !modelRoot) return detachNode();

    setTransformEnabled(false);
    if (orbitControls) orbitControls.enabled = false;

    modelRoot.updateWorldMatrix(true, true);
    const nodeLocal = new THREE.Matrix4();
    const nodeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(node.rotation?.[0] || 0),
        THREE.MathUtils.degToRad(node.rotation?.[1] || 0),
        THREE.MathUtils.degToRad(node.rotation?.[2] || 0),
        "XYZ"
    ));
    nodeLocal.compose(new THREE.Vector3(...node.position), nodeQuat, new THREE.Vector3(1, 1, 1));

    const worldMatrix = modelRoot.matrixWorld.clone().multiply(nodeLocal);
    worldMatrix.decompose(proxy.position, proxy.quaternion, proxy.scale);
    proxy.scale.setScalar(1);
    proxy.updateMatrixWorld(true);

    active = true;
    controls.setMode(mode);
    controls.setSpace("local");
    controls.attach(proxy);
    controls.enabled = true;
    controls.visible = true;
    updateTransformLabel();
}

function detachNode() {
    active = false;
    controls?.detach();
    if (controls) {
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

function syncNodeFromProxy() {
    if (!active || !proxy || !sceneRef) return;
    const id = getActiveAttachmentNodeId();
    const modelRoot = getModelRoot();
    if (!id || !modelRoot) return;

    proxy.updateWorldMatrix(true, false);
    modelRoot.updateWorldMatrix(true, false);
    const localMatrix = modelRoot.matrixWorld.clone().invert().multiply(proxy.matrixWorld);

    const localPosition = new THREE.Vector3();
    const localQuaternion = new THREE.Quaternion();
    const localScale = new THREE.Vector3();
    localMatrix.decompose(localPosition, localQuaternion, localScale);

    const patch = { position: localPosition.toArray() };
    if (mode === "rotate") {
        const euler = new THREE.Euler().setFromQuaternion(localQuaternion, "XYZ");
        patch.rotation = [
            THREE.MathUtils.radToDeg(euler.x),
            THREE.MathUtils.radToDeg(euler.y),
            THREE.MathUtils.radToDeg(euler.z)
        ];
    }
    updateAttachmentNode(id, patch);
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
    if (key === "escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        detachNode();
    }
}

function updateTransformLabel() {
    const label = document.getElementById("rocketNodeTransformMode");
    if (label) label.textContent = mode === "translate" ? "Move" : "Rotate";
}
