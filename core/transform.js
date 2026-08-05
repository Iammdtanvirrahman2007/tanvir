import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

import { pushHistory } from "./history.js";
import { updateInspector } from "../ui/inspector.js";

let transform = null;

let snapEnabled = false;

let startPosition = null;
let startRotation = null;
let startScale = null;

// ==========================================
// Setup
// ==========================================

export function setupTransform(
    camera,
    renderer,
    scene,
    orbitControls
) {

    transform = new TransformControls(
        camera,
        renderer.domElement
    );

    transform.setMode("translate");

    transform.setSize(0.9);

    // ==========================================
    // Drag Start / End
    // ==========================================

    transform.addEventListener(
        "dragging-changed",
        (event) => {

            if (orbitControls) {

                orbitControls.enabled =
                    !event.value;

            }

            const object = transform.object;

            if (!object) return;

            // Drag Start
            if (event.value) {

                startPosition =
                    object.position.clone();

                startRotation =
                    object.rotation.clone();

                startScale =
                    object.scale.clone();

            }

            // Drag End
            else {

                const endPosition =
                    object.position.clone();

                const endRotation =
                    object.rotation.clone();

                const endScale =
                    object.scale.clone();

                pushHistory({

                    undo() {

                        object.position.copy(
                            startPosition
                        );

                        object.rotation.copy(
                            startRotation
                        );

                        object.scale.copy(
                            startScale
                        );

                        updateInspector(object);

                    },

                    redo() {

                        object.position.copy(
                            endPosition
                        );

                        object.rotation.copy(
                            endRotation
                        );

                        object.scale.copy(
                            endScale
                        );

                        updateInspector(object);

                    }

                });

                updateInspector(object);

            }

        }

    );

    // ==========================================
    // Live Inspector Update
    // ==========================================

    transform.addEventListener(
        "objectChange",
        () => {

            if (!transform.object) return;

            const obj = transform.object;

            const posX =
                document.getElementById("posX");

            const posY =
                document.getElementById("posY");

            const posZ =
                document.getElementById("posZ");

            if (posX)
                posX.value =
                    obj.position.x.toFixed(2);

            if (posY)
                posY.value =
                    obj.position.y.toFixed(2);

            if (posZ)
                posZ.value =
                    obj.position.z.toFixed(2);

            const rotX =
                document.getElementById("rotX");

            const rotY =
                document.getElementById("rotY");

            const rotZ =
                document.getElementById("rotZ");

            if (rotX)
                rotX.value =
                    (obj.rotation.x * 57.2958).toFixed(1);

            if (rotY)
                rotY.value =
                    (obj.rotation.y * 57.2958).toFixed(1);

            if (rotZ)
                rotZ.value =
                    (obj.rotation.z * 57.2958).toFixed(1);

            const scaleX =
                document.getElementById("scaleX");

            const scaleY =
                document.getElementById("scaleY");

            const scaleZ =
                document.getElementById("scaleZ");

            if (scaleX)
                scaleX.value =
                    obj.scale.x.toFixed(2);

            if (scaleY)
                scaleY.value =
                    obj.scale.y.toFixed(2);

            if (scaleZ)
                scaleZ.value =
                    obj.scale.z.toFixed(2);

        }

    );

    scene.add(
        transform.getHelper()
    );

    return transform;

}

// ==========================================
// Attach
// ==========================================

export function attachTransform(object) {

    if (!transform || !object) return;

    transform.attach(object);

    updateInspector(object);

    transform.dispatchEvent({

        type: "objectChange"

    });

}

// ==========================================
// Detach
// ==========================================

export function detachTransform() {

    if (!transform) return;

    transform.detach();

}

// ==========================================
// Mode
// ==========================================

export function setTransformMode(mode) {

    if (!transform) return;

    transform.setMode(mode);

    console.log(
        "Transform Mode:",
        mode
    );

}

// ==========================================
// Snap
// ==========================================

export function toggleSnap() {

    if (!transform) return false;

    snapEnabled = !snapEnabled;

    if (snapEnabled) {

        transform.setTranslationSnap(1);

        transform.setRotationSnap(
            THREE.MathUtils.degToRad(15)
        );

        transform.setScaleSnap(0.1);

    }

    else {

        transform.setTranslationSnap(null);

        transform.setRotationSnap(null);

        transform.setScaleSnap(null);

    }

    return snapEnabled;

}

// ==========================================
// Gizmo State
// ==========================================

export function isDraggingTransform() {

    if (!transform) return false;

    return (

        transform.dragging ||

        transform.axis !== null

    );

}

// ==========================================
// Get TransformControls
// ==========================================

export function getTransform() {

    return transform;

}