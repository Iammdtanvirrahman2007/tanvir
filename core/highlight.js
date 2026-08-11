import * as THREE from "three";

let originalEmissives = new Map();

export function highlight(object) {
    restoreHighlights();
    if (!object) return;

    const meshes = [];
    if (object.isMesh) meshes.push(object);
    else if (object.isGroup || object.type === "Group") object.traverse(child => { if (child.isMesh) meshes.push(child); });

    meshes.forEach(mesh => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => {
            if (!material || !material.emissive || !(material.emissive instanceof THREE.Color)) return;
            if (!originalEmissives.has(material)) originalEmissives.set(material, material.emissive.clone());
            material.emissive.setRGB(0.18, 0.11, 0.025);
            material.needsUpdate = true;
        });
    });
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
