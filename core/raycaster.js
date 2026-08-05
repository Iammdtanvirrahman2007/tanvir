import * as THREE from "three";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function enableSelection(editor) {

    const canvas = editor.renderer.domElement;

    canvas.addEventListener("pointerdown", (event) => {

        const rect = canvas.getBoundingClientRect();

        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, editor.camera);

        const hits = raycaster.intersectObjects(editor.scene.children, true);

        if (hits.length > 0) {

            editor.selected = hits[0].object;

            console.log("Selected:", editor.selected.name);

        }

    });

}