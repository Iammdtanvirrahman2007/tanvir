import * as THREE from "three";

export function createLights(scene) {
    const ambientLight = new THREE.HemisphereLight(0xb8c2d4, 0x252830, 1.15);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(8, 12, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.0002;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x8fa6c9, 0.45);
    fillLight.position.set(-8, 5, -10);
    scene.add(fillLight);

    return { ambientLight, sunLight, fillLight };
}
