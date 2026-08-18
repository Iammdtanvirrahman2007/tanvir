import * as THREE from "three";
import { VoxelGrid } from "./voxelGrid.js";
import { copyRegion, fillBox, floodFill, pasteRegion, paint } from "./voxelOps.js";
import { pushHistory } from "../history.js";

const BLOCKS = [
    { id: "grass", label: "Grass" },
    { id: "dirt", label: "Dirt" },
    { id: "stone", label: "Stone" },
    { id: "wood", label: "Wood" },
    { id: "sand", label: "Sand" },
    { id: "brick", label: "Brick" },
    { id: "glass", label: "Glass" }
];

const COLORS = {
    grass: 0x6ea84f,
    dirt: 0x8b5a2b,
    stone: 0x8a8f98,
    wood: 0x9a6a3a,
    sand: 0xd7bf78,
    brick: 0xa9564a,
    glass: 0x8fc7dc
};

const TOOLS = [
    ["paint", "Paint"], ["erase", "Erase"], ["fill", "Fill Box"], ["flood", "Flood"],
    ["select", "Select"], ["copy", "Copy"], ["paste", "Paste"], ["duplicate", "Duplicate"]
];

export function initVoxelEditor({ scene, camera, renderer, controls }) {
    const state = {
        active: false,
        selectedBlock: "grass",
        tool: "paint",
        grid: new VoxelGrid({ dimensions: [64, 32, 64], voxelSize: 1, origin: [0, 0, 0] }),
        root: new THREE.Group(),
        meshes: new Map(),
        raycaster: new THREE.Raycaster(),
        pointer: new THREE.Vector2(),
        materialCache: new Map(),
        status: null,
        palette: null,
        modeButton: null,
        selectionStart: null,
        selectionEnd: null,
        selectionHelper: null,
        clipboard: null
    };

    state.root.name = "VoxelWorkspace";
    state.root.visible = false;
    scene.add(state.root);

    injectUI(state);
    bindViewport(state, renderer.domElement, camera, controls);

    return {
        toggle: () => toggle(state),
        isActive: () => state.active,
        getGrid: () => state.grid,
        clear: () => clear(state)
    };
}

function toggle(state) {
    state.active = !state.active;
    state.root.visible = state.active;
    state.modeButton?.classList.toggle("active", state.active);
    state.modeButton.textContent = state.active ? "Voxel Mode On" : "Voxel Mode";
    setStatus(state, state.active ? `Voxel mode · ${state.selectedBlock} · ${state.tool}` : "3D Modeling Mode");
    window.dispatchEvent(new CustomEvent("editor:voxel-mode", { detail: state.active }));
    return state.active;
}

function injectUI(state) {
    const topActions = document.querySelector(".top-actions");
    if (topActions && !document.getElementById("voxelModeBtn")) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "voxelModeBtn";
        button.className = "action-btn";
        button.textContent = "Voxel Mode";
        button.addEventListener("click", () => toggle(state));
        topActions.insertBefore(button, topActions.firstChild);
        state.modeButton = button;
    } else {
        state.modeButton = document.getElementById("voxelModeBtn");
    }

    const panel = document.createElement("aside");
    panel.id = "voxelPalette";
    panel.hidden = true;
    panel.innerHTML = `
        <div class="mf-voxel-head">
            <div><span>VOXEL AUTHORING</span><strong>Block Palette</strong></div>
            <button type="button" aria-label="Close voxel palette">×</button>
        </div>
        <div class="mf-voxel-tools">
            ${BLOCKS.map(block => `<button type="button" data-block="${block.id}"><i></i>${block.label}</button>`).join("")}
        </div>
        <div class="mf-voxel-actions">
            ${TOOLS.map(([id, label]) => `<button type="button" data-tool="${id}">${label}</button>`).join("")}
            <button type="button" data-tool="clear">Clear All</button>
        </div>
        <div class="mf-voxel-selection" id="voxelSelectionInfo">Selection: none</div>
        <div class="mf-voxel-help">Paint: left click · Erase: left/right click · Select: two corners · Esc: exit</div>
    `;
    document.body.appendChild(panel);
    state.palette = panel;

    panel.querySelectorAll("[data-block]").forEach(button => button.addEventListener("click", () => {
        state.selectedBlock = button.dataset.block;
        selectBlockVisual(state, state.selectedBlock);
        setStatus(state, `Voxel block · ${state.selectedBlock}`);
    }));
    panel.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
        activateTool(state, button.dataset.tool);
    }));
    panel.querySelector(".mf-voxel-head button")?.addEventListener("click", () => toggle(state));
    selectBlockVisual(state, state.selectedBlock);
    selectToolVisual(state, state.tool);

    if (!document.getElementById("voxelEditorStyles")) {
        const style = document.createElement("style");
        style.id = "voxelEditorStyles";
        style.textContent = `
          #voxelPalette{position:fixed;left:18px;top:78px;width:250px;z-index:130;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font-family:system-ui,sans-serif;overflow:hidden}
          #voxelPalette[hidden]{display:none!important}
          .mf-voxel-head{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid #292d35;background:#17191f}.mf-voxel-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.mf-voxel-head strong{display:block;font-size:13px;margin-top:2px}.mf-voxel-head button{width:26px;height:26px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px;cursor:pointer}
          .mf-voxel-tools{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px}.mf-voxel-tools button,.mf-voxel-actions button{display:flex;align-items:center;gap:7px;border:1px solid #30343c;background:#191c22;color:#b8bdc7;border-radius:5px;padding:8px;font-size:10px;text-align:left;cursor:pointer}.mf-voxel-tools button:hover,.mf-voxel-tools button.selected,.mf-voxel-actions button:hover,.mf-voxel-actions button.selected{border-color:#69707d;background:#252932;color:#fff}.mf-voxel-tools i{width:12px;height:12px;border-radius:3px;background:#777;display:block}.mf-voxel-tools [data-block=grass] i{background:#6ea84f}.mf-voxel-tools [data-block=dirt] i{background:#8b5a2b}.mf-voxel-tools [data-block=stone] i{background:#8a8f98}.mf-voxel-tools [data-block=wood] i{background:#9a6a3a}.mf-voxel-tools [data-block=sand] i{background:#d7bf78}.mf-voxel-tools [data-block=brick] i{background:#a9564a}.mf-voxel-tools [data-block=glass] i{background:#8fc7dc}
          .mf-voxel-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:0 10px 10px}.mf-voxel-selection{padding:8px 10px;border-top:1px solid #292d35;border-bottom:1px solid #292d35;color:#9299a5;font-size:9px}.mf-voxel-help{padding:9px 10px;color:#777e8a;font-size:9px;line-height:1.45}.mf-voxel-actions button[data-tool=clear]{grid-column:1/-1}.mf-voxel-actions button.selected{background:#e6e8ec;color:#111318;border-color:#e6e8ec}
          #voxelModeBtn.active{background:#e6e8ec;color:#111318;border-color:#e6e8ec}
          @media(max-width:760px){#voxelPalette{left:8px;right:8px;top:auto;bottom:112px;width:auto}.mf-voxel-tools{grid-template-columns:repeat(4,1fr)}.mf-voxel-actions{grid-template-columns:repeat(4,1fr)}.mf-voxel-actions button[data-tool=clear]{grid-column:auto}}
        `;
        document.head.appendChild(style);
    }
}

function bindViewport(state, element, camera, controls) {
    element.addEventListener("contextmenu", event => {
        if (state.active) event.preventDefault();
    });
    element.addEventListener("pointerdown", event => {
        if (!state.active || event.button > 2) return;
        const coordinate = resolveCoordinate(state, element, camera, event, state.tool === "paint");
        if (!coordinate) return;

        if (state.tool === "erase") {
            removeVoxelWithHistory(state, coordinate);
        } else if (state.tool === "flood") {
            runFlood(state, coordinate);
        } else if (state.tool === "fill") {
            chooseFillCorner(state, coordinate);
        } else if (state.tool === "select") {
            chooseSelectionCorner(state, coordinate);
        } else if (state.tool === "copy") {
            chooseSelectionCorner(state, coordinate);
            if (state.selectionStart && state.selectionEnd) copySelection(state);
        } else if (state.tool === "paste") {
            pasteSelection(state, coordinate);
        } else if (state.tool === "duplicate") {
            duplicateSelection(state, coordinate);
        } else if (event.button === 0) {
            placeVoxelWithHistory(state, coordinate);
        }
        controls?.update?.();
    });

    window.addEventListener("keydown", event => {
        if (!state.active) return;
        if (event.key === "Escape") {
            if (state.selectionStart || state.selectionEnd) clearSelectionArea(state);
            else toggle(state);
            return;
        }
        if (event.key >= "1" && event.key <= "7") {
            selectBlock(state, BLOCKS[Number(event.key) - 1]?.id);
        }
    });
}

function activateTool(state, tool) {
    if (tool === "clear") {
        clear(state, true);
        return;
    }
    state.tool = TOOLS.some(([id]) => id === tool) ? tool : "paint";
    if (state.tool === "fill" || state.tool === "select" || state.tool === "copy") {
        clearSelectionArea(state);
    }
    selectToolVisual(state, state.tool);
    setStatus(state, `Voxel tool · ${state.tool}`);
}

function selectBlock(state, id) {
    if (!id) return;
    state.selectedBlock = id;
    selectBlockVisual(state, id);
    setStatus(state, `Voxel block · ${id}`);
}

function selectBlockVisual(state, id) {
    state.palette?.querySelectorAll("[data-block]").forEach(item => item.classList.toggle("selected", item.dataset.block === id));
}

function selectToolVisual(state, id) {
    state.palette?.querySelectorAll("[data-tool]").forEach(item => item.classList.toggle("selected", item.dataset.tool === id));
}

function resolveCoordinate(state, element, camera, event, placement = false) {
    const rect = element.getBoundingClientRect();
    state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, camera);
    const hits = state.raycaster.intersectObjects([...state.meshes.values()], false);

    if (hits[0]) {
        const hit = hits[0];
        const base = hit.object.userData.voxel;
        if (!placement) return [...base];
        const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
        return [base[0] + Math.round(normal.x), base[1] + Math.round(normal.y), base[2] + Math.round(normal.z)];
    }

    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(ground, point)) return null;
    return [Math.floor(point.x), 0, Math.floor(point.z)];
}

function placeVoxelWithHistory(state, coordinate) {
    if (!state.grid.isInside(...coordinate)) return;
    const before = state.grid.getBlockRecord(...coordinate);
    if (before.blockId === state.selectedBlock && !before.properties) return;
    state.grid.setBlock(...coordinate, state.selectedBlock);
    renderVoxel(state, coordinate);
    pushHistory({
        label: `Place voxel ${state.selectedBlock}`,
        undo: () => restoreVoxelRecord(state, before),
        redo: () => { state.grid.setBlock(...coordinate, state.selectedBlock); renderVoxel(state, coordinate); }
    });
    setStatus(state, `Placed ${state.selectedBlock} at ${coordinate.join(", ")}`);
}

function removeVoxelWithHistory(state, coordinate) {
    if (!state.grid.isInside(...coordinate)) return;
    const before = state.grid.getBlockRecord(...coordinate);
    if (!before || before.blockId === state.grid.defaultBlock) return;
    state.grid.removeBlock(...coordinate);
    removeVoxelMesh(state, coordinate);
    pushHistory({
        label: "Erase voxel",
        undo: () => restoreVoxelRecord(state, before),
        redo: () => { state.grid.removeBlock(...coordinate); removeVoxelMesh(state, coordinate); }
    });
    setStatus(state, `Removed voxel at ${coordinate.join(", ")}`);
}

function runFlood(state, coordinate) {
    const changes = floodFill(state.grid, coordinate, state.selectedBlock);
    if (!changes.length) return setStatus(state, "Flood fill made no changes");
    renderAll(state);
    pushBatchHistory(state, changes, "Flood fill");
    setStatus(state, `Flood filled ${changes.length} voxels`);
}

function chooseFillCorner(state, coordinate) {
    if (!state.selectionStart) {
        state.selectionStart = [...coordinate];
        updateSelectionInfo(state);
        setStatus(state, "Fill start selected · choose the opposite corner");
        return;
    }
    state.selectionEnd = [...coordinate];
    const changes = fillBox(state.grid, state.selectionStart, state.selectionEnd, state.selectedBlock);
    if (changes.length) {
        renderAll(state);
        pushBatchHistory(state, changes, "Fill voxel box");
        setStatus(state, `Filled ${changes.length} voxels`);
    }
    updateSelectionHelper(state);
}

function chooseSelectionCorner(state, coordinate) {
    if (!state.selectionStart || state.selectionEnd) state.selectionStart = [...coordinate], state.selectionEnd = null;
    else state.selectionEnd = [...coordinate];
    updateSelectionHelper(state);
    updateSelectionInfo(state);
}

function copySelection(state) {
    if (!state.selectionStart || !state.selectionEnd) return;
    state.clipboard = copyRegion(state.grid, state.selectionStart, state.selectionEnd);
    setStatus(state, `Copied ${state.clipboard.blocks.length} voxels`);
}

function pasteSelection(state, origin) {
    if (!state.clipboard) return setStatus(state, "Clipboard is empty");
    const before = state.grid.serialize();
    const changes = pasteRegion(state.grid, state.clipboard, origin);
    if (!changes.length) return setStatus(state, "Nothing pasted in bounds");
    renderAll(state);
    const after = state.grid.serialize();
    pushHistory({ label: "Paste voxels", undo: () => restoreGrid(state, before), redo: () => restoreGrid(state, after) });
    setStatus(state, `Pasted ${changes.length} voxels`);
}

function duplicateSelection(state, origin) {
    if (!state.selectionStart || !state.selectionEnd) return setStatus(state, "Select a voxel region first");
    state.clipboard = copyRegion(state.grid, state.selectionStart, state.selectionEnd);
    pasteSelection(state, origin);
}

function pushBatchHistory(state, changes, label) {
    const before = changes.map(change => change.before).filter(Boolean);
    const after = changes.map(change => change.after).filter(Boolean);
    pushHistory({
        label,
        undo: () => before.forEach(record => restoreVoxelRecord(state, record)),
        redo: () => after.forEach(record => restoreVoxelRecord(state, record))
    });
}

function restoreVoxelRecord(state, record) {
    if (!record) return;
    if (record.blockId === state.grid.defaultBlock && !record.properties) state.grid.removeBlock(record.x, record.y, record.z), removeVoxelMesh(state, [record.x, record.y, record.z]);
    else state.grid.setBlock(record.x, record.y, record.z, record.blockId, record.properties), renderVoxel(state, [record.x, record.y, record.z]);
}

function restoreGrid(state, data) {
    state.grid = VoxelGrid.deserialize(data);
    renderAll(state);
}

function renderVoxel(state, coordinate) {
    const key = state.grid.key(...coordinate);
    const existing = state.meshes.get(key);
    if (existing) {
        const block = state.grid.getBlock(...coordinate);
        existing.material = getMaterial(state, block);
        return;
    }
    const block = state.grid.getBlock(...coordinate);
    if (block === state.grid.defaultBlock) return;
    const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const mesh = new THREE.Mesh(geometry, getMaterial(state, block));
    mesh.position.set(coordinate[0] + 0.5, coordinate[1] + 0.5, coordinate[2] + 0.5);
    mesh.userData.voxel = [...coordinate];
    state.root.add(mesh);
    state.meshes.set(key, mesh);
}

function renderAll(state) {
    for (const mesh of state.meshes.values()) {
        mesh.geometry.dispose();
        mesh.removeFromParent();
    }
    state.meshes.clear();
    state.grid.forEachBlock(block => renderVoxel(state, [block.x, block.y, block.z]));
    updateSelectionHelper(state);
}

function removeVoxelMesh(state, coordinate) {
    const key = state.grid.key(...coordinate);
    const mesh = state.meshes.get(key);
    if (!mesh) return;
    mesh.removeFromParent();
    mesh.geometry.dispose();
    state.meshes.delete(key);
}

function getMaterial(state, block) {
    if (!state.materialCache.has(block)) {
        const material = new THREE.MeshStandardMaterial({ color: COLORS[block] ?? 0xffffff, roughness: block === "glass" ? 0.15 : 0.9, metalness: 0 });
        if (block === "glass") material.transparent = true, material.opacity = 0.45;
        state.materialCache.set(block, material);
    }
    return state.materialCache.get(block);
}

function updateSelectionHelper(state) {
    state.selectionHelper?.removeFromParent();
    state.selectionHelper = null;
    if (!state.selectionStart || !state.selectionEnd) return;
    const min = [
        Math.min(state.selectionStart[0], state.selectionEnd[0]),
        Math.min(state.selectionStart[1], state.selectionEnd[1]),
        Math.min(state.selectionStart[2], state.selectionEnd[2])
    ];
    const max = [
        Math.max(state.selectionStart[0], state.selectionEnd[0]),
        Math.max(state.selectionStart[1], state.selectionEnd[1]),
        Math.max(state.selectionStart[2], state.selectionEnd[2])
    ];
    const size = [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1];
    const helper = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.55 })
    );
    helper.position.set(min[0] + size[0] / 2, min[1] + size[1] / 2, min[2] + size[2] / 2);
    helper.name = "VoxelSelection";
    state.root.add(helper);
    state.selectionHelper = helper;
}

function updateSelectionInfo(state) {
    const info = state.palette?.querySelector("#voxelSelectionInfo");
    if (!info) return;
    if (!state.selectionStart) info.textContent = "Selection: none";
    else if (!state.selectionEnd) info.textContent = `Selection: ${state.selectionStart.join(", ")} → …`;
    else {
        const size = state.selectionStart.map((value, index) => Math.abs(value - state.selectionEnd[index]) + 1);
        info.textContent = `Selection: ${size.join(" × ")}`;
    }
}

function clearSelectionArea(state) {
    state.selectionStart = null;
    state.selectionEnd = null;
    state.selectionHelper?.removeFromParent();
    state.selectionHelper = null;
    updateSelectionInfo(state);
}

function clear(state, recordHistory = false) {
    const before = state.grid.serialize();
    state.grid.clear();
    renderAll(state);
    clearSelectionArea(state);
    if (recordHistory && before.blocks.length) {
        const after = state.grid.serialize();
        pushHistory({ label: "Clear voxels", undo: () => restoreGrid(state, before), redo: () => restoreGrid(state, after) });
    }
    setStatus(state, "Voxel grid cleared");
}

function setStatus(state, message) {
    state.status = message;
    window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));
    if (state.palette) state.palette.hidden = !state.active;
    updateSelectionInfo(state);
}
