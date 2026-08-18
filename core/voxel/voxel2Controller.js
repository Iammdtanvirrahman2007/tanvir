import { createDefaultBlockRegistry } from "./blockRegistry.js";
import { validateVoxelGrid } from "./validator.js";
import { generateVoxelCollision } from "./collision.js";

export function initVoxel2Controller() {
  if (window.__modelForgeVoxel2) return window.__modelForgeVoxel2;
  const registry = createDefaultBlockRegistry();
  const api = {
    registry,
    validate() {
      const grid = window.__modelForgeVoxelEditor?.getGrid?.();
      if (!grid) return { valid: false, errors: [{ code: "NO_GRID", message: "Voxel grid is not available." }], warnings: [] };
      const result = validateVoxelGrid(grid, { registry });
      window.__modelForgeVoxelValidation = result;
      window.dispatchEvent(new CustomEvent("editor:voxel-validation", { detail: result }));
      return result;
    },
    generateCollision() {
      const grid = window.__modelForgeVoxelEditor?.getGrid?.();
      if (!grid) return { version: 1, boxes: [], count: 0 };
      const collision = generateVoxelCollision(grid, { registry });
      window.__modelForgeVoxelCollision = collision;
      window.dispatchEvent(new CustomEvent("editor:voxel-collision", { detail: collision }));
      return collision;
    }
  };
  window.__modelForgeVoxel2 = api;
  installPanel(api);
  return api;
}

function installPanel(api) {
  const boot = () => {
    const palette = document.getElementById("voxelPalette");
    if (!palette || document.getElementById("voxel2Tools")) return !palette;
    const panel = document.createElement("section");
    panel.id = "voxel2Tools";
    panel.innerHTML = `
      <div class="mf-v2-kicker">VOXEL 2.0</div>
      <div class="mf-v2-actions">
        <button type="button" data-action="validate">Validate</button>
        <button type="button" data-action="collision">Collision</button>
        <button type="button" data-action="registry">Registry</button>
      </div>
      <div class="mf-v2-result" id="voxel2Result">Ready for voxel QA</div>
    `;
    palette.appendChild(panel);
    panel.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      if (action === "validate") {
        const result = api.validate();
        panel.querySelector("#voxel2Result").textContent = result.valid
          ? `Valid · ${result.warnings.length} warnings`
          : `Blocked · ${result.errors.length} errors · ${result.warnings.length} warnings`;
      } else if (action === "collision") {
        const result = api.generateCollision();
        panel.querySelector("#voxel2Result").textContent = `Collision · ${result.count} AABB runs`;
      } else {
        showRegistry(api.registry, panel.querySelector("#voxel2Result"));
      }
    });
    const style = document.createElement("style");
    style.id = "voxel2Styles";
    style.textContent = `#voxel2Tools{border-top:1px solid #292d35;padding:10px}.mf-v2-kicker{font-size:8px;letter-spacing:.16em;color:#77808d;margin-bottom:7px}.mf-v2-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}.mf-v2-actions button{border:1px solid #30343c;background:#191c22;color:#bfc4cd;border-radius:5px;padding:7px 5px;font:500 9px system-ui,sans-serif;cursor:pointer}.mf-v2-actions button:hover{background:#252932;color:#fff}.mf-v2-result{margin-top:7px;padding:7px 8px;border-radius:5px;border:1px solid #2d323a;background:#101217;color:#89919d;font:9px/1.35 system-ui,sans-serif}`;
    document.head.appendChild(style);
    return true;
  };
  const retry = () => { if (!boot()) requestAnimationFrame(() => requestAnimationFrame(retry)); };
  retry();
}

function showRegistry(registry, result) {
  const list = registry.list().filter(block => block.id !== "air").map(block => `${block.id} (${block.transparent ? "transparent" : "solid"})`).join(" · ");
  result.textContent = `${registry.list().length} registered blocks · ${list}`;
}
