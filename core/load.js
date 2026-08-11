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
                const parsed = JSON.parse(reader.result);
                const roots = Array.isArray(parsed) ? parsed : parsed.objects;
                if (!Array.isArray(roots)) throw new Error("Invalid ModelForge scene.");
                clearObjects(scene);
                roots.forEach(data => restoreObject(scene, scene, data));
                rebuildHierarchy();
                window.dispatchEvent(new CustomEvent("editor:status", { detail: `Loaded ${roots.length} objects` }));
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

function restoreObject(scene, parent, data) {
    if (!data) return null;
    let object;

    if (data.kind === "Group" || data.type === "Group") {
        object = new THREE.Group();
        object.userData.selectable = true;
    } else {
        const geometry = createGeometry(data.type);
        if (!geometry) return null;
        const materials = (data.materials || []).map(createMaterial);
        const material = materials.length === 1 ? materials[0] : materials.length ? materials : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
        object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData.selectable = true;
    }

    object.name = data.name || "Object";
    object.visible = data.visible ?? true;
    object.position.fromArray(normalizeVector(data.position, [0, 0, 0]));
    object.rotation.set(...normalizeVector(data.rotation, [0, 0, 0]));
    object.scale.fromArray(normalizeVector(data.scale, [1, 1, 1]));
    object.userData.editorObject = true;
    Object.assign(object.userData, data.userData || {});

    parent.add(object);
    addObject(scene, object);
    (data.children || []).forEach(child => restoreObject(scene, object, child));
    return object;
}

function createMaterial(data) {
    const material = new THREE.MeshStandardMaterial({ color: data.color ?? 0xffffff, metalness: data.metalness ?? 0, roughness: data.roughness ?? 1, opacity: data.opacity ?? 1, transparent: data.transparent ?? false, wireframe: data.wireframe ?? false, side: data.side ?? THREE.FrontSide });
    material.name = data.name || "";
    return material;
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

function normalizeVector(value, fallback) {
    if (!Array.isArray(value) || value.length < 3) return fallback;
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}
