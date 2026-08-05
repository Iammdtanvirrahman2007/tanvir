import * as THREE from "three";

import { getSelected } from "./selection.js";
import { addObject } from "./objectManager.js";
import { addToHierarchy } from "../ui/hierarchy.js";

export function setupDuplicate(scene) {

    window.addEventListener(
        "keydown",
        (event) => {

            if (!(event.ctrlKey && event.key.toLowerCase() === "d")) {

                return;

            }

            event.preventDefault();

            const selected = getSelected();

            if (!selected) return;

            const copy = selected.clone();

            // Material clone
            if (selected.material) {

                copy.material =
                    selected.material.clone();

            }

            // Geometry clone
            if (selected.geometry) {

                copy.geometry =
                    selected.geometry.clone();

            }

            copy.position.x += 1;

            copy.name =
                selected.name + " Copy";

            copy.userData.selectable = true;

            addObject(scene, copy);

            addToHierarchy(copy);

            console.log(
                "Duplicated:",
                copy.name
            );

        }

    );

}