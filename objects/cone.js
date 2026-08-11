import * as THREE from "three";

let coneCount = 1;

export function createCone() {
    const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.5, 32),
        new THREE.MeshStandardMaterial({ color: 0x8a94a5, roughness: 0.58, metalness: 0.08 })
    );

    cone.position.set(0, 0.75, 0);
    cone.castShadow = true;
    cone.receiveShadow = true;
    cone.userData.selectable = true;
    cone.userData.editorObject = true;
    cone.name = `Cone ${coneCount++}`;
    return cone;
}
