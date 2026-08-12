import * as THREE from "three";
import { createAttachmentNode, readRocketPart } from "./rocketPart.js";

export function measureRocketModel(scene) {
    if (!scene) return null;
    const box = new THREE.Box3();
    let found = false;
    scene.children.forEach(root => {
        if (root.userData?.editorOnly || !root.userData?.editorObject) return;
        root.traverse(object => {
            if (!object.isMesh || object.userData?.editorOnly) return;
            box.expandByObject(object);
            found = true;
        });
    });
    return found && !box.isEmpty() ? box : null;
}

export function buildAutoNode(scene, kind = "top") {
    const box = measureRocketModel(scene);
    if (!box) return null;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const inset = Math.max(Math.min(size.x, size.z) * 0.02, 0.01);
    const yOffset = Math.max(size.y * 0.02, 0.02);

    let spec = {
        name: "Top",
        type: "structural",
        position: [center.x, box.max.y + yOffset, center.z],
        direction: [0, 1, 0],
        compatibleCategories: ["capsule", "tank", "nose-cone", "custom"]
    };

    if (kind === "bottom") {
        spec = {
            name: "Bottom",
            type: "structural",
            position: [center.x, box.min.y - yOffset, center.z],
            direction: [0, -1, 0],
            compatibleCategories: ["tank", "engine", "decoupler", "custom"]
        };
    } else if (kind === "engine") {
        spec = {
            name: "Engine Mount",
            type: "engine",
            position: [center.x, box.min.y, center.z],
            direction: [0, -1, 0],
            compatibleCategories: ["engine"]
        };
    } else if (kind === "docking") {
        spec = {
            name: "Docking Point",
            type: "dock",
            position: [center.x, center.y, box.max.z + Math.max(inset, yOffset)],
            direction: [0, 0, 1],
            compatibleCategories: ["docking-port", "custom"]
        };
    }

    return createAttachmentNode(spec);
}

export function nodePresetKinds() {
    return [
        { id: "top", label: "Top Node" },
        { id: "bottom", label: "Bottom Node" },
        { id: "engine", label: "Engine Mount" },
        { id: "docking", label: "Docking Point" }
    ];
}

export function suggestAutoNode(scene, kind) {
    const part = readRocketPart(scene);
    const existing = part?.attachmentNodes || [];
    const prefix = buildAutoNode(scene, kind);
    if (!prefix) return null;
    let index = 1;
    let candidate = prefix;
    const names = new Set(existing.map(node => node.name));
    while (names.has(candidate.name)) {
        index += 1;
        candidate = { ...prefix, name: `${prefix.name} ${index}` };
    }
    return candidate;
}
