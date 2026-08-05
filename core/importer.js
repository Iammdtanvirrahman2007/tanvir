import * as THREE from "three";

import {
    GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";

import {
    addObject
} from "./objectManager.js";

import {
    addToHierarchy
} from "../ui/hierarchy.js";

const loader = new GLTFLoader();

// ==========================================
// Import GLTF / GLB
// ==========================================

export function setupImporter(scene) {

    const importBtn = document.getElementById("importBtn");
    const fileInput = document.getElementById("fileInput");

    // ======================================
    // Open File Picker
    // ======================================

    importBtn.onclick = () => {
        fileInput.click();
    };

    // ======================================
    // Import File
    // ======================================

    fileInput.onchange = event => {

        const file = event.target.files[0];

        if (!file) return;

        const url = URL.createObjectURL(file);

        loader.load(

            url,

            gltf => {

                const model = gltf.scene;

                // File name থেকে model name
                model.name = file.name.replace(/\.[^/.]+$/, "");

                // ==================================
                // Whole model selectable
                // ==================================

                model.userData.selectable = true;

                // ==================================
                // Setup Meshes
                // ==================================

                model.traverse(child => {

                    if (!child.isMesh) return;

                    // ------------------------------
                    // Remove imported floor / grid
                    // ------------------------------

                    const name = (child.name || "").toLowerCase();

                    if (
                        name.includes("grid") ||
                        name.includes("floor") ||
                        name.includes("ground") ||
                        name.includes("plane") ||
                        name.includes("surface")
                    ) {
                        child.visible = false;
                        return;
                    }

                    // Shadow
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Child mesh আলাদা selectable হবে না
                    child.userData.selectable = false;

                    // ------------------------------
                    // Texture Fix
                    // ------------------------------

                    const materials = Array.isArray(child.material)
                        ? child.material
                        : [child.material];

                    materials.forEach(mat => {

                        if (!mat) return;

                        if (mat.map) {
                            mat.map.colorSpace = THREE.SRGBColorSpace;
                            mat.map.flipY = false;
                        }

                        mat.needsUpdate = true;
                    });
                });

                // ==================================
                // Initial Position
                // ==================================

                model.position.set(0, 0, 0);

                // ==================================
                // Add To Scene
                // ==================================

                addObject(scene, model);

                addToHierarchy(model);

                URL.revokeObjectURL(url);

                console.log("Imported:", model.name);
            },

            undefined,

            error => {

                console.error("Import Error:", error);

                URL.revokeObjectURL(url);
            }
        );

        // একই file আবার import করা যাবে
        fileInput.value = "";
    };
}