import * as THREE from "three";
import { VoxelGrid } from "./voxelGrid.js";
import { copyRegion, fillBox, floodFill, pasteRegion } from "./voxelOps.js";
import { pushHistory } from "../history.js";

const BLOCKS = [
    ["grass", "Grass", 0x6ea84f], ["dirt", "Dirt", 0x8b5a2b], ["stone", "Stone", 0x8a8f98],
    ["wood", "Wood", 0x9a6a3a], ["sand", "Sand", 0xd7bf78], ["brick", "Brick", 0xa9564a],
    ["glass", "Glass", 0x8fc7dc]
];
const TOOLS = [["paint", "Paint"], ["erase", "Erase"], ["fill", "Fill Box"], ["flood", "Flood"], ["select", "Select"], ["copy", "Copy"], ["paste", "Paste"], ["duplicate", "Duplicate"]];

export function initVoxelEditor({ scene, camera, renderer, controls }) {
    const state = {
        active: false, selectedBlock: "grass", tool: "paint",
        grid: new VoxelGrid({ dimensions: [64, 32, 64], voxelSize: 1, origin: [-32, 0, -32] }),
        root: new THREE.Group(), meshes: new Map(), materialCache: new Map(),
        raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), selectionStart: null, selectionEnd: null,
        clipboard: null, palette: null, modeButton: null, status: null
    };
    state.root.name = "VoxelWorkspace";
    state.root.visible = false;
    scene.add(state.root);
    injectUI(state);
    bindViewport(state, renderer.domElement, camera, controls);
    return { toggle: () => toggle(state), isActive: () => state.active, getGrid: () => state.grid, clear: () => clear(state) };
}

function toggle(state) {
    state.active = !state.active;
    state.root.visible = state.active;
    state.modeButton?.classList.toggle("active", state.active);
    if (state.modeButton) state.modeButton.textContent = state.active ? "Voxel Mode On" : "Voxel Mode";
    state.palette.hidden = !state.active;
    setStatus(state, state.active ? `Voxel mode · ${state.selectedBlock} · ${state.tool}` : "3D Modeling Mode");
    window.dispatchEvent(new CustomEvent("editor:voxel-mode", { detail: state.active }));
    return state.active;
}

function injectUI(state) {
    const top = document.querySelector(".top-actions");
    let button = document.getElementById("voxelModeBtn");
    if (!button && top) {
        button = document.createElement("button"); button.type = "button"; button.id = "voxelModeBtn"; button.className = "action-btn"; button.textContent = "Voxel Mode";
        top.insertBefore(button, top.firstChild);
    }
    state.modeButton = button;
    state.palette = document.getElementById("voxelPalette");
    if (state.palette) state.palette.remove();
    const panel = document.createElement("aside"); panel.id = "voxelPalette"; panel.hidden = true;
    panel.innerHTML = `<div class="mf-voxel-head"><div><span>VOXEL AUTHORING</span><strong>Block Palette</strong></div><button type="button">×</button></div><div class="mf-voxel-tools">${BLOCKS.map(([id,label]) => `<button type="button" data-block="${id}"><i></i>${label}</button>`).join("")}</div><div class="mf-voxel-actions">${TOOLS.map(([id,label]) => `<button type="button" data-tool="${id}">${label}</button>`).join("")}<button type="button" data-tool="clear">Clear All</button></div><div class="mf-voxel-selection">Selection: none</div><div class="mf-voxel-help">Paint: click empty ground or a face · Erase: click block · Fill/Select: choose two corners · Esc: exit</div>`;
    document.body.appendChild(panel); state.palette = panel;
    button?.addEventListener("click", () => toggle(state));
    panel.querySelector(".mf-voxel-head button")?.addEventListener("click", () => toggle(state));
    panel.querySelectorAll("[data-block]").forEach(b => b.addEventListener("click", () => { state.selectedBlock = b.dataset.block; selectVisual(state); setStatus(state, `Voxel block · ${state.selectedBlock}`); }));
    panel.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => activateTool(state, b.dataset.tool)));
    selectVisual(state); toolVisual(state);
    if (!document.getElementById("voxelEditorStyles")) {
        const style = document.createElement("style"); style.id = "voxelEditorStyles"; style.textContent = `#voxelPalette{position:fixed;left:18px;top:78px;width:250px;z-index:130;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font-family:system-ui,sans-serif;overflow:hidden}#voxelPalette[hidden]{display:none!important}.mf-voxel-head{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid #292d35;background:#17191f}.mf-voxel-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.mf-voxel-head strong{display:block;font-size:13px;margin-top:2px}.mf-voxel-head button{width:26px;height:26px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px;cursor:pointer}.mf-voxel-tools{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px}.mf-voxel-tools button,.mf-voxel-actions button{display:flex;align-items:center;gap:7px;border:1px solid #30343c;background:#191c22;color:#b8bdc7;border-radius:5px;padding:8px;font-size:10px;text-align:left;cursor:pointer}.mf-voxel-tools button.selected,.mf-voxel-actions button.selected{border-color:#69707d;background:#252932;color:#fff}.mf-voxel-tools i{width:12px;height:12px;border-radius:3px;background:#777}.mf-voxel-tools [data-block=grass] i{background:#6ea84f}.mf-voxel-tools [data-block=dirt] i{background:#8b5a2b}.mf-voxel-tools [data-block=stone] i{background:#8a8f98}.mf-voxel-tools [data-block=wood] i{background:#9a6a3a}.mf-voxel-tools [data-block=sand] i{background:#d7bf78}.mf-voxel-tools [data-block=brick] i{background:#a9564a}.mf-voxel-tools [data-block=glass] i{background:#8fc7dc}.mf-voxel-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 10px 10px}.mf-voxel-actions button[data-tool=clear]{grid-column:1/-1}.mf-voxel-actions button.selected{background:#e6e8ec;color:#111318}.mf-voxel-selection{padding:8px 10px;border-block:1px solid #292d35;color:#9299a5;font-size:9px}.mf-voxel-help{padding:9px 10px;color:#777e8a;font-size:9px;line-height:1.45}#voxelModeBtn.active{background:#e6e8ec;color:#111318;border-color:#e6e8ec}`; document.head.appendChild(style);
    }
}

function bindViewport(state, element, camera, controls) {
    element.addEventListener("contextmenu", e => { if (state.active) e.preventDefault(); });
    element.addEventListener("pointerdown", e => {
        if (!state.active || e.button > 2) return;
        const hit = raycast(state, element, camera, e);
        if (state.tool === "paint" && e.button === 0) paintAt(state, hit, true);
        else if (state.tool === "erase") paintAt(state, hit, false);
        else if (state.tool === "flood" && e.button === 0) floodAt(state, hit);
        else if (state.tool === "fill" && e.button === 0) fillAt(state, hit);
        else if (state.tool === "select" && e.button === 0) selectAt(state, hit);
        else if (state.tool === "copy" && e.button === 0) copyAt(state, hit);
        else if (state.tool === "paste" && e.button === 0) pasteAt(state, hit);
        else if (state.tool === "duplicate" && e.button === 0) duplicateAt(state, hit);
        controls?.update?.();
    });
    window.addEventListener("keydown", e => {
        if (!state.active) return;
        if (e.key === "Escape") { state.selectionStart = state.selectionEnd = null; updateSelection(state); toggle(state); }
        if (/^[1-7]$/.test(e.key)) { state.selectedBlock = BLOCKS[Number(e.key)-1][0]; selectVisual(state); }
    });
}

function raycast(state, element, camera, event) {
    const r = element.getBoundingClientRect(); state.pointer.x = ((event.clientX-r.left)/r.width)*2-1; state.pointer.y = -((event.clientY-r.top)/r.height)*2+1;
    state.raycaster.setFromCamera(state.pointer, camera);
    const hits = state.raycaster.intersectObjects([...state.meshes.values()], false);
    if (hits.length) {
        const h = hits[0], c = h.object.userData.voxel;
        const n = h.face?.normal?.clone().transformDirection(h.object.matrixWorld) || new THREE.Vector3(0,1,0);
        return { voxel:[...c], place:[c[0]+Math.round(n.x), c[1]+Math.round(n.y), c[2]+Math.round(n.z)], point:h.point };
    }
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0), point = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plane, point)) return null;
    const o = state.grid.origin; return { point, voxel:[Math.floor(point.x-o[0]),0,Math.floor(point.z-o[2])], place:[Math.floor(point.x-o[0]),0,Math.floor(point.z-o[2])] };
}

function paintAt(state, hit, place) {
    if (!hit) return;
    const c = place ? hit.place : hit.voxel; if (!state.grid.isInside(...c)) return setStatus(state,"Outside voxel grid");
    const before = state.grid.getBlockRecord(...c);
    if (place) { if (before.blockId === state.selectedBlock) return; state.grid.setBlock(...c,state.selectedBlock); renderVoxel(state,c); }
    else { if (before.blockId === state.grid.defaultBlock) return; state.grid.removeBlock(...c); removeMesh(state,c); }
    const after = state.grid.getBlockRecord(...c); pushHistory({label:place?"Place voxel":"Erase voxel",undo:()=>restore(state,before),redo:()=>restore(state,after)});
    setStatus(state, `${place?"Placed":"Removed"} ${place?state.selectedBlock:"voxel"} · ${worldCoord(state,c).join(", ")}`);
}

function floodAt(state, hit) { if (!hit) return; const c=hit.voxel; if(!state.grid.isInside(...c))return; const changes=floodFill(state.grid,c,state.selectedBlock); if(!changes.length)return setStatus(state,"Flood fill made no changes"); renderAll(state); pushBatch(state,changes,"Flood fill"); setStatus(state,`Flood filled ${changes.length} voxels`); }
function fillAt(state, hit) { if(!hit)return; const c=hit.place; if(!state.selectionStart){state.selectionStart=[...c];updateSelection(state);setStatus(state,"First corner selected · click opposite corner");return;} state.selectionEnd=[...c];const changes=fillBox(state.grid,state.selectionStart,state.selectionEnd,state.selectedBlock);renderAll(state);if(changes.length)pushBatch(state,changes,"Fill voxel box");setStatus(state,`Filled ${changes.length} voxels`); }
function selectAt(state, hit) { if(!hit)return; const c=hit.voxel;if(!state.selectionStart||state.selectionEnd){state.selectionStart=[...c];state.selectionEnd=null;}else state.selectionEnd=[...c];updateSelection(state); }
function copyAt(state, hit) { selectAt(state,hit); if(state.selectionStart&&state.selectionEnd){state.clipboard=copyRegion(state.grid,state.selectionStart,state.selectionEnd);setStatus(state,`Copied ${state.clipboard.blocks.length} voxels`);} }
function pasteAt(state, hit) { if(!hit)return;if(!state.clipboard)return setStatus(state,"Clipboard is empty");const before=state.grid.serialize();const changes=pasteRegion(state.grid,state.clipboard,hit.place);if(!changes.length)return setStatus(state,"Nothing pasted in bounds");renderAll(state);const after=state.grid.serialize();pushHistory({label:"Paste voxels",undo:()=>restoreGrid(state,before),redo:()=>restoreGrid(state,after)});setStatus(state,`Pasted ${changes.length} voxels`); }
function duplicateAt(state, hit) { if(!state.selectionStart||!state.selectionEnd)return setStatus(state,"Select a voxel region first");state.clipboard=copyRegion(state.grid,state.selectionStart,state.selectionEnd);pasteAt(state,hit); }

function renderVoxel(state,c){const k=state.grid.key(...c),old=state.meshes.get(k);if(old){old.material=getMaterial(state,state.grid.getBlock(...c));return;}const block=state.grid.getBlock(...c);if(block===state.grid.defaultBlock)return;const m=new THREE.Mesh(new THREE.BoxGeometry(0.98,0.98,0.98),getMaterial(state,block));const o=state.grid.origin;m.position.set(o[0]+c[0]+0.5,o[1]+c[1]+0.5,o[2]+c[2]+0.5);m.userData.voxel=[...c];m.userData.selectable=true;state.root.add(m);state.meshes.set(k,m);}
function renderAll(state){for(const m of state.meshes.values()){m.geometry.dispose();m.removeFromParent();}state.meshes.clear();state.grid.forEachBlock(b=>renderVoxel(state,[b.x,b.y,b.z]));updateSelection(state);}
function removeMesh(state,c){const m=state.meshes.get(state.grid.key(...c));if(m){m.geometry.dispose();m.removeFromParent();state.meshes.delete(state.grid.key(...c));}}
function restore(state,r){if(!r)return;if(r.blockId===state.grid.defaultBlock&&!r.properties){state.grid.removeBlock(r.x,r.y,r.z);removeMesh(state,[r.x,r.y,r.z]);}else{state.grid.setBlock(r.x,r.y,r.z,r.blockId,r.properties);renderVoxel(state,[r.x,r.y,r.z]);}}
function restoreGrid(state,data){state.grid=VoxelGrid.deserialize(data);renderAll(state);}
function pushBatch(state,changes,label){const before=changes.map(x=>x.before).filter(Boolean),after=changes.map(x=>x.after).filter(Boolean);pushHistory({label,undo:()=>before.forEach(r=>restore(state,r)),redo:()=>after.forEach(r=>restore(state,r))});}
function getMaterial(state,id){if(!state.materialCache.has(id)){const b=BLOCKS.find(x=>x[0]===id);const m=new THREE.MeshStandardMaterial({color:b?.[2]??0xffffff,roughness:id==="glass"?.15:.9,metalness:0});if(id==="glass"){m.transparent=true;m.opacity=.45;}state.materialCache.set(id,m);}return state.materialCache.get(id);}
function activateTool(state,tool){if(tool==="clear"){clear(state);return;}state.tool=TOOLS.some(x=>x[0]===tool)?tool:"paint";if(state.tool!=="select"&&state.tool!=="copy"){state.selectionStart=state.selectionEnd=null;updateSelection(state);}toolVisual(state);setStatus(state,`Voxel tool · ${state.tool}`);}
function selectVisual(state){state.palette?.querySelectorAll("[data-block]").forEach(b=>b.classList.toggle("selected",b.dataset.block===state.selectedBlock));}
function toolVisual(state){state.palette?.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("selected",b.dataset.tool===state.tool));}
function updateSelection(state){const info=state.palette?.querySelector(".mf-voxel-selection");if(info){if(!state.selectionStart)info.textContent="Selection: none";else if(!state.selectionEnd)info.textContent=`Selection: ${worldCoord(state,state.selectionStart).join(", ")} → …`;else{const s=state.selectionStart.map((v,i)=>Math.abs(v-state.selectionEnd[i])+1);info.textContent=`Selection: ${s.join(" × ")}`;}}state.root.getObjectByName("VoxelSelection")?.removeFromParent();if(!state.selectionStart||!state.selectionEnd)return;const min=state.selectionStart.map((v,i)=>Math.min(v,state.selectionEnd[i])),max=state.selectionStart.map((v,i)=>Math.max(v,state.selectionEnd[i])),size=min.map((v,i)=>max[i]-v+1),o=state.grid.origin,h=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({wireframe:true,transparent:true,opacity:.55}));h.name="VoxelSelection";h.position.set(o[0]+min[0]+size[0]/2,o[1]+min[1]+size[1]/2,o[2]+min[2]+size[2]/2);state.root.add(h);}
function worldCoord(state,c){const o=state.grid.origin;return [c[0]+o[0],c[1]+o[1],c[2]+o[2]];}
function clear(state){const before=state.grid.serialize();state.grid.clear();renderAll(state);if(before.blocks.length)pushHistory({label:"Clear voxels",undo:()=>restoreGrid(state,before),redo:()=>{state.grid.clear();renderAll(state);}});setStatus(state,"Voxel grid cleared");}
function setStatus(state,text){state.status=text;window.dispatchEvent(new CustomEvent("editor:status",{detail:text}));const el=document.getElementById("statusText");if(el)el.textContent=text;}
