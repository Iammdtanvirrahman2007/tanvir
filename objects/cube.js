import * as THREE from "three";

let cubeCount = 1;

export function createCube() {
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x7b8494, roughness: 0.62, metalness: 0.08 })
    );

    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.selectable = true;
    cube.userData.editorObject = true;
    cube.name = `Cube ${cubeCount++}`;
    return cube;
}
