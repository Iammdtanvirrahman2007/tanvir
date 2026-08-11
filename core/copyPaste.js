import { getSelected, selectObject } from "./selection.js";
import { addObject, removeObject } from "./objectManager.js";
import { addToHierarchy, removeFromHierarchy, rebuildHierarchy } from "../ui/hierarchy.js";
import { pushHistory } from "./history.js";

let clipboard = null;

export function setupCopyPaste(scene) {
    window.addEventListener("keydown", event => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

        const key = event.key.toLowerCase();
        if (event.ctrlKey && key === "c") {
            const selected = getSelected();
            if (!selected) return;
            event.preventDefault();
            clipboard = selected.clone(true);
            cloneResources(selected, clipboard);
            window.dispatchEvent(new CustomEvent("editor:status", { detail: `Copied ${selected.name || selected.type}` }));
        }

        if (event.ctrlKey && key === "v") {
            if (!clipboard) return;
            event.preventDefault();
            const copy = clipboard.clone(true);
            cloneResources(clipboard, copy);
            copy.position.x += 1;
            copy.position.z += 1;
            copy.name = uniqueName(scene, `${clipboard.name || clipboard.type} Copy`);
            copy.userData.selectable = true;
            copy.userData.editorObject = true;
            scene.add(copy);
            addObject(scene, copy);
            addToHierarchy(copy);
            selectObject(copy);
            pushHistory({ undo: () => { removeObject(scene, copy); removeFromHierarchy(copy); rebuildHierarchy(); }, redo: () => { scene.add(copy); addObject(scene, copy); addToHierarchy(copy); selectObject(copy); } });
            window.dispatchEvent(new CustomEvent("editor:status", { detail: `Pasted ${copy.name}` }));
        }
    });
}

function cloneResources(source, target) {
    if (source.material) target.material = Array.isArray(source.material) ? source.material.map(material => material.clone()) : source.material.clone();
    if (source.geometry) target.geometry = source.geometry.clone();
    source.children?.forEach((child, index) => { if (target.children[index]) cloneResources(child, target.children[index]); });
}

function uniqueName(scene, base) {
    let name = base;
    let index = 2;
    while (scene.getObjectByName(name)) name = `${base} ${index++}`;
    return name;
}
