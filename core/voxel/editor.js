import * as THREE from "three";
import { VoxelGrid } from "./voxelGrid.js";
import { paint } from "./voxelOps.js";

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

export function initVoxelEditor({ scene, camera, renderer, controls }) {
    const state = {
        active: false,
        selectedBlock: "grass",
        grid: new VoxelGrid({ dimensions: [64, 32, 64], voxelSize: 1, origin: [0, 0, 0] }),
        root: new THREE.Group(),
        meshes: new Map(),
        raycaster: new THREE.Raycaster(),
        pointer: new THREE.Vector2(),
        materialCache: new Map(),
        status: null,
        palette: null,
        modeButton: null
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
    setStatus(state, state.active ? `Voxel mode · ${state.selectedBlock}` : "3D Modeling Mode");
    window.dispatchEvent(new CustomEvent("editor:voxel-mode", { detail: state.active }));
    return state.active;
}

function injectUI(state) {
    const topActions = document.querySelector(".top-actions");
    if (topActions) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "voxelModeBtn";
        button.className = "action-btn";
        button.textContent = "Voxel Mode";
        button.addEventListener("click", () => toggle(state));
        topActions.insertBefore(button, topActions.firstChild);
        state.modeButton = button;
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
        <div class="mf-voxel-help">Left click: place · Right click: delete · Esc: exit</div>
    `;
    document.body.appendChild(panel);
    state.palette = panel;

    panel.querySelectorAll("[data-block]").forEach(button => button.addEventListener("click", () => {
        state.selectedBlock = button.dataset.block;
        panel.querySelectorAll("[data-block]").forEach(item => item.classList.toggle("selected", item === button));
        setStatus(state, `Voxel block · ${button.textContent.trim()}`);
    }));
    panel.querySelector(".mf-voxel-head button")?.addEventListener("click", () => toggle(state));
    panel.querySelector("[data-block=grass]")?.classList.add("selected");

    const style = document.createElement("style");
    style.id = "voxelEditorStyles";
    style.textContent = `
      #voxelPalette{position:fixed;left:18px;top:78px;width:210px;z-index:130;background:#111319;border:1px solid #343842;border-radius:9px;box-shadow:0 18px 60px #0009;color:#e6e9ee;font-family:system-ui,sans-serif;overflow:hidden}
      #voxelPalette[hidden]{display:none!important}
      .mf-voxel-head{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid #292d35;background:#17191f}.mf-voxel-head span{display:block;font-size:8px;letter-spacing:.15em;color:#7f8692}.mf-voxel-head strong{display:block;font-size:13px;margin-top:2px}.mf-voxel-head button{width:26px;height:26px;border:1px solid #333741;background:#1e2127;color:#c9cdd5;border-radius:5px;cursor:pointer}
      .mf-voxel-tools{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px}.mf-voxel-tools button{display:flex;align-items:center;gap:7px;border:1px solid #30343c;background:#191c22;color:#b8bdc7;border-radius:5px;padding:8px;font-size:10px;text-align:left;cursor:pointer}.mf-voxel-tools button:hover,.mf-voxel-tools button.selected{border-color:#69707d;background:#252932;color:#fff}.mf-voxel-tools i{width:12px;height:12px;border-radius:3px;background:#777;display:block}.mf-voxel-tools [data-block=grass] i{background:#6ea84f}.mf-voxel-tools [data-block=dirt] i{background:#8b5a2b}.mf-voxel-tools [data-block=stone] i{background:#8a8f98}.mf-voxel-tools [data-block=wood] i{background:#9a6a3a}.mf-voxel-tools [data-block=sand] i{background:#d7bf78}.mf-voxel-tools [data-block=brick] i{background:#a9564a}.mf-voxel-tools [data-block=glass] i{background:#8fc7dc}.mf-voxel-help{padding:9px 10px;border-top:1px solid #292d35;color:#777e8a;font-size:9px;line-height:1.45}
      #voxelModeBtn.active{background:#e6e8ec;color:#111318;border-color:#e6e8ec}
      @media(max-width:760px){#voxelPalette{left:8px;right:8px;top:auto;bottom:112px;width:auto}.mf-voxel-tools{grid-template-columns:repeat(4,1fr)}}`;
    document.head.appendChild(style);
}

function bindViewport(state, element, camera, controls) {
    element.addEventListener("contextmenu", event => {
        if (!state.active) return;
        event.preventDefault();
    });
    element.addEventListener("pointerdown", event => {
        if (!state.active || event.button > 2) return;
        const point = element.getBoundingClientRect();
        state.pointer.x = ((event.clientX - point.left) / point.width) * 2 - 1;
        state.pointer.y = -((event.clientY - point.top) / point.height) * 2 + 1;
        state.raycaster.setFromCamera(state.pointer, camera);

        const hits = state.raycaster.intersectObjects([...state.meshes.values()], false);
        if (event.button === 2) {
            const hit = hits[0];
            if (hit) removeVoxel(state, hit.object.userData.voxel);
            return;
        }

        if (event.button !== 0) return;
        const hit = hits[0];
        if (hit) {
            const base = hit.object.userData.voxel;
            const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
            const target = [base[0] + Math.round(normal.x), base[1] + Math.round(normal.y), base[2] + Math.round(normal.z)];
            placeVoxel(state, target);
        } else {
            const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const point3 = new THREE.Vector3();
            if (state.raycaster.ray.intersectPlane(ground, point3)) {
                const target = [Math.floor(point3.x), 0, Math.floor(point3.z)];
                if (state.grid.isInside(...target)) placeVoxel(state, target);
            }
        }
        controls?.update?.();
    });

    window.addEventListener("keydown", event => {
        if (!state.active) return;
        if (event.key === "Escape") toggle(state);
        if (event.key === "1") selectBlock(state, "grass");
        if (event.key === "2") selectBlock(state, "dirt");
        if (event.key === "3") selectBlock(state, "stone");
        if (event.key === "4") selectBlock(state, "wood");
    });
}

function selectBlock(state, id) {
    state.selectedBlock = id;
    state.palette?.querySelectorAll("[data-block]").forEach(item => item.classList.toggle("selected", item.dataset.block === id));
    setStatus(state, `Voxel block · ${id}`);
}

function placeVoxel(state, coordinate) {
    if (!state.grid.isInside(...coordinate)) return;
    paint(state.grid, [coordinate], state.selectedBlock);
    renderVoxel(state, coordinate);
    setStatus(state, `Placed ${state.selectedBlock} at ${coordinate.join(", ")}`);
}

function removeVoxel(state, coordinate) {
    if (!coordinate || !state.grid.isInside(...coordinate)) return;
    state.grid.removeBlock(...coordinate);
    const key = state.grid.key(...coordinate);
    const mesh = state.meshes.get(key);
    if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        state.meshes.delete(key);
    }
    setStatus(state, `Removed voxel at ${coordinate.join(", ")}`);
}

function renderVoxel(state, coordinate) {
    const key = state.grid.key(...coordinate);
    const existing = state.meshes.get(key);
    if (existing) {
        existing.material.color.setHex(COLORS[state.grid.getBlock(...coordinate)] ?? 0xffffff);
        return;
    }
    const block = state.grid.getBlock(...coordinate);
    const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const material = getMaterial(state, block);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(coordinate[0] + 0.5, coordinate[1] + 0.5, coordinate[2] + 0.5);
    mesh.userData.voxel = [...coordinate];
    state.root.add(mesh);
    state.meshes.set(key, mesh);
}

function getMaterial(state, block) {
    if (!state.materialCache.has(block)) {
        const material = new THREE.MeshStandardMaterial({ color: COLORS[block] ?? 0xffffff, roughness: block === "glass" ? 0.15 : 0.9, metalness: 0 });
        if (block === "glass") material.transparent = true, material.opacity = 0.45;
        state.materialCache.set(block, material);
    }
    return state.materialCache.get(block);
}

function clear(state) {
    state.grid.clear();
    for (const mesh of state.meshes.values()) {
        mesh.geometry.dispose();
        mesh.removeFromParent();
    }
    state.meshes.clear();
}

function setStatus(state, message) {
    state.status = message;
    window.dispatchEvent(new CustomEvent("editor:status", { detail: message }));
    if (state.palette) state.palette.hidden = !state.active;
}
