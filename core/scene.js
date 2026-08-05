import * as THREE from "three";

import { createCamera } from "./camera.js";
import { createRenderer } from "./renderer.js";
import { createControls } from "./controls.js";
import { createLights } from "./lights.js";
import { createGrid } from "./grid.js";

// Export variables
export let controls;
export let scene;
export let camera;
export let renderer;

export function initScene(editor = {}) {

    // ==========================
    // Scene
    // ==========================

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x20242b);

    // ==========================
    // Camera
    // ==========================

    camera = createCamera();

    // ==========================
    // Renderer
    // ==========================

    renderer = createRenderer();

    const app =
        document.getElementById("app");

    app.appendChild(
        renderer.domElement
    );

    // ==========================
    // Controls
    // ==========================

    controls = createControls(
        camera,
        renderer
    );

    // ==========================
    // Editor Connection
    // ==========================

    if (editor) {

        editor.scene = scene;
        editor.camera = camera;
        editor.renderer = renderer;
        editor.controls = controls;

    }

    // ==========================
    // Lights
    // ==========================

    createLights(scene);

    // ==========================
    // Grid
    // ==========================

    const grid =
        createGrid(scene);

    grid.userData.selectable = false;

    // ==========================
    // Default Cube
    // ==========================

    const cube = new THREE.Mesh(

        new THREE.BoxGeometry(),

        new THREE.MeshStandardMaterial({

            color: 0x3b82f6

        })

    );

    cube.position.set(0, 0.5, 0);

    cube.name = "Cube";

    cube.userData.selectable = true;

    scene.add(cube);

    // ==========================
    // Initial Size
    // ==========================

    camera.aspect =
        app.clientWidth / app.clientHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(

        app.clientWidth,

        app.clientHeight

    );

    // ==========================
    // Animation
    // ==========================

    function animate() {

        requestAnimationFrame(
            animate
        );

        controls.update();

        renderer.render(
            scene,
            camera
        );

    }

    animate();

    // ==========================
    // Resize
    // ==========================

    window.addEventListener(
        "resize",
        () => {

            const width =
                app.clientWidth;

            const height =
                app.clientHeight;

            camera.aspect =
                width / height;

            camera.updateProjectionMatrix();

            renderer.setSize(
                width,
                height
            );

        }
    );

}