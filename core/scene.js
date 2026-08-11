import * as THREE from "three";
import { createCamera } from "./camera.js";
import { createRenderer } from "./renderer.js";
import { createControls } from "./controls.js";
import { createLights } from "./lights.js";
import { createGrid } from "./grid.js";
import { addObject } from "./objectManager.js";

export let controls;
export let scene;
export let camera;
export let renderer;
export let grid;
export let lights;

let resizeObserver = null;
let animationFrame = 0;
let lastFrame = performance.now();
let fps = 0;

export function initScene(editor = null) {
    const app = document.getElementById("app");
    if (!app) throw new Error("ModelForge: #app viewport is missing.");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101114);

    camera = createCamera();
    renderer = createRenderer();
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
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

    const animate = now => {
        animationFrame = requestAnimationFrame(animate);
        controls?.update();
        renderer?.render(scene, camera);

        const delta = now - lastFrame;
        if (delta >= 500) {
            fps = Math.round(1000 / Math.max(delta / 2, 1));
            lastFrame = now;
            window.dispatchEvent(new CustomEvent("editor:frame", { detail: { fps } }));
        }
    };

    animationFrame = requestAnimationFrame(animate);
}
