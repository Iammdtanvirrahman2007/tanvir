import * as THREE from "three";
import { pushHistory } from "../core/history.js";

let currentObject = null;
let activeTab = "object";

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
    const body = document.createElement("div");
    body.className = "section-body";
    const name = field("Name", "text", object.name || object.type);
    const type = field("Type", "text", object.isGroup ? "Group" : object.geometry?.type || object.type, true);
    name.input.addEventListener("change", () => {
        const before = object.name;
        const after = name.input.value.trim() || before;
        if (after === before) return;
        object.name = after;
        pushHistory({ undo: () => { object.name = before; refreshInspector(); }, redo: () => { object.name = after; refreshInspector(); } });
        status(`Renamed to ${after}`);
        window.dispatchEvent(new CustomEvent("editor:hierarchy-refresh"));
    });
    body.append(name.row, type.row);
    return section("Object", body);
}

function buildTransform(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    body.append(
        vectorField("Position", object, "position", false),
        vectorField("Rotation", object, "rotation", true),
        vectorField("Scale", object, "scale", false)
    );
    return section("Transform", body);
}

function vectorField(label, object, property, degrees) {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "9px";
    const title = document.createElement("label");
    title.style.cssText = "display:block;margin-bottom:4px;color:#858994;font-size:10px";
    title.textContent = label;
    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px";

    ["x", "y", "z"].forEach(axis => {
        const input = document.createElement("input");
        input.className = "property-input";
        input.type = "number";
        input.step = degrees ? "1" : "0.01";
        input.title = `${label} ${axis.toUpperCase()}`;
        input.value = formatValue(readAxis(object, property, axis, degrees), degrees);
        input.addEventListener("change", () => {
            const before = object[property].clone();
            const value = Number(input.value) || 0;
            const after = object[property].clone();
            if (degrees) after[axis] = THREE.MathUtils.degToRad(value);
            else after[axis] = value;
            object[property].copy(after);
            pushHistory({ undo: () => { object[property].copy(before); refreshInspector(); }, redo: () => { object[property].copy(after); refreshInspector(); } });
            status(`${label} changed`);
        });
        row.appendChild(input);
    });

    wrapper.append(title, row);
    return wrapper;
}

function buildVisibility(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>Visible</label><input type="checkbox">`;
    const input = row.querySelector("input");
    input.checked = object.visible;
    input.addEventListener("change", () => {
        const before = object.visible;
        const after = input.checked;
        object.visible = after;
        pushHistory({ undo: () => { object.visible = before; refreshInspector(); }, redo: () => { object.visible = after; refreshInspector(); } });
    });
    body.appendChild(row);
    return section("Visibility", body);
}

function buildMetadata(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    [["UUID", object.uuid], ["Mass", object.userData?.mass ?? "1"], ["Part Type", object.userData?.partType || "Default"]].forEach(([label, value]) => {
        const item = field(label, "text", value, true);
        body.appendChild(item.row);
    });
    return section("Metadata", body);
}

function buildMaterialSection(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    if (!object.material) {
        const message = document.createElement("p");
        message.style.color = "#777b85";
        message.textContent = "This object has no editable material.";
        body.appendChild(message);
        return section("Material", body);
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const slot = document.createElement("select");
    slot.className = "property-select";
    materials.forEach((material, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = material.name || `Material ${index + 1}`;
        slot.appendChild(option);
    });
    const slotRow = document.createElement("div");
    slotRow.className = "property-row";
    const slotLabel = document.createElement("label");
    slotLabel.textContent = "Slot";
    slotRow.append(slotLabel, slot);
    body.appendChild(slotRow);

    const editor = document.createElement("div");
    editor.style.marginTop = "8px";
    body.appendChild(editor);
    const render = () => {
        editor.replaceChildren();
        const material = materials[Number(slot.value)];
        if (!material) return;
        addColor(editor, material);
        addRange(editor, "Metalness", material.metalness ?? 0, value => material.metalness = value);
        addRange(editor, "Roughness", material.roughness ?? 1, value => material.roughness = value);
        addRange(editor, "Opacity", material.opacity ?? 1, value => { material.opacity = value; material.transparent = value < 1; material.depthWrite = value >= 1; material.needsUpdate = true; });
        const wire = field("Wireframe", "checkbox", material.wireframe);
        wire.input.checked = material.wireframe;
        wire.input.addEventListener("change", () => { material.wireframe = wire.input.checked; material.needsUpdate = true; });
        editor.appendChild(wire.row);
        const texture = document.createElement("label");
        texture.className = "file-input-label";
        texture.textContent = "Load Texture";
        const input = document.createElement("input");
        input.type = "file"; input.accept = ".png,.jpg,.jpeg,.webp"; input.hidden = true;
        input.addEventListener("change", () => loadTexture(input.files?.[0], material));
        texture.appendChild(input); texture.addEventListener("click", () => input.click());
        editor.appendChild(texture);
    };
    slot.addEventListener("change", render);
    render();
    return section("Material", body);
}

function addColor(parent, material) {
    const row = field("Color", "color", `#${material.color.getHexString()}`);
    row.input.addEventListener("input", () => { material.color.set(row.input.value); material.needsUpdate = true; });
    parent.appendChild(row.row);
}

function addRange(parent, label, initial, onChange) {
    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>${label}</label><div class="range-row"><input type="range" min="0" max="1" step="0.01"><input class="range-value" type="number" min="0" max="1" step="0.01"></div>`;
    const range = row.querySelector("input[type=range]"), value = row.querySelector("input[type=number]");
    range.value = initial; value.value = Number(initial).toFixed(2);
    range.addEventListener("input", () => { value.value = Number(range.value).toFixed(2); onChange(Number(range.value)); });
    value.addEventListener("change", () => { const n = Math.min(1, Math.max(0, Number(value.value) || 0)); range.value = n; value.value = n.toFixed(2); onChange(n); });
    parent.appendChild(row);
}

function field(label, type, value, disabled = false) {
    const row = document.createElement("div");
    row.className = "property-row";
    const caption = document.createElement("label"); caption.textContent = label;
    const input = document.createElement("input"); input.className = "property-input"; input.type = type; input.disabled = disabled;
    if (type === "checkbox") input.checked = !!value; else input.value = value ?? "";
    row.append(caption, input);
    return { row, input };
}

function section(title, body) {
    const wrapper = document.createElement("section"); wrapper.className = "inspector-section";
    const head = document.createElement("button"); head.className = "section-head"; head.innerHTML = `<span class="section-chevron">▾</span>${title}`;
    head.addEventListener("click", () => { body.hidden = !body.hidden; head.querySelector(".section-chevron").textContent = body.hidden ? "▸" : "▾"; });
    wrapper.append(head, body); return wrapper;
}

function readAxis(object, property, axis, degrees) { const value = object[property][axis]; return degrees ? THREE.MathUtils.radToDeg(value) : value; }
function formatValue(value, degrees) { return Number(value).toFixed(degrees ? 1 : 2); }
function loadTexture(file, material) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => new THREE.TextureLoader().load(reader.result, texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false; material.map = texture; material.needsUpdate = true; });
    reader.readAsDataURL(file);
}
function status(message) { window.dispatchEvent(new CustomEvent("editor:status", { detail: message })); }
