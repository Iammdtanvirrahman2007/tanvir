import { createDefaultBlockRegistry } from "./blockRegistry.js";

export function generateVoxelCollision(grid, options = {}) {
  const registry = options.registry || createDefaultBlockRegistry();
  const boxes = [];
  const processed = new Set();

  for (let y = 0; y < grid.height; y++) {
    for (let z = 0; z < grid.depth; z++) {
      let x = 0;
      while (x < grid.width) {
        const key = grid.key(x, y, z);
        if (processed.has(key) || !isCollidable(grid.getBlock(x, y, z), registry)) { x++; continue; }
        const start = x;
        while (x < grid.width && isCollidable(grid.getBlock(x, y, z), registry)) x++;
        boxes.push({ min: [start, y, z], max: [x, y + 1, z + 1] });
      }
    }
  }

  return {
    version: 1,
    type: "voxel-aabb-runs",
    units: "voxel",
    boxes,
    count: boxes.length
  };
}

export function collisionToWorldBoxes(collision, grid) {
  if (!collision || collision.version !== 1 || !Array.isArray(collision.boxes)) return [];
  const size = Number(grid.voxelSize) || 1;
  const origin = Array.isArray(grid.origin) ? grid.origin : [0, 0, 0];
  return collision.boxes.map(box => ({
    min: origin.map((value, axis) => value + box.min[axis] * size),
    max: origin.map((value, axis) => value + box.max[axis] * size)
  }));
}

function isCollidable(blockId, registry) {
  return registry.get(blockId)?.collision === true;
}
