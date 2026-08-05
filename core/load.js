import * as THREE from "three";
import { addObject, clearObjects } from "./objectManager.js";
import { addToHierarchy } from "../ui/hierarchy.js";

export function loadScene(scene) {

    // File picker তৈরি
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = e => {
            try {
                const objects = JSON.parse(e.target.result);

                // ==================================
                // Remove ALL User Objects Safely
                // ==================================
                const toRemove = [];
                
                scene.children.forEach(obj => {
                    // Grid, Light, Camera, TransformControls ইত্যাদি বাদ দিয়ে বাকি সব ইউজারের অবজেক্ট রিমুভ করার জন্য সিলেক্ট করা
                    if (obj.isCamera) return;
                    if (obj.isLight) return;
                    if (obj.isGridHelper) return;
                    if (obj.isAxesHelper) return;
                    if (obj.type === "TransformControls") return;

                    toRemove.push(obj);
                });
                
                toRemove.forEach(obj => {
                    scene.remove(obj);
                });

                // পুরোনো অবজেক্টের মেমোরি ও লিস্ট ক্লিয়ার করো
                clearObjects();

                // ==================================
                // Recreate Saved Objects
                // ==================================
                objects.forEach(data => {

                    let geometry = null;

                    switch (data.type) {

                        case "BoxGeometry":
                            geometry = new THREE.BoxGeometry();
                            break;

                        case "SphereGeometry":
                            geometry = new THREE.SphereGeometry(0.5, 32, 32);
                            break;

                        case "CylinderGeometry":
                            geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
                            break;

                        case "ConeGeometry":
                            geometry = new THREE.ConeGeometry(0.5, 1.5, 32);
                            break;

                        case "PlaneGeometry":
                            geometry = new THREE.PlaneGeometry(5, 5);
                            break;

                        case "OctahedronGeometry":
                            geometry = new THREE.OctahedronGeometry(0.5);
                            break;

                        case "TorusGeometry":
                            geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
                            break;

                        default:
                            console.warn("Unsupported geometry:", data.type);
                            return;
                    }

                    // ==============================
                    // Create Materials
                    // ==============================
                    const materials = (data.materials || []).map(mat =>
                        new THREE.MeshStandardMaterial({
                            color: mat.color ?? 0xffffff,
                            metalness: mat.metalness ?? 0,
                            roughness: mat.roughness ?? 1,
                            opacity: mat.opacity ?? 1,
                            transparent: mat.transparent ?? false,
                            wireframe: mat.wireframe ?? false,
                            side: THREE.DoubleSide
                        })
                    );

                    const material =
                        materials.length === 0
                            ? new THREE.MeshStandardMaterial({
                                color: 0xffffff
                            })
                            : materials.length === 1
                                ? materials[0]
                                : materials;

                    // ==============================
                    // Create Mesh
                    // ==============================
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = data.name || "Object";

                    // Restore Transform
                    mesh.position.set(
                        data.position?.x ?? 0,
                        data.position?.y ?? 0,
                        data.position?.z ?? 0
                    );

                    mesh.rotation.set(
                        data.rotation?.x ?? 0,
                        data.rotation?.y ?? 0,
                        data.rotation?.z ?? 0
                    );

                    mesh.scale.set(
                        data.scale?.x ?? 1,
                        data.scale?.y ?? 1,
                        data.scale?.z ?? 1
                    );

                    mesh.visible = data.visible ?? true;

                    // Shadow
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;

                    // Selection এর জন্য
                    mesh.userData.selectable = true;

                    // Scene এ add করো এবং objectManager ও Hierarchy-তে আপডেট করো
                    addObject(scene, mesh);
                    addToHierarchy(mesh);
                });

                console.log("Scene Loaded Successfully");

            } catch (error) {
                console.error("Load failed:", error);
                alert("Invalid scene.json file");
            }
        };

        reader.readAsText(file);
    });

    // File picker open করো
    input.click();
}