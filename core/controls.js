import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createControls(camera, renderer) {
    const controls = new OrbitControls(camera, renderer.domElement);
    const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    controls.enableDamping = true;
    controls.dampingFactor = coarsePointer ? 0.095 : 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.rotateSpeed = coarsePointer ? 0.62 : 0.75;
    controls.zoomSpeed = coarsePointer ? 0.85 : 1.1;
    controls.panSpeed = coarsePointer ? 0.68 : 0.8;
    controls.minDistance = 0.2;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI * 0.99;
    controls.target.set(0, 0.5, 0);

    // Keep the browser from interpreting viewport gestures as page scrolling.
    renderer.domElement.style.touchAction = "none";
    controls.update();
    return controls;
}
