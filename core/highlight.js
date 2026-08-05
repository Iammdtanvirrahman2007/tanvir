import * as THREE from "three";

let currentObjects = [];
let originalEmissives = new Map();

// ==========================================
// Highlight Selected Object / Group
// ==========================================

export function highlight(object) {

    // ======================================
    // Restore previous emissive colors
    // ======================================

    originalEmissives.forEach((originalColor, material) => {

        if (material && material.emissive) {
            material.emissive.copy(originalColor);
        }
    });

    originalEmissives.clear();
    currentObjects = [];

    // Nothing selected
    if (!object) return;

    // ======================================
    // Collect meshes
    // ======================================

    const meshes = [];

    if (object.isGroup || object.type === "Group") {

        object.traverse(child => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });

    } else if (object.isMesh) {

        meshes.push(object);
    }

    // ======================================
    // Apply highlight
    // ======================================

    meshes.forEach(mesh => {

        const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

        materials.forEach(mat => {

            if (!mat) return;

            // emissive property থাকলে তবেই highlight
            if ("emissive" in mat && mat.emissive instanceof THREE.Color) {

                // Original color save করো
                if (!originalEmissives.has(mat)) {
                    originalEmissives.set(mat, mat.emissive.clone());
                }

                // Highlight color
                mat.emissive.setHex(0xffcc00);
            }
        });
    });

    currentObjects = meshes;
}