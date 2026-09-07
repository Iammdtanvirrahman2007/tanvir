import * as THREE from "three";
import { createObject } from "../objects/factory.js";
import { addObject, removeObject } from "./objectManager.js";
import { getSelected, selectObject, selectMultiple, clearSelection } from "./selection.js";
import { getMultiSelection } from "./grouping.js";
import { addToHierarchy, rebuildHierarchy } from "../ui/hierarchy.js";

let api = null;
let csgModulePromise = null;

const SHAPES = [
    ["cube", "Cube", "□"], ["sphere", "Sphere", "○"], ["cylinder", "Cylinder", "▱"],
    ["cone", "Cone", "△"], ["torus", "Torus", "○"], ["capsule", "Capsule", "▯"]
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
        b.textContent = "Builder";
        top.insertBefore(b, top.firstChild);
    }
    s.button = b;

    const p = document.createElement("aside");
    p.id = "builderToolsPanel";
    p.hidden = true;
    p.innerHTML = `
      <div class="mf-builder-head">
        <div><span>MODELFORGE</span><strong>Builder</strong></div>
        <button data-close aria-label="Close">×</button>
      </div>
      <div class="mf-builder-body">
        <section class="mf-builder-section">
          <label>ADD</label>
          <div class="mf-shapes">${SHAPES.map(([id,label,icon]) => `<button data-shape="${id}" title="Add ${label}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div>
        </section>
        <section class="mf-builder-section">
          <label>EDIT</label>
          <div class="mf-action-row"><button data-action="duplicate">Duplicate</button><button data-action="delete" class="danger">Delete</button></div>
        </section>
        <section class="mf-builder-section">
          <label>MERGE</label>
          <div class="mf-boolean"><button data-action="union"><b>+</b><span>Combine</span></button><button data-action="subtract"><b>−</b><span>Subtract</span></button><button data-action="intersect"><b>∩</b><span>Intersect</span></button></div>
          <small>Select 2 objects. First is the base.</small>
        </section>
        <section class="mf-builder-section">
          <label>ARRANGE</label>
          <div class="mf-action-row"><button data-action="align-x">Center X</button><button data-action="align-y">Center Y</button><button data-action="align-z">Center Z</button><button data-action="drop">Ground</button></div>
        </section>
        <section class="mf-builder-section mf-builder-last">
          <label>VIEW</label>
          <div class="mf-action-row"><button data-action="grid-snap">Snap</button><button data-action="frame">Frame</button><button data-action="select-all">All</button><button data-action="clear">Clear</button></div>
        </section>
      </div>
      <div class="mf-builder-status">Select an object</div>`;
    document.body.appendChild(p);
    s.panel = p;

    if (!document.getElementById("builderToolsStyles")) {
        const st = document.createElement("style");
        st.id = "builderToolsStyles";
        st.textContent = `
#builderToolsPanel{position:fixed;right:312px;top:58px;width:300px;max-height:calc(100vh - 100px);overflow:hidden;z-index:126;background:#0b0c0e;border:1px solid #2a2c30;border-radius:8px;box-shadow:0 18px 55px rgba(0,0,0,.55);color:#f4f4f4;font:11px Inter,system-ui,sans-serif}
#builderToolsPanel[hidden]{display:none!important}
.mf-builder-head{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #26282c;background:#101114}.mf-builder-head span{display:block;font-size:7px;letter-spacing:.18em;color:#777b82}.mf-builder-head strong{display:block;margin-top:2px;font-size:13px;font-weight:600;color:#fff}.mf-builder-head button{width:26px;height:26px;border:1px solid #303238;border-radius:5px;background:#17181b;color:#aaa;cursor:pointer;font-size:16px}.mf-builder-head button:hover{background:#fff;color:#000;border-color:#fff}
.mf-builder-body{padding:4px 0;max-height:calc(100vh - 150px);overflow:auto}.mf-builder-section{padding:11px 12px 10px;border-bottom:1px solid #202226}.mf-builder-section.mf-builder-last{border-bottom:0}.mf-builder-section label{display:block;margin-bottom:7px;color:#777b82;font-size:8px;font-weight:700;letter-spacing:.16em}.mf-shapes{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.mf-shapes button{height:58px;border:1px solid #292b30;border-radius:5px;background:#111215;color:#bfc2c8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}.mf-shapes button i{font-style:normal;font-size:19px;line-height:1;color:#fff}.mf-shapes button span{font-size:9px}.mf-shapes button:hover{background:#fff;color:#090a0c;border-color:#fff}.mf-shapes button:hover i{color:#000}
.mf-action-row{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.mf-action-row button,.mf-boolean button{height:31px;border:1px solid #292b30;border-radius:4px;background:#111215;color:#c2c5ca;cursor:pointer}.mf-action-row button:hover,.mf-boolean button:hover{background:#fff;color:#090a0c;border-color:#fff}.mf-action-row button.danger:hover{background:#fff;color:#000}.mf-boolean{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.mf-boolean button{height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.mf-boolean b{font-size:17px;line-height:1;font-weight:500;color:#fff}.mf-boolean span{font-size:8px}.mf-boolean button:hover b{color:#000}.mf-builder-section small{display:block;margin-top:6px;color:#60646b;font-size:8px}.mf-builder-status{height:30px;display:flex;align-items:center;padding:0 12px;border-top:1px solid #26282c;color:#70747c;font-size:9px;background:#0f1012}
#builderToolsBtn.active{background:#fff!important;color:#090a0c!important;border-color:#fff!important}
/* Keep the main workspace monochrome and remove secondary UI clutter. */
:root{--accent:#fff!important;--accent2:#fff!important}#modelingShelf{display:none!important}#meshEditPanel{display:none!important}#meshEditBtn{display:none!important}.tool-btn.snap-on{color:#fff!important;background:#282a2e!important}.status-indicator.busy{background:#fff!important}
@media(max-width:1100px){#builderToolsPanel{right:8px;top:58px;width:292px}}
@media(max-width:760px){#builderToolsPanel{left:8px;right:8px;top:auto;bottom:86px;width:auto;max-height:calc(100vh - 150px);border-radius:9px}.mf-builder-body{max-height:55vh}}
`;
        document.head.appendChild(st);
    }

    refreshState(s);
}

function bind(s) {
    s.button?.addEventListener("click", () => toggle(s));
    s.panel.querySelector("[data-close]")?.addEventListener("click", () => close(s));
    s.panel.querySelectorAll("[data-shape]").forEach(b => b.addEventListener("click", () => addShape(s, b.dataset.shape)));
    s.panel.querySelectorAll("[data-action]").forEach(b => b.addEventListener("click", () => action(s, b.dataset.action)));
    window.addEventListener("editor:selection-change", () => refreshState(s));
    window.addEventListener("editor:multiselect-change", () => refreshState(s));
}

function open(s) { s.panel.hidden = false; s.button?.classList.add("active"); refreshState(s); }
function close(s) { s.panel.hidden = true; s.button?.classList.remove("active"); }
function toggle(s) { if (s.panel.hidden) open(s); else close(s); }

function addShape(s, type) {
    let object = null;
    if (["cube", "sphere", "cylinder", "cone", "plane"].includes(type)) object = createObject(type);
    else if (type === "torus") object = makeMesh("Torus", new THREE.TorusGeometry(0.65, 0.22, 16, 32));
    else if (type === "capsule") object = makeMesh("Capsule", THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.42, 0.65, 8, 16) : new THREE.CylinderGeometry(0.42, 0.42, 1.45, 16));
    if (!object) return setStatus(s, "Could not create shape");
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
    if (name === "align-x" || name === "align-y" || name === "align-z") return align(s, name.slice(-1));
    if (name === "drop") { const selected = getSelection(); selected.forEach(o => dropToGround(o, s.scene)); return setStatus(s, `Grounded ${selected.length}`); }
    if (name === "grid-snap") return gridSnap(s);
    if (name === "frame") return document.getElementById("frameBtn")?.click();
    if (name === "select-all") return selectAll(s);
    if (name === "clear") return clearSelection();
}

function getSelection() { return getMultiSelection().filter(o => o?.isMesh || o?.isGroup); }

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
    setStatus(s, `Duplicated ${copies.length}`);
}

function deleteSelected(s) {
    const selected = getSelection();
    if (!selected.length) return setStatus(s, "Select an object first");
    selected.forEach(o => removeObject(s.scene, o));
    clearSelection(); rebuildHierarchy(); setStatus(s, `Deleted ${selected.length}`);
}

async function booleanOp(s, type) {
    const selected = getSelection().filter(o => o.isMesh && o.geometry);
    if (selected.length !== 2) return setStatus(s, "Select exactly 2 mesh objects");
    setStatus(s, "Processing…");
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
        setStatus(s, result.name);
    } catch (error) {
        console.error("ModelForge boolean error", error);
        setStatus(s, "Boolean failed");
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
    const center = boxes.reduce((sum, b) => sum + b.getCenter(new THREE.Vector3())[axis], 0) / boxes.length;
    selected.forEach((o, i) => { const c = boxes[i].getCenter(new THREE.Vector3()); o.position[axis] += center - c[axis]; });
    setStatus(s, `Centered ${axis.toUpperCase()}`);
}

function gridSnap(s) {
    const selected = getSelection();
    if (!selected.length) return setStatus(s, "Select an object first");
    const step = 0.5;
    selected.forEach(o => { o.position.x = Math.round(o.position.x / step) * step; o.position.y = Math.round(o.position.y / step) * step; o.position.z = Math.round(o.position.z / step) * step; });
    setStatus(s, `Snapped ${selected.length}`);
}

function selectAll(s) {
    const all = s.scene.children.filter(o => o?.userData?.editorObject && o?.userData?.selectable && (o.isMesh || o.isGroup));
    selectMultiple(all); setStatus(s, `${all.length} selected`);
}

function dropToGround(object) {
    if (!object?.isObject3D) return;
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    object.position.y += -box.min.y;
}

function refreshState(s) {
    if (!s.panel) return;
    const selected = getSelection();
    s.panel.querySelectorAll("[data-action]").forEach(button => {
        const action = button.dataset.action;
        const needsSelection = !["select-all", "clear"].includes(action);
        button.disabled = needsSelection && selected.length === 0;
        if (["union", "subtract", "intersect"].includes(action)) button.disabled = selected.length !== 2;
        if (["align-x", "align-y", "align-z"].includes(action)) button.disabled = selected.length < 2;
    });
    const status = s.panel.querySelector(".mf-builder-status");
    if (status && !s.panel.matches(":hover")) status.textContent = selected.length ? `${selected.length} selected` : "Select an object";
}

function setStatus(s, text) {
    const el = s.panel?.querySelector(".mf-builder-status");
    if (el) el.textContent = text;
    window.dispatchEvent(new CustomEvent("editor:status", { detail: text }));
}
