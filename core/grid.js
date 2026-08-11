import * as THREE from "three";

export function createGrid(scene) {
    const grid = new THREE.GridHelper(100, 100, 0x3a3d45, 0x23262d);
    grid.name = "Viewport Grid";
    grid.userData.editorOnly = true;
    grid.userData.selectable = false;
    scene.add(grid);
    return grid;
}
