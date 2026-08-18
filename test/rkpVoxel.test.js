import test from "node:test";
import assert from "node:assert/strict";
import { createRKPAsset } from "../core/rkpSchema.js";
import { VoxelGrid } from "../core/voxel/voxelGrid.js";

test("RKP v2 preserves voxel payloads", () => {
    const grid = new VoxelGrid({ dimensions: [8, 8, 8], voxelSize: 1 });
    grid.setBlock(1, 2, 3, "stone", { variant: "rough" });
    const asset = createRKPAsset({ name: "Voxel Test", type: "voxel_structure", voxel: grid.serialize() });
    assert.equal(asset.version, 2);
    assert.deepEqual(asset.voxel, grid.serialize());
});

test("RKP voxel payload is absent by default", () => {
    const asset = createRKPAsset({ name: "Scene Test" });
    assert.equal(asset.voxel, null);
});
