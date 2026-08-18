import { exportProductionAsset } from "./productionAssetExporter.js";

export function initProductionAssetUI(scene) {
    if (document.getElementById("productionAssetBtn")) return;

    const host = document.querySelector(".top-actions");
    if (!host) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "productionAssetBtn";
    button.className = "action-btn";
    button.textContent = "Production Asset";
    host.insertBefore(button, host.firstChild);

    button.addEventListener("click", () => openDialog(scene));
}

function openDialog(scene) {
    if (document.getElementById("productionAssetDialog")) return;

    const panel = document.createElement("div");
    panel.id = "productionAssetDialog";
    panel.className = "save-format-dialog";
    panel.innerHTML = `
      <div class="save-format-card production-asset-card">
        <div class="dialog-kicker">VOXEL FRONTIER · PRODUCTION</div>
        <h3>Prepare Game Asset</h3>
        <p class="dialog-description">Clean the current structure without redesigning its visual identity, then export GLB + metadata + preview.</p>
        <label class="save-field-label" for="productionAssetId">Asset ID</label>
        <input id="productionAssetId" value="small_house_01" spellcheck="false" autocomplete="off">
        <div class="production-grid">
          <div><label class="save-field-label" for="productionAssetType">Type</label><input id="productionAssetType" value="structure"></div>
          <div><label class="save-field-label" for="productionAssetCategory">Category</label><input id="productionAssetCategory" value="house"></div>
        </div>
        <label class="save-field-label" for="productionAssetBiomes">Suggested biomes</label>
        <input id="productionAssetBiomes" value="plains, forest" spellcheck="false">
        <div class="production-checklist">
          <div>✓ Remove editor/helper objects</div>
          <div>✓ Bake transforms + ground at Y=0</div>
          <div>✓ Center bottom pivot</div>
          <div>✓ Clean names/materials</div>
          <div>✓ Validate production placement</div>
          <div>✓ Export GLB 2.0 + metadata + preview</div>
        </div>
        <div id="productionAssetResult" class="production-result" hidden></div>
        <div class="save-format-actions">
          <button type="button" data-cancel>Cancel</button>
          <button type="button" class="primary" data-prepare>Prepare Asset</button>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const result = panel.querySelector("#productionAssetResult");
    const prepare = panel.querySelector("[data-prepare]");
    const close = () => panel.remove();

    panel.addEventListener("click", event => {
        if (event.target === panel || event.target.closest("[data-cancel]")) return close();
        if (!event.target.closest("[data-prepare]")) return;
        const id = panel.querySelector("#productionAssetId").value.trim();
        const type = panel.querySelector("#productionAssetType").value.trim() || "structure";
        const category = panel.querySelector("#productionAssetCategory").value.trim() || "house";
        const suggestedBiomes = panel.querySelector("#productionAssetBiomes").value.split(",").map(item => item.trim()).filter(Boolean);
        prepare.disabled = true;
        prepare.textContent = "Preparing…";
        result.hidden = false;
        result.textContent = "Cleaning and validating structure…";
        exportProductionAsset(scene, { id, type, category, suggestedBiomes })
            .then(output => {
                result.textContent = `Ready · ${output.report.meshCountAfter} meshes · ${output.report.materialCount} materials · ${output.metadata.dimensions.x} × ${output.metadata.dimensions.y} × ${output.metadata.dimensions.z}`;
                result.classList.add("success");
                prepare.textContent = "Exported";
                window.dispatchEvent(new CustomEvent("editor:production-asset-ready", { detail: output.metadata }));
            })
            .catch(error => {
                result.textContent = `Blocked: ${error.message || "production validation failed"}`;
                result.classList.add("error");
                prepare.disabled = false;
                prepare.textContent = "Prepare Asset";
            });
    });

    const style = document.createElement("style");
    style.id = "productionAssetStyles";
    style.textContent = `
      #productionAssetDialog .production-asset-card{width:min(520px,calc(100vw - 32px))}
      .production-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .production-checklist{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:16px;padding:10px;border:1px solid #2e323a;border-radius:6px;background:#111318;color:#9ca2ad;font:10px/1.4 system-ui,sans-serif}
      .production-result{margin-top:10px;padding:9px;border-radius:5px;border:1px solid #30343c;background:#111318;color:#adb3be;font:10px/1.4 system-ui,sans-serif}
      .production-result.success{border-color:#3e5d49;color:#a8d2b4}.production-result.error{border-color:#634346;color:#e1a8ad}
      @media(max-width:600px){.production-grid,.production-checklist{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    panel.querySelector("#productionAssetId")?.focus();
    panel.querySelector("#productionAssetId")?.select();
}
