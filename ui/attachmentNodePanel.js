import { NODE_TYPES } from "../rocket/categories.js";
import {
    getAttachmentNodes,
    getActiveAttachmentNodeId,
    selectAttachmentNode,
    clearAttachmentNodeSelection,
    addAttachmentNode,
    removeAttachmentNode,
    isNodeEditMode,
    toggleNodeEditMode,
    updateAttachmentNode
} from "../rocket/attachmentNodes.js";

let installed = false;
let host = null;
let contextEditor = null;
let contextNodeId = null;

export function initAttachmentNodePanel() {
    if (installed) return;
    installed = true;
    window.addEventListener("editor:rocket-part-mode", event => { if (event.detail) render(); });
    window.addEventListener("editor:rocket-node-change", event => {
        if (event.detail?.transforming) {
            updateActiveNodePosition(event.detail.node);
            updateContextEditor(event.detail.node);
        } else {
            render();
        }
    });
    window.addEventListener("editor:attachment-node-selected", updateSelectionOnly);
    window.addEventListener("editor:attachment-node-mode", render);
    document.addEventListener("pointerdown", closeContextEditorOnOutside, true);
    window.addEventListener("resize", closeContextEditor, { passive: true });
    render();
}

function render() {
    const body = document.getElementById("rocketPartBody");
    if (!body || body.closest("[hidden]")) return;
    closeContextEditor();
    host?.remove();
    host = document.createElement("section");
    host.className = "rocket-node-foundation";
    const edit = isNodeEditMode();
    host.innerHTML = `
        <div class="rocket-node-foundation-head">
            <div><span class="eyebrow">Connectivity</span><strong>Attachment Nodes</strong><small>${edit ? "Node Edit Mode · click node spheres" : "Normal Mode · node points are inactive"}</small></div>
            <div class="rocket-node-actions"><button type="button" data-mode class="node-mode-btn${edit ? " active" : ""}">${edit ? "Exit Node Mode" : "Node Mode"}</button><button type="button" data-add>+ Add Node</button></div>
        </div>
        <div class="rocket-node-origin">Reference: Main Graph origin <strong>(0, 0, 0)</strong></div>
        <div class="rocket-node-foundation-list" data-list></div>
        <div class="rocket-node-foundation-empty" data-empty></div>
    `;
    body.appendChild(host);
    installStyles();

    const list = host.querySelector("[data-list]");
    const empty = host.querySelector("[data-empty]");
    const nodes = getAttachmentNodes();
    const activeId = getActiveAttachmentNodeId();
    nodes.forEach(node => appendNodeItem(list, node, activeId));

    empty.innerHTML = nodes.length
        ? `<span>${edit ? "Node Mode is active. Click a sphere to select it, then use Move/Rotate or right-click a node in this list for exact XYZ values." : "Turn on Node Mode to select and edit node spheres."}</span>`
        : `<span>No attachment nodes yet. Click <strong>+ Add Node</strong> to create the first one.</span>`;

    host.querySelector("[data-add]").addEventListener("click", () => addAttachmentNode());
    host.querySelector("[data-mode]").addEventListener("click", () => toggleNodeEditMode());
}

function appendNodeItem(list, node, activeId) {
    const item = document.createElement("div");
    item.className = `rocket-node-foundation-item${node.id === activeId ? " active" : ""}`;
    item.dataset.nodeId = node.id;
    const position = Array.isArray(node.position) ? node.position : [0, 0, 0];
    const type = NODE_TYPES.includes(node.type) ? node.type : "custom";
    item.innerHTML = `
        <button type="button" class="rocket-node-select" data-select>
            <span class="node-dot"></span>
            <span class="node-copy"><strong>${escapeHtml(node.name || node.id)}</strong><small>${escapeHtml(type)}</small></span>
        </button>
        <span class="rocket-node-position" data-position>(${fmt(position[0])}, ${fmt(position[1])}, ${fmt(position[2])})</span>
        <button type="button" class="rocket-node-delete" data-delete aria-label="Delete node">×</button>
    `;
    item.querySelector("[data-select]").addEventListener("click", () => selectAttachmentNode(node.id));
    item.querySelector("[data-select]").addEventListener("contextmenu", event => openContextEditor(event, node.id));
    item.addEventListener("contextmenu", event => openContextEditor(event, node.id));
    item.querySelector("[data-delete]").addEventListener("click", event => {
        event.stopPropagation();
        removeAttachmentNode(node.id);
        clearAttachmentNodeSelection();
        closeContextEditor();
    });
    list.appendChild(item);
}

function openContextEditor(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();
    const node = getAttachmentNodes().find(item => item.id === nodeId);
    if (!node) return;

    selectAttachmentNode(nodeId);
    closeContextEditor();
    contextNodeId = nodeId;

    const editor = document.createElement("div");
    editor.className = "rocket-node-context-editor";
    editor.innerHTML = `
        <div class="rocket-node-context-head">
            <div><strong>${escapeHtml(node.name || "Node")}</strong><span>Global Transform · Main Graph Origin</span></div>
            <button type="button" data-close aria-label="Close">×</button>
        </div>
        <div class="rocket-node-context-section">
            <div class="rocket-node-context-label">POSITION</div>
            <div class="rocket-node-context-grid" data-position-grid></div>
        </div>
        <div class="rocket-node-context-section">
            <div class="rocket-node-context-label">ROTATION (DEG)</div>
            <div class="rocket-node-context-grid" data-rotation-grid></div>
        </div>
        <div class="rocket-node-context-actions">
            <button type="button" data-apply>Apply</button>
            <button type="button" data-reset>Reset</button>
        </div>
    `;

    const positionGrid = editor.querySelector("[data-position-grid]");
    const rotationGrid = editor.querySelector("[data-rotation-grid]");
    const positionInputs = createVectorInputs(positionGrid, node.position || [0, 0, 0], "P");
    const rotationInputs = createVectorInputs(rotationGrid, node.rotation || [0, 0, 0], "R");

    editor.querySelector("[data-close]").addEventListener("click", closeContextEditor);
    editor.querySelector("[data-apply]").addEventListener("click", () => {
        updateAttachmentNode(contextNodeId, {
            position: readVectorInputs(positionInputs),
            rotation: readVectorInputs(rotationInputs)
        });
        syncContextEditorFromNode();
    });
    editor.querySelector("[data-reset]").addEventListener("click", () => {
        updateAttachmentNode(contextNodeId, { position: [0, 0, 0], rotation: [0, 0, 0] });
        syncContextEditorFromNode();
    });

    document.body.appendChild(editor);
    contextEditor = editor;
    positionEditor(event, editor);
}

function createVectorInputs(parent, values, prefix) {
    const result = [];
    ["X", "Y", "Z"].forEach((axis, index) => {
        const wrap = document.createElement("label");
        wrap.className = "rocket-node-vector-field";
        wrap.innerHTML = `<span>${axis}</span><input type="number" step="0.01">`;
        const input = wrap.querySelector("input");
        input.value = Number(values?.[index] ?? 0).toFixed(2);
        input.dataset.axis = `${prefix}${axis}`;
        parent.appendChild(wrap);
        result.push(input);
    });
    return result;
}

function readVectorInputs(inputs) {
    return inputs.map(input => {
        const number = Number(input.value);
        return Number.isFinite(number) ? number : 0;
    });
}

function updateContextEditor(node) {
    if (!contextEditor || !node || node.id !== contextNodeId) return;
    const inputs = contextEditor.querySelectorAll("input");
    const p = node.position || [0, 0, 0];
    const r = node.rotation || [0, 0, 0];
    [p[0], p[1], p[2], r[0], r[1], r[2]].forEach((value, index) => {
        if (inputs[index]) inputs[index].value = Number(value).toFixed(2);
    });
}

function syncContextEditorFromNode() {
    if (!contextNodeId) return;
    const node = getAttachmentNodes().find(item => item.id === contextNodeId);
    updateContextEditor(node);
}

function positionEditor(event, editor) {
    const margin = 10;
    const rect = editor.getBoundingClientRect();
    let left = event.clientX + 6;
    let top = event.clientY + 6;
    if (left + rect.width > window.innerWidth - margin) left = window.innerWidth - rect.width - margin;
    if (top + rect.height > window.innerHeight - margin) top = window.innerHeight - rect.height - margin;
    editor.style.left = `${Math.max(margin, left)}px`;
    editor.style.top = `${Math.max(margin, top)}px`;
}

function closeContextEditorOnOutside(event) {
    if (!contextEditor) return;
    if (contextEditor.contains(event.target)) return;
    if (event.target.closest?.(".rocket-node-foundation-item")) return;
    closeContextEditor();
}

function closeContextEditor() {
    contextEditor?.remove();
    contextEditor = null;
    contextNodeId = null;
}

function updateSelectionOnly() {
    if (!host) return;
    const activeId = getActiveAttachmentNodeId();
    host.querySelectorAll(".rocket-node-foundation-item").forEach(item => item.classList.toggle("active", item.dataset.nodeId === activeId));
    if (activeId) {
        const node = getAttachmentNodes().find(item => item.id === activeId);
        updateContextEditor(node);
    }
}

function updateActiveNodePosition(node) {
    if (!host || !node) return;
    const item = host.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`);
    if (!item) return;
    const p = node.position || [0, 0, 0];
    item.querySelector("[data-position]").textContent = `(${fmt(p[0])}, ${fmt(p[1])}, ${fmt(p[2])})`;
    item.classList.add("active");
}

function fmt(value) { return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00"; }
function escapeHtml(value) { return String(value).replace(/[&<>\"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char])); }

function installStyles() {
    if (document.getElementById("rocketNodeFoundationStyles")) return;
    const style = document.createElement("style");
    style.id = "rocketNodeFoundationStyles";
    style.textContent = `
        .rocket-node-foundation{margin:10px;border:1px solid #2f333a;border-radius:7px;background:#15171b;overflow:hidden}
        .rocket-node-foundation-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border-bottom:1px solid #292c32}
        .rocket-node-foundation-head strong{display:block;color:#e7e9ed;font-size:12px;margin-top:2px}.rocket-node-foundation-head small{display:block;color:#6f7681;font-size:8px;margin-top:3px}
        .rocket-node-actions{display:flex;gap:5px;align-items:center}.rocket-node-foundation-head button{border:1px solid #373b45;border-radius:4px;background:#202329;color:#c6cbd3;padding:7px 9px;font:600 9px system-ui;cursor:pointer}.rocket-node-foundation-head button:hover{background:#2a2e35;color:#fff}.rocket-node-foundation-head .node-mode-btn.active{border-color:#74601f;background:#2c2611;color:#ffd978}
        .rocket-node-origin{padding:7px 10px;border-bottom:1px solid #262930;color:#777f8b;font-size:8px}.rocket-node-origin strong{color:#aeb5c0;font-family:ui-monospace,SFMono-Regular,monospace;font-weight:500}
        .rocket-node-foundation-list{display:grid;gap:4px;padding:7px}
        .rocket-node-foundation-item{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:7px;border:1px solid #2c3037;border-radius:5px;background:#181a1f}.rocket-node-foundation-item.active{border-color:#596273;background:#20242b}
        .rocket-node-select{min-width:0;display:flex;align-items:center;gap:7px;border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer}.node-dot{width:8px;height:8px;border-radius:50%;background:#67d4ff;flex:0 0 auto}.node-copy{min-width:0;display:grid;gap:2px}.node-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d7dbe2;font-size:10px}.node-copy small{color:#727984;font-size:8px}
        .rocket-node-position{color:#7c8490;font:8px ui-monospace,SFMono-Regular,monospace;white-space:nowrap}.rocket-node-delete{width:24px;height:24px;border:1px solid #343842;border-radius:4px;background:#1d2025;color:#9ba2ad;cursor:pointer;font-size:14px;line-height:1}.rocket-node-delete:hover{background:#33252a;color:#ffb4b4;border-color:#6a4047}
        .rocket-node-foundation-empty{padding:0 10px 9px;color:#6e7580;font-size:8px;line-height:1.4}.rocket-node-foundation-empty strong{color:#a9afb9}
        .rocket-node-context-editor{position:fixed;z-index:2500;width:270px;padding:11px;border:1px solid #3a3f49;border-radius:8px;background:#17191e;color:#e7e9ed;box-shadow:0 18px 50px rgba(0,0,0,.55)}
        .rocket-node-context-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:9px;border-bottom:1px solid #292d34}.rocket-node-context-head strong{display:block;font-size:11px}.rocket-node-context-head span{display:block;margin-top:2px;color:#737a85;font-size:8px}
        .rocket-node-context-head button{width:24px;height:24px;border:1px solid #343943;border-radius:4px;background:#20232a;color:#aeb4bd;cursor:pointer}.rocket-node-context-section{padding-top:10px}.rocket-node-context-label{margin-bottom:6px;color:#777f8c;font-size:8px;font-weight:700;letter-spacing:.8px}.rocket-node-context-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}.rocket-node-vector-field span{display:block;margin-bottom:3px;color:#8e949f;font-size:8px}.rocket-node-vector-field input{width:100%;height:31px;padding:0 7px;border:1px solid #343943;border-radius:4px;background:#0f1115;color:#e7e9ed;font:11px ui-monospace,SFMono-Regular,monospace;box-sizing:border-box}.rocket-node-vector-field input:focus{outline:0;border-color:#6a7180;box-shadow:0 0 0 2px rgba(106,113,128,.12)}
        .rocket-node-context-actions{display:flex;justify-content:flex-end;gap:5px;margin-top:12px;padding-top:9px;border-top:1px solid #292d34}.rocket-node-context-actions button{height:30px;padding:0 10px;border:1px solid #383d47;border-radius:4px;background:#20232a;color:#cbd0d8;font-size:9px;font-weight:600;cursor:pointer}.rocket-node-context-actions button:hover{background:#2a2e35;color:#fff}.rocket-node-context-actions button[data-apply]{background:#303640;color:#fff}
    `;
    document.head.appendChild(style);
}
