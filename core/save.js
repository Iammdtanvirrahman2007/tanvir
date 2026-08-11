import * as THREE from "three";

const FORMATS = {
    rkp: { label: "ModelForge Project", ext: "rkp", mime: "application/json" },
    json: { label: "JSON Scene", ext: "json", mime: "application/json" },
    obj: { label: "Wavefront OBJ", ext: "obj", mime: "text/plain" },
    gltf: { label: "glTF", ext: "gltf", mime: "model/gltf+json" },
    glb: { label: "glTF Binary", ext: "glb", mime: "model/gltf-binary" }
};

const PROJECT_NAME_KEY = "modelforge:project-name";
const SAVE_DIALOG_ID = "modelForgeSaveDialog";
const SAVE_STYLE_ID = "modelForgeSaveDialogStyles";

export function serializeScene(scene) {
    const roots = scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly);
    return { format: "ModelForgeProject", fileExtension: ".rkp", version: 5, app: "ModelForge", projectName: getProjectName(), created: new Date().toISOString(), objects: roots.map(serializeObject) };
}

export function saveScene(scene, options = {}) {
    const format = options.format || "rkp";
    if (!FORMATS[format]) return false;
    if (format === "obj") return exportOBJ(scene, options.filename);
    if (format === "gltf" || format === "glb") return exportGLTF(scene, format, options.filename);
    const data = serializeScene(scene);
    const ext = FORMATS[format].ext;
    return downloadBlob(JSON.stringify(data, null, 2), options.filename || `${sanitizeName(getProjectName())}.${ext}`, FORMATS[format].mime);
}

export function chooseSaveFormat(scene) {
    const existing = document.getElementById(SAVE_DIALOG_ID);
    if (existing) {
        const input = existing.querySelector("#saveFilename");
        input?.focus(); input?.select(); return existing;
    }
    installSaveDialogStyles();
    const panel = document.createElement("div");
    panel.id = SAVE_DIALOG_ID;
    panel.className = "save-format-dialog";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "saveDialogTitle");
    const currentName = getProjectName();
    panel.innerHTML = `<div class="save-format-card"><div class="save-dialog-kicker">PROJECT</div><h3 id="saveDialogTitle">Save Project</h3><p class="save-dialog-description">Choose a filename and format for your project.</p><label class="save-field-label" for="saveFilename">File name</label><input id="saveFilename" autocomplete="off" spellcheck="false" placeholder="My Rocket Model" value="${escapeHtml(currentName)}"><label class="save-field-label" for="saveFormatSelect">Format</label><select id="saveFormatSelect"><option value="rkp">ModelForge Project (.rkp)</option><option value="json">JSON Scene (.json)</option><option value="obj">Wavefront OBJ (.obj)</option><option value="gltf">glTF (.gltf)</option><option value="glb">glTF Binary (.glb)</option></select><div class="save-format-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save</button></div></div>`;
    document.body.appendChild(panel);
    const input = panel.querySelector("#saveFilename");
    const formatSelect = panel.querySelector("#saveFormatSelect");
    let closed = false;
    const finish = () => { if (closed) return; closed = true; panel.remove(); window.removeEventListener("keydown", onGlobalKeydown, true); };
    const submit = () => { if (closed) return; const format = formatSelect.value; const name = sanitizeName(input.value) || "modelforge-project"; setProjectName(name); saveScene(scene, { format, filename: `${name}.${FORMATS[format].ext}` }); finish(); };
    const onGlobalKeydown = event => { if (!document.getElementById(SAVE_DIALOG_ID)) return; if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(); } else if (event.key === "Enter" && document.activeElement !== formatSelect) { event.preventDefault(); event.stopPropagation(); submit(); } };
    panel.addEventListener("click", event => { if (event.target === panel) return finish(); if (event.target.closest("[data-cancel]")) return finish(); if (event.target.closest("[data-save]")) return submit(); });
    input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); submit(); } else if (event.key === "Escape") { event.preventDefault(); finish(); } });
    window.addEventListener("keydown", onGlobalKeydown, true);
    requestAnimationFrame(() => { input.focus(); input.select(); });
    return panel;
}

function installSaveDialogStyles() {
    if (document.getElementById(SAVE_STYLE_ID)) return;
    const style = document.createElement("style"); style.id = SAVE_STYLE_ID;
    style.textContent = `#${SAVE_DIALOG_ID}.save-format-dialog{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(5,6,9,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}#${SAVE_DIALOG_ID} .save-format-card{width:min(430px,calc(100vw - 32px));box-sizing:border-box;padding:22px;border:1px solid #363a43;border-radius:10px;background:#181a1f;color:#e7e9ee;box-shadow:0 28px 90px rgba(0,0,0,.65)}#${SAVE_DIALOG_ID} .save-dialog-kicker{font:600 9px/1 system-ui,sans-serif;letter-spacing:.18em;color:#777e8b;margin-bottom:8px}#${SAVE_DIALOG_ID} h3{margin:0;font:600 19px/1.25 system-ui,sans-serif;color:#f1f3f6}#${SAVE_DIALOG_ID} .save-dialog-description{margin:7px 0 20px;color:#858c98;font:12px/1.5 system-ui,sans-serif}#${SAVE_DIALOG_ID} .save-field-label{display:block;margin:13px 0 6px;color:#aeb4bf;font:500 10px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em}#${SAVE_DIALOG_ID} input,#${SAVE_DIALOG_ID} select{width:100%;height:38px;box-sizing:border-box;border:1px solid #363a43;border-radius:5px;outline:0;background:#111318;color:#e6e8ed;padding:0 10px;font:13px system-ui,sans-serif}#${SAVE_DIALOG_ID} input:focus,#${SAVE_DIALOG_ID} select:focus{border-color:#777f8d;box-shadow:0 0 0 2px rgba(130,140,155,.12)}#${SAVE_DIALOG_ID} .save-format-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}#${SAVE_DIALOG_ID} .save-format-actions button{height:34px;padding:0 13px;border:1px solid #353943;border-radius:5px;background:#202329;color:#c6cad2;font:500 11px system-ui,sans-serif;cursor:pointer}#${SAVE_DIALOG_ID} .save-format-actions button:hover{background:#292d34;color:#fff}#${SAVE_DIALOG_ID} .save-format-actions .primary{background:#e6e8ec;color:#111318;border-color:#e6e8ec}@media(max-width:600px){#${SAVE_DIALOG_ID}.save-format-dialog{align-items:end;padding:0}#${SAVE_DIALOG_ID} .save-format-card{width:100%;border-radius:14px 14px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));border-bottom:0}}`;
    document.head.appendChild(style);
}

export function saveRKP(scene, filename) { const name = sanitizeName(filename || getProjectName() || "modelforge-project").replace(/\.rkp$/i, ""); setProjectName(name); return saveScene(scene, { format: "rkp", filename: `${name}.rkp` }); }
export function getProjectName() { try { return localStorage.getItem(PROJECT_NAME_KEY) || "modelforge-project"; } catch { return "modelforge-project"; } }
export function setProjectName(name) { const clean = sanitizeName(name) || "modelforge-project"; try { localStorage.setItem(PROJECT_NAME_KEY, clean); } catch {} window.dispatchEvent(new CustomEvent("editor:project-name-change", { detail: clean })); return clean; }
export function getSupportedSaveFormats() { return Object.values(FORMATS).map(item => ({ ...item })); }
function sanitizeName(value) { return String(value || "").trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120).trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function downloadBlob(content, filename, mime) { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true; }

function exportOBJ(scene, filename = `${sanitizeName(getProjectName()) || "modelforge-model"}.obj`) {
    const vertices = [], faces = []; scene.updateMatrixWorld(true);
    scene.traverse(object => { if (!object.isMesh || !object.userData?.editorObject || object.userData?.editorOnly) return; const position = object.geometry?.attributes?.position; if (!position) return; const offset = vertices.length / 3; const vector = new THREE.Vector3(); for (let i = 0; i < position.count; i++) { vector.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld); vertices.push(vector.x, vector.y, vector.z); } const index = object.geometry.index; if (index) for (let i = 0; i < index.count; i += 3) faces.push(`f ${index.getX(i)+1+offset} ${index.getX(i+1)+1+offset} ${index.getX(i+2)+1+offset}`); else for (let i = 0; i < position.count; i += 3) faces.push(`f ${i+1+offset} ${i+2+offset} ${i+3+offset}`); });
    const lines = ["# ModelForge", ...Array.from({ length: vertices.length / 3 }, (_, i) => `v ${vertices[i*3]} ${vertices[i*3+1]} ${vertices[i*3+2]}`), ...faces]; return downloadBlob(`${lines.join("\n")}\n`, filename, "text/plain");
}

async function exportGLTF(scene, format, filename) {
    try { const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js"); const exporter = new GLTFExporter(); exporter.parse(scene, result => { const binary = format === "glb"; const data = binary ? result : JSON.stringify(result, null, 2); downloadBlob(data, filename || `${sanitizeName(getProjectName()) || "modelforge-model"}.${format}`, binary ? "model/gltf-binary" : "model/gltf+json"); }, error => console.error("glTF export failed", error), { binary: format === "glb" }); return true; } catch (error) { console.error("glTF exporter unavailable", error); return false; }
}

function serializeObject(object) {
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]).map(serializeMaterial) : [];
    return { kind: object.isGroup ? "Group" : "Mesh", type: object.geometry?.type || object.type, name: object.name || object.type, visible: object.visible, position: object.position.toArray(), rotation: [object.rotation.x, object.rotation.y, object.rotation.z], scale: object.scale.toArray(), materials, userData: { partType: object.userData?.partType || "", category: object.userData?.category || "", manufacturer: object.userData?.manufacturer || "", mass: object.userData?.mass ?? 1, description: object.userData?.description || "", version: object.userData?.version || "1.0", materialName: object.userData?.materialName || "" }, children: object.children.filter(child => child.userData?.editorObject && !child.userData?.editorOnly).map(serializeObject) };
}

function serializeMaterial(material) {
    return {
        name: material.name || "",
        color: material.color?.getHex() ?? 0xffffff,
        metalness: material.metalness ?? 0,
        roughness: material.roughness ?? 1,
        opacity: material.opacity ?? 1,
        transparent: !!material.transparent,
        depthWrite: material.depthWrite ?? ((material.opacity ?? 1) >= 1),
        wireframe: !!material.wireframe,
        flatShading: !!material.flatShading,
        side: material.side ?? THREE.FrontSide,
        emissive: material.emissive?.getHex() ?? 0,
        emissiveIntensity: material.emissiveIntensity ?? 1,
        baseTextureData: material.userData?.baseTextureData || null
    };
}
