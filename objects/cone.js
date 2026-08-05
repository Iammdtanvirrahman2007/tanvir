import * as THREE from "three";

let coneCount = 1;

export function createCone() {

    const geometry =
        new THREE.ConeGeometry(
            0.5,
            1.5,
            32
        );

    // ==========================
    // Materials
    // ==========================

    const materials = [

        new THREE.MeshStandardMaterial({

            color: Math.random() * 0xffffff

        }),

        new THREE.MeshStandardMaterial({

            color: Math.random() * 0xffffff

        }),

        new THREE.MeshStandardMaterial({

            color: Math.random() * 0xffffff

        })

    ];

    const cone =
        new THREE.Mesh(

            geometry,
            materials

        );

    cone.position.set(

        (Math.random() - 0.5) * 8,

        0.75,

        (Math.random() - 0.5) * 8

    );

    cone.castShadow = true;

    cone.receiveShadow = true;

    cone.userData.selectable = true;

    cone.name =
        "Cone " + coneCount++;

    return cone;

}