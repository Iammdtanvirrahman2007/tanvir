import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const exporter = new GLTFExporter();

export function exportScene(scene, options = {}) {
    const source = new THREE.Group();
    source.name = "ModelForgeScene";

    scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly).forEach(object => {
        source.add(object.clone(true));
    });

    return new Promise((resolve, reject) => {
        exporter.parse(source, result => resolve(result), error => reject(error), {
            binary: options.binary ?? false,
            onlyVisible: false
        });
    });
}

export async function downloadGLTF(scene) {
    try {
        const result = await exportScene(scene);
        const output = JSON.stringify(result, null, 2);
        const blob = new Blob([output], { type: "model/gltf+json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "modelforge-scene.gltf";
        link.click();
        URL.revokeObjectURL(url);
        window.dispatchEvent(new CustomEvent("editor:status", { detail: "GLTF exported" }));
    } catch (error) {
        console.error("GLTF export failed:", error);
        window.dispatchEvent(new CustomEvent("editor:status", { detail: "GLTF export failed" }));
    }
}

export function setupExporter(scene) {
    const exportBtn = document.getElementById("exportBtn");
    if (!exportBtn) return;
    exportBtn.onclick = () => downloadGLTF(scene);
}
