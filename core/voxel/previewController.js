import { GreedyVoxelRenderer } from "./greedyRenderer.js";
import { createDefaultBlockRegistry } from "./blockRegistry.js";
import { snapVoxelCoordinate } from "./gridSnap.js";
import { scene } from "../scene.js";

export function initVoxelPreviewController() {
  let preview = null;
  let timer = null;
  let lastSignature = "";
  let snapStep = 1;
  const registry = createDefaultBlockRegistry();

  const ensure = () => {
    if (!preview) preview = new GreedyVoxelRenderer(scene, { chunkSize: 16, registry });
    return preview;
  };

  const getEditor = () => window.__modelForgeVoxelEditor || null;
  const setStatus = message => window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));

  const refresh = () => {
    const editor = getEditor();
    const grid = editor?.getGrid?.();
    if (!grid || !preview) return;
    const payload = grid.serialize();
    const signature = JSON.stringify(payload.blocks);
    if (signature === lastSignature) return;
    lastSignature = signature;
    const stats = preview.rebuild(grid);
    setStatus(`Greedy voxel preview · ${stats.blocks} blocks · ${stats.quads} quads · ${stats.chunks} chunks`);
  };

  const togglePreview = () => {
    const renderer = ensure();
    const editor = getEditor();
    const optimizedVisible = !renderer.root.visible;
    if (optimizedVisible && editor) {
      const original = scene.getObjectByName("VoxelWorkspace");
      if (original) original.visible = false;
      renderer.setVisible(true);
      refresh();
      setStatus("Greedy optimized preview enabled");
    } else {
      renderer.setVisible(false);
      const original = scene.getObjectByName("VoxelWorkspace");
      if (original) original.visible = !!editor?.isActive?.();
      setStatus("Standard voxel preview enabled");
    }
  };

  const updateSnap = value => {
    const numeric = Number(value);
    snapStep = numeric > 0 ? numeric : 1;
    window.__modelForgeVoxelSnapStep = snapStep;
    setStatus(`Voxel snap · ${snapStep}`);
  };

  const injectControls = () => {
    if (document.getElementById("voxelPerformanceTools")) return true;
    const panel = document.getElementById("voxelPalette");
    if (!panel) return false;
    const tools = document.createElement("div");
    tools.id = "voxelPerformanceTools";
    tools.innerHTML = `
      <div class="mf-voxel-perf-title">VIEW / GRID</div>
      <button type="button" id="voxelOptimizedBtn">Greedy Preview</button>
      <label>Snap <select id="voxelSnapStep"><option value="1">1 block</option><option value="2">2 blocks</option></select></label>
    `;
    panel.appendChild(tools);
    tools.querySelector("#voxelOptimizedBtn").addEventListener("click", togglePreview);
    tools.querySelector("#voxelSnapStep").addEventListener("change", event => updateSnap(event.target.value));
    const style = document.createElement("style");
    style.id = "voxelPerformanceStyles";
    style.textContent = `#voxelPerformanceTools{border-top:1px solid #292d35;padding:9px 10px;display:grid;gap:6px}.mf-voxel-perf-title{font-size:8px;letter-spacing:.15em;color:#747b88}.mf-voxel-perf-title+button,#voxelPerformanceTools label{font:10px system-ui,sans-serif;color:#bfc4cd}.mf-voxel-perf-title+button{border:1px solid #30343c;background:#191c22;color:#b8bdc7;border-radius:5px;padding:7px;text-align:left;cursor:pointer}.mf-voxel-perf-title+button:hover{background:#252932;color:#fff}#voxelPerformanceTools select{margin-left:6px;border:1px solid #30343c;background:#191c22;color:#c9cdd5;border-radius:4px;padding:4px;font:10px system-ui,sans-serif}`;
    document.head.appendChild(style);
    return true;
  };

  const boot = () => {
    if (!injectControls()) return false;
    ensure();
    if (!timer) timer = window.setInterval(refresh, 700);
    window.addEventListener("editor:voxel-mode", () => {
      const editor = getEditor();
      const original = scene.getObjectByName("VoxelWorkspace");
      if (original && preview?.root?.visible !== true) original.visible = !!editor?.isActive?.();
    });
    return true;
  };

  const start = () => { if (!boot()) requestAnimationFrame(() => requestAnimationFrame(start)); };
  start();

  return {
    refresh,
    togglePreview,
    setSnapStep: updateSnap,
    snap: coordinate => snapVoxelCoordinate(coordinate, snapStep),
    getSnapStep: () => snapStep,
    getStats: () => preview?.getStats?.() || { chunks: 0, blocks: 0, quads: 0, meshes: 0, visible: false },
    getRegistry: () => registry
  };
}
