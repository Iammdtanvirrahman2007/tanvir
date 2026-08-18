import test from "node:test";
import assert from "node:assert/strict";
import { VoxelGrid } from "../core/voxel/voxelGrid.js";
import { copyRegion, fillBox, floodFill, pasteRegion, paint } from "../core/voxel/voxelOps.js";

test("paint writes selected blocks and reports before/after", () => {
    const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
    const changes = paint(grid, [[1, 1, 1], [2, 1, 1]], "stone");
    assert.equal(changes.length, 2);
    assert.equal(grid.getBlock(1, 1, 1), "stone");
    assert.equal(grid.getBlock(2, 1, 1), "stone");
    assert.equal(changes[0].before.blockId, "air");
    assert.equal(changes[0].after.blockId, "stone");
});

test("fillBox fills an inclusive region", () => {
    const grid = new VoxelGrid({ dimensions: [6, 6, 6] });
    const changes = fillBox(grid, [1, 1, 1], [2, 3, 2], "brick");
    assert.equal(changes.length, 12);
    assert.equal(grid.getBlock(2, 3, 2), "brick");
    assert.equal(grid.getBlock(0, 0, 0), "air");
});

test("floodFill replaces a connected air region", () => {
    const grid = new VoxelGrid({ dimensions: [4, 4, 4] });
    grid.setBlock(1, 0, 0, "stone");
    grid.setBlock(1, 1, 0, "stone");
    const changes = floodFill(grid, [0, 0, 0], "water");
    assert.equal(changes.length, 62);
    assert.equal(grid.getBlock(0, 0, 0), "water");
    assert.equal(grid.getBlock(3, 3, 3), "water");
    assert.equal(grid.getBlock(1, 0, 0), "stone");
});

test("copyRegion and pasteRegion preserve block ids and properties", () => {
    const source = new VoxelGrid({ dimensions: [6, 6, 6] });
    source.setBlock(0, 0, 0, "wood", { variant: "oak" });
    source.setBlock(1, 0, 0, "glass");
    const clipboard = copyRegion(source, [0, 0, 0], [1, 0, 0]);

    const target = new VoxelGrid({ dimensions: [6, 6, 6] });
    const changes = pasteRegion(target, clipboard, [3, 2, 1]);
    assert.equal(changes.length, 2);
    assert.equal(target.getBlock(3, 2, 1), "wood");
    assert.deepEqual(target.getBlockRecord(3, 2, 1).properties, { variant: "oak" });
    assert.equal(target.getBlock(4, 2, 1), "glass");
});
