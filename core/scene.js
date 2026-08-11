import * as THREE from "three";
import { createCamera } from "./camera.js?v=20260811-runtime-fix";
import { createRenderer } from "./renderer.js?v=20260811-runtime-fix";
import { createControls } from "./controls.js?v=20260811-runtime-fix";
import { createLights } from "./lights.js?v=20260811-runtime-fix";
import { createGrid } from "./grid.js?v=20260811-runtime-fix";
import { addObject } from "./objectManager.js?v=20260811-runtime-fix";

export let controls;
export let scene;
export let camera;
export let renderer;
export let grid;
export let lights;

let resizeObserver = null;
let animationFrame = 0;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
let fps = 0;

export function initScene(editor = null) {
    const app = document.getElementById("app");
    if (!app) throw new Error("ModelForge: #app viewport is missing.");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101114);

    camera = createCamera();
    renderer = createRenderer();
    if (!renderer) throw new Error("ModelForge: renderer initialization failed.");
    renderer.targetPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    app.replaceChildren(renderer.domElement);

    controls = createControls(camera, renderer);
    controls.target.set(0, 0.5, 0);
    controls.update();

    lights = createLights(scene);
    grid = createGrid(scene);
    grid.userData.selectable = false;
    grid.userData.editorOnly = true;

    if (editor) {
        editor.scene = scene;
        editor.camera = camera;
        editor.renderer = renderer;
        editor.controls = controls;
    }

    resizeRenderer();
    startRenderLoop();
    setupResizeObserver(app);

    return { scene, camera, renderer, controls, grid, lights };
}

export function createDefaultCube() {
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({
            color: 0x6b7280,
            roughness: 0.65,
            metalness: 0.05
        })
    );

    cube.name = "Cube";
    cube.position.set(0, 0.5, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.selectable = true;
    cube.userData.editorObject = true;

    addObject(scene, cube);
    return cube;
}

export function resizeRenderer() {
    if (!renderer || !camera) return;
    const app = document.getElementById("app");
    if (!app) return;

    const width = Math.max(1, app.clientWidth);
    const height = Math.max(1, app.clientHeight);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const targetRatio = renderer.targetPixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(targetRatio);
    renderer.setSize(width, height, false);
}

export function setRenderPixelRatio(ratio) {
    if (!renderer || !Number.isFinite(ratio) || ratio <= 0) return;
    renderer.targetPixelRatio = ratio;
    resizeRenderer();
}

export function resetCamera() {
    if (!camera || !controls) return;
    camera.position.set(5, 4.5, 5);
    controls.target.set(0, 0.5, 0);
    controls.update();
}

export function getFPS() {
    return fps;
}

function setupResizeObserver(app) {
    if (resizeObserver) resizeObserver.disconnect();

    if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resizeRenderer);
        resizeObserver.observe(app);
    } else {
        window.addEventListener("resize", resizeRenderer);
    }
}

function startRenderLoop() {
    cancelAnimationFrame(animationFrame);
    fpsWindowStart = performance.now();
    fpsFrameCount = 0;

    const animate = now => {
        animationFrame = requestAnimationFrame(animate);
        controls?.update();
        renderer?.render(scene, camera);

        fpsFrameCount += 1;
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 750) {
            fps = Math.round((fpsFrameCount * 1000) / elapsed);
            fpsWindowStart = now;
            fpsFrameCount = 0;
            window.dispatchEvent(new CustomEvent("editor:frame", { detail: { fps } }));
        }
    };

    animationFrame = requestAnimationFrame(animate);
}
