export function snapVoxelCoordinate(coordinate, step = 1) {
    const safeStep = positiveStep(step);
    if (!Array.isArray(coordinate) || coordinate.length < 3) {
        throw new Error("Voxel coordinate must contain [x, y, z]");
    }
    return coordinate.slice(0, 3).map(value => Math.round(Number(value) / safeStep) * safeStep);
}

export function snapVoxelOrigin(origin, step = 1) {
    return snapVoxelCoordinate(origin, step);
}

export function clampVoxelCoordinate(coordinate, dimensions) {
    if (!Array.isArray(coordinate) || coordinate.length < 3 || !Array.isArray(dimensions) || dimensions.length < 3) {
        throw new Error("Coordinate and dimensions must contain [x, y, z]");
    }
    return [
        Math.min(Math.max(Math.trunc(coordinate[0]), 0), Math.max(0, dimensions[0] - 1)),
        Math.min(Math.max(Math.trunc(coordinate[1]), 0), Math.max(0, dimensions[1] - 1)),
        Math.min(Math.max(Math.trunc(coordinate[2]), 0), Math.max(0, dimensions[2] - 1))
    ];
}

function positiveStep(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new RangeError("Voxel snap step must be positive");
    return number;
}
