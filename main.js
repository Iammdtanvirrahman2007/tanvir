import { setupUpload } from "./core/upload.js";

import { saveScene } from "./core/save.js";
import { loadScene } from "./core/load.js";

import {
    setupExporter
} from "./core/exporter.js";

import {
    setupImporter
} from "./core/importer.js";

import {
    setupCopyPaste
} from "./core/copyPaste.js";

import {
    setupDuplicate
} from "./core/duplicate.js";

import {
    toggleSnap,
    setupTransform,
    setTransformMode
} from "./core/transform.js";

import {
    undo,
    redo,
    pushHistory
} from "./core/history.js";

import {
    initScene,
    scene,
    renderer,
    camera,
    controls
} from "./core/scene.js";

import {
    setupDelete
} from "./core/delete.js";

import {
    setupSelection,
    clearSelection,
    getSelected
} from "./core/selection.js";

import {
    addObject
} from "./core/objectManager.js";

import {
    addToHierarchy,
    removeFromHierarchy
} from "./ui/hierarchy.js";

import {
    createObject
} from "./objects/factory.js";

import {
    groupSelected,
    ungroupSelected
} from "./core/grouping.js";

// ==========================================
// Initialize
// ==========================================

initScene();

setupSelection(
    renderer,
    camera,
    scene
);

setupTransform(
    camera,
    renderer,
    scene,
    controls
);

// ==========================================
// Systems
// ==========================================

setupDelete(scene);
setupDuplicate(scene);
setupCopyPaste(scene);
setupImporter(scene);
setupExporter(scene);
setupUpload(scene);

// ==========================================
// Add Object
// ==========================================

function add(type) {

    const object = createObject(type);

    if (!object) return;

    addObject(scene, object);

    addToHierarchy(object);

    pushHistory({

        undo() {

            scene.remove(object);

            removeFromHierarchy(object);

        },

        redo() {

            scene.add(object);

            addToHierarchy(object);

        }

    });

}

// ==========================================
// Shape Buttons
// ==========================================

document
    .getElementById("cubeBtn")
    .onclick = () => add("cube");

document
    .getElementById("sphereBtn")
    .onclick = () => add("sphere");

document
    .getElementById("cylinderBtn")
    .onclick = () => add("cylinder");

document
    .getElementById("coneBtn")
    .onclick = () => add("cone");

document
    .getElementById("planeBtn")
    .onclick = () => add("plane");

// ==========================================
// Transform Buttons
// ==========================================

document
    .getElementById("moveBtn")
    .onclick = () => {

        setTransformMode("translate");

    };

document
    .getElementById("rotateBtn")
    .onclick = () => {

        setTransformMode("rotate");

    };

document
    .getElementById("scaleBtn")
    .onclick = () => {

        setTransformMode("scale");

    };

// ==========================================
// Snap
// ==========================================

document
    .getElementById("snapBtn")
    .onclick = () => {

        const enabled = toggleSnap();

        document
            .getElementById("snapBtn")
            .textContent = enabled
                ? "Snap On"
                : "Snap Off";

    };

// ==========================================
// Group
// ==========================================

const groupBtn =
    document.getElementById("groupBtn");

if (groupBtn) {

    groupBtn.onclick = () => {

        const group =
            groupSelected(scene);

        if (group) {

            addToHierarchy(group);

        }

    };

}

// ==========================================
// Ungroup
// ==========================================

const ungroupBtn =
    document.getElementById("ungroupBtn");

if (ungroupBtn) {

    ungroupBtn.onclick = () => {

        const selected =
            getSelected();

        ungroupSelected(
            scene,
            selected
        );

    };

}

// ==========================================
// Keyboard
// ==========================================

window.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key === "z"
        ) {

            event.preventDefault();

            undo();

        }

        if (
            event.ctrlKey &&
            event.key === "y"
        ) {

            event.preventDefault();

            redo();

        }

    }
);

// ==========================================
// Save
// ==========================================

document
    .getElementById("saveBtn")
    .onclick = () => {

        saveScene(scene);

    };

// ==========================================
// Load
// ==========================================

document
    .getElementById("newBtn")
    .onclick = () => {

        clearSelection();

        document
            .getElementById("sceneTree")
            .innerHTML = "";

        loadScene(scene);

        setTimeout(() => {

            clearSelection();

        }, 50);

    };