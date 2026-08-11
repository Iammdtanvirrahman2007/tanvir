import * as THREE from "three";
import { pushHistory } from "../core/history.js";

let currentObject = null;
let activeTab = "object";
let updating = false;

export function initInspector() {
    document.querySelectorAll(".inspector-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            activeTab = tab.dataset.tab || "object";
            document.querySelectorAll(".inspector-tab").forEach(item => item.classList.toggle("active", item === tab));
            renderInspector();
        });
    });
}

export function updateInspector(object) {
    currentObject = object || null;
    renderInspector();
}

export function getInspectorObject() {
    return currentObject;
}

export function refreshInspector() {
    if (currentObject) renderInspector();
}

function renderInspector() {
    const panel = document.getElementById("inspectorContent");
    if (!panel) return;

    panel.replaceChildren();

    if (!currentObject) {
        const empty = document.createElement("div");
        empty.className = "empty-inspector";
        empty.innerHTML = `<div class="empty-icon">◇</div><strong>No object selected</strong><p>Select an object in the viewport or Scene panel to inspect its properties.</p>`;
        panel.appendChild(empty);
        return;
    }

    if (activeTab === "material") {
        panel.appendChild(buildMaterialSection(currentObject));
        return;
    }

    panel.append(
        buildIdentitySection(currentObject),
        buildTransformSection(currentObject),
        buildVisibilitySection(currentObject),
        buildMetadataSection(currentObject)
    );
}

function buildIdentitySection(object) {
    const body = document.createElement("div");
    body.className = "section-body";

    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>Name</label><input class="property-input" id="ins_name" type="text">`;
    row.querySelector("input").value = object.name || object.type;
    row.querySelector("input").addEventListener("change", event => {
        const previous = object.name;
        const next = event.target.value.trim() || previous;
        if (next === previous) return;
        object.name = next;
        pushHistory({ undo: () => { object.name = previous; updateInspector(object); }, redo: () => { object.name = next; updateInspector(object); } });
        dispatchRefresh("Renamed object");
    });
    body.appendChild(row);

    const typeRow = document.createElement("div");
    typeRow.className = "property-row";
    typeRow.innerHTML = `<label>Type</label><input class="property-input" disabled>`;
    typeRow.querySelector("input").value = object.isGroup ? "Group" : object.geometry?.type || object.type;
    body.appendChild(typeRow);

    return section("Object", body);
}

function buildTransformSection(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    body.appendChild(vectorControl("Position", ["posX", "posY", "posZ"], [object.position.x, object.position.y, object.position.z], value => setVector(object, "position", value)));
    body.appendChild(vectorControl("Rotation", ["rotX", "rotY", "rotZ"], [THREE.MathUtils.radToDeg(object.rotation.x), THREE.MathUtils.radToDeg(object.rotation.y), THREE.MathUtils.radToDeg(object.rotation.z)], value => setRotation(object, value)));
    body.appendChild(vectorControl("Scale", ["scaleX", "scaleY", "scaleZ"], [object.scale.x, object.scale.y, object.scale.z], value => setVector(object, "scale", value)));
    return section("Transform", body);
}

function vectorControl(title, ids, values, apply) {
    const wrapper = document.createElement("div");
    wrapper.className = "property-row";
    wrapper.style.display = "block";
    wrapper.innerHTML = `<label style="display:block;margin-bottom:4px">${title}</label>`;

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 1fr 1fr";
    row.style.gap = "4px";

    ["X", "Y", "Z"].forEach((axis, index) => {
        const input = document.createElement("input");
        input.className = "property-input";
        input.id = ids[index];
        input.type = "number";
        input.step = title === "Rotation" ? "1" : "0.01";
        input.value = Number(values[index]).toFixed(title === "Rotation" ? 1 : 2);
        input.title = `${title} ${axis}`;
        input.addEventListener("change", () => {
            const next = values.slice();
            next[index] = Number(input.value) || 0;
            apply(next);
        });
        row.appendChild(input);
    });

    wrapper.appendChild(row);
    return wrapper;
}

function setVector(object, property, next) {
    const before = object[property].clone();
    const after = new THREE.Vector3(...next);
    object[property].copy(after);
    pushHistory({ undo: () => { object[property].copy(before); refreshInspector(); }, redo: () => { object[property].copy(after); refreshInspector(); } });
    dispatchRefresh(`${property} changed`);
}

function setRotation(object, degrees) {
    const before = object.rotation.clone();
    const after = new THREE.Euler(...degrees.map(value => THREE.MathUtils.degToRad(value)), object.rotation.order);
    object.rotation.copy(after);
    pushHistory({ undo: () => { object.rotation.copy(before); refreshInspector(); }, redo: () => { object.rotation.copy(after); refreshInspector(); } });
    dispatchRefresh("Rotation changed");
}

function buildVisibilitySection(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>Visible</label><input type="checkbox">`;
    const checkbox = row.querySelector("input");
    checkbox.checked = object.visible;
    checkbox.addEventListener("change", () => {
        const before = object.visible;
        const after = checkbox.checked;
        object.visible = after;
        pushHistory({ undo: () => { object.visible = before; refreshInspector(); }, redo: () => { object.visible = after; refreshInspector(); } });
    });
    body.appendChild(row);
    return section("Visibility", body);
}

function buildMetadataSection(object) {
    const body = document.createElement("div");
    body.className = "section-body";
    const entries = [
        ["UUID", object.uuid],
        ["Mass", object.userData?.mass ?? "1"],
        ["Part Type", object.userData?.partType || "Default"]
    ];
    entries.forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "property-row";
        row.innerHTML = `<label>${label}</label><input class="property-input" disabled>`;
        row.querySelector("input").value = value;
        body.appendChild(row);
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
    const selectRow = document.createElement("div");
    selectRow.className = "property-row";
    selectRow.innerHTML = `<label>Slot</label><select class="property-select" id="materialSlot"></select>`;
    const slot = selectRow.querySelector("select");
    materials.forEach((material, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = material.name || `Material ${index + 1}`;
        slot.appendChild(option);
    });
    body.appendChild(selectRow);

    const controls = document.createElement("div");
    controls.style.marginTop = "8px";
    body.appendChild(controls);

    const renderMaterial = index => {
        controls.replaceChildren();
        const material = materials[index];
        if (!material) return;

        addColorControl(controls, "Color", material, value => {
            material.color.set(value);
            material.needsUpdate = true;
        });
        addRangeControl(controls, "Metalness", material.metalness ?? 0, value => { material.metalness = value; });
        addRangeControl(controls, "Roughness", material.roughness ?? 1, value => { material.roughness = value; });
        addRangeControl(controls, "Opacity", material.opacity ?? 1, value => {
            material.opacity = value;
            material.transparent = value < 1;
            material.depthWrite = value >= 1;
            material.needsUpdate = true;
        });

        const wire = document.createElement("div");
        wire.className = "property-row";
        wire.innerHTML = `<label>Wireframe</label><input type="checkbox">`;
        const checkbox = wire.querySelector("input");
        checkbox.checked = !!material.wireframe;
        checkbox.addEventListener("change", () => { material.wireframe = checkbox.checked; material.needsUpdate = true; });
        controls.appendChild(wire);

        const texture = document.createElement("label");
        texture.className = "file-input-label";
        texture.textContent = "Load Texture";
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".png,.jpg,.jpeg,.webp";
        input.hidden = true;
        input.addEventListener("change", () => loadTexture(input.files?.[0], material));
        texture.appendChild(input);
        texture.addEventListener("click", () => input.click());
        controls.appendChild(texture);
    };

    slot.addEventListener("change", () => renderMaterial(Number(slot.value)));
    renderMaterial(0);
    return section("Material", body);
}

function addColorControl(parent, label, material, onChange) {
    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>${label}</label><input class="property-input" type="color">`;
    const input = row.querySelector("input");
    input.value = `#${material.color.getHexString()}`;
    input.addEventListener("input", () => onChange(input.value));
    parent.appendChild(row);
}

function addRangeControl(parent, label, initial, onChange) {
    const row = document.createElement("div");
    row.className = "property-row";
    row.innerHTML = `<label>${label}</label><div class="range-row"><input type="range" min="0" max="1" step="0.01"><input class="range-value" type="number" min="0" max="1" step="0.01"></div>`;
    const range = row.querySelector("input[type=range]");
    const value = row.querySelector("input[type=number]");
    range.value = initial;
    value.value = Number(initial).toFixed(2);
    const sync = next => { const n = Math.min(1, Math.max(0, Number(next) || 0)); range.value = n; value.value = n.toFixed(2); onChange(n); };
    range.addEventListener("input", () => sync(range.value));
    value.addEventListener("change", () => sync(value.value));
    parent.appendChild(row);
}

function loadTexture(file, material) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => new THREE.TextureLoader().load(reader.result, texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        material.map = texture;
        material.needsUpdate = true;
    });
    reader.readAsDataURL(file);
}

function section(title, body) {
    const wrapper = document.createElement("section");
    wrapper.className = "inspector-section";
    const head = document.createElement("button");
    head.className = "section-head";
    head.innerHTML = `<span class="section-chevron">▾</span>${title}`;
    head.addEventListener("click", () => {
        const hidden = body.hidden;
        body.hidden = !hidden;
        head.querySelector(".section-chevron").textContent = hidden ? "▾" : "▸";
    });
    wrapper.append(head, body);
    return wrapper;
}

function dispatchRefresh(message) {
    window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));
    if (!updating) renderInspector();
}
