import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { saveScene, getProjectName } from "./save.js";

const exporter = new GLTFExporter();

export function exportScene(scene, options = {}) {
    const source = new THREE.Group();
    source.name = "ModelForgeScene";

    scene.children
        .filter(object => object.userData?.editorObject && !object.userData?.editorOnly)
        .forEach(object => {
            const clone = object.clone(true);
            stripEditorAttachmentNodes(clone);
            source.add(clone);
        });

    return new Promise((resolve, reject) => exporter.parse(
        source,
        result => resolve(result),
        error => reject(error),
        { binary: options.binary ?? false, onlyVisible: false }
    ));
}

function stripEditorAttachmentNodes(root) {
    const remove = [];
    root.traverse(object => {
        if (object.userData?.attachmentNode || object.userData?.attachmentNodeExcludeFromExport) remove.push(object);
    });
    remove.forEach(object => object.parent?.remove(object));
}

export function setupExporter(scene) {
    const exportBtn = document.getElementById("exportBtn");
    if (!exportBtn) return;
    exportBtn.onclick = () => chooseExportFormat(scene);
}

export function chooseExportFormat(scene) {
    ensureDialogStyles();
    const panel = document.createElement("div");
    panel.className = "save-format-dialog export-dialog";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML = `<div class="save-format-card"><div class="dialog-kicker">EXPORT</div><h3>Export Scene</h3><p class="dialog-description">Choose a filename and interchange format.</p><label class="save-field-label" for="exportFilename">File name</label><input id="exportFilename" autocomplete="off" spellcheck="false" value="${escapeHtml(getProjectName())}"><label class="save-field-label" for="exportFormatSelect">Format</label><select id="exportFormatSelect"><option value="obj">Wavefront OBJ (.obj)</option><option value="gltf">glTF (.gltf)</option><option value="glb">glTF Binary (.glb)</option><option value="json">JSON Scene (.json)</option><option value="rkp">ModelForge Project (.rkp)</option></select><div class="save-format-actions"><button data-cancel>Cancel</button><button class="primary" data-export>Export</button></div></div>`;
    document.body.appendChild(panel);
    const input = panel.querySelector("#exportFilename");
    const format = panel.querySelector("#exportFormatSelect");
    const finish = () => panel.remove();
    const submit = () => {
        const selectedFormat = format.value;
        const name = sanitize(input.value) || "modelforge-export";
        saveScene(scene, { format: selectedFormat, filename: `${name}.${selectedFormat}` });
        finish();
    };
    panel.addEventListener("click", event => {
        if (event.target === panel || event.target.closest("[data-cancel]")) finish();
        else if (event.target.closest("[data-export]")) submit();
    });
    input.addEventListener("keydown", event => { if (event.key === "Enter") submit(); if (event.key === "Escape") finish(); });
    format.addEventListener("keydown", event => { if (event.key === "Escape") finish(); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
    return panel;
}

export async function downloadGLTF(scene) {
    const result = await exportScene(scene);
    const output = JSON.stringify(result, null, 2);
    const blob = new Blob([output], { type: "model/gltf+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitize(getProjectName()) || "modelforge-scene"}.gltf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.dispatchEvent(new CustomEvent("editor:status", { detail: "GLTF exported" }));
}

function ensureDialogStyles() {
    if (document.getElementById("modelforge-dialog-styles")) return;
    const style = document.createElement("style");
    style.id = "modelforge-dialog-styles";
    style.textContent = `
        .save-format-dialog{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(5,6,9,.68);backdrop-filter:blur(8px);animation:mfDialogIn .14s ease-out}
        .save-format-card{width:min(430px,calc(100vw - 32px));padding:20px;border:1px solid #363a44;border-radius:10px;background:#191b20;box-shadow:0 24px 70px rgba(0,0,0,.55);color:#e7e8eb}
        .dialog-kicker{margin-bottom:6px;color:#747985;font-size:9px;font-weight:700;letter-spacing:1.4px}
        .save-format-card h3{margin:0;font-size:16px;font-weight:650;letter-spacing:-.1px}
        .dialog-description{margin:6px 0 18px;color:#777c87;font-size:11px;line-height:1.45}
        .save-field-label{display:block;margin:12px 0 6px;color:#8f949f;font-size:10px;font-weight:600}
        .save-format-card input,.save-format-card select{width:100%;height:36px;padding:0 10px;border:1px solid #343841;border-radius:5px;outline:0;background:#111318;color:#e2e4e8;font-size:12px}
        .save-format-card input:focus,.save-format-card select:focus{border-color:#646a77;box-shadow:0 0 0 2px rgba(100,106,119,.12)}
        .save-format-card select{cursor:pointer}
        .save-format-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:20px;padding-top:14px;border-top:1px solid #292c34}
        .save-format-actions button{min-width:76px;height:34px;padding:0 12px;border:1px solid #343841;border-radius:5px;background:#202229;color:#bfc2ca;cursor:pointer}
        .save-format-actions button:hover{background:#292c34;color:#fff}
        .save-format-actions button.primary{border-color:#4b505c;background:#3a3d45;color:#fff}
        .save-format-actions button.primary:hover{background:#474b55}
        @keyframes mfDialogIn{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
        @media(max-width:760px){.save-format-dialog{padding:12px;place-items:end center}.save-format-card{width:100%;border-radius:12px;padding:17px;box-shadow:0 -18px 55px rgba(0,0,0,.5)}.save-format-actions button{height:40px;min-width:90px}}
    `;
    document.head.appendChild(style);
}

function sanitize(value) { return String(value || "").trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120).trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }