import { exportScene } from "./exporter.js";

// ==========================================
// Export Rocket Part (.rkp)
// ==========================================

export function setupUpload(scene) {

    const uploadBtn =
        document.getElementById("uploadBtn");

    if (!uploadBtn) return;

    uploadBtn.onclick = async () => {

        try {

            console.log("========== Export Rocket Part ==========");

            // ==================================
            // Export GLTF
            // ==================================

            const gltf =
                await exportScene(scene);

            // ==================================
            // Collect Parts
            // ==================================

            const parts = [];

            scene.traverse(object => {

                if (
                    object.userData.selectable === true
                ) {

                    parts.push({

                        uuid: object.uuid,

                        name:
                            object.name || "Unnamed",

                        type:
                            object.userData.partType ||
                            "Unknown",

                        category:
                            object.userData.category ||
                            "Default",

                        manufacturer:
                            object.userData.manufacturer ||
                            "",

                        mass:
                            object.userData.mass ?? 1,

                        description:
                            object.userData.description ||
                            "",

                        version:
                            object.userData.version ||
                            "1.0",

                        position:
                            object.position.toArray(),

                        rotation: [

                            object.rotation.x,
                            object.rotation.y,
                            object.rotation.z

                        ],

                        scale:
                            object.scale.toArray()

                    });

                }

            });

            // ==================================
            // Rocket Part Package
            // ==================================

            const rocketPart = {

                format: "RocketPart",

                version: 1,

                created:
                    new Date().toISOString(),

                metadata: {

                    name:
                        parts[0]?.name ||
                        "Unnamed",

                    type:
                        parts[0]?.type ||
                        "Unknown",

                    category:
                        parts[0]?.category ||
                        "Default",

                    manufacturer:
                        parts[0]?.manufacturer ||
                        "",

                    mass:
                        parts[0]?.mass ??
                        1,

                    description:
                        parts[0]?.description ||
                        "",

                    version:
                        parts[0]?.version ||
                        "1.0"

                },

                parts,

                gltf

            };

            // ==================================
            // Download
            // ==================================

            const json =
                JSON.stringify(
                    rocketPart,
                    null,
                    2
                );

            const blob =
                new Blob(
                    [json],
                    {
                        type:
                            "application/json"
                    }
                );

            const url =
                URL.createObjectURL(blob);

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                (
                    rocketPart.metadata.name ||
                    "RocketPart"
                ) + ".rkp";

            link.click();

            URL.revokeObjectURL(url);

            console.log("Rocket Part Exported");

            alert(
                "Rocket Part Downloaded 🚀"
            );

        }

        catch (err) {

            console.error(err);

            alert(
                "Export Failed ❌"
            );

        }

    };

}