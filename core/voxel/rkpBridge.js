import * as THREE from "three";
import { VoxelGrid } from "./voxelGrid.js";
import { scene } from "../scene.js?v=20260811-runtime-fix";

const COLORS = {
    grass: 0x6ea84f,
    dirt: 0x8b5a2b,
    stone: 0x8a8f98,
    wood: 0x9a6a3a,
    sand: 0xd7bf78,
    brick: 0xa9564a,
    glass: 0x8fc7dc
};

export function initVoxelRKPBridge() {
    const restore = () => {
        const payload = window.__modelForgeLastRKPAsset?.voxel;
        const editor = window.__modelForgeVoxelEditor;
        if (!payload || !editor) return;
        try {
            const restored = VoxelGrid.deserialize(payload);
            const target = editor.getGrid?.();
            if (!target) return;
            target.clear();
            restored.forEachBlock(block => target.setBlock(block.x, block.y, block.z, block.blockId, block.properties));
            rebuildVoxelMeshes(target);
            window.dispatchEvent(new CustomEvent("editor:status", { detail: `Restored ${target.getVoxelCount()} saved voxels` }));
        } catch (error) {
            console.warn("ModelForge voxel RKP restore failed:", error);
        }
    };

    window.addEventListener("editor:project-opened", () => requestAnimationFrame(restore));
    requestAnimationFrame(restore);
    return { restore };
}

function rebuildVoxelMeshes(grid) {
    const root = scene.getObjectByName("VoxelWorkspace");
    if (!root) return;
    root.clear();
    const materials = new Map();
    grid.forEachBlock(block => {
        const material = getMaterial(materials, block.blockId);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), material);
        mesh.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
        mesh.userData.voxel = [block.x, block.y, block.z];
        root.add(mesh);
    });
}

function getMaterial(cache, blockId) {
    if (!cache.has(blockId)) {
        const material = new THREE.MeshStandardMaterial({ color: COLORS[blockId] ?? 0xffffff, roughness: blockId === "glass" ? 0.15 : 0.9 });
        if (blockId === "glass") { material.transparent = true; material.opacity = 0.45; }
        cache.set(blockId, material);
    }
    return cache.get(blockId);
}
