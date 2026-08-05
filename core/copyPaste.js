import { getSelected, selectObject } from "./selection.js";
import { addObject } from "./objectManager.js";
import { addToHierarchy } from "../ui/hierarchy.js";

let clipboard = null;

export function setupCopyPaste(scene) {

    window.addEventListener("keydown", (event) => {

        // ==========================
        // Copy
        // ==========================

        if (event.ctrlKey && event.key.toLowerCase() === "c") {

            event.preventDefault();

            const selected = getSelected();

            if (!selected) return;

            clipboard = selected;

            console.log("Copied:", selected.name);

        }

        // ==========================
        // Paste
        // ==========================

        if (event.ctrlKey && event.key.toLowerCase() === "v") {

            event.preventDefault();

            if (!clipboard) return;

            const copy = clipboard.clone();

            if (clipboard.material) {

                copy.material =
                    clipboard.material.clone();

            }

            if (clipboard.geometry) {

                copy.geometry =
                    clipboard.geometry.clone();

            }

            copy.position.x += 1;

            copy.position.z += 1;

            copy.name =
                clipboard.name + " Copy";

            copy.userData.selectable = true;

            addObject(scene, copy);

            addToHierarchy(copy);

            selectObject(copy);

            console.log("Pasted:", copy.name);

        }

    });

}