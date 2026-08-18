import { VoxelGrid } from "./voxelGrid.js";

export function paint(grid, coordinates, blockId, properties = null) {
    if (!Array.isArray(coordinates)) return [];
    const changes = [];
    for (const coordinate of coordinates) {
        const [x, y, z] = normalizeCoordinate(coordinate);
        const before = grid.getBlockRecord(x, y, z);
        grid.setBlock(x, y, z, blockId, properties);
        changes.push({ before, after: grid.getBlockRecord(x, y, z) });
    }
    return changes;
}

export function fillBox(grid, min, max, blockId, properties = null) {
    const bounds = normalizeBounds(grid, min, max);
    const changes = [];
    for (let z = bounds.min[2]; z <= bounds.max[2]; z++) {
        for (let y = bounds.min[1]; y <= bounds.max[1]; y++) {
            for (let x = bounds.min[0]; x <= bounds.max[0]; x++) {
                const before = grid.getBlockRecord(x, y, z);
                grid.setBlock(x, y, z, blockId, properties);
                changes.push({ before, after: grid.getBlockRecord(x, y, z) });
            }
        }
    }
    return changes;
}

export function floodFill(grid, start, replacement, properties = null) {
    const origin = normalizeCoordinate(start);
    if (!grid.isInside(...origin)) return [];
    const original = grid.getBlock(...origin);
    if (original === replacement) return [];

    const queue = [origin];
    const visited = new Set();
    const changes = [];

    while (queue.length) {
        const [x, y, z] = queue.shift();
        const key = grid.key(x, y, z);
        if (visited.has(key) || !grid.isInside(x, y, z)) continue;
        visited.add(key);
        if (grid.getBlock(x, y, z) !== original) continue;

        const before = grid.getBlockRecord(x, y, z);
        grid.setBlock(x, y, z, replacement, properties);
        changes.push({ before, after: grid.getBlockRecord(x, y, z) });

        queue.push(
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        );
    }
    return changes;
}

export function copyRegion(grid, min, max) {
    const bounds = normalizeBounds(grid, min, max);
    const blocks = [];
    for (let z = bounds.min[2]; z <= bounds.max[2]; z++) {
        for (let y = bounds.min[1]; y <= bounds.max[1]; y++) {
            for (let x = bounds.min[0]; x <= bounds.max[0]; x++) {
                const record = grid.getBlockRecord(x, y, z);
                if (record.blockId !== grid.defaultBlock || record.properties) {
                    blocks.push({
                        x: x - bounds.min[0],
                        y: y - bounds.min[1],
                        z: z - bounds.min[2],
                        blockId: record.blockId,
                        properties: record.properties
                    });
                }
            }
        }
    }
    return {
        version: 1,
        size: [
            bounds.max[0] - bounds.min[0] + 1,
            bounds.max[1] - bounds.min[1] + 1,
            bounds.max[2] - bounds.min[2] + 1
        ],
        blocks
    };
}

export function pasteRegion(grid, clipboard, origin) {
    if (!clipboard || clipboard.version !== 1 || !Array.isArray(clipboard.size) || !Array.isArray(clipboard.blocks)) {
        throw new Error("Invalid voxel clipboard");
    }
    const base = normalizeCoordinate(origin);
    const changes = [];
    for (const block of clipboard.blocks) {
        const x = base[0] + Math.trunc(Number(block.x));
        const y = base[1] + Math.trunc(Number(block.y));
        const z = base[2] + Math.trunc(Number(block.z));
        if (!grid.isInside(x, y, z)) continue;
        const before = grid.getBlockRecord(x, y, z);
        grid.setBlock(x, y, z, block.blockId, block.properties || null);
        changes.push({ before, after: grid.getBlockRecord(x, y, z) });
    }
    return changes;
}

function normalizeBounds(grid, min, max) {
    const a = normalizeCoordinate(min);
    const b = normalizeCoordinate(max);
    const lower = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
    const upper = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
    if (!grid.isInside(...lower) || !grid.isInside(...upper)) {
        throw new RangeError("Voxel region exceeds grid bounds");
    }
    return { min: lower, max: upper };
}

function normalizeCoordinate(value) {
    if (!Array.isArray(value) || value.length < 3) {
        throw new Error("Voxel coordinate must contain [x, y, z]");
    }
    return value.slice(0, 3).map(Number).map(Math.trunc);
}

export function createVoxelGrid(options = {}) {
    return new VoxelGrid(options);
}
