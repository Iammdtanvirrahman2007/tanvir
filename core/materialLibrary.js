import * as THREE from "three";

const STORAGE_KEY = "modelforge:materials:v1";
const materials = new Map();

export function initMaterialLibrary() {
    load();
    if (!materials.size) {
        registerPreset("Matte", { color: "#8b909a", metalness: 0, roughness: 0.82 });
        registerPreset("Metal", { color: "#9aa3ad", metalness: 1, roughness: 0.24 });
        registerPreset("Plastic", { color: "#5f6b7a", metalness: 0.05, roughness: 0.38 });
        registerPreset("Glass", { color: "#b9d8e8", metalness: 0, roughness: 0.08, opacity: 0.28, transparent: true });
        registerPreset("Glow", { color: "#9edcff", metalness: 0, roughness: 0.25, emissive: "#4aa3d8", emissiveIntensity: 1.5 });
        save();
    }
    return listMaterials();
}

export function registerMaterial(name, material) {
    const key = normalize(name);
    if (!key || !material) return null;
    materials.set(key, serializeMaterial(name, material));
    save();
    dispatch("editor:material-library-change", { action: "register", name });
    return materials.get(key);
}

export function registerPreset(name, options = {}) {
    const material = new THREE.MeshStandardMaterial(options);
    return registerMaterial(name, material);
}

export function saveMaterial(name, material) { return registerMaterial(name, material); }

export function getMaterial(name) {
    const data = materials.get(normalize(name));
    return data ? deserializeMaterial(data) : null;
}

export function listMaterials() {
    return [...materials.values()].map(item => ({ ...item }));
}

export function renameMaterial(oldName, newName) {
    const oldKey = normalize(oldName), newKey = normalize(newName);
    if (!materials.has(oldKey) || !newKey || (newKey !== oldKey && materials.has(newKey))) return false;
    const data = materials.get(oldKey);
    data.name = newName.trim();
    materials.delete(oldKey); materials.set(newKey, data); save();
    dispatch("editor:material-library-change", { action: "rename", oldName, newName });
    return true;
}

export function deleteMaterial(name) {
    const key = normalize(name);
    if (!materials.has(key)) return false;
    materials.delete(key); save();
    dispatch("editor:material-library-change", { action: "delete", name });
    return true;
}

export function applyMaterial(object, name) {
    if (!object) return false;
    const source = getMaterial(name);
    if (!source) return false;
    if (Array.isArray(object.material)) object.material = object.material.map(() => source.clone());
    else object.material = source.clone();
    object.material.needsUpdate = true;
    object.userData.materialName = name;
    dispatch("editor:material-applied", { object, name });
    return true;
}

function serializeMaterial(name, material) {
    return { name, color: material.color?.getHexString?.() || "ffffff", metalness: material.metalness ?? 0, roughness: material.roughness ?? 1, opacity: material.opacity ?? 1, transparent: !!material.transparent, wireframe: !!material.wireframe, emissive: material.emissive?.getHexString?.() || "000000", emissiveIntensity: material.emissiveIntensity ?? 1, side: material.side ?? THREE.FrontSide };
}

function deserializeMaterial(data) {
    return new THREE.MeshStandardMaterial({ color: `#${data.color}`, metalness: data.metalness, roughness: data.roughness, opacity: data.opacity, transparent: data.transparent, wireframe: data.wireframe, emissive: `#${data.emissive}`, emissiveIntensity: data.emissiveIntensity, side: data.side });
}

function normalize(value) { return String(value || "").trim().toLowerCase(); }
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...materials.values()])); } catch {} }
function load() { try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); data.forEach(item => materials.set(normalize(item.name), item)); } catch {} }
function dispatch(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }
