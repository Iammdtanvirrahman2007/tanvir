import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createControls(camera, renderer) {

    const controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;

    controls.minDistance = 2;
    controls.maxDistance = 200;

    controls.target.set(0, 0, 0);

    return controls;

}