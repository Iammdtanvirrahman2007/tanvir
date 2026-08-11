import * as THREE from "three";
import { selectObject, clearSelection } from "./selection.js";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function enableSelection(editor) {
    if (!editor?.renderer?.domElement || !editor.camera || !editor.scene) return;
    const canvas = editor.renderer.domElement;

    canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, editor.camera);

        const hit = raycaster.intersectObjects(editor.scene.children, true).find(item => findSelectable(item.object, editor.scene));
        const target = hit ? findSelectable(hit.object, editor.scene) : null;
        if (target) {
            editor.selected = target;
            selectObject(target);
        } else {
            editor.selected = null;
            clearSelection();
        }
    });
}

function findSelectable(object, scene) {
    let current = object;
    let candidate = null;
    while (current && current !== scene) {
        if (current.userData?.selectable === true) candidate = current;
        current = current.parent;
    }
    return candidate;
}
