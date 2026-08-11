import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createControls(camera, renderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.2;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI * 0.99;
    controls.target.set(0, 0.5, 0);
    return controls;
}
