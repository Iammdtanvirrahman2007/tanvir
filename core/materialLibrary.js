import * as THREE from "three";

const STORAGE_KEY = "modelforge:materials:v2";
const materials = new Map();

export function initMaterialLibrary() {
    load();
    if (!materials.size) {
        registerPreset("Matte", { color: "#8b909a", metalness: 0, roughness: 0.82 });
        registerPreset("Metal", { color: "#9aa3ad", metalness: 1, roughness: 0.24 });
        registerPreset("Plastic", { color: "#5f6b7a", metalness: 0.05, roughness: 0.38 });
        registerPreset("Glass", { color: "#b9d8e8", metalness: 0, roughness: 0.08, opacity: 0.28, transparent: true, side: THREE.DoubleSide });
        registerPreset("Glow", { color: "#9edcff", metalness: 0, roughness: 0.25, emissive: "#4aa3d8", emissiveIntensity: 2.5 });
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
export function registerPreset(name, options = {}) { const material = new THREE.MeshStandardMaterial(options); material.userData.materialPreset = name; return registerMaterial(name, material); }
export function saveMaterial(name, material) { return registerMaterial(name, material); }
export function getMaterial(name) { const data = materials.get(normalize(name)); return data ? deserializeMaterial(data) : null; }
export function listMaterials() { return [...materials.values()].map(item => ({ ...item })); }

export function renameMaterial(oldName, newName) {
    const oldKey = normalize(oldName), newKey = normalize(newName);
    if (!materials.has(oldKey) || !newKey || (newKey !== oldKey && materials.has(newKey))) return false;
    const data = materials.get(oldKey); data.name = newName.trim(); materials.delete(oldKey); materials.set(newKey, data); save();
    dispatch("editor:material-library-change", { action: "rename", oldName, newName }); return true;
}
export function deleteMaterial(name) { const key = normalize(name); if (!materials.has(key)) return false; materials.delete(key); save(); dispatch("editor:material-library-change", { action: "delete", name }); return true; }

export function applyMaterial(object, name) {
    if (!object) return false; const source = getMaterial(name); if (!source) return false;
    if (Array.isArray(object.material)) object.material = object.material.map(() => source.clone()); else object.material = source.clone();
    const applied = Array.isArray(object.material) ? object.material[0] : object.material; if (applied) applied.needsUpdate = true;
    object.userData.materialName = name; dispatch("editor:material-applied", { object, name }); return true;
}

export function serializeMaterialState(material, name = material?.name || "") {
    if (!material) return null;
    return { name, color: material.color?.getHex?.() ?? 0xffffff, metalness: material.metalness ?? 0, roughness: material.roughness ?? 1, opacity: material.opacity ?? 1, transparent: !!material.transparent, depthWrite: material.depthWrite ?? true, wireframe: !!material.wireframe, flatShading: !!material.flatShading, side: material.side ?? THREE.FrontSide, emissive: material.emissive?.getHex?.() ?? 0, emissiveIntensity: material.emissiveIntensity ?? 1, materialPreset: material.userData?.materialPreset || "Custom", baseTextureData: material.userData?.baseTextureData || null };
}

export function deserializeMaterialState(data) {
    if (!data) return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
    const material = new THREE.MeshStandardMaterial({ color: data.color ?? 0xffffff, metalness: data.metalness ?? 0, roughness: data.roughness ?? 1, opacity: data.opacity ?? 1, transparent: data.transparent ?? false, depthWrite: data.depthWrite ?? ((data.opacity ?? 1) >= 1), wireframe: data.wireframe ?? false, side: data.side ?? THREE.FrontSide, emissive: data.emissive ?? 0, emissiveIntensity: data.emissiveIntensity ?? 1 });
    material.name = data.name || ""; material.flatShading = !!data.flatShading; material.userData.materialPreset = data.materialPreset || "Custom";
    if (data.baseTextureData) { material.userData.baseTextureData = data.baseTextureData; restoreTexture(material, data.baseTextureData); }
    material.needsUpdate = true; return material;
}
function serializeMaterial(name, material) { return serializeMaterialState(material, name); }
function deserializeMaterial(data) { return deserializeMaterialState(data); }
function restoreTexture(material, dataUrl) { try { new THREE.TextureLoader().load(dataUrl, texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; material.map = texture; material.needsUpdate = true; }); } catch {} }
function normalize(value) { return String(value || "").trim().toLowerCase(); }
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...materials.values()])); } catch (error) { console.warn("Material library save failed", error); } }
function load() { try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); if (!Array.isArray(data)) return; data.forEach(item => { if (item?.name) materials.set(normalize(item.name), item); }); } catch (error) { console.warn("Material library load failed", error); } }
function dispatch(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail })); }
