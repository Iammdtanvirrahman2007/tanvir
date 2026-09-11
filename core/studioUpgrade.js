import * as THREE from "three";
import { scene, camera, renderer, grid, controls, setRenderPixelRatio } from "./scene.js?v=20260811-runtime-fix";
import { createObject } from "../objects/factory.js";
import { addObject, getObjects } from "./objectManager.js";
import { addToHierarchy, rebuildHierarchy } from "../ui/hierarchy.js";
import { getSelected } from "./selection.js";
import { focusObject } from "./focus.js";

let palette;
let presentation = false;
let wireframe = false;
let quality = 1;

const actions = [
    ["Add Cube", "Create a cube", () => add("cube")],
    ["Add Sphere", "Create a sphere", () => add("sphere")],
    ["Add Cylinder", "Create a cylinder", () => add("cylinder")],
    ["Add Cone", "Create a cone", () => add("cone")],
    ["Add Plane", "Create a plane", () => add("plane")],
    ["Focus Selection", "Frame the selected object", () => focusSelection()],
    ["Frame Scene", "Fit the whole scene in view", () => frameScene()],
    ["Toggle Grid", "Show or hide the modeling grid", () => toggleGrid()],
    ["Wireframe Preview", "Toggle wireframe materials", () => toggleWireframe()],
    ["Presentation Mode", "Hide editor chrome", () => togglePresentation()],
    ["Screenshot", "Save the viewport as a PNG", () => screenshot()],
    ["Fullscreen", "Enter or leave fullscreen", () => fullscreen()],
    ["Performance: High", "Use higher render resolution", () => setQuality(1.5)],
    ["Performance: Balanced", "Use balanced render resolution", () => setQuality(1)],
    ["Performance: Battery", "Reduce render resolution", () => setQuality(0.7)]
];

export function initStudioUpgrade() {
    injectStyles();
    createPalette();
    createStudioButton();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", () => {
        if (presentation && window.innerWidth < 761) exitPresentation();
    }, { passive: true });
}

function createPalette() {
    palette = document.createElement("div");
    palette.id = "mfStudioPalette";
    palette.hidden = true;
    palette.innerHTML = `
      <div class="mf-palette-card" role="dialog" aria-label="ModelForge command palette">
        <div class="mf-palette-head"><span>Studio Command</span><kbd>Esc</kbd></div>
        <div class="mf-palette-search"><span>⌕</span><input id="mfPaletteInput" autocomplete="off" placeholder="Search actions…"></div>
        <div id="mfPaletteList" class="mf-palette-list"></div>
        <div class="mf-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> run</span></div>
      </div>`;
    document.body.appendChild(palette);
    palette.addEventListener("pointerdown", e => { if (e.target === palette) closePalette(); });
    palette.querySelector("#mfPaletteInput").addEventListener("input", renderActions);
    palette.querySelector("#mfPaletteInput").addEventListener("keydown", paletteKeydown);
    renderActions();
}

function createStudioButton() {
    const host = document.querySelector(".viewport-top-right");
    if (!host || document.getElementById("mfStudioButton")) return;
    const button = document.createElement("button");
    button.id = "mfStudioButton";
    button.className = "viewport-btn mf-studio-button";
    button.textContent = "Studio";
    button.title = "Command palette (Ctrl/Cmd+K)";
    button.addEventListener("click", openPalette);
    host.prepend(button);
}

function renderActions() {
    const list = document.getElementById("mfPaletteList");
    const input = document.getElementById("mfPaletteInput");
    if (!list) return;
    const query = (input?.value || "").trim().toLowerCase();
    const filtered = actions.filter(([name, desc]) => `${name} ${desc}`.toLowerCase().includes(query));
    list.innerHTML = filtered.map(([name, desc], i) => `<button class="mf-action" data-index="${actions.indexOf(filtered[i])}"><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(desc)}</small></span><b>↵</b></button>`).join("");
    list.querySelectorAll(".mf-action").forEach(btn => btn.addEventListener("click", () => runAction(Number(btn.dataset.index))));
    list.firstElementChild?.classList.add("selected");
}

function paletteKeydown(e) {
    const buttons = [...document.querySelectorAll("#mfPaletteList .mf-action")];
    if (e.key === "Escape") return closePalette();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const current = Math.max(0, buttons.findIndex(b => b.classList.contains("selected")));
        buttons.forEach(b => b.classList.remove("selected"));
        const next = e.key === "ArrowDown" ? (current + 1) % buttons.length : (current - 1 + buttons.length) % buttons.length;
        buttons[next]?.classList.add("selected");
        buttons[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = buttons.find(b => b.classList.contains("selected"));
        if (selected) runAction(Number(selected.dataset.index));
    }
}

function openPalette() {
    if (!palette) return;
    palette.hidden = false;
    const input = document.getElementById("mfPaletteInput");
    if (input) { input.value = ""; renderActions(); requestAnimationFrame(() => input.focus()); }
}
function closePalette() { if (palette) palette.hidden = true; }
function runAction(index) { closePalette(); actions[index]?.[2]?.(); }

function add(type) {
    const object = createObject(type);
    if (!object) return;
    addObject(scene, object);
    addToHierarchy(object);
    window.dispatchEvent(new CustomEvent("editor:status", { detail: `Added ${object.name}` }));
    rebuildHierarchy();
}

function focusSelection() {
    const object = getSelected();
    if (!object) return status("Select an object first");
    focusObject(object, { duration: 0 });
    status(`Focused ${object.name || object.type}`);
}

function frameScene() {
    const objects = getObjects().filter(o => o?.isObject3D);
    if (!objects.length) return status("Scene is empty");
    const box = new THREE.Box3();
    objects.forEach(o => box.expandByObject(o));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1);
    const distance = radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.35;
    const direction = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    controls.target.copy(center);
    controls.update();
    status("Framed scene");
}

function toggleGrid() {
    grid.visible = !grid.visible;
    status(grid.visible ? "Grid enabled" : "Grid hidden");
}

function toggleWireframe() {
    wireframe = !wireframe;
    scene.traverse(object => {
        if (!object.isMesh || !object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
            if ("wireframe" in material) material.wireframe = wireframe;
        });
    });
    status(wireframe ? "Wireframe preview" : "Solid preview");
}

function togglePresentation() {
    presentation ? exitPresentation() : enterPresentation();
}
function enterPresentation() {
    if (window.innerWidth < 761) return status("Presentation mode is available on desktop");
    presentation = true;
    document.body.classList.add("mf-presentation");
    status("Presentation mode");
}
function exitPresentation() {
    presentation = false;
    document.body.classList.remove("mf-presentation");
    status("Editor mode");
}

function screenshot() {
    if (!renderer) return;
    try {
        renderer.render(scene, camera);
        const link = document.createElement("a");
        link.download = `modelforge-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        link.href = renderer.domElement.toDataURL("image/png");
        link.click();
        status("Viewport screenshot saved");
    } catch (error) {
        console.error(error);
        status("Screenshot failed");
    }
}

async function fullscreen() {
    try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
        else await document.exitFullscreen?.();
    } catch { status("Fullscreen is unavailable"); }
}

function setQuality(value) {
    quality = value;
    setRenderPixelRatio(Math.min((window.devicePixelRatio || 1) * value, 2));
    status(`Render quality ${Math.round(value * 100)}%`);
}

function status(text) { window.dispatchEvent(new CustomEvent("editor:status", { detail: text })); }
function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); }
    if (e.key === "Escape" && !palette?.hidden) closePalette();
    if (e.key === "F11") { e.preventDefault(); fullscreen(); }
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char])); }

function injectStyles() {
    if (document.getElementById("mfStudioStyles")) return;
    const style = document.createElement("style");
    style.id = "mfStudioStyles";
    style.textContent = `
      #mfStudioPalette{position:fixed;inset:0;z-index:200;display:grid;place-items:start center;padding-top:min(15vh,140px);background:rgba(0,0,0,.58);backdrop-filter:blur(7px)}
      #mfStudioPalette[hidden]{display:none}
      .mf-palette-card{width:min(620px,calc(100vw - 28px));overflow:hidden;border:1px solid #34363c;border-radius:10px;background:#0b0c0f;box-shadow:0 30px 100px rgba(0,0,0,.8)}
      .mf-palette-head{height:42px;padding:0 13px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #24262b;color:#bbb;font-size:11px;font-weight:650}
      .mf-palette-search{height:52px;display:flex;align-items:center;gap:10px;padding:0 15px;border-bottom:1px solid #24262b;color:#666;font-size:18px}
      .mf-palette-search input{flex:1;border:0;outline:0;background:transparent;color:#eee;font-size:14px}
      .mf-palette-search input::placeholder{color:#555}
      .mf-palette-list{max-height:min(52vh,420px);overflow:auto;padding:6px}
      .mf-action{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:0;border-radius:6px;background:transparent;color:#999;text-align:left;cursor:pointer}
      .mf-action:hover,.mf-action.selected{background:#1a1c21;color:#fff}.mf-action span{display:grid;gap:2px}.mf-action strong{font-size:11px;font-weight:650}.mf-action small{color:#62656d;font-size:9px}.mf-action b{color:#4f525a;font-size:12px}
      .mf-palette-foot{display:flex;justify-content:space-between;padding:8px 12px;border-top:1px solid #24262b;color:#555;font-size:9px}.mf-palette-foot span{display:flex;align-items:center;gap:5px}
      kbd{padding:2px 5px;border:1px solid #35373d;border-radius:3px;background:#121318;color:#777;font:9px ui-monospace,monospace}
      .mf-studio-button{font-weight:650;color:#ddd!important}
      body.mf-presentation #topbar,body.mf-presentation #leftPanel,body.mf-presentation #rightPanel,body.mf-presentation #bottomToolbar,body.mf-presentation #statusBar{display:none!important}
      body.mf-presentation #editor{height:100vh}.mf-presentation #viewport{height:100vh}
      @media(max-width:760px){.mf-palette-card{width:calc(100vw - 16px);border-radius:12px}.mf-studio-button{display:none}}
    `;
    document.head.appendChild(style);
}
