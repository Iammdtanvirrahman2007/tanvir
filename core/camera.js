import * as THREE from "three";

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2000);
    camera.position.set(5.5, 4.5, 5.5);
    camera.lookAt(0, 0.5, 0);
    return camera;
}
