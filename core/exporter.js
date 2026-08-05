import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const exporter = new GLTFExporter();

// ==========================================
// Export Scene As GLTF
// ==========================================

export function exportScene(scene) {

    return new Promise((resolve, reject) => {

        exporter.parse(

            scene,

            result => {

                resolve(result);

            },

            error => {

                reject(error);

            },

            {
                binary: false
            }

        );

    });

}

// ==========================================
// Download GLTF
// ==========================================

export async function downloadGLTF(scene) {

    try {

        const result = await exportScene(scene);

        const output = JSON.stringify(
            result,
            null,
            2
        );

        const blob = new Blob(
            [output],
            {
                type: "application/json"
            }
        );

        const link =
            document.createElement("a");

        link.href =
            URL.createObjectURL(blob);

        link.download = "scene.gltf";

        link.click();

        URL.revokeObjectURL(link.href);

        console.log("GLTF Exported");

    }

    catch (err) {

        console.error(err);

    }

}

// ==========================================
// Setup Export Button
// ==========================================

export function setupExporter(scene) {

    const exportBtn =
        document.getElementById("exportBtn");

    if (!exportBtn) return;

    exportBtn.onclick = () => {

        downloadGLTF(scene);

    };

}