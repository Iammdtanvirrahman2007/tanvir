import * as THREE from "three";

let planeCount = 1;

export function createPlane() {

    const geometry =
        new THREE.PlaneGeometry(
            5,
            5,
            1,
            1
        );

    const material =
        new THREE.MeshStandardMaterial({

            color: 0x777777,

            side: THREE.DoubleSide

        });

    const plane =
        new THREE.Mesh(

            geometry,
            material

        );

    plane.rotation.x =
        -Math.PI / 2;

    plane.castShadow = true;

    plane.receiveShadow = true;

    plane.userData.selectable = true;

    plane.name =
        "Plane " + planeCount++;

    return plane;

}