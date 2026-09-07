import * as THREE from "three";
import { getSelected, clearSelection } from "./selection.js";
import { pushHistory } from "./history.js";

let api = null;

export function initMeshEditMode({ scene, camera, renderer, controls }) {
    if (api) return api;
    const state = { scene, camera, renderer, controls, active:false, mode:"face", mesh:null, selected:new Set(), overlay:new THREE.Group(), ray:new THREE.Raycaster(), pointer:new THREE.Vector2(), before:null, panel:null, button:null };
    state.overlay.name = "MeshEditOverlay";
    state.overlay.userData.editorOnly = true;
    scene.add(state.overlay);
    injectUI(state);
    bind(state);
    api = { toggle:()=>toggle(state), isActive:()=>state.active };
    return api;
}

function injectUI(s){
    const top=document.querySelector(".top-actions");
    let b=document.getElementById("meshEditBtn");
    if(!b&&top){b=document.createElement("button");b.id="meshEditBtn";b.type="button";b.className="action-btn";b.textContent="Edit Mesh";top.insertBefore(b,top.firstChild)}
    s.button=b;
    const p=document.createElement("aside");p.id="meshEditPanel";p.hidden=true;p.innerHTML=`<div class="me-head"><div><span>MESH EDITING</span><strong>Edit Mode</strong></div><button data-close>×</button></div><div class="me-row modes"><button data-mode="vertex">Vertex</button><button data-mode="edge">Edge</button><button data-mode="face" class="active">Face</button></div><div class="me-row ops"><button data-op="extrude">Extrude</button><button data-op="inset">Inset</button><button data-op="delete">Delete</button><button data-op="bevel">Bevel</button></div><div class="me-row"><button data-op="select-all">Select All</button><button data-op="clear">Clear</button></div><div class="me-help">Click mesh to select. Vertex/Edge/Face modes edit the actual mesh. E = extrude · I = inset · X = delete · Tab = exit.</div><div class="me-status">No mesh selected</div>`;document.body.appendChild(p);s.panel=p;
    if(!document.getElementById("meshEditStyles")){const st=document.createElement("style");st.id="meshEditStyles";st.textContent=`#meshEditPanel{position:fixed;left:282px;bottom:54px;width:300px;z-index:125;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font:11px system-ui,sans-serif}#meshEditPanel[hidden]{display:none!important}.me-head{display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #292d35;background:#17191f}.me-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.me-head strong{display:block;font-size:13px}.me-head button{width:25px;height:25px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px}.me-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 10px 0}.me-row button{border:1px solid #30343c;background:#191c22;color:#b8bdc7;border-radius:5px;padding:8px;cursor:pointer}.me-row button.active{background:#e6e8ec;color:#111318}.me-help{padding:9px 10px;color:#777e8a;font-size:9px;line-height:1.45}.me-status{padding:8px 10px;border-top:1px solid #292d35;color:#9aa1ad;font-size:9px}#meshEditBtn.active{background:#e6e8ec;color:#111318;border-color:#e6e8ec}`;document.head.appendChild(st)}
}

function bind(s){
    s.button?.addEventListener("click",()=>toggle(s));
    s.panel.querySelector("[data-close]")?.addEventListener("click",()=>toggle(s));
    s.panel.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{s.mode=b.dataset.mode;s.selected.clear();s.panel.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));refreshOverlay(s);status(s,`${s.mode} selection`)}));
    s.panel.querySelectorAll("[data-op]").forEach(b=>b.addEventListener("click",()=>operate(s,b.dataset.op)));
    s.renderer.domElement.addEventListener("pointerdown",e=>{if(!s.active||e.button!==0)return;if(s.controls?.enabled)s.controls.enabled=false;pick(s,e);setTimeout(()=>{if(s.active&&s.controls)s.controls.enabled=true},0)});
    window.addEventListener("keydown",e=>{if(!s.active)return;if(e.key==="Tab"){e.preventDefault();toggle(s);return}if(e.key.toLowerCase()==="e")operate(s,"extrude");if(e.key.toLowerCase()==="i")operate(s,"inset");if(e.key.toLowerCase()==="x"||e.key==="Delete")operate(s,"delete");if(e.key.toLowerCase()==="a")operate(s,"select-all");if(e.key==="Escape"){s.selected.clear();refreshOverlay(s)}});
}

function toggle(s){
    if(!s.active){
        const mesh=getSelected() || s.scene.children.find(o=>o?.isMesh&&o.userData?.editorObject);
        if(!mesh?.isMesh||!mesh.geometry){status(s,"Select a mesh first");return false}
        s.mesh=mesh;s.before=mesh.geometry.clone();prepareGeometry(s);s.active=true;window.__modelForgeMeshEditMode=true;clearSelection();s.panel.hidden=false;s.button?.classList.add("active");if(s.button)s.button.textContent="Edit Mode On";s.overlay.visible=true;status(s,"Face edit ready");refreshOverlay(s);
    }else exit(s);
    return s.active;
}
function exit(s){s.active=false;window.__modelForgeMeshEditMode=false;s.selected.clear();s.mesh=null;s.overlay.clear();s.overlay.visible=false;s.panel.hidden=true;s.button?.classList.remove("active");if(s.button)s.button.textContent="Edit Mesh";if(s.controls)s.controls.enabled=true;}

function prepareGeometry(s){
    const g=s.mesh.geometry;if(!g.attributes.position)return;
    if(!g.index){const pos=g.attributes.position,uv=g.attributes.uv,map=new Map(),verts=[],uvs=[],idx=[];for(let i=0;i<pos.count;i++){const key=[pos.getX(i),pos.getY(i),pos.getZ(i),uv?uv.getX(i):0,uv?uv.getY(i):0].join("|");let j=map.get(key);if(j==null){j=verts.length/3;map.set(key,j);verts.push(pos.getX(i),pos.getY(i),pos.getZ(i));if(uv)uvs.push(uv.getX(i),uv.getY(i))}idx.push(j)}const ng=new THREE.BufferGeometry();ng.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));if(uv)ng.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));ng.setIndex(idx);ng.computeVertexNormals();s.mesh.geometry.dispose();s.mesh.geometry=ng}
    s.mesh.geometry.computeVertexNormals();s.mesh.geometry.computeBoundingBox();s.mesh.geometry.computeBoundingSphere();
}

function pick(s,e){const r=s.renderer.domElement.getBoundingClientRect();s.pointer.x=((e.clientX-r.left)/r.width)*2-1;s.pointer.y=-((e.clientY-r.top)/r.height)*2+1;s.ray.setFromCamera(s.pointer,s.camera);const hits=s.ray.intersectObject(s.mesh,false);if(!hits.length)return;const h=hits[0],g=s.mesh.geometry,idx=g.index?.array;if(!idx||h.faceIndex==null)return;const tri=[idx[h.faceIndex*3],idx[h.faceIndex*3+1],idx[h.faceIndex*3+2]];if(s.mode==="face"){s.selected.clear();s.selected.add(h.faceIndex)}else if(s.mode==="vertex"){let best=tri[0],bd=Infinity;for(const v of tri){const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,v);s.mesh.localToWorld(p);const d=p.distanceTo(h.point);if(d<bd){bd=d;best=v}}s.selected.clear();s.selected.add(best)}else{let best=edgeKey(tri[0],tri[1]),bd=Infinity;for(const [a,b] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]){const pa=v3(g.attributes.position,a),pb=v3(g.attributes.position,b);s.mesh.localToWorld(pa);s.mesh.localToWorld(pb);const q=closestPointSegment(h.point,pa,pb),d=q.distanceTo(h.point);if(d<bd){bd=d;best=edgeKey(a,b)}}s.selected.clear();s.selected.add(best)}refreshOverlay(s);status(s,`${s.mode}: ${s.selected.size} selected`)}

function operate(s,op){if(!s.mesh)return;if(op==="clear"){s.selected.clear();refreshOverlay(s);return}if(op==="select-all"){if(s.mode==="vertex"){for(let i=0;i<s.mesh.geometry.attributes.position.count;i++)s.selected.add(i)}else if(s.mode==="face"){const n=s.mesh.geometry.index.count/3;for(let i=0;i<n;i++)s.selected.add(i)}else{const idx=s.mesh.geometry.index.array;for(let i=0;i<idx.length;i+=3){s.selected.add(edgeKey(idx[i],idx[i+1]));s.selected.add(edgeKey(idx[i+1],idx[i+2]));s.selected.add(edgeKey(idx[i+2],idx[i]))}}refreshOverlay(s);return}if(op==="delete"){deleteSelected(s);return}if(op==="extrude"){extrudeFaces(s,1);return}if(op==="inset"){insetFaces(s,.2);return}if(op==="bevel"){bevelVertices(s,.12);return}}

function extrudeFaces(s,d){if(s.mode!=="face"||!s.selected.size){status(s,"Select a face first");return}const g=s.mesh.geometry,pa=g.attributes.position,idx=[...g.index.array],positions=Array.from(pa.array),faces=[...s.selected];for(const fi of faces){const a=idx[fi*3],b=idx[fi*3+1],c=idx[fi*3+2],A=v3(pa,a),B=v3(pa,b),C=v3(pa,c),n=new THREE.Triangle().set(A,B,C).getNormal(new THREE.Vector3()).normalize().multiplyScalar(d),ids=[];for(const p of [A,B,C]){ids.push(positions.length/3);positions.push(p.x+n.x,p.y+n.y,p.z+n.z)}idx.splice(fi*3,3,ids[0],ids[1],ids[2]);idx.push(ids[0],ids[2],ids[1],a,b,ids[0],b,c,ids[1],c,a,ids[2])}rebuild(s,positions,idx);status(s,`Extruded ${faces.length} face${faces.length>1?'s':''}`)}
function insetFaces(s,f){if(s.mode!=="face"||!s.selected.size){status(s,"Select a face first");return}const g=s.mesh.geometry,pa=g.attributes.position,idx=g.index.array;for(const fi of s.selected){const vs=[idx[fi*3],idx[fi*3+1],idx[fi*3+2]],center=new THREE.Vector3();for(const v of vs)center.add(v3(pa,v));center.multiplyScalar(1/3);for(const v of vs){const p=v3(pa,v).lerp(center,f);pa.setXYZ(v,p.x,p.y,p.z)}}pa.needsUpdate=true;g.computeVertexNormals();refreshOverlay(s);status(s,"Inset applied")}
function bevelVertices(s,amount){if(s.mode!=="vertex"||!s.selected.size){status(s,"Select vertices first");return}const pa=s.mesh.geometry.attributes.position,center=new THREE.Vector3();for(const v of s.selected)center.add(v3(pa,v));center.multiplyScalar(1/s.selected.size);for(const v of s.selected){const p=v3(pa,v).lerp(center,amount);pa.setXYZ(v,p.x,p.y,p.z)}pa.needsUpdate=true;s.mesh.geometry.computeVertexNormals();refreshOverlay(s);status(s,"Bevel applied")}
function deleteSelected(s){const g=s.mesh.geometry,old=[...g.index.array],remove=new Set();if(s.mode==="face"){for(const fi of s.selected)for(let k=0;k<3;k++)remove.add(fi*3+k)}else{const verts=s.mode==="vertex"?s.selected:new Set([...s.selected].flatMap(e=>e.split(",").map(Number)));for(let i=0;i<old.length;i++)if(verts.has(old[i]))remove.add(i)}const idx=old.filter((_,i)=>!remove.has(i));rebuild(s,Array.from(g.attributes.position.array),idx);s.selected.clear();status(s,"Mesh geometry deleted")}
function rebuild(s,positions,indices){const before=s.mesh.geometry.clone(),g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();s.mesh.geometry.dispose();s.mesh.geometry=g;s.selected.clear();refreshOverlay(s);pushHistory({label:"Mesh edit",undo:()=>{s.mesh.geometry.dispose();s.mesh.geometry=before.clone();s.mesh.geometry.computeVertexNormals()},redo:()=>{}})}
function refreshOverlay(s){s.overlay.clear();if(!s.mesh?.geometry)return;const g=s.mesh.geometry,pa=g.attributes.position,matV=new THREE.PointsMaterial({color:0xffc107,size:8,sizeAttenuation:false});if(s.mode==="vertex"){const arr=[];for(const v of s.selected){const p=v3(pa,v);arr.push(p.x,p.y,p.z)}const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.Float32BufferAttribute(arr,3));s.overlay.add(new THREE.Points(pg,matV))}else{const arr=[],idx=g.index?.array||[];if(s.mode==="face"){for(const fi of s.selected)for(const v of [idx[fi*3],idx[fi*3+1],idx[fi*3+2]]){const p=v3(pa,v);arr.push(p.x,p.y,p.z)}}else for(const e of s.selected){const [a,b]=e.split(",").map(Number);for(const v of [a,b]){const p=v3(pa,v);arr.push(p.x,p.y,p.z)}}const lg=new THREE.BufferGeometry();lg.setAttribute("position",new THREE.Float32BufferAttribute(arr,3));s.overlay.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xffc107,depthTest:false})))} }
function v3(a,i){return new THREE.Vector3(a.getX(i),a.getY(i),a.getZ(i))}
function edgeKey(a,b){return a<b?`${a},${b}`:`${b},${a}`}
function closestPointSegment(p,a,b){const ab=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/ab.lengthSq()));return a.clone().addScaledVector(ab,t)}
function status(s,t){const e=s.panel?.querySelector(".me-status");if(e)e.textContent=t;window.dispatchEvent(new CustomEvent("editor:status",{detail:t}))}
