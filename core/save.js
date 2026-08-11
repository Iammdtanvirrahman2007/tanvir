import * as THREE from "three";

const FORMATS = {
    rkp: { label: "ModelForge Project", ext: "rkp", mime: "application/json" },
    json: { label: "JSON Scene", ext: "json", mime: "application/json" },
    obj: { label: "Wavefront OBJ", ext: "obj", mime: "text/plain" },
    gltf: { label: "glTF", ext: "gltf", mime: "model/gltf+json" },
    glb: { label: "glTF Binary", ext: "glb", mime: "model/gltf-binary" }
};

const PROJECT_NAME_KEY = "modelforge:project-name";

export function serializeScene(scene) {
    const roots = scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly);
    return { format: "ModelForgeProject", fileExtension: ".rkp", version: 4, app: "ModelForge", projectName: getProjectName(), created: new Date().toISOString(), objects: roots.map(serializeObject) };
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
    const panel = document.createElement("div");
    panel.className = "save-format-dialog";
    const currentName = getProjectName();
    panel.innerHTML = `<div class="save-format-card"><h3>Save Project</h3><label class="save-field-label" for="saveFilename">File name</label><input id="saveFilename" autocomplete="off" spellcheck="false" placeholder="My Rocket Model" value="${escapeHtml(currentName)}"><label class="save-field-label" for="saveFormatSelect">Format</label><select id="saveFormatSelect"><option value="rkp">ModelForge Project (.rkp)</option><option value="json">JSON Scene (.json)</option><option value="obj">Wavefront OBJ (.obj)</option><option value="gltf">glTF (.gltf)</option><option value="glb">glTF Binary (.glb)</option></select><div class="save-format-actions"><button data-cancel>Cancel</button><button data-save>Save</button></div></div>`;
    document.body.appendChild(panel);
    const input = panel.querySelector("#saveFilename");
    const formatSelect = panel.querySelector("#saveFormatSelect");
    const finish = () => panel.remove();
    const submit = () => {
        const format = formatSelect.value;
        const name = sanitizeName(input.value) || "modelforge-project";
        setProjectName(name);
        saveScene(scene, { format, filename: `${name}.${format}` });
        finish();
    };
    panel.addEventListener("click", event => {
        if (event.target.closest("[data-cancel]")) return finish();
        if (event.target.closest("[data-save]")) submit();
    });
    input.addEventListener("keydown", event => { if (event.key === "Enter") submit(); if (event.key === "Escape") finish(); });
    requestAnimationFrame(() => { input.focus(); input.select(); });
    return panel;
}

export function saveRKP(scene, filename) {
    const name = sanitizeName(filename || getProjectName() || "modelforge-project").replace(/\.rkp$/i, "");
    setProjectName(name);
    return saveScene(scene, { format: "rkp", filename: `${name}.rkp` });
}

export function getProjectName() {
    try { return localStorage.getItem(PROJECT_NAME_KEY) || "modelforge-project"; } catch { return "modelforge-project"; }
}

export function setProjectName(name) {
    const clean = sanitizeName(name) || "modelforge-project";
    try { localStorage.setItem(PROJECT_NAME_KEY, clean); } catch {}
    window.dispatchEvent(new CustomEvent("editor:project-name-change", { detail: clean }));
    return clean;
}

export function getSupportedSaveFormats() { return Object.values(FORMATS).map(item => ({ ...item })); }

function sanitizeName(value) { return String(value || "").trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120).trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
}

function exportOBJ(scene, filename = `${sanitizeName(getProjectName()) || "modelforge-model"}.obj`) {
    const vertices = [], faces = [];
    scene.updateMatrixWorld(true);
    scene.traverse(object => {
        if (!object.isMesh || !object.userData?.editorObject || object.userData?.editorOnly) return;
        const position = object.geometry?.attributes?.position; if (!position) return;
        const offset = vertices.length / 3; const vector = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) { vector.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld); vertices.push(vector.x, vector.y, vector.z); }
        const index = object.geometry.index;
        if (index) for (let i = 0; i < index.count; i += 3) faces.push(`f ${index.getX(i)+1+offset} ${index.getX(i+1)+1+offset} ${index.getX(i+2)+1+offset}`);
        else for (let i = 0; i < position.count; i += 3) faces.push(`f ${i+1+offset} ${i+2+offset} ${i+3+offset}`);
    });
    const lines = ["# ModelForge", ...Array.from({ length: vertices.length / 3 }, (_, i) => `v ${vertices[i*3]} ${vertices[i*3+1]} ${vertices[i*3+2]}`), ...faces];
    return downloadBlob(`${lines.join("\n")}\n`, filename, "text/plain");
}

async function exportGLTF(scene, format, filename) {
    try {
        const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
        const exporter = new GLTFExporter();
        exporter.parse(scene, result => {
            const binary = format === "glb";
            const data = binary ? result : JSON.stringify(result, null, 2);
            downloadBlob(data, filename || `${sanitizeName(getProjectName()) || "modelforge-model"}.${format}`, binary ? "model/gltf-binary" : "model/gltf+json");
        }, error => console.error("glTF export failed", error), { binary: format === "glb" });
        return true;
    } catch (error) { console.error("glTF exporter unavailable", error); return false; }
}

function serializeObject(object) {
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]).map(serializeMaterial) : [];
    return { kind: object.isGroup ? "Group" : "Mesh", type: object.geometry?.type || object.type, name: object.name || object.type, visible: object.visible, position: object.position.toArray(), rotation: [object.rotation.x, object.rotation.y, object.rotation.z], scale: object.scale.toArray(), materials, userData: { partType: object.userData?.partType || "", category: object.userData?.category || "", manufacturer: object.userData?.manufacturer || "", mass: object.userData?.mass ?? 1, description: object.userData?.description || "", version: object.userData?.version || "1.0" }, children: object.children.filter(child => child.userData?.editorObject && !child.userData?.editorOnly).map(serializeObject) };
}
function serializeMaterial(material) { return { name: material.name || "", color: material.color?.getHex() ?? 0xffffff, metalness: material.metalness ?? 0, roughness: material.roughness ?? 1, opacity: material.opacity ?? 1, transparent: material.transparent ?? false, side: material.side ?? 0 }; }
