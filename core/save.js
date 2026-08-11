import { getObjects } from "./objectManager.js";

export function serializeScene(scene) {
    const roots = scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly);
    return {
        format: "ModelForgeScene",
        version: 2,
        created: new Date().toISOString(),
        objects: roots.map(serializeObject)
    };
}

export function saveScene(scene) {
    const data = serializeScene(scene);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelforge-scene.json";
    link.click();
    URL.revokeObjectURL(url);
    return data;
}

function serializeObject(object) {
    const materials = object.material
        ? (Array.isArray(object.material) ? object.material : [object.material]).map(serializeMaterial)
        : [];

    return {
        kind: object.isGroup ? "Group" : "Mesh",
        type: object.geometry?.type || object.type,
        name: object.name || object.type,
        visible: object.visible,
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray(),
        materials,
        userData: {
            partType: object.userData?.partType || "",
            category: object.userData?.category || "",
            manufacturer: object.userData?.manufacturer || "",
            mass: object.userData?.mass ?? 1,
            description: object.userData?.description || "",
            version: object.userData?.version || "1.0"
        },
        children: object.children.filter(child => child.userData?.editorObject && !child.userData?.editorOnly).map(serializeObject)
    };
}

function serializeMaterial(material) {
    return {
        name: material.name || "",
        color: material.color?.getHex() ?? 0xffffff,
        metalness: material.metalness ?? 0,
        roughness: material.roughness ?? 1,
        opacity: material.opacity ?? 1,
        transparent: material.transparent ?? false,
        wireframe: material.wireframe ?? false,
        side: material.side ?? 0
    };
}
