import { createCube } from "./cube.js";
import { createSphere } from "./sphere.js";
import { createCylinder } from "./cylinder.js";
import { createCone } from "./cone.js";
import { createPlane } from "./plane.js";

const registry = new Map([
    ["cube", createCube],
    ["sphere", createSphere],
    ["cylinder", createCylinder],
    ["cone", createCone],
    ["plane", createPlane]
]);

export function createObject(type) {
    const creator = registry.get(type);
    if (!creator) return null;

    const object = creator();
    object.userData.selectable = true;
    object.userData.editorObject = true;
    object.userData.objectType = type;
    return object;
}

export function registerObjectType(type, creator) {
    if (!type || typeof creator !== "function") throw new TypeError("Object creator must be a function.");
    registry.set(type, creator);
}

export function getObjectTypes() {
    return [...registry.keys()];
}
