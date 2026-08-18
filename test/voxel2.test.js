import test from "node:test";
import assert from "node:assert/strict";
import { VoxelGrid } from "../core/voxel/voxelGrid.js";
import { VoxelBlockRegistry } from "../core/voxel/blockRegistry.js";
import { validateVoxelGrid } from "../core/voxel/validator.js";
import { generateVoxelCollision } from "../core/voxel/collision.js";
import { buildGreedyChunk } from "../core/voxel/greedyMesher.js";

function registry() { return new VoxelBlockRegistry([
  { id: "air", solid: false, collision: false },
  { id: "stone", label: "Stone", solid: true, collision: true, color: 0x888888 },
  { id: "glass", label: "Glass", solid: true, transparent: true, collision: true, color: 0x99ccff }
]); }

test("block registry validates and exports definitions", () => {
  const r = registry();
  r.register({ id: "oak_log", label: "Oak Log", solid: true, collision: true });
  assert.equal(r.require("oak_log").label, "Oak Log");
  assert.equal(r.export().version, 1);
  assert.equal(r.list().length, 4);
});

test("voxel validator accepts known blocks and rejects unknown blocks", () => {
  const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
  grid.setBlock(1, 1, 1, "stone");
  assert.equal(validateVoxelGrid(grid, { registry: registry() }).valid, true);
  grid.setBlock(2, 1, 1, "missing_block");
  const result = validateVoxelGrid(grid, { registry: registry() });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === "UNKNOWN_BLOCK"));
});

test("collision generator creates one run for a contiguous row", () => {
  const grid = new VoxelGrid({ dimensions: [4, 2, 2] });
  grid.setBlock(0, 0, 0, "stone");
  grid.setBlock(1, 0, 0, "stone");
  grid.setBlock(2, 0, 0, "stone");
  const collision = generateVoxelCollision(grid, { registry: registry() });
  assert.equal(collision.count, 1);
  assert.deepEqual(collision.boxes[0], { min: [0, 0, 0], max: [3, 1, 1] });
});

test("greedy mesher merges a 2-block row and removes the internal face", () => {
  const grid = new VoxelGrid({ dimensions: [2, 1, 1] });
  grid.setBlock(0, 0, 0, "stone");
  grid.setBlock(1, 0, 0, "stone");
  const meshes = buildGreedyChunk(grid, [0, 0, 0], 16, registry());
  const stone = meshes.get("stone");
  assert.ok(stone);
  assert.equal(stone.quads, 6);
  assert.equal(stone.positions.length, 108);
});
