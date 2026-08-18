import * as THREE from "three";
import { scene } from "../scene.js";
import { pushHistory } from "../history.js";
import { mirror, mirrorPlane, rotateY90, layerRecords, snapshot, restoreSnapshot, symmetricSet } from "./voxelTransforms.js";

const BLOCK_COLORS = {
  grass: 0x6ea84f,
  dirt: 0x8b5a2b,
  stone: 0x8a8f98,
  wood: 0x9a6a3a,
  sand: 0xd7bf78,
  brick: 0xa9564a,
  glass: 0x8fc7dc
};

export function initVoxelTransformUI() {
  if (window.__modelForgeVoxelTransformsUI) return window.__modelForgeVoxelTransformsUI;
  const start = () => {
    const editor = window.__modelForgeVoxelEditor;
    if (!editor?.getGrid) return;
    const root = scene.getObjectByName("VoxelWorkspace");
    if (!root) return;
    const api = { destroy: () => panel.remove(), refresh: render };
    const panel = buildPanel(editor, root);
    document.body.appendChild(panel);
    render();
    window.__modelForgeVoxelTransformsUI = api;
    return api;
  };
  let api = start();
  if (!api) {
    let attempts = 0;
    const retry = () => {
      api = start();
      if (!api && attempts++ < 60) requestAnimationFrame(retry);
    };
    requestAnimationFrame(retry);
  }
  return api;
}

function buildPanel(editor, root) {
  const panel = document.createElement("aside");
  panel.id = "voxelTransformPanel";
  panel.innerHTML = `
    <div class="vtx-head"><div><span>VOXEL TOOLS</span><strong>Transform & Layers</strong></div><button type="button" data-close>×</button></div>
    <div class="vtx-section"><div class="vtx-label">MIRROR</div><div class="vtx-grid"><button data-action="mirror-x">Mirror X</button><button data-action="mirror-y">Mirror Y</button><button data-action="mirror-z">Mirror Z</button></div></div>
    <div class="vtx-section"><div class="vtx-label">ROTATE</div><div class="vtx-grid"><button data-action="rotate-y">Rotate Y 90°</button><button data-action="symmetry">Symmetry X</button></div></div>
    <div class="vtx-section"><div class="vtx-label">LAYER VISIBILITY</div><div class="vtx-layer-row"><select data-layer></select><button data-layer-action="show">Show</button><button data-layer-action="hide">Hide</button></div><div class="vtx-help">Layers use the voxel Y coordinate.</div></div>
  `;
  const style = document.createElement("style");
  style.id = "voxelTransformStyles";
  style.textContent = `
    #voxelTransformPanel{position:fixed;right:18px;top:78px;width:230px;z-index:130;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font-family:system-ui,sans-serif;overflow:hidden}
    .vtx-head{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;border-bottom:1px solid #292d35;background:#17191f}.vtx-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.vtx-head strong{display:block;font-size:13px;margin-top:2px}.vtx-head button{width:26px;height:26px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px;cursor:pointer}
    .vtx-section{padding:10px 10px;border-bottom:1px solid #252831}.vtx-label{font-size:8px;letter-spacing:.13em;color:#7f8692;margin-bottom:7px}.vtx-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.vtx-grid button,.vtx-layer-row button,.vtx-layer-row select{min-height:30px;border:1px solid #30343c;border-radius:5px;background:#191c22;color:#b8bdc7;font:500 10px system-ui;cursor:pointer}.vtx-grid button:hover,.vtx-layer-row button:hover{background:#252932;color:#fff}.vtx-layer-row{display:grid;grid-template-columns:1fr auto auto;gap:5px}.vtx-help{padding-top:7px;color:#777e8a;font-size:9px;line-height:1.35}
    @media(max-width:760px){#voxelTransformPanel{left:8px;right:8px;top:auto;bottom:8px;width:auto}.vtx-grid{grid-template-columns:repeat(4,1fr)}.vtx-section{padding:8px}}
  `;
  document.head.appendChild(style);

  panel.querySelector("[data-close]").addEventListener("click", () => { panel.remove(); window.__modelForgeVoxelTransformsUI = null; });
  panel.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => {
    const grid = editor.getGrid();
    const before = snapshot(grid);
    try {
      if (button.dataset.action === "mirror-x") mirror(grid, "x");
      if (button.dataset.action === "mirror-y") mirror(grid, "y");
      if (button.dataset.action === "mirror-z") mirror(grid, "z");
      if (button.dataset.action === "rotate-y") rotateY90(grid, 1);
      if (button.dataset.action === "symmetry") symmetricSet(grid, "x");
      render();
      pushHistory({
        label: `Voxel ${button.textContent.trim()}`,
        undo: () => { restoreSnapshot(grid, before); render(); },
        redo: () => { applyAction(grid, button.dataset.action); render(); }
      });
      window.dispatchEvent(new CustomEvent("editor:status", { detail: `${button.textContent.trim()} applied` }));
    } catch (error) {
      restoreSnapshot(grid, before);
      window.dispatchEvent(new CustomEvent("editor:status", { detail: `Voxel transform failed: ${error.message}` }));
    }
  }));

  panel.querySelector("[data-layer-action=show]").addEventListener("click", () => setLayer(true));
  panel.querySelector("[data-layer-action=hide]").addEventListener("click", () => setLayer(false));

  function setLayer(visible) {
    const index = Number(panel.querySelector("[data-layer]").value);
    for (const mesh of root.children) {
      const coordinate = mesh.userData?.voxel;
      if (coordinate && coordinate[1] === index) mesh.visible = visible;
    }
    window.dispatchEvent(new CustomEvent("editor:status", { detail: `Layer ${index}: ${visible ? "visible" : "hidden"}` }));
  }

  return panel;

  function applyAction(grid, action) {
    if (action === "mirror-x") mirror(grid, "x");
    else if (action === "mirror-y") mirror(grid, "y");
    else if (action === "mirror-z") mirror(grid, "z");
    else if (action === "rotate-y") rotateY90(grid, 1);
    else if (action === "symmetry") symmetricSet(grid, "x");
  }

  function render() {
    const grid = editor.getGrid();
    for (const child of [...root.children]) {
      child.removeFromParent();
      child.geometry?.dispose?.();
    }
    const materialCache = new Map();
    grid.forEachBlock(block => {
      const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
      let material = materialCache.get(block.blockId);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[block.blockId] ?? 0xffffff, roughness: block.blockId === "glass" ? 0.15 : 0.9 });
        if (block.blockId === "glass") { material.transparent = true; material.opacity = 0.45; }
        materialCache.set(block.blockId, material);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
      mesh.userData.voxel = [block.x, block.y, block.z];
      root.add(mesh);
    });
    const layerSelect = panel.querySelector("[data-layer]");
    const current = Number(layerSelect.value);
    layerSelect.innerHTML = "";
    for (const layer of layerRecords(grid, "y")) {
      const option = document.createElement("option");
      option.value = layer.index;
      option.textContent = `Layer Y=${layer.index} (${layer.blocks.length})`;
      layerSelect.appendChild(option);
    }
    if ([...layerSelect.options].some(option => Number(option.value) === current)) layerSelect.value = String(current);
  }
}
