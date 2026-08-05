import * as THREE from "three";

export function createGrid(scene) {

    const grid = new THREE.GridHelper(
        100,
        100
    );

    scene.add(grid);

    // grid টা return করো
    return grid;

}