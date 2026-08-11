import * as THREE from "three";

let originalEmissives = new Map();

export function highlight(object) {
    setHighlights(object ? [object] : []);
}

export function highlightMultiple(objects = []) {
    setHighlights(objects);
}

export function clearHighlight() {
    restoreHighlights();
}

function setHighlights(objects) {
    restoreHighlights();
    const uniqueObjects = [...new Set((objects || []).filter(Boolean))];
    if (!uniqueObjects.length) return;

    const materials = new Set();
    uniqueObjects.forEach(object => collectMaterials(object, materials));

    materials.forEach(material => {
        if (!material?.emissive || !(material.emissive instanceof THREE.Color)) return;
        if (!originalEmissives.has(material)) originalEmissives.set(material, material.emissive.clone());
        material.emissive.setRGB(0.18, 0.11, 0.025);
        material.needsUpdate = true;
    });
}

function collectMaterials(object, target) {
    if (object.isMesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { if (material) target.add(material); });
    }
    object.children?.forEach(child => collectMaterials(child, target));
}

export function restoreHighlights() {
    originalEmissives.forEach((color, material) => {
        if (material?.emissive) {
            material.emissive.copy(color);
            material.needsUpdate = true;
        }
    });
    originalEmissives.clear();
}
