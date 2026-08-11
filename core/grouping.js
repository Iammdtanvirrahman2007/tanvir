import * as THREE from "three";
import { pushHistory } from "./history.js";
import { rebuildHierarchy } from "../ui/hierarchy.js";

let multiSelection = [];

export function toggleMultiSelect(object) {
    if (!object) return multiSelection;

    const index = multiSelection.indexOf(object);
    if (index === -1) multiSelection.push(object);
    else multiSelection.splice(index, 1);

    window.dispatchEvent(new CustomEvent("editor:multiselect-change", { detail: multiSelection }));
    return multiSelection;
}

export function setMultiSelection(objects = []) {
    multiSelection = [...new Set(objects.filter(Boolean))];
    window.dispatchEvent(new CustomEvent("editor:multiselect-change", { detail: multiSelection }));
    return multiSelection;
}

export function getMultiSelection() {
    return [...multiSelection];
}

export function clearMultiSelection() {
    multiSelection = [];
    window.dispatchEvent(new CustomEvent("editor:multiselect-change", { detail: multiSelection }));
}

export function groupSelected(scene) {
    const selected = multiSelection.filter(object => object?.parent && object.parent !== scene);
    if (selected.length < 2) return null;

    const group = new THREE.Group();
    group.name = uniqueGroupName(scene);
    group.userData.selectable = true;
    group.userData.editorObject = true;

    scene.add(group);
    selected.forEach(object => group.attach(object));
    setMultiSelection([group]);
    rebuildHierarchy();

    pushHistory({
        undo() {
            selected.forEach(object => scene.attach(object));
            scene.remove(group);
            setMultiSelection(selected);
            rebuildHierarchy();
        },
        redo() {
            scene.add(group);
            selected.forEach(object => group.attach(object));
            setMultiSelection([group]);
            rebuildHierarchy();
        }
    });

    return group;
}

export function ungroupSelected(scene, group) {
    if (!group || !group.isGroup) return [];

    const children = [...group.children];
    const parent = group.parent || scene;
    children.forEach(child => parent.attach(child));
    parent.remove(group);
    setMultiSelection(children);
    rebuildHierarchy();

    pushHistory({
        undo() {
            parent.add(group);
            children.forEach(child => group.attach(child));
            setMultiSelection([group]);
            rebuildHierarchy();
        },
        redo() {
            children.forEach(child => parent.attach(child));
            parent.remove(group);
            setMultiSelection(children);
            rebuildHierarchy();
        }
    });

    return children;
}

function uniqueGroupName(scene) {
    let index = 1;
    while (scene.getObjectByName(`Group ${index}`)) index++;
    return `Group ${index}`;
}
