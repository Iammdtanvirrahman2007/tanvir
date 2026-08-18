import test from "node:test";
import assert from "node:assert/strict";
import { clampVoxelCoordinate, snapVoxelCoordinate } from "../core/voxel/gridSnap.js";

test("snaps voxel coordinates to the requested step", () => {
    assert.deepEqual(snapVoxelCoordinate([1.2, 2.7, -0.4], 1), [1, 3, -0]);
    assert.deepEqual(snapVoxelCoordinate([1.24, 2.76, 3.49], 0.5), [1, 3, 3.5]);
});

test("clamps voxel coordinates to grid dimensions", () => {
    assert.deepEqual(clampVoxelCoordinate([-2, 5, 99], [8, 6, 10]), [0, 5, 9]);
});

test("rejects invalid snap steps", () => {
    assert.throws(() => snapVoxelCoordinate([0, 0, 0], 0), RangeError);
});
