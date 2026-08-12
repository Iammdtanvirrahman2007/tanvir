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
let canvas = null;
let proxyStartWorld = null;

export function initNodeTransform(scene, renderer, camera, orbit = null) {
    if (controls || !scene || !renderer || !camera) return;
    sceneRef = scene;
    canvas = renderer.domElement;
    orbitControls = orbit || defaultOrbitControls || null;

    controls = new TransformControls(camera, canvas);
    controls.setMode(mode);
    controls.setSize(0.9);
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
        if (orbitControls) orbitControls.enabled = false;
        window.dispatchEvent(new CustomEvent("editor:rocket-node-transform", {
            detail: { active: !!event.value, mode, nodeId: getActiveAttachmentNodeId() }
        }));

        if (event.value) {
            proxy?.updateMatrixWorld(true);
            proxyStartWorld = proxy?.matrixWorld.clone() || null;
        } else {
            syncNodeFromProxy();
            proxyStartWorld = null;
            if (active && orbitControls) orbitControls.enabled = false;
        }
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

    // Isolate node editing from the normal object gizmo.
    setTransformEnabled(false);
    if (orbitControls) orbitControls.enabled = false;

    modelRoot.updateWorldMatrix(true, true);
    const nodeLocal = new THREE.Matrix4();
    const nodeQuat = new THREE.Quaternion();
    const nodeScale = new THREE.Vector3(1, 1, 1);
    nodeQuat.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(node.rotation?.[0] || 0),
        THREE.MathUtils.degToRad(node.rotation?.[1] || 0),
        THREE.MathUtils.degToRad(node.rotation?.[2] || 0),
        "XYZ"
    ));
    nodeLocal.compose(new THREE.Vector3(...node.position), nodeQuat, nodeScale);

    const worldMatrix = modelRoot.matrixWorld.clone().multiply(nodeLocal);
    worldMatrix.decompose(proxy.position, proxy.quaternion, proxy.scale);

    // The proxy orientation follows the model so local gizmo axes match the
    // rocket part coordinate system (Y up, Z forward).
    const modelWorldQuat = new THREE.Quaternion();
    const modelWorldScale = new THREE.Vector3();
    const modelWorldPos = new THREE.Vector3();
    modelRoot.matrixWorld.decompose(modelWorldPos, modelWorldQuat, modelWorldScale);
    if (mode === "translate") proxy.quaternion.copy(modelWorldQuat);

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
    proxyStartWorld = null;
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

void canvas;
void proxyStartWorld;
