import * as THREE from "three";

let cubeCount = 1;

export function createCube() {

    const geometry =
        new THREE.BoxGeometry();

    // ==========================
    // 6 Materials (One Per Face)
    // ==========================

    const materials = [];

    for (let i = 0; i < 6; i++) {

        materials.push(

            new THREE.MeshStandardMaterial({

                color: Math.random() * 0xffffff

            })

        );

    }

    const cube =
        new THREE.Mesh(

            geometry,
            materials

        );

    cube.position.set(

        (Math.random() - 0.5) * 6,

        0.5,

        (Math.random() - 0.5) * 6

    );

    cube.castShadow = true;

    cube.receiveShadow = true;

    cube.userData.selectable = true;

    cube.name =
        "Cube " + cubeCount++;

    return cube;

}