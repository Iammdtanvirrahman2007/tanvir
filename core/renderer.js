import * as THREE from "three";

export function createRenderer() {

    const renderer = new THREE.WebGLRenderer({

        antialias: true

    });

    renderer.setPixelRatio(

        window.devicePixelRatio

    );

    renderer.shadowMap.enabled = true;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    // ✅ Add this
    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    // Optional (looks better)
    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1;

    // ==========================
    // Viewport Size
    // ==========================

    const app =
        document.getElementById("app");

    renderer.setSize(

        app.clientWidth,

        app.clientHeight

    );

    renderer.domElement.style.width = "100%";

    renderer.domElement.style.height = "100%";

    renderer.domElement.style.display = "block";

    return renderer;

}