import * as THREE from "three";

let sphereCount = 1;

export function createSphere() {

    const geometry =
        new THREE.SphereGeometry(
            0.5,
            32,
            32
        );

    const material =
        new THREE.MeshStandardMaterial({

            color: Math.random() * 0xffffff

        });

    const sphere =
        new THREE.Mesh(

            geometry,
            material

        );

    sphere.position.set(

        (Math.random() - 0.5) * 8,

        0.5,

        (Math.random() - 0.5) * 8

    );

    sphere.castShadow = true;

    sphere.receiveShadow = true;

    sphere.userData.selectable = true;

    sphere.name =
        "Sphere " + sphereCount++;

    return sphere;

}