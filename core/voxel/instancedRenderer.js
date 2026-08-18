import * as THREE from "three";

const DEFAULT_COLORS = {
    grass: 0x6ea84f,
    dirt: 0x8b5a2b,
    stone: 0x8a8f98,
    wood: 0x9a6a3a,
    sand: 0xd7bf78,
    brick: 0xa9564a,
    glass: 0x8fc7dc
};

export class VoxelInstancedRenderer {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.root = new THREE.Group();
        this.root.name = options.name || "VoxelOptimizedPreview";
        this.scene.add(this.root);
        this.blockColors = { ...DEFAULT_COLORS, ...(options.blockColors || {}) };
        this.geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        this.materials = new Map();
        this.instances = new Map();
        this.enabled = false;
    }

    rebuild(grid) {
        this.clear();
        if (!grid) return { blocks: 0, batches: 0 };
        const groups = new Map();
        grid.forEachBlock(block => {
            if (block.blockId === grid.defaultBlock) return;
            if (!groups.has(block.blockId)) groups.set(block.blockId, []);
            groups.get(block.blockId).push(block);
        });

        const matrix = new THREE.Matrix4();
        for (const [blockId, blocks] of groups) {
            const mesh = new THREE.InstancedMesh(this.geometry, this.getMaterial(blockId), blocks.length);
            mesh.name = `VoxelBatch:${blockId}`;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            blocks.forEach((block, index) => {
                matrix.makeTranslation(block.x + 0.5, block.y + 0.5, block.z + 0.5);
                mesh.setMatrixAt(index, matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            mesh.userData.blockId = blockId;
            mesh.userData.voxelCount = blocks.length;
            this.root.add(mesh);
            this.instances.set(blockId, mesh);
        }
        return { blocks: [...groups.values()].reduce((sum, list) => sum + list.length, 0), batches: groups.size };
    }

    setVisible(visible) {
        this.enabled = !!visible;
        this.root.visible = this.enabled;
    }

    clear() {
        for (const mesh of this.instances.values()) this.root.remove(mesh);
        this.instances.clear();
    }

    dispose() {
        this.clear();
        this.geometry.dispose();
        for (const material of this.materials.values()) material.dispose();
        this.materials.clear();
        this.root.removeFromParent();
    }

    getStats() {
        let instances = 0;
        for (const mesh of this.instances.values()) instances += mesh.count;
        return { batches: this.instances.size, instances, visible: this.root.visible };
    }

    getMaterial(blockId) {
        if (!this.materials.has(blockId)) {
            const material = new THREE.MeshStandardMaterial({
                color: this.blockColors[blockId] ?? 0xffffff,
                roughness: blockId === "glass" ? 0.15 : 0.9,
                metalness: 0,
                transparent: blockId === "glass",
                opacity: blockId === "glass" ? 0.45 : 1
            });
            this.materials.set(blockId, material);
        }
        return this.materials.get(blockId);
    }
}
