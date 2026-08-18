import test from "node:test";
import assert from "node:assert/strict";
import { VoxelGrid } from "../core/voxel/voxelGrid.js";

test("stores and retrieves voxel blocks with metadata", () => {
    const grid = new VoxelGrid({ dimensions: [8, 8, 8], voxelSize: 0.5, defaultBlock: "air" });
    grid.setBlock(2, 3, 4, "oak", { hardness: 2 });
    assert.equal(grid.getBlock(2, 3, 4), "oak");
    assert.deepEqual(grid.getBlockRecord(2, 3, 4).properties, { hardness: 2 });
    assert.equal(grid.getVoxelCount(), 1);
});

test("removes default blocks without storing sparse entries", () => {
    const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
    grid.setBlock(1, 1, 1, "stone");
    grid.removeBlock(1, 1, 1);
    assert.equal(grid.getBlock(1, 1, 1), "air");
    assert.equal(grid.getVoxelCount(), 0);
});

test("serializes deterministically and round-trips", () => {
    const grid = new VoxelGrid({ dimensions: [4, 4, 4], voxelSize: 1, origin: [1, 2, 3] });
    grid.setBlock(2, 1, 0, "stone");
    grid.setBlock(0, 0, 0, "wood", { variant: "oak" });
    const data = grid.serialize();
    assert.deepEqual(data.blocks.map(({ x, y, z }) => [x, y, z]), [[0, 0, 0], [2, 1, 0]]);
    const restored = VoxelGrid.deserialize(data);
    assert.deepEqual(restored.serialize(), data);
});

test("rejects out-of-bounds writes and malformed deserialization", () => {
    const grid = new VoxelGrid({ dimensions: [2, 2, 2] });
    assert.throws(() => grid.setBlock(2, 0, 0, "stone"), RangeError);
    assert.throws(() => VoxelGrid.deserialize({ version: 1, dimensions: [2, 2, 2], blocks: [{ x: 9, y: 0, z: 0, blockId: "stone" }] }), /out of bounds/);
});
