import { createCube } from "./cube.js";
import { createSphere } from "./sphere.js";
import { createCylinder } from "./cylinder.js";
import { createCone } from "./cone.js";
import { createPlane } from "./plane.js";

export function createObject(type) {

    let obj = null;

    switch (type) {

        case "cube":
            obj = createCube();
            break;

        case "sphere":
            obj = createSphere();
            break;

        case "cylinder":
            obj = createCylinder();
            break;

        case "cone":
            obj = createCone();
            break;

        case "plane":
            obj = createPlane();
            break;

        default:
            return null;

    }

    // ✅ সব shape selectable হবে
    obj.userData.selectable = true;

    return obj;

}