import { PART_CATEGORIES, NODE_TYPES } from "../rocket/categories.js";
import {
    getAttachmentNodes,
    getActiveAttachmentNodeId,
    selectAttachmentNode,
    clearAttachmentNodeSelection,
    addAttachmentNode,
    updateAttachmentNode,
    removeAttachmentNode
} from "../rocket/attachmentNodes.js";
import { initRocketValidationPanel } from "./rocketValidationPanel.js";

let installed = false;
let host = null;

export function initAttachmentNodePanel() {
    if (installed) return;
    installed = true;
    initRocketValidationPanel();
    window.addEventListener("editor:rocket-part-mode", event => {
        if (event.detail) requestRender();
    });
    window.addEventListener("editor:rocket-part-change", requestRender);
    window.addEventListener("editor:rocket-node-change", requestRender);
    window.addEventListener("editor:attachment-node-selected", requestRender);
    requestRender();
}

function requestRender() {
    queueMicrotask(render);
}

function render() {
    const body = document.getElementById("rocketPartBody");
    if (!body || body.closest("[hidden]")) return;
    host?.remove();
    host = document.createElement("section");
    host.className = "rocket-node-editor-section";
    host.innerHTML = `
        <div class="rocket-node-editor-head">
            <div><span class="eyebrow">Connectivity</span><strong>Attachment Nodes</strong></div>
            <button type="button" data-node-add>+ Add Node</button>
        </div>
        <div class="rocket-node-list" data-node-list></div>
        <div class="rocket-node-editor" data-node-editor></div>
    `;
    body.appendChild(host);
    installStyles();

    const list = host.querySelector("[data-node-list]");
    const editor = host.querySelector("[data-node-editor]");
    const nodes = getAttachmentNodes();
    const activeId = getActiveAttachmentNodeId();

    nodes.forEach(node => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `rocket-node-item${node.id === activeId ? " active" : ""}`;
        item.innerHTML = `<span class="node-dot" data-type="${escapeAttr(node.type)}"></span><span class="node-name">${escapeHtml(node.name)}</span><small>${escapeHtml(node.type)}</small>`;
        item.addEventListener("click", () => selectAttachmentNode(node.id));
        list.appendChild(item);
    });

    if (!nodes.length) {
        list.innerHTML = `<div class="rocket-node-empty">No nodes. Add Top, Bottom, Engine, Docking or custom attachment points.</div>`;
        editor.innerHTML = `<div class="rocket-node-hint">Nodes are editor-only helpers and will be excluded from the final visual model.</div>`;
    } else if (activeId) {
        const node = nodes.find(item => item.id === activeId);
        if (node) buildEditor(editor, node);
    } else {
        editor.innerHTML = `<div class="rocket-node-hint">Select a node in the list or click a node helper in the viewport.</div>`;
    }

    host.querySelector("[data-node-add]")?.addEventListener("click", () => {
        const next = addAttachmentNode({
            name: `Node ${nodes.length + 1}`,
            type: "structural",
            position: [0, 0, 0],
            direction: [0, 1, 0]
        });
        if (next) setTimeout(() => selectAttachmentNode(next.id), 0);
    });
}

function buildEditor(editor, node) {
    editor.innerHTML = `
        <div class="rocket-node-editor-title"><span class="node-editor-dot" data-type="${escapeAttr(node.type)}"></span><strong>${escapeHtml(node.name)}</strong><button type="button" data-delete>Delete</button></div>
        <label class="node-field"><span>Name</span><input data-name type="text" value="${escapeAttr(node.name)}"></label>
        <label class="node-field"><span>Type</span><select data-type></select></label>
        <div class="node-field-label">Position</div><div class="node-vector" data-position></div>
        <div class="node-field-label">Rotation (deg)</div><div class="node-vector" data-rotation></div>
        <div class="node-field-label">Direction</div><div class="node-vector" data-direction></div>
        <div class="node-field-label">Compatible Parts</div><div class="node-categories" data-categories></div>
        <button type="button" class="node-apply" data-save>Save Node</button>
    `;

    const typeSelect = editor.querySelector("[data-type]");
    NODE_TYPES.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        option.selected = node.type === type;
        typeSelect.appendChild(option);
    });

    const fields = {
        position: addVectorInputs(editor.querySelector("[data-position]"), node.position, false),
        rotation: addVectorInputs(editor.querySelector("[data-rotation]"), node.rotation, true),
        direction: addVectorInputs(editor.querySelector("[data-direction]"), node.direction, false)
    };

    const categories = editor.querySelector("[data-categories]");
    PART_CATEGORIES.forEach(category => {
        const label = document.createElement("label");
        label.className = "node-check";
        label.innerHTML = `<input type="checkbox" value="${escapeAttr(category)}"><span>${escapeHtml(category)}</span>`;
        label.querySelector("input").checked = node.compatibleCategories.includes(category);
        categories.appendChild(label);
    });

    editor.querySelector("[data-save]").addEventListener("click", () => {
        const vector = key => fields[key].map(input => Number(input.value) || 0);
        const direction = normalize(vector("direction"));
        const selectedCategories = [...categories.querySelectorAll("input:checked")].map(input => input.value);
        updateAttachmentNode(node.id, {
            name: editor.querySelector("[data-name]").value.trim() || node.name,
            type: typeSelect.value,
            position: vector("position"),
            rotation: vector("rotation"),
            direction,
            compatibleCategories: selectedCategories
        });
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Node ${node.name} updated` }));
    });

    editor.querySelector("[data-delete]").addEventListener("click", () => {
        removeAttachmentNode(node.id);
        clearAttachmentNodeSelection();
    });
}

function addVectorInputs(parent, vector, rotation) {
    const inputs = ["X", "Y", "Z"].map((axis, index) => {
        const input = document.createElement("input");
        input.type = "number";
        input.step = rotation ? "1" : "0.01";
        input.value = Number(vector[index] || 0).toFixed(rotation ? 1 : 2);
        input.title = axis;
        parent.appendChild(input);
        return input;
    });
    return inputs;
}

function normalize(vector) {
    const [x, y, z] = vector;
    const length = Math.hypot(x, y, z);
    return length > 1e-8 ? [x / length, y / length, z / length] : [0, 1, 0];
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
function escapeAttr(value) { return escapeHtml(value); }

function installStyles() {
    if (document.getElementById("rocketNodeEditorStyles")) return;
    const style = document.createElement("style");
    style.id = "rocketNodeEditorStyles";
    style.textContent = `
        .rocket-node-editor-section{margin:10px;border:1px solid #30333a;border-radius:6px;background:#15171b;overflow:hidden}
        .rocket-node-editor-head{display:flex;align-items:center;justify-content:space-between;padding:9px;border-bottom:1px solid #282b31}.rocket-node-editor-head strong{display:block;margin-top:2px;color:#e7e9ed;font-size:12px}.rocket-node-editor-head button,.rocket-node-editor-title button{border:1px solid #343842;border-radius:4px;background:#202329;color:#bfc4cd;padding:6px 8px;font:600 9px system-ui;cursor:pointer}.rocket-node-editor-head button:hover,.rocket-node-editor-title button:hover{background:#2a2d34;color:#fff}
        .rocket-node-list{display:grid;gap:4px;padding:7px}.rocket-node-item{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:7px;width:100%;padding:7px;border:1px solid #292c32;border-radius:4px;background:#17191e;color:#c9cdd5;text-align:left;cursor:pointer}.rocket-node-item:hover{background:#20232a}.rocket-node-item.active{border-color:#5a6270;background:#20242b}.node-dot,.node-editor-dot{width:8px;height:8px;border-radius:50%;background:#c4cad4}.node-dot[data-type="structural"],.node-editor-dot[data-type="structural"]{background:#67d4ff}.node-dot[data-type="fuel"],.node-editor-dot[data-type="fuel"]{background:#6ee7a8}.node-dot[data-type="engine"],.node-editor-dot[data-type="engine"]{background:#ff8a65}.node-dot[data-type="dock"],.node-editor-dot[data-type="dock"]{background:#c9a7ff}.node-dot[data-type="utility"],.node-editor-dot[data-type="utility"]{background:#f5d06f}.node-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.rocket-node-item small{color:#727782;font-size:8px}.rocket-node-empty,.rocket-node-hint{margin:0 7px 7px;padding:8px;border:1px dashed #343842;border-radius:4px;color:#757b86;font:9px/1.45 system-ui}.rocket-node-editor{padding:8px;border-top:1px solid #292c31}.rocket-node-editor-title{display:flex;align-items:center;gap:6px;margin-bottom:8px}.rocket-node-editor-title strong{flex:1;color:#e7e9ed;font-size:10px}.node-field{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:6px;margin-bottom:6px;color:#7f8590;font-size:9px}.node-field input,.node-field select,.node-vector input{width:100%;box-sizing:border-box;border:1px solid #343741;border-radius:4px;background:#101216;color:#d7dae0;padding:6px;font:10px system-ui;outline:none}.node-field input:focus,.node-field select:focus,.node-vector input:focus{border-color:#596273}.node-field-label{margin:8px 0 4px;color:#777d87;font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.node-vector{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}.node-categories{display:grid;grid-template-columns:1fr 1fr;gap:4px}.node-check{display:flex;align-items:center;gap:5px;padding:4px;border:1px solid #2d3037;border-radius:4px;background:#17191e;color:#9ea4ad;font-size:8px}.node-check input{accent-color:#8995aa}.node-apply{width:100%;margin-top:8px;border:1px solid #3a3e48;border-radius:4px;background:#262a31;color:#d2d6de;padding:7px;font:600 10px system-ui;cursor:pointer}.node-apply:hover{background:#31353e;color:#fff}
    `;
    document.head.appendChild(style);
}
