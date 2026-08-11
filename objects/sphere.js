import * as THREE from "three";

let sphereCount = 1;

export function createSphere() {
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 20),
        new THREE.MeshStandardMaterial({ color: 0x8792a5, roughness: 0.58, metalness: 0.1 })
    );

    sphere.position.set(0, 0.5, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData.selectable = true;
    sphere.userData.editorObject = true;
    sphere.name = `Sphere ${sphereCount++}`;
    return sphere;
}
