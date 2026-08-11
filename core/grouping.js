import * as THREE from "three";
import { pushHistory } from "./history.js";
import { rebuildHierarchy } from "../ui/hierarchy.js";

let multiSelection = [];

export function toggleMultiSelect(object) {
    if (!object) return getMultiSelection();
    const index = multiSelection.indexOf(object);
    if (index === -1) multiSelection.push(object);
    else multiSelection.splice(index, 1);
    emitMultiSelection();
    return getMultiSelection();
}

export function setMultiSelection(objects = []) {
    multiSelection = normalizeSelection(objects);
    emitMultiSelection();
    return getMultiSelection();
}

export function getMultiSelection() {
    return [...multiSelection];
}

export function clearMultiSelection() {
    multiSelection = [];
    emitMultiSelection();
}

export function groupSelected(scene) {
    if (!scene) return null;

    // Only group actual selected roots. If a parent and one of its children are
    // both selected, keep the parent and avoid reparenting the child twice.
    const selected = normalizeSelection(multiSelection)
        .filter(object => object !== scene && object.parent)
        .filter(object => !multiSelection.some(other => other !== object && other?.getObjectById?.(object.id)));

    if (selected.length < 2) return null;

    const originalParents = selected.map(object => object.parent);
    const groupParent = commonParent(selected, scene);
    const group = new THREE.Group();
    group.name = uniqueGroupName(scene);
    group.userData = {
        selectable: true,
        editorObject: true,
        editorGroup: true,
        hierarchyExpanded: true
    };

    // Add the group at the common parent's level and use attach() so every
    // selected object keeps its exact world transform.
    groupParent.add(group);
    selected.forEach(object => group.attach(object));

    setMultiSelection([group]);
    syncSelection("single", group);
    rebuildHierarchy();

    pushHistory({
        label: `Group ${group.name}`,
        undo() {
            selected.forEach(object => originalParents[selected.indexOf(object)].attach(object));
            group.remove(...group.children);
            groupParent.remove(group);
            setMultiSelection(selected);
            syncSelection("multiple", selected);
            rebuildHierarchy();
        },
        redo() {
            groupParent.add(group);
            selected.forEach(object => group.attach(object));
            setMultiSelection([group]);
            syncSelection("single", group);
            rebuildHierarchy();
        }
    });

    return group;
}

export function ungroupSelected(scene, target = null) {
    const group = resolveGroup(target, scene);
    if (!group) return [];

    const parent = group.parent || scene;
    const children = [...group.children];
    const childWorld = children.map(captureWorldTransform);

    children.forEach(child => parent.attach(child));
    parent.remove(group);

    setMultiSelection(children);
    syncSelection("multiple", children);
    rebuildHierarchy();

    pushHistory({
        label: `Ungroup ${group.name || "Group"}`,
        undo() {
            parent.add(group);
            children.forEach((child, index) => {
                group.attach(child);
                applyWorldTransform(child, childWorld[index]);
            });
            setMultiSelection([group]);
            syncSelection("single", group);
            rebuildHierarchy();
        },
        redo() {
            children.forEach(child => parent.attach(child));
            parent.remove(group);
            setMultiSelection(children);
            syncSelection("multiple", children);
            rebuildHierarchy();
        }
    });

    return children;
}

function resolveGroup(target, scene) {
    if (target?.isGroup && target.userData?.editorGroup) return target;
    if (Array.isArray(target)) return target.find(object => object?.isGroup && object.userData?.editorGroup) || null;
    const selected = getMultiSelection();
    return selected.find(object => object?.isGroup && object.userData?.editorGroup) || null;
}

function normalizeSelection(objects) {
    const unique = [...new Set((objects || []).filter(object => object && object.userData?.editorObject && !object.userData?.editorOnly))];
    return unique.filter(object => !unique.some(other => other !== object && other?.getObjectById?.(object.id)));
}

function commonParent(objects, fallback) {
    if (!objects.length) return fallback;
    let parent = objects[0].parent || fallback;
    while (parent && parent !== fallback) {
        if (objects.every(object => object.parent === parent)) return parent;
        parent = parent.parent;
    }
    return fallback;
}

function captureWorldTransform(object) {
    object.updateMatrixWorld(true);
    return {
        position: object.getWorldPosition(new THREE.Vector3()),
        quaternion: object.getWorldQuaternion(new THREE.Quaternion()),
        scale: object.getWorldScale(new THREE.Vector3())
    };
}

function applyWorldTransform(object, transform) {
    const parent = object.parent;
    if (!parent) return;
    parent.updateMatrixWorld(true);
    object.position.copy(parent.worldToLocal(transform.position.clone()));
    const parentQuaternion = parent.getWorldQuaternion(new THREE.Quaternion());
    object.quaternion.copy(parentQuaternion.invert().multiply(transform.quaternion));
    const parentScale = parent.getWorldScale(new THREE.Vector3());
    object.scale.set(
        parentScale.x ? transform.scale.x / parentScale.x : transform.scale.x,
        parentScale.y ? transform.scale.y / parentScale.y : transform.scale.y,
        parentScale.z ? transform.scale.z / parentScale.z : transform.scale.z
    );
    object.updateMatrixWorld(true);
}

function syncSelection(mode, objects) {
    window.dispatchEvent(new CustomEvent("editor:group-selection-sync", {
        detail: { mode, objects: [...objects] }
    }));
}

function emitMultiSelection() {
    window.dispatchEvent(new CustomEvent("editor:multiselect-change", { detail: getMultiSelection() }));
}

function uniqueGroupName(scene) {
    let index = 1;
    while (scene.getObjectByName(`Group ${index}`)) index++;
    return `Group ${index}`;
}
