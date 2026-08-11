import { getSelected, selectObject } from "./selection.js";
import { addObject, removeObject } from "./objectManager.js";
import { addToHierarchy, removeFromHierarchy, rebuildHierarchy } from "../ui/hierarchy.js";
import { pushHistory } from "./history.js";

export function duplicateObject(scene, selected = getSelected()) {
    if (!selected) return null;

    const copy = selected.clone(true);
    cloneResources(selected, copy);
    copy.name = uniqueName(scene, `${selected.name || selected.type} Copy`);
    copy.position.x += 1;
    copy.userData.selectable = true;
    copy.userData.editorObject = true;

    const parent = selected.parent || scene;
    parent.add(copy);
    addObject(scene, copy);
    addToHierarchy(copy);
    selectObject(copy);

    pushHistory({
        undo() { removeObject(scene, copy); removeFromHierarchy(copy); rebuildHierarchy(); },
        redo() { parent.add(copy); addObject(scene, copy); addToHierarchy(copy); selectObject(copy); }
    });

    return copy;
}

export function setupDuplicate(scene) {
    window.addEventListener("keydown", event => {
        if (!(event.ctrlKey && event.key.toLowerCase() === "d")) return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
        event.preventDefault();
        const copy = duplicateObject(scene);
        if (copy) window.dispatchEvent(new CustomEvent("editor:status", { detail: `Duplicated ${copy.name}` }));
    });
}

function cloneResources(source, target) {
    if (source.material) {
        if (Array.isArray(source.material)) target.material = source.material.map(material => material.clone());
        else target.material = source.material.clone();
    }
    if (source.geometry) target.geometry = source.geometry.clone();

    if (source.children?.length) {
        source.children.forEach((child, index) => {
            if (target.children[index]) cloneResources(child, target.children[index]);
        });
    }
}

function uniqueName(scene, base) {
    let name = base;
    let index = 2;
    while (scene.getObjectByName(name)) name = `${base} ${index++}`;
    return name;
}
