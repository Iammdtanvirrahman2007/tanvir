import test from "node:test";
import assert from "node:assert/strict";
import { VoxelGrid } from "../core/voxel/voxelGrid.js";
import { mirror, rotateY90, symmetricSet, layerRecords } from "../core/voxel/voxelTransforms.js";

test("mirrors voxels across the requested axis", () => {
  const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
  grid.setBlock(0, 1, 2, "stone");
  mirror(grid, "x");
  assert.equal(grid.getBlock(3, 1, 2), "stone");
});

test("rotates voxels around Y by 90 degrees", () => {
  const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
  grid.setBlock(1, 0, 2, "wood");
  rotateY90(grid, 1);
  assert.equal(grid.getBlock(1, 0, 1), "wood");
});

test("symmetry duplicates valid mirrored voxels", () => {
  const grid = new VoxelGrid({ dimensions: [5, 4, 5] });
  grid.setBlock(1, 0, 2, "brick");
  symmetricSet(grid, "x");
  assert.equal(grid.getBlock(3, 0, 2), "brick");
});

test("layer records group voxels by Y", () => {
  const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
  grid.setBlock(0, 0, 0, "dirt");
  grid.setBlock(1, 2, 0, "stone");
  const layers = layerRecords(grid);
  assert.deepEqual(layers.map(layer => layer.index), [0, 2]);
  assert.equal(layers[1].blocks[0].blockId, "stone");
});
