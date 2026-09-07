import * as THREE from "three";
import { createObject } from "../objects/factory.js";
import { addObject, removeObject } from "./objectManager.js";
import { getSelected, selectObject, selectMultiple, clearSelection } from "./selection.js";
import { getMultiSelection, setMultiSelection } from "./grouping.js";
import { addToHierarchy, rebuildHierarchy } from "../ui/hierarchy.js";

let api = null;
let csgModulePromise = null;

const SHAPES = [
    ["cube", "Cube"], ["sphere", "Sphere"], ["cylinder", "Cylinder"], ["cone", "Cone"],
    ["torus", "Torus"], ["capsule", "Capsule"], ["plane", "Plane"]
];

export function initBuilderTools({ scene, camera, renderer, controls }) {
    if (api) return api;
    const state = { scene, camera, renderer, controls, panel: null, button: null };
    injectUI(state);
    bind(state);
    api = { open: () => open(state), close: () => close(state), toggle: () => toggle(state) };
    return api;
}

function injectUI(s) {
    const top = document.querySelector(".top-actions");
    let b = document.getElementById("builderToolsBtn");
    if (!b && top) {
        b = document.createElement("button");
        b.id = "builderToolsBtn";
        b.type = "button";
        b.className = "action-btn";
        b.textContent = "3D Builder";
        top.insertBefore(b, top.firstChild);
    }
    s.button = b;

    const p = document.createElement("aside");
    p.id = "builderToolsPanel";
    p.hidden = true;
    p.innerHTML = `
      <div class="bt-head"><div><span>MODELFORGE</span><strong>3D Builder</strong></div><button data-close aria-label="Close">×</button></div>
      <div class="bt-section"><label>ADD SHAPE</label><div class="bt-grid shapes">${SHAPES.map(([id,label]) => `<button data-shape="${id}">${label}</button>`).join("")}</div></div>
      <div class="bt-section"><label>MODEL</label><div class="bt-grid"><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button><button data-action="group">Combine Group</button><button data-action="ungroup">Ungroup</button></div></div>
      <div class="bt-section"><label>BOOLEAN</label><div class="bt-grid"><button data-action="union">Combine</button><button data-action="subtract">Subtract</button><button data-action="intersect">Intersect</button></div><small>Select 2 objects. First = base, second = tool.</small></div>
      <div class="bt-section"><label>ALIGN</label><div class="bt-grid"><button data-action="align-x">Center X</button><button data-action="align-y">Center Y</button><button data-action="align-z">Center Z</button><button data-action="drop">Drop to ground</button></div></div>
      <div class="bt-section"><label>QUICK</label><div class="bt-grid"><button data-action="grid-snap">Grid Snap</button><button data-action="frame">Frame Selected</button><button data-action="select-all">Select All</button><button data-action="clear">Clear</button></div></div>
      <div class="bt-help">3D Builder workflow: add primitives, move/scale them, select multiple objects, then Combine / Subtract / Intersect to build complex game assets.</div>
      <div class="bt-status">Ready</div>`;
    document.body.appendChild(p);
    s.panel = p;

    if (!document.getElementById("builderToolsStyles")) {
        const st = document.createElement("style");
        st.id = "builderToolsStyles";
        st.textContent = `
#builderToolsPanel{position:fixed;right:286px;top:112px;width:286px;max-height:calc(100vh - 180px);overflow:auto;z-index:126;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font:11px system-ui,sans-serif}
#builderToolsPanel[hidden]{display:none!important}.bt-head{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #292d35;background:#17191f;z-index:2}.bt-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.bt-head strong{display:block;font-size:13px}.bt-head button{width:25px;height:25px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px}.bt-section{padding:9px 10px 0}.bt-section label{display:block;margin-bottom:6px;color:#747b87;font-size:8px;letter-spacing:.13em}.bt-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.bt-grid button{border:1px solid #30343c;background:#191c22;color:#c3c7cf;border-radius:5px;padding:8px 5px;cursor:pointer}.bt-grid button:hover{background:#242830;border-color:#4a505b}.bt-grid button:active{transform:translateY(1px)}.bt-section small{display:block;padding-top:6px;color:#707783;font-size:9px;line-height:1.35}.bt-help{margin:10px;color:#777e8a;font-size:9px;line-height:1.45}.bt-status{padding:8px 10px;border-top:1px solid #292d35;color:#9aa1ad;font-size:9px}.shapes{grid-template-columns:repeat(3,1fr)}#builderToolsBtn.active{background:#e6e8ec;color:#111318;border-color:#e6e8ec}@media(max-width:760px){#builderToolsPanel{left:8px;right:8px;top:auto;bottom:60px;width:auto;max-height:72vh}}
`;
        document.head.appendChild(st);
    }
}

function bind(s) {
    s.button?.addEventListener("click", () => toggle(s));
    s.panel.querySelector("[data-close]")?.addEventListener("click", () => close(s));
    s.panel.querySelectorAll("[data-shape]").forEach(b => b.addEventListener("click", () => addShape(s, b.dataset.shape)));
    s.panel.querySelectorAll("[data-action]").forEach(b => b.addEventListener("click", () => action(s, b.dataset.action)));
}

function open(s) { s.panel.hidden = false; s.button?.classList.add("active"); }
function close(s) { s.panel.hidden = true; s.button?.classList.remove("active"); }
function toggle(s) { if (s.panel.hidden) open(s); else close(s); }

function addShape(s, type) {
    let object = null;
    if (["cube", "sphere", "cylinder", "cone", "plane"].includes(type)) object = createObject(type);
    else if (type === "torus") object = makeMesh("Torus", new THREE.TorusGeometry(0.65, 0.22, 16, 32));
    else if (type === "capsule") object = makeMesh("Capsule", THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.42, 0.65, 8, 16) : new THREE.CylinderGeometry(0.42, 0.42, 1.45, 16));
    if (!object) return setStatus(s, "Could not create shape");
    object.position.set(0, object.geometry?.boundingBox ? 0 : 0, 0);
    object.userData.selectable = true;
    object.userData.editorObject = true;
    object.userData.objectType = type;
    object.castShadow = true;
    object.receiveShadow = true;
    addObject(s.scene, object);
    dropToGround(object, s.scene);
    addToHierarchy(object);
    selectObject(object);
    rebuildHierarchy();
    setStatus(s, `Added ${object.name}`);
}

function makeMesh(name, geometry) {
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.65, metalness: 0.05 }));
    mesh.name = name;
    return mesh;
}

function action(s, name) {
    if (name === "duplicate") return duplicate(s);
    if (name === "delete") return deleteSelected(s);
    if (name === "union" || name === "subtract" || name === "intersect") return booleanOp(s, name);
    if (name === "group") return dispatchClick("groupBtn");
    if (name === "ungroup") return dispatchClick("ungroupBtn");
    if (name === "align-x" || name === "align-y" || name === "align-z") return align(s, name.slice(-1));
    if (name === "drop") return getSelection().forEach(o => dropToGround(o, s.scene));
    if (name === "grid-snap") return gridSnap(s);
    if (name === "frame") return dispatchClick("frameBtn");
    if (name === "select-all") return selectAll(s);
    if (name === "clear") return clearSelection();
}

function getSelection() { return getMultiSelection().filter(o => o?.isMesh || o?.isGroup); }
function dispatchClick(id) { document.getElementById(id)?.click(); }

function duplicate(s) {
    const selected = getSelection();
    if (!selected.length) return setStatus(s, "Select an object first");
    const copies = [];
    selected.forEach(source => {
        if (!source.isMesh) return;
        const copy = source.clone();
        copy.geometry = source.geometry.clone();
        if (Array.isArray(source.material)) copy.material = source.material.map(m => m.clone());
        else if (source.material) copy.material = source.material.clone();
        copy.name = `${source.name || "Object"} Copy`;
        copy.position.x += 0.5;
        copy.position.z += 0.5;
        copy.userData = { ...source.userData, editorObject: true, selectable: true };
        addObject(s.scene, copy); addToHierarchy(copy); copies.push(copy);
    });
    if (copies.length) selectMultiple(copies);
    rebuildHierarchy();
    setStatus(s, `Duplicated ${copies.length} object${copies.length === 1 ? "" : "s"}`);
}

function deleteSelected(s) {
    const selected = getSelection();
    if (!selected.length) return setStatus(s, "Select an object first");
    selected.forEach(o => removeObject(s.scene, o));
    clearSelection(); rebuildHierarchy(); setStatus(s, `Deleted ${selected.length} object${selected.length === 1 ? "" : "s"}`);
}

async function booleanOp(s, type) {
    const selected = getSelection().filter(o => o.isMesh && o.geometry);
    if (selected.length !== 2) return setStatus(s, "Select exactly 2 mesh objects");
    setStatus(s, "Preparing boolean operation…");
    try {
        const { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } = await loadCSG();
        const base = new Brush(selected[0].geometry.clone(), cloneMaterial(selected[0].material));
        const tool = new Brush(selected[1].geometry.clone(), cloneMaterial(selected[1].material));
        base.position.copy(selected[0].position); base.quaternion.copy(selected[0].quaternion); base.scale.copy(selected[0].scale); base.updateMatrixWorld(true);
        tool.position.copy(selected[1].position); tool.quaternion.copy(selected[1].quaternion); tool.scale.copy(selected[1].scale); tool.updateMatrixWorld(true);
        const evaluator = new Evaluator();
        evaluator.useGroups = true;
        const operation = type === "union" ? ADDITION : type === "subtract" ? SUBTRACTION : INTERSECTION;
        const result = evaluator.evaluate(base, tool, operation);
        result.name = type === "union" ? "Combined" : type === "subtract" ? "Subtracted" : "Intersection";
        result.userData = { ...selected[0].userData, editorObject: true, selectable: true, booleanSource: type };
        result.castShadow = true; result.receiveShadow = true;
        s.scene.add(result);
        selected.forEach(o => removeObject(s.scene, o));
        addObject(s.scene, result);
        addToHierarchy(result); rebuildHierarchy(); selectObject(result);
        setStatus(s, `${result.name} created`);
    } catch (error) {
        console.error("ModelForge boolean error", error);
        setStatus(s, `Boolean failed: ${error?.message || "unsupported geometry"}`);
    }
}

function loadCSG() {
    if (!csgModulePromise) csgModulePromise = import("https://unpkg.com/three-bvh-csg@0.0.17/build/index.module.js");
    return csgModulePromise;
}

function cloneMaterial(material) {
    if (Array.isArray(material)) return material.map(m => m?.clone?.() || m);
    return material?.clone?.() || new THREE.MeshStandardMaterial({ color: 0x6b7280 });
}

function align(s, axis) {
    const selected = getSelection().filter(o => o?.isMesh);
    if (selected.length < 2) return setStatus(s, "Select 2 or more objects");
    const boxes = selected.map(o => new THREE.Box3().setFromObject(o));
    const center = boxes.reduce((sum, b) => sum + (axis === "x" ? b.getCenter(new THREE.Vector3()).x : axis === "y" ? b.getCenter(new THREE.Vector3()).y : b.getCenter(new THREE.Vector3()).z), 0) / boxes.length;
    selected.forEach((o, i) => {
        const c = boxes[i].getCenter(new THREE.Vector3());
        if (axis === "x") o.position.x += center - c.x;
        if (axis === "y") o.position.y += center - c.y;
        if (axis === "z") o.position.z += center - c.z;
    });
    setStatus(s, `Centered ${axis.toUpperCase()} axis`);
}

function gridSnap(s) {
    const selected = getSelection();
    if (!selected.length) return setStatus(s, "Select an object first");
    const step = 0.5;
    selected.forEach(o => { o.position.x = Math.round(o.position.x / step) * step; o.position.y = Math.round(o.position.y / step) * step; o.position.z = Math.round(o.position.z / step) * step; });
    setStatus(s, `Grid snapped ${selected.length} object${selected.length === 1 ? "" : "s"}`);
}

function selectAll(s) {
    const all = s.scene.children.filter(o => o?.userData?.editorObject && o?.userData?.selectable && (o.isMesh || o.isGroup));
    selectMultiple(all); setStatus(s, `${all.length} objects selected`);
}

function dropToGround(object, scene) {
    if (!object?.isObject3D) return;
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    object.position.y += -box.min.y;
}

function setStatus(s, text) {
    const el = s.panel?.querySelector(".bt-status"); if (el) el.textContent = text;
    window.dispatchEvent(new CustomEvent("editor:status", { detail: text }));
}
