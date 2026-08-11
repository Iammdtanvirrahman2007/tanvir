import { exportScene } from "./exporter.js";

export function setupUpload(scene) {
    const uploadBtn = document.getElementById("uploadBtn");
    if (!uploadBtn) return;

    uploadBtn.onclick = async () => {
        try {
            const gltf = await exportScene(scene);
            const parts = [];

            scene.traverse(object => {
                if (object.userData?.selectable !== true) return;
                parts.push({
                    uuid: object.uuid,
                    name: object.name || "Unnamed",
                    type: object.userData.partType || "Unknown",
                    category: object.userData.category || "Default",
                    manufacturer: object.userData.manufacturer || "",
                    mass: object.userData.mass ?? 1,
                    description: object.userData.description || "",
                    version: object.userData.version || "1.0",
                    position: object.position.toArray(),
                    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
                    scale: object.scale.toArray()
                });
            });

            const metadata = parts[0] || {};
            const rocketPart = {
                format: "RocketPart",
                version: 1,
                created: new Date().toISOString(),
                metadata: {
                    name: metadata.name || "Unnamed",
                    type: metadata.type || "Unknown",
                    category: metadata.category || "Default",
                    manufacturer: metadata.manufacturer || "",
                    mass: metadata.mass ?? 1,
                    description: metadata.description || "",
                    version: metadata.version || "1.0"
                },
                parts,
                gltf
            };

            const blob = new Blob([JSON.stringify(rocketPart, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${metadata.name || "RocketPart"}.rkp`;
            link.click();
            URL.revokeObjectURL(url);
            window.dispatchEvent(new CustomEvent("editor:status", { detail: "Rocket part exported" }));
        } catch (error) {
            console.error("Rocket part export failed:", error);
            window.dispatchEvent(new CustomEvent("editor:status", { detail: "Rocket part export failed" }));
        }
    };
}
