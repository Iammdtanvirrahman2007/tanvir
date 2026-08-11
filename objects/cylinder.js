import * as THREE from "three";

let cylinderCount = 1;

export function createCylinder() {
    const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 2, 32),
        new THREE.MeshStandardMaterial({ color: 0x78869a, roughness: 0.6, metalness: 0.12 })
    );

    cylinder.position.set(0, 1, 0);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    cylinder.userData.selectable = true;
    cylinder.userData.editorObject = true;
    cylinder.name = `Cylinder ${cylinderCount++}`;
    return cylinder;
}
