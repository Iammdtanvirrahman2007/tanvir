import * as THREE from "three";

let cylinderCount = 1;

export function createCylinder() {

    const geometry =
        new THREE.CylinderGeometry(
            0.5,
            0.5,
            2,
            32
        );

    // ==========================
    // Top, Side, Bottom
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

    const cylinder =
        new THREE.Mesh(

            geometry,
            materials

        );

    cylinder.position.set(

        (Math.random() - 0.5) * 8,

        1,

        (Math.random() - 0.5) * 8

    );

    cylinder.castShadow = true;

    cylinder.receiveShadow = true;

    cylinder.userData.selectable = true;

    cylinder.name =
        "Cylinder " + cylinderCount++;

    return cylinder;

}