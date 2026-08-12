import { createAttachmentNode, readRocketPart, updateRocketPart } from "./rocketPart.js";

let sceneRef = null;
let activeNodeId = null;

export function initAttachmentNodeEditor(scene) {
    sceneRef = scene || null;
    activeNodeId = null;
}

export function getAttachmentNodes() {
    return readRocketPart(sceneRef)?.attachmentNodes || [];
}

export function getActiveAttachmentNodeId() { return activeNodeId; }

export function selectAttachmentNode(nodeId) {
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    if (!node) return null;
    activeNodeId = node.id;
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: node }));
    return node;
}

export function clearAttachmentNodeSelection() {
    activeNodeId = null;
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
}

export function addAttachmentNode() {
    if (!sceneRef) return null;
    const current = getAttachmentNodes();
    const node = createAttachmentNode({
        name: `Node ${current.length + 1}`,
        type: "structural",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        direction: [0, 1, 0],
        compatibleCategories: []
    });
    updateRocketPart(sceneRef, { attachmentNodes: [...current, node] });
    activeNodeId = node.id;
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: node }));
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: node }));
    return node;
}

export function removeAttachmentNode(nodeId) {
    if (!sceneRef) return false;
    const current = getAttachmentNodes();
    const next = current.filter(node => node.id !== nodeId);
    if (next.length === current.length) return false;
    updateRocketPart(sceneRef, { attachmentNodes: next });
    if (activeNodeId === nodeId) activeNodeId = null;
    window.dispatchEvent(new CustomEvent("editor:rocket-node-change", { detail: null }));
    window.dispatchEvent(new CustomEvent("editor:attachment-node-selected", { detail: null }));
    return true;
}
