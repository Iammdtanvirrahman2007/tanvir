import { getObjects } from "./objectManager.js";

export function serializeScene(scene) {
    const roots = scene.children.filter(object => object.userData?.editorObject && !object.userData?.editorOnly);
    return {
        format: "ModelForgeProject",
        fileExtension: ".rkp",
        version: 3,
        app: "ModelForge",
        created: new Date().toISOString(),
        objects: roots.map(serializeObject)
    };
}

export function saveScene(scene, options = {}) {
    const data = serializeScene(scene);
    const extension = options.format === "json" ? "json" : "rkp";
    const filename = options.filename || `modelforge-project.${extension}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return data;
}

export function saveRKP(scene, filename = "modelforge-project.rkp") {
    return saveScene(scene, { format: "rkp", filename: filename.endsWith(".rkp") ? filename : `${filename}.rkp` });
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
