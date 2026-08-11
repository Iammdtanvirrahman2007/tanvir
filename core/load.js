import * as THREE from "three";
import { addObject, clearObjects } from "./objectManager.js";
import { rebuildHierarchy } from "../ui/hierarchy.js";

export function loadScene(scene) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!Array.isArray(data)) throw new Error("Scene data must be an array.");

                clearObjects(scene);

                for (const item of data) {
                    const geometry = createGeometry(item.type);
                    if (!geometry) continue;

                    const materialData = Array.isArray(item.materials) && item.materials.length
                        ? item.materials
                        : [{ color: 0xffffff }];

                    const materials = materialData.map(material => new THREE.MeshStandardMaterial({
                        color: material.color ?? 0xffffff,
                        metalness: material.metalness ?? 0,
                        roughness: material.roughness ?? 1,
                        opacity: material.opacity ?? 1,
                        transparent: material.transparent ?? false,
                        wireframe: material.wireframe ?? false,
                        side: THREE.DoubleSide
                    }));

                    const mesh = new THREE.Mesh(geometry, materials.length === 1 ? materials[0] : materials);
                    mesh.name = item.name || "Object";
                    mesh.position.set(item.position?.x ?? 0, item.position?.y ?? 0, item.position?.z ?? 0);
                    mesh.rotation.set(item.rotation?.x ?? 0, item.rotation?.y ?? 0, item.rotation?.z ?? 0);
                    mesh.scale.set(item.scale?.x ?? 1, item.scale?.y ?? 1, item.scale?.z ?? 1);
                    mesh.visible = item.visible ?? true;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.userData.selectable = true;
                    mesh.userData.editorObject = true;
                    addObject(scene, mesh);
                }

                rebuildHierarchy();
                window.dispatchEvent(new CustomEvent("editor:status", { detail: `Loaded ${data.length} objects` }));
            } catch (error) {
                console.error("Load failed:", error);
                window.dispatchEvent(new CustomEvent("editor:status", { detail: "Invalid scene file" }));
            }
        };
        reader.readAsText(file);
        input.value = "";
    }, { once: true });

    input.click();
}

function createGeometry(type) {
    switch (type) {
        case "BoxGeometry": return new THREE.BoxGeometry(1, 1, 1);
        case "SphereGeometry": return new THREE.SphereGeometry(0.5, 32, 20);
        case "CylinderGeometry": return new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
        case "ConeGeometry": return new THREE.ConeGeometry(0.5, 1.5, 32);
        case "PlaneGeometry": return new THREE.PlaneGeometry(5, 5);
        case "OctahedronGeometry": return new THREE.OctahedronGeometry(0.5);
        case "TorusGeometry": return new THREE.TorusGeometry(0.5, 0.2, 16, 64);
        default: return null;
    }
}
