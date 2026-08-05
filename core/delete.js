import {
    getSelected,
    clearSelection
} from "./selection.js";

import {
    removeObject,
    addObject
} from "./objectManager.js";

import {
    addToHierarchy,
    removeFromHierarchy
} from "../ui/hierarchy.js";

import { pushHistory }
    from "./history.js";

import { updateInspector }
    from "../ui/inspector.js";

import { highlight }
    from "./highlight.js";

export function setupDelete(scene) {

    window.addEventListener("keydown", (event) => {

        if (event.key !== "Delete") return;

        const selected = getSelected();

        if (!selected) return;

        // History Save
        pushHistory({

            undo() {

                addObject(scene, selected);

                addToHierarchy(selected);

            },

            redo() {

                removeObject(scene, selected);

                removeFromHierarchy(selected);

            }

        });

        // Delete
        removeObject(scene, selected);

        removeFromHierarchy(selected);
            clearSelection();
        highlight(null);

        updateInspector(null);

        console.log(
            "Deleted :",
            selected.name
        );

    });

}