import * as THREE from "three";
import { getInspectorObject, refreshInspector } from "../ui/inspector.js";

const STYLE_ID = "mf-texture-system-styles";
const OBSERVER_KEY = "__mfTextureSystemObserver";
const SLOTS = [
  ["baseColor", "Base Color", "map", "PNG, JPG, JPEG, WebP", "2048×2048", "Color / albedo texture"],
  ["normal", "Normal", "normalMap", "PNG, WebP", "2048×2048", "Tangent-space normal map"],
  ["roughness", "Roughness", "PNG, WebP", "roughnessMap", "1024×1024", "Grayscale: white = rough"],
  ["metalness", "Metallic", "metalnessMap", "PNG, WebP", "1024×1024", "Grayscale: white = metal"],
  ["ao", "Ambient Occlusion", "aoMap", "PNG, WebP", "1024×1024", "Grayscale contact-shadow map"],
  ["height", "Height", "displacementMap", "PNG, WebP", "1024×1024", "Grayscale height map"],
  ["emissive", "Emissive", "emissiveMap", "PNG, JPG, WebP", "1024×1024", "Glowing areas"],
  ["alpha", "Alpha", "alphaMap", "PNG, WebP", "1024×1024", "Grayscale transparency mask"]
];

const PROFILE = {
  BoxGeometry: { label: "Box / prop", size: "2048×2048", note: "Square tileable texture works best" },
  SphereGeometry: { label: "Sphere / planet", size: "2048×2048", note: "Use an equirectangular/spherical UV texture" },
  CylinderGeometry: { label: "Cylinder", size: "2048×2048", note: "Square texture; vertical details stay crisp" },
  ConeGeometry: { label: "Cone", size: "2048×2048", note: "Square texture with enough top-detail padding" },
  PlaneGeometry: { label: "Plane / decal", size: "2048×2048", note: "Use PNG/WebP when transparency is needed" },
  TorusGeometry: { label: "Torus", size: "2048×2048", note: "Square texture with seamless edges" },
  OctahedronGeometry: { label: "Low-poly / stylized", size: "1024×1024", note: "1024 is usually enough for game-ready assets" }
};

export function initTextureSystem() {
  if (window[OBSERVER_KEY]) return;
  installStyles();
  const panel = document.getElementById("inspectorContent");
  if (!panel) return;
  const enhance = () => {
    const materialSection = [...panel.querySelectorAll(".section")].find(section => section.querySelector?.(".file-input-label"));
    if (!materialSection || materialSection.querySelector(".mf-texture-system")) return;
    const object = getInspectorObject();
    const material = getMaterial(object);
    if (!material) return;
    const mount = materialSection.querySelector(".section-body") || materialSection;
    mount.appendChild(buildTexturePanel(object, material));
  };
  const observer = new MutationObserver(() => requestAnimationFrame(enhance));
  observer.observe(panel, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;
  requestAnimationFrame(enhance);
}

function getMaterial(object) { if (!object?.material) return null; return Array.isArray(object.material) ? object.material[0] : object.material; }

function buildTexturePanel(object, material) {
  const root = document.createElement("div");
  root.className = "mf-texture-system";
  const profile = PROFILE[object?.geometry?.type] || { label: object?.geometry?.type || "Custom mesh", size: "2048×2048", note: "Use 1024×1024 for small assets, 2048×2048 for hero assets" };
  root.innerHTML = `<div class="mf-ts-head"><div><b>Texture Set</b><span>Game-ready PBR slots</span></div><span class="mf-ts-shape">${profile.label}</span></div><div class="mf-ts-tip"><strong>Recommended ${profile.size}</strong><span>${profile.note}</span></div><div class="mf-ts-grid"></div><div class="mf-ts-transform"><div class="mf-ts-subhead">UV Transform</div><div class="mf-ts-uv"></div></div>`;
  const grid = root.querySelector(".mf-ts-grid");
  SLOTS.forEach(slot => grid.appendChild(buildSlot(material, slot)));
  buildUVControls(root.querySelector(".mf-ts-uv"), material);
  return root;
}

function buildSlot(material, spec) {
  const [key, label, prop, acceptLabel, recommended, hint] = spec;
  const wrap = document.createElement("div"); wrap.className = "mf-ts-slot";
  const current = material[prop];
  const info = document.createElement("div"); info.className = "mf-ts-slot-info";
  const thumb = document.createElement("div"); thumb.className = "mf-ts-thumb";
  if (current) { const canvas = document.createElement("canvas"); canvas.width = 48; canvas.height = 48; thumb.appendChild(canvas); makePreview(current, canvas); } else thumb.textContent = "＋";
  const text = document.createElement("div"); text.innerHTML = `<b>${label}</b><span>${acceptLabel}</span><small>Recommended ${recommended}</small>`; info.append(thumb, text);
  const actions = document.createElement("div"); actions.className = "mf-ts-actions";
  const choose = document.createElement("button"); choose.type = "button"; choose.textContent = current ? "Replace" : "Select";
  const input = document.createElement("input"); input.type = "file"; input.accept = acceptFor(key); input.hidden = true;
  input.addEventListener("change", async () => { const file = input.files?.[0]; if (!file) return; try { await applyTexture(material, key, prop, file); refreshInspector(); status(`${label} texture applied`); } catch (error) { status(error.message || `Could not load ${file.name}`); } input.value = ""; });
  choose.addEventListener("click", () => input.click());
  const clear = document.createElement("button"); clear.type = "button"; clear.textContent = "Clear"; clear.disabled = !current;
  clear.addEventListener("click", () => { clearTexture(material, key, prop); refreshInspector(); status(`${label} texture cleared`); });
  actions.append(choose, clear, input); wrap.append(info, actions); wrap.title = hint; return wrap;
}

function acceptFor(key) { if (key === "baseColor" || key === "emissive") return ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"; return ".png,.webp,image/png,image/webp"; }

async function applyTexture(material, key, prop, file) {
  const maxBytes = 12 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`${file.name} is too large. Keep each texture under 12 MB.`);
  const dataUrl = await fileToDataURL(file); const image = await loadImage(dataUrl);
  if (image.width > 8192 || image.height > 8192) throw new Error(`${file.name} is ${image.width}×${image.height}. Maximum supported texture size is 8192×8192.`);
  const texture = new THREE.Texture(image); texture.needsUpdate = true; texture.colorSpace = key === "baseColor" || key === "emissive" ? THREE.SRGBColorSpace : THREE.NoColorSpace; texture.flipY = false; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  material[prop]?.dispose?.(); material[prop] = texture;
  material.userData = material.userData || {}; material.userData.textureSlots = material.userData.textureSlots || {};
  material.userData.textureSlots[key] = { dataUrl, name: file.name, width: image.width, height: image.height, bytes: file.size, type: file.type || "image/*" };
  if (key === "ao") ensureUV2(); applyUV(material, material.userData.textureTransform || { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0 }); material.needsUpdate = true;
}

function clearTexture(material, key, prop) { material[prop]?.dispose?.(); material[prop] = null; if (material.userData?.textureSlots) delete material.userData.textureSlots[key]; material.needsUpdate = true; }
function ensureUV2() { const object = getInspectorObject(); if (!object?.geometry?.attributes?.uv || object.geometry.attributes.uv2) return; const uv = object.geometry.attributes.uv; object.geometry.setAttribute("uv2", new THREE.BufferAttribute(uv.array.slice(0), 2)); }

function buildUVControls(parent, material) {
  const uv = { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, ...(material.userData?.textureTransform || {}) };
  [["Repeat X","repeatX",0.01,32],["Repeat Y","repeatY",0.01,32],["Offset X","offsetX",-10,10],["Offset Y","offsetY",-10,10],["Rotation°","rotation",-360,360]].forEach(([label,key,min,max]) => { const row=document.createElement("label"); row.className="mf-ts-uv-field"; row.innerHTML=`<span>${label}</span><input type="number" step="0.01" min="${min}" max="${max}" value="${Number(uv[key]??0)}">`; row.querySelector("input").addEventListener("change",event=>{uv[key]=clamp(Number(event.target.value),min,max);applyUV(material,uv);}); parent.appendChild(row); });
  const row=document.createElement("div"); row.className="mf-ts-uv-buttons"; const tile=document.createElement("button"); tile.type="button"; tile.textContent="Tile 2×"; tile.onclick=()=>{uv.repeatX=uv.repeatY=2;applyUV(material,uv);refreshInspector();}; const reset=document.createElement("button"); reset.type="button"; reset.textContent="Reset UV"; reset.onclick=()=>{uv.repeatX=uv.repeatY=1;uv.offsetX=uv.offsetY=uv.rotation=0;applyUV(material,uv);refreshInspector();}; row.append(tile,reset); parent.appendChild(row);
}

function applyUV(material, uv) { material.userData=material.userData||{}; material.userData.textureTransform={...uv}; ["map","normalMap","roughnessMap","metalnessMap","aoMap","displacementMap","emissiveMap","alphaMap"].forEach(prop=>{const texture=material[prop];if(!texture)return;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(uv.repeatX,uv.repeatY);texture.offset.set(uv.offsetX,uv.offsetY);texture.rotation=THREE.MathUtils.degToRad(uv.rotation);texture.center.set(.5,.5);texture.needsUpdate=true;}); }
function makePreview(texture,canvas){if(!texture?.image)return;try{const ctx=canvas.getContext("2d");ctx.clearRect(0,0,48,48);ctx.drawImage(texture.image,0,0,48,48);}catch{}}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Invalid or unreadable image"));image.src=src;});}
function clamp(n,min,max){return Math.min(max,Math.max(min,Number.isFinite(n)?n:min));}
function status(message){window.dispatchEvent(new CustomEvent("editor:status",{detail:message}));}

function installStyles(){if(document.getElementById(STYLE_ID))return;const style=document.createElement("style");style.id=STYLE_ID;style.textContent=`.mf-texture-system{margin-top:12px;padding-top:12px;border-top:1px solid #2b2f37}.mf-ts-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.mf-ts-head b{display:block;font-size:12px;color:#e8ebf0}.mf-ts-head span{display:block;font-size:9px;color:#7f8793;margin-top:2px}.mf-ts-shape{padding:4px 6px;border:1px solid #353a44;border-radius:4px;color:#9ca4b1!important;margin:0!important}.mf-ts-tip{display:flex;flex-direction:column;gap:2px;padding:8px;background:#14171c;border:1px solid #2b3039;border-radius:5px;margin-bottom:8px}.mf-ts-tip strong{font-size:10px;color:#cfd4dc}.mf-ts-tip span{font-size:9px;color:#777f8c}.mf-ts-grid{display:grid;gap:6px}.mf-ts-slot{display:flex;justify-content:space-between;gap:7px;align-items:center;padding:7px;border:1px solid #2d323b;border-radius:6px;background:#171a20}.mf-ts-slot-info{display:flex;align-items:center;gap:7px;min-width:0}.mf-ts-slot-info b,.mf-ts-slot-info span,.mf-ts-slot-info small{display:block}.mf-ts-slot-info b{font-size:10px;color:#dfe3e9}.mf-ts-slot-info span{font-size:8px;color:#7f8792;margin-top:1px}.mf-ts-slot-info small{font-size:8px;color:#626a77;margin-top:2px}.mf-ts-thumb{width:38px;height:38px;flex:none;display:grid;place-items:center;border:1px solid #343944;border-radius:4px;background:#0f1115;color:#68717f;overflow:hidden}.mf-ts-thumb canvas{width:38px;height:38px}.mf-ts-actions{display:flex;gap:4px}.mf-ts-actions button,.mf-ts-uv-buttons button{height:27px;padding:0 7px;border:1px solid #363b45;border-radius:4px;background:#20242b;color:#bfc5ce;font-size:9px;cursor:pointer}.mf-ts-actions button:hover,.mf-ts-uv-buttons button:hover{background:#292e37;color:#fff}.mf-ts-actions button:disabled{opacity:.4;cursor:default}.mf-ts-transform{margin-top:10px}.mf-ts-subhead{font-size:10px;color:#aeb5c0;margin-bottom:6px}.mf-ts-uv{display:grid;grid-template-columns:1fr 1fr;gap:5px}.mf-ts-uv-field{display:grid;grid-template-columns:1fr 1fr;gap:5px;align-items:center}.mf-ts-uv-field span{font-size:8px;color:#737b87}.mf-ts-uv-field input{width:100%;height:27px;box-sizing:border-box;border:1px solid #333843;border-radius:4px;background:#111318;color:#d6dae0;padding:0 6px;font-size:9px}.mf-ts-uv-buttons{grid-column:1/-1;display:flex;gap:5px;margin-top:2px}@media(max-width:600px){.mf-ts-slot{align-items:flex-start}.mf-ts-actions{flex-direction:column}.mf-ts-actions button{min-width:58px}}`;document.head.appendChild(style);}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initTextureSystem,{once:true});else initTextureSystem();
