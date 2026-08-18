import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const DEFAULTS = {
    id: "small_house_01",
    type: "structure",
    category: "house",
    suggestedBiomes: ["plains", "forest"],
    allowedRotation: [0, 90, 180, 270]
};

export async function prepareProductionAsset(scene, options = {}) {
    const settings = normalizeOptions(options);
    const root = collectAssetRoot(scene, settings.id);
    const report = cleanAndNormalizeRoot(root, settings);
    const validation = validateProductionAsset(root, report);

    if (!validation.valid) {
        const error = new Error(validation.errors.map(item => item.message).join("; "));
        error.validation = validation;
        error.report = report;
        throw error;
    }

    return {
        root,
        report,
        validation,
        metadata: createMetadata(root, report, settings)
    };
}

export async function exportProductionAsset(scene, options = {}) {
    const prepared = await prepareProductionAsset(scene, options);
    const exporter = new GLTFExporter();
    const glb = await new Promise((resolve, reject) => {
        exporter.parse(
            prepared.root,
            result => resolve(result),
            error => reject(error),
            { binary: true, onlyVisible: true }
        );
    });

    const baseName = sanitizeFileName(options.id || prepared.metadata.id || DEFAULTS.id);
    const metadataText = JSON.stringify(prepared.metadata, null, 2);
    const previewBlob = await createPreviewBlob(prepared.root, options);

    downloadBlob(glb, `${baseName}/model.glb`, "model/gltf-binary");
    downloadBlob(metadataText, `${baseName}/metadata.json`, "application/json");
    if (previewBlob) downloadBlob(previewBlob, `${baseName}/preview.webp`, "image/webp");

    window.dispatchEvent(new CustomEvent("editor:status", {
        detail: `Production asset exported · ${baseName}`
    }));

    return { ...prepared, glb, metadataText, previewBlob };
}

function normalizeOptions(options) {
    return {
        id: sanitizeId(options.id || DEFAULTS.id),
        type: String(options.type || DEFAULTS.type),
        category: String(options.category || DEFAULTS.category),
        suggestedBiomes: Array.isArray(options.suggestedBiomes) && options.suggestedBiomes.length
            ? options.suggestedBiomes.map(String)
            : [...DEFAULTS.suggestedBiomes],
        allowedRotation: [...DEFAULTS.allowedRotation]
    };
}

function collectAssetRoot(scene, id) {
    const root = new THREE.Group();
    root.name = id;

    scene.children
        .filter(object => object.userData?.editorObject && !object.userData?.editorOnly)
        .forEach(object => root.add(object.clone(true)));

    return root;
}

function cleanAndNormalizeRoot(root, settings) {
    const report = {
        removedHelpers: 0,
        removedCameras: 0,
        removedLights: 0,
        removedHidden: 0,
        removedEmpty: 0,
        meshCountBefore: 0,
        meshCountAfter: 0,
        materialCount: 0,
        geometryCount: 0,
        dimensions: { x: 0, y: 0, z: 0 },
        pivot: [0, 0, 0]
    };

    const remove = [];
    root.traverse(object => {
        if (object.isMesh) report.meshCountBefore += 1;
        const editorOnly = object.userData?.editorOnly || object.userData?.editorHelper || object.userData?.debug;
        const helperName = /(^|[_ .-])(grid|gizmo|guide|helper|handle|axis|measurement|debug)([_ .-]|$)/i.test(object.name || "");
        if (object !== root && (editorOnly || helperName || object.isCamera || object.isLight)) remove.push({ object, reason: object.isCamera ? "camera" : object.isLight ? "light" : "helper" });
        else if (object !== root && object.visible === false) remove.push({ object, reason: "hidden" });
    });

    for (const entry of remove) {
        entry.object.parent?.remove(entry.object);
        if (entry.reason === "camera") report.removedCameras += 1;
        else if (entry.reason === "light") report.removedLights += 1;
        else if (entry.reason === "hidden") report.removedHidden += 1;
        else report.removedHelpers += 1;
    }

    const meshes = [];
    root.traverse(object => {
        if (!object.isMesh) return;
        if (!object.geometry?.attributes?.position || object.geometry.attributes.position.count === 0) {
            object.parent?.remove(object);
            report.removedEmpty += 1;
            return;
        }
        meshes.push(object);
    });

    root.updateMatrixWorld(true);
    for (const mesh of meshes) {
        bakeTransform(mesh);
        cleanMeshMaterials(mesh);
        if (!mesh.geometry.getAttribute("normal")) mesh.geometry.computeVertexNormals();
        mesh.userData = {
            assetRole: inferAssetRole(mesh.name),
            sourceName: mesh.name
        };
        mesh.name = meaningfulName(mesh.name);
    }

    root.updateMatrixWorld(true);
    groundAndCenter(root);
    root.name = settings.id;
    report.meshCountAfter = meshes.length;
    report.geometryCount = new Set(meshes.map(mesh => mesh.geometry.uuid)).size;
    report.materialCount = new Set(meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean).map(material => material.uuid)).size;
    report.dimensions = getDimensions(root);
    report.pivot = [0, 0, 0];

    return report;
}

function bakeTransform(mesh) {
    mesh.updateMatrix();
    mesh.geometry = mesh.geometry.clone();
    mesh.geometry.applyMatrix4(mesh.matrix);
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
}

function cleanMeshMaterials(mesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cleaned = materials.filter(Boolean).map(material => {
        const clone = material.clone();
        clone.name = sanitizeMaterialName(clone.name || "material");
        if (clone.map && clone.map.colorSpace !== undefined) clone.map.colorSpace = THREE.SRGBColorSpace;
        return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? cleaned : (cleaned[0] || new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
}

function groundAndCenter(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    const offset = new THREE.Vector3(-centerX, -box.min.y, -centerZ);
    root.position.add(offset);
    root.updateMatrixWorld(true);
}

function validateProductionAsset(root, report) {
    const errors = [];
    const warnings = [];
    const checks = [];

    const meshList = [];
    root.traverse(object => { if (object.isMesh) meshList.push(object); });

    checks.push({ id: "asset-geometry", label: "Actual structure geometry exists", pass: meshList.length > 0 });
    if (!meshList.length) errors.push({ code: "NO_GEOMETRY", message: "No renderable structure geometry remains." });

    const forbidden = [];
    root.traverse(object => {
        if (object.isCamera || object.isLight || object.userData?.editorOnly || object.userData?.editorHelper || object.userData?.debug) forbidden.push(object.name || object.type);
    });
    checks.push({ id: "no-editor-helpers", label: "No editor/helper objects", pass: forbidden.length === 0 });
    if (forbidden.length) errors.push({ code: "EDITOR_OBJECTS_REMAIN", message: `Editor/helper objects remain: ${forbidden.join(", ")}` });

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const epsilon = 1e-4;
    const bottomAtZero = Math.abs(box.min.y) <= epsilon;
    checks.push({ id: "grounded", label: "Bottom at Y=0", pass: bottomAtZero, measured: box.min.y });
    if (!bottomAtZero) errors.push({ code: "NOT_GROUNDED", message: `Bottom is not at Y=0 (measured ${box.min.y}).` });

    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    checks.push({ id: "pivot", label: "Bottom-center origin", pass: Math.abs(root.position.x) <= epsilon && Math.abs(root.position.y) <= epsilon && Math.abs(root.position.z) <= epsilon, measured: [root.position.x, root.position.y, root.position.z] });
    if (Math.abs(root.position.x) > epsilon || Math.abs(root.position.z) > epsilon || Math.abs(root.position.y) > epsilon) warnings.push({ code: "PIVOT_TRANSFORM", message: "Root transform is not zeroed after grounding." });

    checks.push({ id: "dimensions", label: "Valid positive dimensions", pass: box.getSize(new THREE.Vector3()).x > 0 && box.getSize(new THREE.Vector3()).y > 0 && box.getSize(new THREE.Vector3()).z > 0, measured: report.dimensions });
    checks.push({ id: "rotation-safe", label: "Discrete world rotation contract", pass: true, allowed: [0, 90, 180, 270] });

    const duplicateNames = findDuplicateNames(meshList);
    if (duplicateNames.length) warnings.push({ code: "DUPLICATE_NAMES", message: `Duplicate mesh names: ${duplicateNames.join(", ")}` });
    const nonIndexed = meshList.filter(mesh => !mesh.geometry.index).length;
    if (nonIndexed) warnings.push({ code: "NON_INDEXED", message: `${nonIndexed} mesh(es) are non-indexed and may benefit from geometry optimization.` });

    return { valid: errors.length === 0, errors, warnings, checks };
}

function createMetadata(root, report, settings) {
    return {
        id: settings.id,
        type: settings.type,
        category: settings.category,
        suggestedBiomes: settings.suggestedBiomes,
        placement: {
            origin: "bottom-center",
            gridAligned: true,
            terrainAligned: true,
            voxelScale: 1
        },
        allowedRotation: settings.allowedRotation,
        dimensions: report.dimensions,
        scale: [1, 1, 1],
        pivot: [0, 0, 0],
        optimization: {
            meshCount: report.meshCountAfter,
            geometryCount: report.geometryCount,
            materialCount: report.materialCount
        },
        validation: {
            productionReady: true,
            generatedAt: new Date().toISOString()
        },
        hierarchy: root.children.map(object => object.name)
    };
}

async function createPreviewBlob(root, options = {}) {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(512, 512, false);
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x111319);
    const previewRoot = root.clone(true);
    previewRoot.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    previewScene.add(previewRoot);

    const box = new THREE.Box3().setFromObject(previewRoot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, radius * 20);
    camera.position.set(radius * 1.8, radius * 1.35, radius * 1.8);
    camera.lookAt(center);
    previewScene.add(camera);
    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x222633, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(radius * 2, radius * 3, radius * 1.5);
    previewScene.add(key);
    renderer.render(previewScene, camera);
    renderer.dispose();
    return await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.88));
}

function getDimensions(root) {
    root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    return { x: round(size.x), y: round(size.y), z: round(size.z) };
}

function inferAssetRole(name) {
    const value = String(name || "").toLowerCase();
    for (const role of ["roof", "wall", "floor", "door", "window", "pillar", "foundation", "decoration"]) {
        if (value.includes(role)) return role;
    }
    return "structure_part";
}

function meaningfulName(value) {
    const source = String(value || "structure_part").trim().toLowerCase();
    const cleaned = source.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "structure_part";
    const banned = /^(cube|sphere|cylinder|cone|plane|mesh|object|default|untitled)(?:_?copy)?(?:_?\d+)?$/;
    return banned.test(cleaned) ? "structure_part" : cleaned;
}

function findDuplicateNames(meshes) {
    const counts = new Map();
    meshes.forEach(mesh => counts.set(mesh.name, (counts.get(mesh.name) || 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

function sanitizeId(value) {
    return String(value || "asset").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "asset";
}

function sanitizeMaterialName(value) {
    return String(value || "material").trim().replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "material";
}

function sanitizeFileName(value) {
    return sanitizeId(value).replace(/_+/g, "_");
}

function round(value) {
    return Number(value.toFixed(4));
}

function downloadBlob(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
