import * as THREE from "three";
import { PART_CATEGORIES } from "../rocket/categories.js";
import { attachRocketPartMetadata, createDefaultRocketPart, updateRocketPart, readRocketPart } from "../rocket/rocketPart.js";
import { validateRocketPart } from "../rocket/validation.js";

let sceneRef = null;
let active = false;
let panel = null;

export function initRocketPartPanel(scene) {
    sceneRef = scene;
    ensurePanel();
    attachRocketPartMetadata(sceneRef);
}

export function toggleRocketPartMode() {
    active ? exitRocketPartMode() : enterRocketPartMode();
    return active;
}

export function enterRocketPartMode() {
    if (!sceneRef) return false;
    active = true;
    ensurePanel();
    attachRocketPartMetadata(sceneRef);
    panel.hidden = false;
    document.body.classList.add("rocket-part-mode");
    renderPanel();
    syncButton();
    window.dispatchEvent(new CustomEvent("editor:rocket-part-mode", { detail: true }));
    return true;
}

export function exitRocketPartMode() {
    active = false;
    if (panel) panel.hidden = true;
    document.body.classList.remove("rocket-part-mode");
    syncButton();
    window.dispatchEvent(new CustomEvent("editor:rocket-part-mode", { detail: false }));
}

export function isRocketPartMode() { return active; }

function ensurePanel() {
    if (panel) return;
    const host = document.getElementById("rightPanel");
    if (!host) return;
    panel = document.createElement("div");
    panel.id = "rocketPartPanel";
    panel.hidden = true;
    panel.innerHTML = `
        <div class="rocket-part-head">
            <div><span class="eyebrow">Authoring</span><h3>Rocket Part</h3></div>
            <button type="button" class="rocket-part-close" aria-label="Exit Rocket Part Mode">×</button>
        </div>
        <div class="rocket-part-status"><span class="rocket-status-dot"></span><span id="rocketPartStatus">DRAFT</span><span id="rocketPartValidity"></span></div>
        <div class="rocket-part-body" id="rocketPartBody"></div>
    `;
    host.appendChild(panel);
    panel.querySelector(".rocket-part-close")?.addEventListener("click", exitRocketPartMode);
    installStyles();
}

function renderPanel() {
    if (!panel || !sceneRef) return;
    const body = panel.querySelector("#rocketPartBody");
    if (!body) return;
    const part = readRocketPart(sceneRef) || createDefaultRocketPart();
    body.replaceChildren();

    body.append(
        section("Part Identity", [
            textInput("Name", part.name, value => update({ name: value })),
            textInput("ID", part.id, null, true),
            selectInput("Category", PART_CATEGORIES, part.category, value => update({ category: value })),
            textInput("Version", part.version, value => update({ version: value })),
            textArea("Description", part.description, value => update({ description: value }))
        ]),
        section("Physical", [
            numberInput("Mass", part.physical.mass, value => updatePhysical("mass", value)),
            numberInput("Height", part.physical.height, value => updatePhysical("height", value)),
            numberInput("Diameter", part.physical.diameter, value => updatePhysical("diameter", value)),
            numberInput("Width", part.physical.width, value => updatePhysical("width", value)),
            numberInput("Depth", part.physical.depth, value => updatePhysical("depth", value)),
            action("Calculate From Model", calculateDimensions)
        ]),
        section("Attachment Nodes", [
            action("Validate Part", validateCurrent)
        ])
    );
    updateStatus(part);

    function update(patch) {
        if (!sceneRef) return;
        updateRocketPart(sceneRef, patch);
        renderPanel();
        dispatchChange();
    }

    function updatePhysical(key, value) {
        const current = readRocketPart(sceneRef) || createDefaultRocketPart();
        current.physical[key] = Number.isFinite(value) && value > 0 ? value : current.physical[key];
        updateRocketPart(sceneRef, { physical: current.physical });
        renderPanel();
        dispatchChange();
    }
}

function calculateDimensions() {
    if (!sceneRef) return;
    const box = new THREE.Box3();
    let found = false;
    sceneRef.children.forEach(root => {
        if (root === sceneRef || root.userData?.editorOnly || !root.userData?.editorObject || root.userData?.attachmentNode) return;
        root.traverse(object => {
            if (!object.isMesh || object.userData?.editorOnly || object.userData?.attachmentNode) return;
            box.expandByObject(object);
            found = true;
        });
    });
    if (!found || box.isEmpty()) return setStatus("No model geometry to measure");
    const size = box.getSize(new THREE.Vector3());
    updateRocketPart(sceneRef, {
        physical: {
            height: size.y,
            width: size.x,
            depth: size.z,
            diameter: Math.max(size.x, size.z),
            mass: (readRocketPart(sceneRef)?.physical?.mass || 1)
        }
    });
    renderPanel();
    setStatus(`Dimensions calculated · H ${size.y.toFixed(2)} · W ${size.x.toFixed(2)} · D ${size.z.toFixed(2)}`);
    window.dispatchEvent(new CustomEvent("editor:rocket-part-change"));
}

function validateCurrent() {
    const part = readRocketPart(sceneRef) || createDefaultRocketPart();
    const result = validateRocketPart(part);
    updateStatus(part, result);
    if (result.valid) setStatus("Rocket part is ready for node authoring");
    else setStatus(`${result.errors.length} validation issue${result.errors.length === 1 ? "" : "s"}`);
}

function updateStatus(part, result = validateRocketPart(part)) {
    const status = panel?.querySelector("#rocketPartStatus");
    const validity = panel?.querySelector("#rocketPartValidity");
    if (!status || !validity) return;
    const published = part.publishStatus || "draft";
    status.textContent = published.toUpperCase();
    validity.textContent = result.valid ? "READY" : `${result.errors.length} ISSUE${result.errors.length === 1 ? "" : "S"}`;
    validity.className = result.valid ? "valid" : "invalid";
}

function syncButton() {
    const button = document.getElementById("rocketPartBtn");
    if (!button) return;
    button.textContent = active ? "Model" : "Rocket Part";
    button.classList.toggle("primary", active);
    button.title = active ? "Exit Rocket Part Mode" : "Open Rocket Part Mode";
}

function dispatchChange() { window.dispatchEvent(new CustomEvent("editor:rocket-part-change")); }
function setStatus(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }

function section(title, children) {
    const wrap = document.createElement("section");
    wrap.className = "rocket-part-section";
    const head = document.createElement("div"); head.className = "rocket-part-section-head"; head.textContent = title;
    const content = document.createElement("div"); content.className = "rocket-part-section-body";
    children.forEach(child => content.appendChild(child));
    wrap.append(head, content);
    return wrap;
}

function textInput(label, value, onChange, disabled = false) {
    const row = rowBase(label);
    const input = document.createElement("input"); input.type = "text"; input.value = value ?? ""; input.disabled = disabled;
    if (onChange) input.addEventListener("change", () => onChange(input.value.trim()));
    row.appendChild(input); return row;
}

function numberInput(label, value, onChange, allowNegative = false) {
    const row = rowBase(label);
    const input = document.createElement("input"); input.type = "number"; input.step = "0.01";
    input.min = allowNegative ? "" : "0.0001"; input.value = Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00";
    input.addEventListener("change", () => onChange(Number(input.value))); row.appendChild(input); return row;
}

function selectInput(label, values, current, onChange) {
    const row = rowBase(label); const select = document.createElement("select");
    values.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = value; option.selected = value === current; select.appendChild(option); });
    select.addEventListener("change", () => onChange(select.value)); row.appendChild(select); return row;
}

function textArea(label, value, onChange) {
    const row = rowBase(label, true); const input = document.createElement("textarea"); input.rows = 3; input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value.trim())); row.appendChild(input); return row;
}

function action(label, onClick) { const button = document.createElement("button"); button.type = "button"; button.className = "rocket-part-action"; button.textContent = label; button.addEventListener("click", onClick); return button; }
function rowBase(label, stacked = false) { const row = document.createElement("label"); row.className = `rocket-part-field${stacked ? " stacked" : ""}`; const caption = document.createElement("span"); caption.textContent = label; row.appendChild(caption); return row; }

function installStyles() {
    if (document.getElementById("rocketPartModeStyles")) return;
    const style = document.createElement("style"); style.id = "rocketPartModeStyles";
    style.textContent = `
        #rightPanel{position:relative;overflow:hidden}
        #rocketPartPanel{position:absolute;inset:0;z-index:8;width:100%;height:100%;box-sizing:border-box;background:#15171b;overflow:hidden;border-left:1px solid #2c2f35;display:flex;flex-direction:column;min-height:0}
        #rocketPartPanel[hidden]{display:none}
        .rocket-part-head{display:flex;align-items:center;justify-content:space-between;padding:15px 14px 9px;border-bottom:1px solid #292c32;flex:0 0 auto}
        .rocket-part-head h3{margin:2px 0 0;color:#eceef2;font-size:15px}
        .rocket-part-close{width:28px;height:28px;border:1px solid #333740;border-radius:5px;background:#1c1e23;color:#aeb3bd;font-size:18px;cursor:pointer}
        .rocket-part-close:hover{background:#282b32;color:#fff}
        .rocket-part-status{display:flex;align-items:center;gap:7px;padding:8px 14px;border-bottom:1px solid #24272c;color:#7e848e;font-size:9px;letter-spacing:.11em;font-weight:700;flex:0 0 auto}
        .rocket-status-dot{width:7px;height:7px;border-radius:50%;background:#e4a934;box-shadow:0 0 0 3px #e4a93422}
        #rocketPartValidity{margin-left:auto}.valid{color:#7ddc9c}.invalid{color:#f08b8b}
        .rocket-part-body{padding:10px 10px 72px;overflow:auto;min-height:0;flex:1;scrollbar-gutter:stable}
        .rocket-part-body::-webkit-scrollbar{width:8px}.rocket-part-body::-webkit-scrollbar-thumb{background:#30333b;border-radius:8px}
        .rocket-part-section{border:1px solid #2b2e35;border-radius:6px;margin-bottom:8px;background:#17191e;overflow:hidden}
        .rocket-part-section-head{padding:8px 10px;border-bottom:1px solid #262930;color:#9ea4ae;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
        .rocket-part-section-body{display:grid;gap:7px;padding:9px}
        .rocket-part-field{display:grid;grid-template-columns:78px 1fr;gap:7px;align-items:center;color:#7f8590;font-size:9px}
        .rocket-part-field.stacked{grid-template-columns:1fr}
        .rocket-part-field input,.rocket-part-field select,.rocket-part-field textarea{width:100%;box-sizing:border-box;border:1px solid #333741;border-radius:4px;background:#111318;color:#d5d8de;padding:6px 7px;font:11px system-ui,sans-serif;outline:none}
        .rocket-part-field input:focus,.rocket-part-field select:focus,.rocket-part-field textarea:focus{border-color:#596273}
        .rocket-part-field input:disabled{opacity:.55}
        .rocket-part-action{border:1px solid #343842;border-radius:4px;background:#202329;color:#bfc4cd;padding:7px 8px;font:600 10px system-ui;cursor:pointer}
        .rocket-part-action:hover{background:#292c33;color:#fff}
        @media(max-width:760px){#rocketPartPanel{position:fixed;inset:auto 0 32px 0;width:100%;max-height:calc(82vh - 32px);height:auto;border-left:0;border-top:1px solid #343841;border-radius:12px 12px 0 0;box-shadow:0 -20px 45px #000a}}
    `;
    document.head.appendChild(style);
}
