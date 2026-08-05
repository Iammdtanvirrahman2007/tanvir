import * as THREE from "three";

export function createLights(scene) {

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(
        0xffffff,
        1
    );

    scene.add(ambientLight);

    // Directional Light (Sun)
    const sunLight = new THREE.DirectionalLight(
        0xffffff,
        2
    );

    sunLight.position.set(10, 20, 10);

    sunLight.castShadow = true;

    scene.add(sunLight);

    return {

        ambientLight,

        sunLight

    };

}