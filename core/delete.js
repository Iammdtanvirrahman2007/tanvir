import { getSelected, clearSelection } from "./selection.js";
import { removeObject, addObject } from "./objectManager.js";
import { rebuildHierarchy } from "../ui/hierarchy.js";
import { pushHistory } from "./history.js";
import { updateInspector } from "../ui/inspector.js";
import { highlight } from "./highlight.js";

export function setupDelete(scene) {
    window.addEventListener("keydown", event => {
        if (event.key !== "Delete") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

        const selected = getSelected();
        if (!selected || !selected.parent) return;

        const parent = selected.parent;
        const index = parent.children.indexOf(selected);

        removeObject(scene, selected);
        clearSelection();
        highlight(null);
        updateInspector(null);
        rebuildHierarchy();

        pushHistory({
            undo() {
                if (parent === scene) addObject(scene, selected);
                else parent.add(selected);
                if (index >= 0 && index < parent.children.length - 1) parent.children.splice(parent.children.indexOf(selected), 1), parent.children.splice(index, 0, selected);
                rebuildHierarchy();
            },
            redo() {
                removeObject(scene, selected);
                clearSelection();
                rebuildHierarchy();
            }
        });

        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Deleted ${selected.name || selected.type}` }));
    });
}
