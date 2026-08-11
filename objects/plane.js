import * as THREE from "three";

let planeCount = 1;

export function createPlane() {
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x626a78, roughness: 0.8, metalness: 0, side: THREE.DoubleSide })
    );

    plane.rotation.x = -Math.PI / 2;
    plane.castShadow = true;
    plane.receiveShadow = true;
    plane.userData.selectable = true;
    plane.userData.editorObject = true;
    plane.name = `Plane ${planeCount++}`;
    return plane;
}
