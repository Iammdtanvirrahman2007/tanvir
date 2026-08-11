import * as THREE from "three";
import { pushHistory } from "../core/history.js";

let currentObject = null;
let activeTab = "object";
let clipboardMaterial = null;

export function initInspector() {
    document.querySelectorAll(".inspector-tab").forEach(tab => tab.addEventListener("click", () => {
        activeTab = tab.dataset.tab || "object";
        document.querySelectorAll(".inspector-tab").forEach(item => item.classList.toggle("active", item === tab));
        renderInspector();
    }));
}

export function updateInspector(object) { currentObject = object || null; renderInspector(); }
export function getInspectorObject() { return currentObject; }
export function refreshInspector() { if (currentObject) renderInspector(); }

function renderInspector() {
    const panel = document.getElementById("inspectorContent");
    if (!panel) return;
    panel.replaceChildren();
    if (!currentObject) {
        panel.innerHTML = `<div class="empty-inspector"><div class="empty-icon">◇</div><strong>No object selected</strong><p>Select an object in the viewport or Scene panel to inspect its properties.</p></div>`;
        return;
    }
    panel.appendChild(activeTab === "material" ? buildMaterialSection(currentObject) : buildObjectSections(currentObject));
}

function buildObjectSections(object) {
    const fragment = document.createDocumentFragment();
    fragment.append(buildIdentity(object), buildTransform(object), buildVisibility(object), buildMetadata(object));
    return fragment;
}

function buildIdentity(object) {
    const body = document.createElement("div"); body.className = "section-body";
    const name = field("Name", "text", object.name || object.type);
    const type = field("Type", "text", object.isGroup ? "Group" : object.geometry?.type || object.type, true);
    name.input.addEventListener("change", () => { const before = object.name; const after = name.input.value.trim() || before; if (after === before) return; object.name = after; pushHistory({ undo: () => { object.name = before; refreshInspector(); }, redo: () => { object.name = after; refreshInspector(); } }); status(`Renamed to ${after}`); window.dispatchEvent(new CustomEvent("editor:hierarchy-refresh")); });
    body.append(name.row, type.row); return section("Object", body);
}

function buildTransform(object) {
    const body = document.createElement("div"); body.className = "section-body";
    body.append(vectorField("Position", object, "position", false), vectorField("Rotation", object, "rotation", true), vectorField("Scale", object, "scale", false));
    return section("Transform", body);
}

function vectorField(label, object, property, degrees) {
    const wrapper = document.createElement("div"); wrapper.style.marginBottom = "9px";
    const title = document.createElement("label"); title.style.cssText = "display:block;margin-bottom:4px;color:#858994;font-size:10px"; title.textContent = label;
    const row = document.createElement("div"); row.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px";
    ["x", "y", "z"].forEach(axis => { const input = document.createElement("input"); input.className = "property-input"; input.type = "number"; input.step = degrees ? "1" : "0.01"; input.title = `${label} ${axis.toUpperCase()}`; input.value = formatValue(readAxis(object, property, axis, degrees), degrees); input.addEventListener("change", () => { const before = object[property].clone(); const value = Number(input.value) || 0; const after = object[property].clone(); if (degrees) after[axis] = THREE.MathUtils.degToRad(value); else after[axis] = value; object[property].copy(after); pushHistory({ undo: () => { object[property].copy(before); refreshInspector(); }, redo: () => { object[property].copy(after); refreshInspector(); } }); status(`${label} changed`); }); row.appendChild(input); });
    wrapper.append(title, row); return wrapper;
}

function buildVisibility(object) {
    const body = document.createElement("div"); body.className = "section-body";
    const row = document.createElement("div"); row.className = "property-row"; row.innerHTML = `<label>Visible</label><input type="checkbox">`; const input = row.querySelector("input"); input.checked = object.visible;
    input.addEventListener("change", () => { const before = object.visible, after = input.checked; object.visible = after; pushHistory({ undo: () => { object.visible = before; refreshInspector(); }, redo: () => { object.visible = after; refreshInspector(); } }); }); body.appendChild(row); return section("Visibility", body);
}

function buildMetadata(object) {
    const body = document.createElement("div"); body.className = "section-body";
    [["UUID", object.uuid], ["Mass", object.userData?.mass ?? "1"], ["Part Type", object.userData?.partType || "Default"]].forEach(([label, value]) => body.appendChild(field(label, "text", value, true).row));
    return section("Metadata", body);
}

function buildMaterialSection(object) {
    const body = document.createElement("div"); body.className = "section-body";
    if (!object.material) { const message = document.createElement("p"); message.style.color = "#777b85"; message.textContent = "This object has no editable material."; body.appendChild(message); return section("Material", body); }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const slot = document.createElement("select"); slot.className = "property-select";
    materials.forEach((material, index) => { const option = document.createElement("option"); option.value = index; option.textContent = material.name || `Material ${index + 1}`; slot.appendChild(option); });
    const slotRow = document.createElement("div"); slotRow.className = "property-row"; const slotLabel = document.createElement("label"); slotLabel.textContent = "Slot"; slotRow.append(slotLabel, slot); body.appendChild(slotRow);

    const actions = document.createElement("div"); actions.className = "inspector-actions";
    actions.append(
        actionButton("Copy", () => { const m = materials[Number(slot.value)]; clipboardMaterial = cloneMaterialState(m); status("Material copied"); }),
        actionButton("Paste", () => { const m = materials[Number(slot.value)]; if (!clipboardMaterial) return status("Material clipboard is empty"); const before = cloneMaterialState(m); applyMaterialState(m, clipboardMaterial); pushMaterialHistory(m, before, clipboardMaterial, "Paste material"); refreshInspector(); status("Material pasted"); }),
        actionButton("Reset", () => { const m = materials[Number(slot.value)]; const before = cloneMaterialState(m); const target = presetState(m.userData?.materialPreset || "Custom"); applyMaterialState(m, target); pushMaterialHistory(m, before, target, "Reset material"); refreshInspector(); status("Material reset"); })
    );
    body.appendChild(actions);

    const presetRow = document.createElement("div"); presetRow.className = "property-row"; const presetLabel = document.createElement("label"); presetLabel.textContent = "Preset";
    const preset = document.createElement("select"); preset.className = "property-select";
    ["Custom", "Matte", "Metal", "Plastic", "Glass", "Glow"].forEach(name => { const option = document.createElement("option"); option.value = name; option.textContent = name; preset.appendChild(option); });
    preset.value = mPreset(materials[0]) || "Custom";
    presetRow.append(presetLabel, preset); body.appendChild(presetRow);

    const editor = document.createElement("div"); editor.style.marginTop = "8px"; body.appendChild(editor);
    const render = () => {
        editor.replaceChildren();
        const material = materials[Number(slot.value)];
        if (!material) return;
        addColor(editor, material);
        addRange(editor, "Metalness", material.metalness ?? 0, 0, 1, value => { material.metalness = value; material.needsUpdate = true; markCustom(material); });
        addRange(editor, "Roughness", material.roughness ?? 1, 0, 1, value => { material.roughness = value; material.needsUpdate = true; markCustom(material); });
        addColorField(editor, "Emission", material.emissive || new THREE.Color(0), color => { if (material.emissive) material.emissive.set(color); material.needsUpdate = true; markCustom(material); });
        addRange(editor, "Emission Power", material.emissiveIntensity ?? 1, 0, 20, value => { material.emissiveIntensity = value; material.needsUpdate = true; markCustom(material); });
        addRange(editor, "Opacity", material.opacity ?? 1, 0, 1, value => { material.opacity = value; material.transparent = value < 1; material.depthWrite = value >= 1; material.needsUpdate = true; markCustom(material); });
        addSelect(editor, "Side", [["Front", THREE.FrontSide], ["Back", THREE.BackSide], ["Double", THREE.DoubleSide]], material.side, value => { material.side = Number(value); material.needsUpdate = true; markCustom(material); });
        const wire = field("Wireframe", "checkbox", material.wireframe); wire.input.checked = material.wireframe; wire.input.addEventListener("change", () => { const before = cloneMaterialState(material); material.wireframe = wire.input.checked; material.needsUpdate = true; const after = cloneMaterialState(material); pushMaterialHistory(material, before, after, "Toggle wireframe"); markCustom(material); }); editor.appendChild(wire.row);
        const flat = field("Flat Shading", "checkbox", material.flatShading); flat.input.checked = !!material.flatShading; flat.input.addEventListener("change", () => { const before = cloneMaterialState(material); material.flatShading = flat.input.checked; material.needsUpdate = true; const after = cloneMaterialState(material); pushMaterialHistory(material, before, after, "Toggle flat shading"); markCustom(material); }); editor.appendChild(flat.row);
        const textureRow = document.createElement("div"); textureRow.style.display = "flex"; textureRow.style.gap = "6px";
        const texture = document.createElement("label"); texture.className = "file-input-label"; texture.textContent = material.map ? "Replace Base Texture" : "Load Base Texture";
        const input = document.createElement("input"); input.type = "file"; input.accept = ".png,.jpg,.jpeg,.webp"; input.hidden = true; input.addEventListener("change", () => loadTexture(input.files?.[0], material)); texture.appendChild(input);
        const clear = actionButton("Clear", () => { const before = cloneMaterialState(material); material.map?.dispose?.(); material.map = null; delete material.userData.baseTextureData; material.needsUpdate = true; const after = cloneMaterialState(material); pushMaterialHistory(material, before, after, "Clear texture"); refreshInspector(); });
        textureRow.append(texture, clear); editor.appendChild(textureRow);
    };
    preset.addEventListener("change", () => { const m = materials[Number(slot.value)]; if (preset.value === "Custom") { markCustom(m); return; } const before = cloneMaterialState(m); const next = presetState(preset.value); applyMaterialState(m, next); m.userData.materialPreset = preset.value; pushMaterialHistory(m, before, next, `Apply ${preset.value}`); render(); status(`${preset.value} material applied`); });
    slot.addEventListener("change", render); render(); return section("Material", body);
}

function addColor(parent, material) {
    const row = addColorField(parent, "Color", material.color, color => { material.color.set(color); material.needsUpdate = true; markCustom(material); });
    return row;
}

function addColorField(parent, label, initialColor, onChange) {
    const row = field(label, "color", `#${initialColor.getHexString()}`);
    let before = null;
    row.input.addEventListener("focus", () => { if (row.input.type === "color") before = cloneMaterialStateForColor(initialColor); });
    row.input.addEventListener("input", () => onChange(row.input.value));
    parent.appendChild(row.row);
    return row;
}

function addSelect(parent, label, options, initial, onChange) {
    const row = document.createElement("div"); row.className = "property-row"; const caption = document.createElement("label"); caption.textContent = label; const select = document.createElement("select"); select.className = "property-select";
    options.forEach(([name, value]) => { const option = document.createElement("option"); option.value = value; option.textContent = name; option.selected = value === initial; select.appendChild(option); }); select.addEventListener("change", () => onChange(select.value)); row.append(caption, select); parent.appendChild(row);
}

function addRange(parent, label, initial, min, max, onChange) {
    const row = document.createElement("div"); row.className = "property-row";
    row.innerHTML = `<label>${label}</label><div class="range-row"><input type="range" min="${min}" max="${max}" step="0.01"><input class="range-value" type="number" min="${min}" max="${max}" step="0.01"></div>`;
    const range = row.querySelector("input[type=range]"), value = row.querySelector("input[type=number]");
    const clamp = n => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
    const current = clamp(Number(initial)); range.value = current; value.value = current.toFixed(2);
    let before = null;
    const begin = () => { if (!before) before = cloneCurrentMaterialState(onChange); };
    range.addEventListener("pointerdown", () => { before = null; });
    range.addEventListener("input", () => { value.value = Number(range.value).toFixed(2); onChange(Number(range.value)); });
    range.addEventListener("change", () => { if (before) { const after = findMaterialStateFromRow(onChange); if (after) pushMaterialHistory(after.material, before, after.state, label); } before = null; });
    value.addEventListener("focus", () => { before = null; });
    value.addEventListener("change", () => { const n = clamp(Number(value.value)); const material = getMaterialFromCallback(onChange); const old = material ? cloneMaterialState(material) : null; range.value = n; value.value = n.toFixed(2); onChange(n); if (material && old) pushMaterialHistory(material, old, cloneMaterialState(material), label); });
    parent.appendChild(row);
}

function cloneCurrentMaterialState() { return null; }
function findMaterialStateFromRow() { return null; }
function getMaterialFromCallback() { return null; }

function actionButton(label, onClick) { const button = document.createElement("button"); button.className = "icon-action"; button.type = "button"; button.textContent = label; button.addEventListener("click", onClick); return button; }
function cloneMaterialState(m) { return { color: m.color?.getHex() ?? 0xffffff, metalness: m.metalness ?? 0, roughness: m.roughness ?? 1, opacity: m.opacity ?? 1, transparent: !!m.transparent, depthWrite: m.depthWrite ?? true, wireframe: !!m.wireframe, flatShading: !!m.flatShading, side: m.side ?? THREE.FrontSide, emissive: m.emissive?.getHex() ?? 0, emissiveIntensity: m.emissiveIntensity ?? 1, baseTextureData: m.userData?.baseTextureData || null, materialPreset: m.userData?.materialPreset || "Custom" }; }
function cloneMaterialStateForColor(color) { return color?.getHex?.() ?? 0xffffff; }
function applyMaterialState(m, state) { if (m.color) m.color.setHex(state.color ?? 0xffffff); if (m.emissive) m.emissive.setHex(state.emissive ?? 0); m.metalness = state.metalness ?? 0; m.roughness = state.roughness ?? 1; m.opacity = state.opacity ?? 1; m.transparent = !!state.transparent || m.opacity < 1; m.depthWrite = state.depthWrite ?? (m.opacity >= 1); m.wireframe = !!state.wireframe; m.flatShading = !!state.flatShading; m.side = state.side ?? THREE.FrontSide; m.emissiveIntensity = state.emissiveIntensity ?? 1; m.userData = { ...(m.userData || {}) }; if (state.materialPreset) m.userData.materialPreset = state.materialPreset; if (state.baseTextureData) { m.userData.baseTextureData = state.baseTextureData; restoreTexture(m, state.baseTextureData); } else { m.map?.dispose?.(); m.map = null; delete m.userData.baseTextureData; } m.needsUpdate = true; }
function pushMaterialHistory(material, before, after, label) { if (!material || !before || !after || JSON.stringify(before) === JSON.stringify(after)) return; pushHistory({ label, undo: () => { applyMaterialState(material, before); refreshInspector(); }, redo: () => { applyMaterialState(material, after); refreshInspector(); } }); }
function defaultMaterialState() { return { color: 0xffffff, metalness: 0, roughness: 1, opacity: 1, transparent: false, depthWrite: true, wireframe: false, flatShading: false, side: THREE.FrontSide, emissive: 0, emissiveIntensity: 1, baseTextureData: null, materialPreset: "Custom" }; }
function presetState(name) { const states = { Matte: { color: 0x9da3ad, metalness: 0, roughness: 0.85, opacity: 1, transparent: false, depthWrite: true, wireframe: false, flatShading: false, side: THREE.FrontSide, emissive: 0, emissiveIntensity: 1, baseTextureData: null, materialPreset: "Matte" }, Metal: { color: 0xb8bec8, metalness: 1, roughness: 0.22, opacity: 1, transparent: false, depthWrite: true, wireframe: false, flatShading: false, side: THREE.FrontSide, emissive: 0, emissiveIntensity: 1, baseTextureData: null, materialPreset: "Metal" }, Plastic: { color: 0x626a78, metalness: 0.05, roughness: 0.32, opacity: 1, transparent: false, depthWrite: true, wireframe: false, flatShading: false, side: THREE.FrontSide, emissive: 0, emissiveIntensity: 1, baseTextureData: null, materialPreset: "Plastic" }, Glass: { color: 0xa9c9ff, metalness: 0, roughness: 0.05, opacity: 0.28, transparent: true, depthWrite: false, wireframe: false, flatShading: false, side: THREE.DoubleSide, emissive: 0, emissiveIntensity: 1, baseTextureData: null, materialPreset: "Glass" }, Glow: { color: 0x7aa2ff, metalness: 0.05, roughness: 0.18, opacity: 1, transparent: false, depthWrite: true, wireframe: false, flatShading: false, side: THREE.FrontSide, emissive: 0x6f8cff, emissiveIntensity: 2.5, baseTextureData: null, materialPreset: "Glow" } }; return states[name] || defaultMaterialState(); }
function mPreset(material) { return material?.userData?.materialPreset || "Custom"; }
function markCustom(material) { if (material) { material.userData = { ...(material.userData || {}), materialPreset: "Custom" }; } }
function field(label, type, value, disabled = false) { const row = document.createElement("div"); row.className = "property-row"; const caption = document.createElement("label"); caption.textContent = label; const input = document.createElement("input"); input.className = "property-input"; input.type = type; input.disabled = disabled; if (type === "checkbox") input.checked = !!value; else input.value = value ?? ""; row.append(caption, input); return { row, input }; }
function section(title, body) { const wrapper = document.createElement("section"); wrapper.className = "inspector-section"; const head = document.createElement("button"); head.className = "section-head"; head.innerHTML = `<span class="section-chevron">▾</span>${title}`; head.addEventListener("click", () => { body.hidden = !body.hidden; head.querySelector(".section-chevron").textContent = body.hidden ? "▸" : "▾"; }); wrapper.append(head, body); return wrapper; }
function readAxis(object, property, axis, degrees) { const value = object[property][axis]; return degrees ? THREE.MathUtils.radToDeg(value) : value; }
function formatValue(value, degrees) { return Number(value).toFixed(degrees ? 1 : 2); }
function loadTexture(file, material) {
    if (!file || !material) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || "");
        new THREE.TextureLoader().load(dataUrl, texture => {
            texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
            material.map?.dispose?.(); material.map = texture; material.userData = { ...(material.userData || {}), baseTextureData: dataUrl, materialPreset: "Custom" }; material.needsUpdate = true;
            refreshInspector(); status("Base texture loaded");
        });
    };
    reader.readAsDataURL(file);
}
function restoreTexture(material, dataUrl) { if (!dataUrl) return; try { new THREE.TextureLoader().load(dataUrl, texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; material.map?.dispose?.(); material.map = texture; material.needsUpdate = true; }); } catch {} }
function status(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }
