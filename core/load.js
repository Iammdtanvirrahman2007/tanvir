import * as THREE from "three";
import { addObject, clearObjects } from "./objectManager.js";
import { rebuildHierarchy } from "../ui/hierarchy.js";

const ACCEPT = ".rkp,.json,.obj,.gltf,.glb,.stl,.fbx,.dae,.3ds,.ply,.csv,.txt,application/json,model/gltf+json,model/gltf-binary,text/plain";

export function loadScene(scene) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) openProjectFile(scene, file);
        input.value = "";
    }, { once: true });
    input.click();
}

export async function openProjectFile(scene, file) {
    if (!file) return false;
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
        if (ext === "rkp" || ext === "json") return await openJSONProject(scene, file);
        if (ext === "obj") return await openLoader(scene, file, "OBJLoader");
        if (ext === "gltf" || ext === "glb") return await openGLTF(scene, file);
        if (ext === "stl") return await openLoader(scene, file, "STLLoader");
        if (ext === "fbx") return await openLoader(scene, file, "FBXLoader");
        if (ext === "dae") return await openLoader(scene, file, "ColladaLoader");
        if (ext === "3ds") return await openLoader(scene, file, "TDSLoader");
        if (ext === "ply") return await openLoader(scene, file, "PLYLoader");
        throw new Error(`Unsupported file type: .${ext}`);
    } catch (error) {
        console.error("Import failed:", error);
        window.dispatchEvent(new CustomEvent("editor:status", { detail: `Import failed: ${file.name}` }));
        return false;
    }
}

async function openJSONProject(scene, file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const roots = Array.isArray(parsed) ? parsed : parsed.objects;
    if (!Array.isArray(roots)) throw new Error("Invalid ModelForge project.");
    clearObjects(scene);
    roots.forEach(data => restoreObject(scene, scene, data));
    rebuildHierarchy();
    announce(file, parsed.format || "JSON", roots.length);
    return true;
}

async function openGLTF(scene, file) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const buffer = await file.arrayBuffer();
    const result = await new Promise((resolve, reject) => loader.parse(buffer, "", resolve, reject));
    return addImportedRoot(scene, result.scene, file, "glTF");
}

async function openLoader(scene, file, loaderName) {
    const module = await import(`three/addons/loaders/${loaderName}.js`);
    const Loader = module[loaderName];
    if (!Loader) throw new Error(`${loaderName} unavailable`);
    const loader = new Loader();
    const source = loaderName === "STLLoader" || loaderName === "PLYLoader" ? await file.arrayBuffer() : await file.text();
    const parsed = loader.parse(source);
    const root = parsed.isObject3D ? parsed : new THREE.Mesh(parsed, new THREE.MeshStandardMaterial({ color: 0xb7c0ca, roughness: 0.6 }));
    return addImportedRoot(scene, root, file, loaderName.replace("Loader", ""));
}

function addImportedRoot(scene, root, file, format) {
    clearObjects(scene);
    root.name = file.name.replace(/\.[^.]+$/, "") || "Imported Model";
    root.userData.editorObject = true;
    root.traverse(object => {
        if (object.isMesh) { object.userData.editorObject = true; object.castShadow = true; object.receiveShadow = true; }
    });
    scene.add(root);
    rebuildHierarchy();
    announce(file, format, root.children?.length || 1);
    return true;
}

function announce(file, format, objectCount) {
    window.dispatchEvent(new CustomEvent("editor:project-opened", { detail: { fileName: file.name, format, objectCount } }));
    window.dispatchEvent(new CustomEvent("editor:status", { detail: `Imported ${file.name}` }));
}

function restoreObject(scene, parent, data) {
    if (!data) return null;
    let object;
    if (data.kind === "Group" || data.type === "Group") { object = new THREE.Group(); object.userData.selectable = true; }
    else {
        const geometry = createGeometry(data.type); if (!geometry) return null;
        const materials = (data.materials || []).map(createMaterial);
        const material = materials.length === 1 ? materials[0] : materials.length ? materials : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
        object = new THREE.Mesh(geometry, material); object.castShadow = true; object.receiveShadow = true; object.userData.selectable = true;
    }
    object.name = data.name || "Object"; object.visible = data.visible ?? true;
    object.position.fromArray(normalizeVector(data.position, [0,0,0])); object.rotation.set(...normalizeVector(data.rotation, [0,0,0])); object.scale.fromArray(normalizeVector(data.scale, [1,1,1]));
    object.userData.editorObject = true; Object.assign(object.userData, data.userData || {}); parent.add(object); addObject(scene, object);
    (data.children || []).forEach(child => restoreObject(scene, object, child)); return object;
}
function createMaterial(data) { return new THREE.MeshStandardMaterial({ color: data.color ?? 0xffffff, metalness: data.metalness ?? 0, roughness: data.roughness ?? 1, opacity: data.opacity ?? 1, transparent: data.transparent ?? false, wireframe: data.wireframe ?? false, side: data.side ?? THREE.FrontSide }); }
function createGeometry(type) { switch (type) { case "BoxGeometry": return new THREE.BoxGeometry(1,1,1); case "SphereGeometry": return new THREE.SphereGeometry(.5,32,20); case "CylinderGeometry": return new THREE.CylinderGeometry(.5,.5,2,32); case "ConeGeometry": return new THREE.ConeGeometry(.5,1.5,32); case "PlaneGeometry": return new THREE.PlaneGeometry(5,5); case "OctahedronGeometry": return new THREE.OctahedronGeometry(.5); case "TorusGeometry": return new THREE.TorusGeometry(.5,.2,16,64); default: return null; } }
function normalizeVector(value, fallback) { if (Array.isArray(value) && value.length >= 3) return [Number(value[0])||0,Number(value[1])||0,Number(value[2])||0]; if (value && typeof value === "object") return [Number(value.x)||0,Number(value.y)||0,Number(value.z)||0]; return fallback; }
