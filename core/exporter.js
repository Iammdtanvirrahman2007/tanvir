import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { saveScene, getProjectName } from "./save.js";

const exporter = new GLTFExporter();

export function exportScene(scene, options = {}) {
    const source = new THREE.Group();
    source.name = "ModelForgeScene";
    scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly).forEach(object => source.add(object.clone(true)));
    return new Promise((resolve, reject) => exporter.parse(source, result => resolve(result), error => reject(error), { binary: options.binary ?? false, onlyVisible: false }));
}

export function setupExporter(scene) {
    const exportBtn = document.getElementById("exportBtn");
    if (!exportBtn) return;
    exportBtn.onclick = () => chooseExportFormat(scene);
}

export function chooseExportFormat(scene) {
    const panel = document.createElement("div");
    panel.className = "save-format-dialog";
    panel.innerHTML = `<div class="save-format-card"><h3>Export</h3><label class="save-field-label" for="exportFilename">File name</label><input id="exportFilename" autocomplete="off" spellcheck="false" value="${escapeHtml(getProjectName())}"><label class="save-field-label" for="exportFormatSelect">Format</label><select id="exportFormatSelect"><option value="obj">Wavefront OBJ (.obj)</option><option value="gltf">glTF (.gltf)</option><option value="glb">glTF Binary (.glb)</option><option value="json">JSON Scene (.json)</option><option value="rkp">ModelForge Project (.rkp)</option></select><div class="save-format-actions"><button data-cancel>Cancel</button><button class="primary" data-export>Export</button></div></div>`;
    document.body.appendChild(panel);
    const input = panel.querySelector("#exportFilename");
    const finish = () => panel.remove();
    const submit = () => {
        const format = panel.querySelector("#exportFormatSelect").value;
        const name = sanitize(input.value) || "modelforge-export";
        saveScene(scene, { format, filename: `${name}.${format}` });
        finish();
    };
    panel.addEventListener("click", event => { if (event.target.closest("[data-cancel]")) finish(); else if (event.target.closest("[data-export]")) submit(); });
    input.addEventListener("keydown", event => { if (event.key === "Enter") submit(); if (event.key === "Escape") finish(); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
    return panel;
}

export async function downloadGLTF(scene) {
    const result = await exportScene(scene);
    const output = JSON.stringify(result, null, 2);
    const blob = new Blob([output], { type: "model/gltf+json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${sanitize(getProjectName()) || "modelforge-scene"}.gltf`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.dispatchEvent(new CustomEvent("editor:status", { detail: "GLTF exported" }));
}

function sanitize(value) { return String(value || "").trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120).trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
