import { exportProductionAsset } from "./productionAssetExporter.js";

const DEFAULTS = {
    id: "small_house_01",
    type: "structure",
    category: "house",
    biomes: "plains, forest"
};

export function initProductionAssetUI(scene) {
    if (document.getElementById("productionAssetBtn")) return;

    const host = document.querySelector(".top-actions");
    if (!host) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "productionAssetBtn";
    button.className = "action-btn production-asset-trigger";
    button.innerHTML = `<span class="mf-prod-trigger-icon">◆</span><span>Production Asset</span>`;
    button.title = "Prepare the current scene as a production-ready game asset";
    host.insertBefore(button, host.firstChild);
    button.addEventListener("click", () => openDialog(scene));
}

function openDialog(scene) {
    if (document.getElementById("productionAssetDialog")) return;
    installStyles();

    const panel = document.createElement("div");
    panel.id = "productionAssetDialog";
    panel.className = "mf-production-overlay";
    panel.innerHTML = `
      <section class="mf-production-modal" role="dialog" aria-modal="true" aria-labelledby="productionAssetTitle">
        <header class="mf-production-header">
          <div class="mf-production-title-wrap">
            <div class="mf-production-kicker"><span class="mf-production-dot"></span>VOXEL FRONTIER <span>/</span> PRODUCTION</div>
            <h2 id="productionAssetTitle">Prepare Game Asset</h2>
            <p>Clean, validate and package the current structure without changing its visual identity.</p>
          </div>
          <button type="button" class="mf-production-close" data-cancel aria-label="Close">×</button>
        </header>

        <div class="mf-production-body">
          <div class="mf-production-main">
            <div class="mf-production-section-head">
              <div>
                <span class="mf-production-eyebrow">ASSET DEFINITION</span>
                <h3>Identity & classification</h3>
              </div>
              <span class="mf-production-badge">GAME READY</span>
            </div>

            <div class="mf-production-form-grid">
              <label class="mf-field mf-field-wide">
                <span>Asset ID</span>
                <input id="productionAssetId" value="${DEFAULTS.id}" spellcheck="false" autocomplete="off">
                <small>Stable identifier used by the world generator.</small>
              </label>
              <label class="mf-field">
                <span>Type</span>
                <input id="productionAssetType" value="${DEFAULTS.type}" spellcheck="false">
              </label>
              <label class="mf-field">
                <span>Category</span>
                <input id="productionAssetCategory" value="${DEFAULTS.category}" spellcheck="false">
              </label>
              <label class="mf-field mf-field-wide">
                <span>Suggested biomes</span>
                <input id="productionAssetBiomes" value="${DEFAULTS.biomes}" spellcheck="false">
                <small>Comma-separated biome tags.</small>
              </label>
            </div>

            <div class="mf-production-section-head mf-production-section-head-spaced">
              <div>
                <span class="mf-production-eyebrow">PROCESS</span>
                <h3>What ModelForge will do</h3>
              </div>
            </div>

            <div class="mf-production-steps">
              ${step("01", "Clean scene", "Remove editor helpers, debug objects, cameras and unnecessary lights.", "✓")}
              ${step("02", "Normalize asset", "Bake transforms, clean names/materials and ground the asset at Y = 0.", "✓")}
              ${step("03", "Validate placement", "Check pivot, scale, dimensions and procedural rotation rules.", "✓")}
              ${step("04", "Package output", "Export GLB 2.0 with metadata and preview assets for the registry.", "✓")}
            </div>
          </div>

          <aside class="mf-production-side">
            <div class="mf-production-preview-card">
              <div class="mf-production-preview-art">
                <div class="mf-production-preview-grid"></div>
                <div class="mf-production-preview-house">
                  <span></span><span></span><span></span>
                </div>
              </div>
              <div class="mf-production-preview-caption">
                <div>
                  <span class="mf-production-eyebrow">OUTPUT TARGET</span>
                  <strong id="productionOutputName">small_house_01</strong>
                </div>
                <span class="mf-output-format">GLB</span>
              </div>
            </div>

            <div class="mf-production-info-card">
              <div class="mf-info-row"><span>Origin</span><strong>Bottom-center</strong></div>
              <div class="mf-info-row"><span>Scale</span><strong>1 voxel = 1 unit</strong></div>
              <div class="mf-info-row"><span>Rotation</span><strong>0° · 90° · 180° · 270°</strong></div>
              <div class="mf-info-row"><span>Placement</span><strong>Terrain aligned</strong></div>
            </div>

            <div class="mf-production-package-card">
              <div class="mf-production-eyebrow">PACKAGE</div>
              <div class="mf-package-path">assets / structures / <strong id="productionPackageName">small_house_01</strong></div>
              <div class="mf-package-files">
                <span>model.glb</span>
                <span>metadata.json</span>
                <span>preview.webp</span>
              </div>
            </div>
          </aside>
        </div>

        <div class="mf-production-status" id="productionAssetResult" hidden></div>

        <footer class="mf-production-footer">
          <div class="mf-production-footer-note"><span class="mf-production-check">✓</span> Source geometry is never redesigned by this workflow.</div>
          <div class="mf-production-actions">
            <button type="button" class="mf-secondary-btn" data-cancel>Cancel</button>
            <button type="button" class="mf-primary-btn" data-prepare><span>Prepare Asset</span><span class="mf-primary-arrow">→</span></button>
          </div>
        </footer>
      </section>
    `;

    document.body.appendChild(panel);

    const result = panel.querySelector("#productionAssetResult");
    const prepare = panel.querySelector("[data-prepare]");
    const idInput = panel.querySelector("#productionAssetId");
    const outputName = panel.querySelector("#productionOutputName");
    const packageName = panel.querySelector("#productionPackageName");

    const syncName = () => {
        const value = idInput.value.trim() || DEFAULTS.id;
        outputName.textContent = value;
        packageName.textContent = value;
    };
    idInput.addEventListener("input", syncName);

    const close = () => panel.remove();
    panel.addEventListener("click", event => {
        if (event.target === panel || event.target.closest("[data-cancel]")) return close();
        if (!event.target.closest("[data-prepare]")) return;

        const id = idInput.value.trim();
        const type = panel.querySelector("#productionAssetType").value.trim() || DEFAULTS.type;
        const category = panel.querySelector("#productionAssetCategory").value.trim() || DEFAULTS.category;
        const suggestedBiomes = panel.querySelector("#productionAssetBiomes").value
            .split(",").map(item => item.trim()).filter(Boolean);

        if (!id) {
            result.hidden = false;
            result.className = "mf-production-status is-error";
            result.innerHTML = `<span>!</span><div><strong>Asset ID required</strong><small>Provide a stable identifier before preparing the package.</small></div>`;
            idInput.focus();
            return;
        }

        prepare.disabled = true;
        prepare.innerHTML = `<span class="mf-spinner"></span><span>Preparing asset…</span>`;
        result.hidden = false;
        result.className = "mf-production-status is-running";
        result.innerHTML = `<span class="mf-spinner"></span><div><strong>Processing production package</strong><small>Cleaning, normalizing and validating the current scene.</small></div>`;

        exportProductionAsset(scene, { id, type, category, suggestedBiomes })
            .then(output => {
                result.className = "mf-production-status is-success";
                result.innerHTML = `<span>✓</span><div><strong>Production package ready</strong><small>${output.report.meshCountAfter} meshes · ${output.report.materialCount} materials · ${output.metadata.dimensions.x} × ${output.metadata.dimensions.y} × ${output.metadata.dimensions.z} units</small></div>`;
                prepare.innerHTML = `<span>Export complete</span><span class="mf-primary-arrow">✓</span>`;
                window.dispatchEvent(new CustomEvent("editor:production-asset-ready", { detail: output.metadata }));
            })
            .catch(error => {
                result.className = "mf-production-status is-error";
                result.innerHTML = `<span>!</span><div><strong>Export blocked</strong><small>${escapeHtml(error.message || "Production validation failed")}</small></div>`;
                prepare.disabled = false;
                prepare.innerHTML = `<span>Prepare Asset</span><span class="mf-primary-arrow">→</span>`;
            });
    });

    const onKey = event => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
        if (event.key === "Enter" && document.activeElement === idInput) {
            event.preventDefault();
            prepare.click();
        }
    };
    window.addEventListener("keydown", onKey);
    const cleanup = () => window.removeEventListener("keydown", onKey);
    const observer = new MutationObserver(() => {
        if (!document.body.contains(panel)) {
            cleanup();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true });

    requestAnimationFrame(() => {
        idInput.focus();
        idInput.select();
    });
}

function step(number, title, description, mark) {
    return `<div class="mf-production-step"><div class="mf-step-index">${number}</div><div class="mf-step-copy"><strong>${title}</strong><span>${description}</span></div><div class="mf-step-mark">${mark}</div></div>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
}

function installStyles() {
    if (document.getElementById("mfProductionAssetStyles")) return;
    const style = document.createElement("style");
    style.id = "mfProductionAssetStyles";
    style.textContent = `
      #productionAssetBtn.production-asset-trigger{display:inline-flex;align-items:center;gap:7px}
      #productionAssetBtn .mf-prod-trigger-icon{font-size:9px;opacity:.8}
      .mf-production-overlay{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:28px;background:rgba(3,5,8,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
      .mf-production-modal{width:min(930px,calc(100vw - 48px));max-height:min(860px,calc(100vh - 48px));display:flex;flex-direction:column;overflow:hidden;border:1px solid #303641;border-radius:16px;background:linear-gradient(180deg,#171a20 0%,#12151a 100%);box-shadow:0 40px 120px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.025) inset;color:#eef0f4;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .mf-production-header{display:flex;justify-content:space-between;gap:24px;padding:24px 26px 21px;border-bottom:1px solid #292e37;background:linear-gradient(180deg,rgba(255,255,255,.022),transparent)}
      .mf-production-kicker{display:flex;align-items:center;gap:7px;font-size:9px;font-weight:700;letter-spacing:.18em;color:#7f8896}.mf-production-kicker span{opacity:.5}.mf-production-dot{width:6px;height:6px;border-radius:50%;background:#9da6b4;box-shadow:0 0 0 3px rgba(157,166,180,.08)}
      .mf-production-title-wrap h2{margin:7px 0 7px;font-size:22px;line-height:1.15;letter-spacing:-.025em;font-weight:650;color:#f5f6f8}.mf-production-title-wrap p{margin:0;color:#848d9b;font-size:12px;line-height:1.55;max-width:620px}.mf-production-close{flex:0 0 auto;width:34px;height:34px;border:1px solid #303641;border-radius:8px;background:#1a1e24;color:#8e96a3;font-size:22px;line-height:1;cursor:pointer}.mf-production-close:hover{background:#242931;color:#fff;border-color:#434a56}
      .mf-production-body{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,.8fr);gap:22px;padding:22px 26px;overflow:auto}
      .mf-production-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.mf-production-section-head-spaced{margin-top:23px}.mf-production-eyebrow{display:block;font-size:8px;line-height:1;letter-spacing:.18em;font-weight:750;color:#707a88}.mf-production-section-head h3{margin:6px 0 0;font-size:13px;font-weight:620;color:#dce0e6}.mf-production-badge{padding:5px 8px;border:1px solid #38404c;border-radius:999px;color:#99a3b2;background:#1a1f26;font-size:8px;font-weight:750;letter-spacing:.1em}
      .mf-production-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:15px}.mf-field{display:flex;flex-direction:column;gap:6px}.mf-field-wide{grid-column:1/-1}.mf-field span{font-size:9px;font-weight:650;color:#a5adba;letter-spacing:.04em}.mf-field input{width:100%;height:38px;box-sizing:border-box;border:1px solid #303640;border-radius:8px;background:#101319;color:#e8ebef;padding:0 11px;font:500 12px/1 system-ui,sans-serif;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}.mf-field input:hover{background:#13171d}.mf-field input:focus{border-color:#6a7381;background:#12161c;box-shadow:0 0 0 3px rgba(120,130,145,.1)}.mf-field small{font-size:8.5px;line-height:1.4;color:#66707d}
      .mf-production-steps{display:grid;gap:7px;margin-top:12px}.mf-production-step{display:grid;grid-template-columns:31px minmax(0,1fr) 20px;align-items:center;gap:11px;padding:11px 12px;border:1px solid #2a3039;border-radius:9px;background:rgba(255,255,255,.018)}.mf-production-step:hover{background:rgba(255,255,255,.028);border-color:#363d48}.mf-step-index{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:#1e232b;color:#778190;font-size:8px;font-weight:750;letter-spacing:.08em}.mf-step-copy{min-width:0}.mf-step-copy strong{display:block;font-size:10px;font-weight:650;color:#dce1e8}.mf-step-copy span{display:block;margin-top:3px;color:#707987;font-size:8.5px;line-height:1.45}.mf-step-mark{color:#aab4c0;font-size:11px;text-align:center}
      .mf-production-side{display:grid;align-content:start;gap:11px}.mf-production-preview-card,.mf-production-info-card,.mf-production-package-card{border:1px solid #2b313a;border-radius:11px;background:rgba(255,255,255,.018);overflow:hidden}.mf-production-preview-art{height:150px;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 55%,#2a3038 0,#1b1f26 42%,#12151a 75%)}.mf-production-preview-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:20px 20px;mask-image:linear-gradient(to bottom,transparent,#000 20%,#000 80%,transparent)}.mf-production-preview-house{position:absolute;left:50%;top:54%;width:112px;height:70px;transform:translate(-50%,-50%);border:2px solid #7e8793;border-top:0;border-radius:3px;background:linear-gradient(180deg,transparent 0 22px,rgba(123,135,150,.08) 22px 100%);box-shadow:0 10px 40px rgba(0,0,0,.34)}.mf-production-preview-house:before,.mf-production-preview-house:after{content:"";position:absolute;top:-22px;width:2px;height:22px;background:#7e8793}.mf-production-preview-house:before{left:17px}.mf-production-preview-house:after{right:17px}.mf-production-preview-house span{position:absolute;bottom:0;width:2px;height:100%;background:#6f7986}.mf-production-preview-house span:nth-child(1){left:17px}.mf-production-preview-house span:nth-child(2){left:54px}.mf-production-preview-house span:nth-child(3){right:17px}.mf-production-preview-caption{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;border-top:1px solid #292f38}.mf-production-preview-caption strong{display:block;margin-top:5px;font-size:12px;color:#e7eaee;word-break:break-all}.mf-output-format{padding:5px 7px;border:1px solid #3a414d;border-radius:6px;color:#aab4c1;background:#1a1f26;font-size:8px;font-weight:800;letter-spacing:.12em}
      .mf-production-info-card{padding:9px 13px}.mf-info-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #252a32}.mf-info-row:last-child{border-bottom:0}.mf-info-row span{color:#707987;font-size:9px}.mf-info-row strong{color:#cdd3db;font-size:9px;font-weight:600;text-align:right}.mf-production-package-card{padding:13px}.mf-package-path{margin-top:7px;color:#b0b8c3;font-size:9px;line-height:1.5;word-break:break-word}.mf-package-path strong{color:#eef1f4}.mf-package-files{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.mf-package-files span{padding:5px 7px;border:1px solid #303742;border-radius:5px;background:#171b21;color:#7f8997;font-size:8px}
      .mf-production-status{display:flex;align-items:center;gap:10px;margin:0 26px 16px;padding:11px 12px;border:1px solid #303741;border-radius:9px;font-size:10px}.mf-production-status>span:first-child{width:20px;text-align:center;flex:0 0 auto}.mf-production-status strong{display:block;color:#e2e6eb;font-size:10px}.mf-production-status small{display:block;margin-top:2px;color:#7f8996;font-size:8.5px;line-height:1.4}.mf-production-status.is-running{background:#181d24}.mf-production-status.is-success{border-color:#34483b;background:#151d18}.mf-production-status.is-success>span:first-child{color:#9fc8ac}.mf-production-status.is-error{border-color:#57383d;background:#201719}.mf-production-status.is-error>span:first-child{color:#df9ca5}
      .mf-production-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 26px;border-top:1px solid #292e37;background:#12151a}.mf-production-footer-note{display:flex;align-items:center;gap:7px;color:#697482;font-size:8.5px}.mf-production-check{width:17px;height:17px;display:grid;place-items:center;border:1px solid #3b444f;border-radius:50%;color:#8f9aa7;font-size:8px}.mf-production-actions{display:flex;gap:8px}.mf-secondary-btn,.mf-primary-btn{height:38px;padding:0 13px;border-radius:8px;font:650 10px system-ui,sans-serif;cursor:pointer}.mf-secondary-btn{border:1px solid #303741;background:#1a1e24;color:#8d96a3}.mf-secondary-btn:hover{background:#242930;color:#e8ebef;border-color:#424a56}.mf-primary-btn{display:inline-flex;align-items:center;gap:13px;border:1px solid #d4d9df;background:#eef0f2;color:#111419;min-width:145px;justify-content:center}.mf-primary-btn:hover{background:#fff}.mf-primary-btn:disabled{opacity:.58;cursor:wait}.mf-primary-arrow{font-size:13px}.mf-spinner{width:11px;height:11px;display:inline-block;border:2px solid rgba(220,225,232,.2);border-top-color:#d8dee7;border-radius:50%;animation:mfProdSpin .7s linear infinite}@keyframes mfProdSpin{to{transform:rotate(360deg)}}
      @media(max-width:820px){.mf-production-body{grid-template-columns:1fr}.mf-production-side{grid-row:1}.mf-production-preview-art{height:120px}.mf-production-form-grid{grid-template-columns:1fr}.mf-field-wide{grid-column:auto}.mf-production-modal{max-height:calc(100vh - 18px);width:min(680px,calc(100vw - 18px));border-radius:14px}.mf-production-header,.mf-production-body,.mf-production-footer{padding-left:18px;padding-right:18px}.mf-production-status{margin-left:18px;margin-right:18px}}
      @media(max-width:560px){.mf-production-overlay{padding:8px;align-items:end}.mf-production-modal{max-height:calc(100vh - 8px);border-radius:14px 14px 10px 10px}.mf-production-header{padding-top:18px}.mf-production-title-wrap h2{font-size:19px}.mf-production-footer{align-items:stretch;flex-direction:column}.mf-production-footer-note{order:2}.mf-production-actions{display:grid;grid-template-columns:1fr 1.4fr}.mf-secondary-btn,.mf-primary-btn{width:100%}}
    `;
    document.head.appendChild(style);
}
