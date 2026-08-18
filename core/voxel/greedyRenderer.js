import * as THREE from "three";
import { buildGreedyChunk, countChunkQuads } from "./greedyMesher.js";
import { createDefaultBlockRegistry } from "./blockRegistry.js";

export class GreedyVoxelRenderer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.chunkSize = Math.max(4, Math.floor(options.chunkSize || 16));
    this.registry = options.registry || createDefaultBlockRegistry();
    this.root = new THREE.Group();
    this.root.name = "GreedyVoxelPreview";
    this.root.visible = false;
    scene.add(this.root);
    this.materials = new Map();
    this.stats = { chunks: 0, blocks: 0, quads: 0, meshes: 0 };
  }

  rebuild(grid) {
    this.clear();
    const seenBlocks = new Set();
    let chunks = 0, quads = 0;
    for (let y = 0; y < grid.height; y += this.chunkSize) {
      for (let z = 0; z < grid.depth; z += this.chunkSize) {
        for (let x = 0; x < grid.width; x += this.chunkSize) {
          const origin = [x, y, z];
          const data = buildGreedyChunk(grid, origin, this.chunkSize, this.registry);
          const chunkQuads = countChunkQuads(data);
          if (!chunkQuads) continue;
          chunks++;
          quads += chunkQuads;
          const chunk = new THREE.Group();
          chunk.name = `Chunk_${x}_${y}_${z}`;
          data.forEach((meshData, blockId) => {
            if (!meshData.positions.length) return;
            seenBlocks.add(blockId);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.positions, 3));
            geometry.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.normals, 3));
            geometry.setAttribute("uv", new THREE.Float32BufferAttribute(meshData.uvs, 2));
            geometry.computeBoundingSphere();
            const mesh = new THREE.Mesh(geometry, this.materialFor(blockId));
            mesh.name = `Voxel_${blockId}`;
            mesh.userData.voxelRenderer = true;
            chunk.add(mesh);
          });
          this.root.add(chunk);
        }
      }
    }
    this.stats = { chunks, blocks: grid.getVoxelCount(), quads, meshes: [...this.root.children].reduce((n, chunk) => n + chunk.children.length, 0), blockTypes: seenBlocks.size };
    return { ...this.stats };
  }

  materialFor(blockId) {
    if (this.materials.has(blockId)) return this.materials.get(blockId);
    const def = this.registry.require(blockId);
    const material = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: def.roughness,
      metalness: def.metalness,
      transparent: def.transparent,
      opacity: def.transparent ? 0.55 : 1,
      depthWrite: !def.transparent
    });
    this.materials.set(blockId, material);
    return material;
  }

  clear() {
    while (this.root.children.length) {
      const child = this.root.children.pop();
      child.traverse(object => { if (object.geometry) object.geometry.dispose(); });
    }
    this.stats = { chunks: 0, blocks: 0, quads: 0, meshes: 0 };
  }

  setVisible(visible) { this.root.visible = !!visible; }
  getStats() { return { ...this.stats, visible: this.root.visible }; }
}
