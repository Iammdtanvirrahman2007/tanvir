import { getObjects } from "./objectManager.js";

export function saveScene(scene) {

    const savedObjects = [];

    // objectManager থেকে বর্তমান অবজেক্টগুলোর লিস্ট নিচ্ছি
    const currentObjects = getObjects();

    currentObjects.forEach(object => {

        // শুধু Mesh save করো
        if (!object.isMesh) return;

        // ==================================
        // Imported GLB child mesh skip করো
        // ==================================
        if (
            object.parent &&
            object.parent.userData.selectable === true
        ) {
            return;
        }

        const materials =
            Array.isArray(object.material)
                ? object.material
                : [object.material];

        savedObjects.push({

            type: object.geometry.type,

            name: object.name || "Object",

            position: {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z
            },

            rotation: {
                x: object.rotation.x,
                y: object.rotation.y,
                z: object.rotation.z
            },

            scale: {
                x: object.scale.x,
                y: object.scale.y,
                z: object.scale.z
            },

            visible: object.visible,

            materials: materials.map(mat => ({

                color: mat.color?.getHex() ?? 0xffffff,

                metalness: mat.metalness ?? 0,

                roughness: mat.roughness ?? 1,

                opacity: mat.opacity ?? 1,

                transparent: mat.transparent ?? false,

                wireframe: mat.wireframe ?? false

            }))

        });

    });

    const data = JSON.stringify(savedObjects, null, 2);

    const blob = new Blob([data], {
        type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "scene.json";
    a.click();

    URL.revokeObjectURL(url);

    console.log("Scene Saved Successfully");
}