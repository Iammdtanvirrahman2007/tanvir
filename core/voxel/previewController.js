import { VoxelInstancedRenderer } from "./instancedRenderer.js";
import { snapVoxelCoordinate } from "./gridSnap.js";
import { scene } from "../scene.js";

export function initVoxelPreviewController() {
    let preview = null;
    let timer = null;
    let lastSignature = "";
    let snapStep = 1;

    const ensure = () => {
        if (!preview) preview = new VoxelInstancedRenderer(scene);
        return preview;
    };

    const getEditor = () => window.__modelForgeVoxelEditor || null;

    const refresh = () => {
        const editor = getEditor();
        const grid = editor?.getGrid?.();
        if (!grid || !preview) return;
        const payload = grid.serialize();
        const signature = JSON.stringify(payload.blocks);
        if (signature === lastSignature) return;
        lastSignature = signature;
        const stats = preview.rebuild(grid);
        setStatus(`Optimized voxel preview · ${stats.blocks} blocks · ${stats.batches} batches`);
    };

    const setStatus = message => window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));

    const togglePreview = () => {
        const renderer = ensure();
        const editor = getEditor();
        const optimizedVisible = !renderer.root.visible;
        if (optimizedVisible && editor) {
            const original = scene.getObjectByName("VoxelWorkspace");
            if (original) original.visible = false;
            renderer.setVisible(true);
            refresh();
            setStatus("Optimized voxel preview enabled");
        } else {
            renderer.setVisible(false);
            const original = scene.getObjectByName("VoxelWorkspace");
            if (original) original.visible = !!editor?.isActive?.();
            setStatus("Standard voxel preview enabled");
        }
    };

    const updateSnap = value => {
        snapStep = Number(value) > 0 ? Number(value) : 1;
        window.__modelForgeVoxelSnapStep = snapStep;
        setStatus(`Voxel snap · ${snapStep}`);
    };

    const injectControls = () => {
        if (document.getElementById("voxelPerformanceTools")) return;
        const panel = document.getElementById("voxelPalette");
        if (!panel) return false;
        const tools = document.createElement("div");
        tools.id = "voxelPerformanceTools";
        tools.innerHTML = `
            <div class="mf-voxel-perf-title">VIEW / SNAP</div>
            <button type="button" id="voxelOptimizedBtn">Optimized Preview</button>
            <label>Snap <select id="voxelSnapStep"><option value="1">1 block</option><option value="0.5">0.5 block</option><option value="2">2 blocks</option></select></label>
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
        if (!timer) timer = window.setInterval(refresh, 500);
        window.addEventListener("editor:voxel-mode", () => {
            const editor = getEditor();
            const original = scene.getObjectByName("VoxelWorkspace");
            if (original && preview?.root?.visible !== true) original.visible = !!editor?.isActive?.();
        });
        return true;
    };

    const start = () => {
        if (boot()) return;
        requestAnimationFrame(() => requestAnimationFrame(start));
    };
    start();

    return {
        refresh,
        togglePreview,
        setSnapStep: updateSnap,
        getSnapStep: () => snapStep,
        getStats: () => preview?.getStats?.() || { batches: 0, instances: 0, visible: false }
    };
}

export { snapVoxelCoordinate };
