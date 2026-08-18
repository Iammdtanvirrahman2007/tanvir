import { VoxelGrid } from "./voxelGrid.js";

export function snapshot(grid) {
  return grid.serialize();
}

export function restoreSnapshot(grid, data) {
  if (!data || data.version !== 1) throw new Error("Invalid voxel snapshot");
  const restored = VoxelGrid.deserialize(data);
  grid.clear();
  for (const block of data.blocks || []) {
    grid.setBlock(block.x, block.y, block.z, block.blockId, block.properties || null);
  }
  return restored;
}

export function mirror(grid, axis = "x") {
  const source = snapshot(grid).blocks;
  const limit = axisLimit(grid, axis);
  const transformed = source.map(block => ({
    ...block,
    ...mirrorCoordinate(block, axis, limit)
  }));
  return applyTransformed(grid, transformed);
}

export function rotateY90(grid, turns = 1) {
  const normalizedTurns = ((Math.trunc(turns) % 4) + 4) % 4;
  if (!normalizedTurns) return [];
  const source = snapshot(grid).blocks;
  const transformed = source.map(block => rotateCoordinateY(block, normalizedTurns, grid.width, grid.depth));
  return applyTransformed(grid, transformed);
}

export function rotateX90(grid, turns = 1) {
  const normalizedTurns = ((Math.trunc(turns) % 4) + 4) % 4;
  if (!normalizedTurns) return [];
  const source = snapshot(grid).blocks;
  const transformed = source.map(block => rotateCoordinateX(block, normalizedTurns, grid.height, grid.depth));
  return applyTransformed(grid, transformed);
}

export function rotateZ90(grid, turns = 1) {
  const normalizedTurns = ((Math.trunc(turns) % 4) + 4) % 4;
  if (!normalizedTurns) return [];
  const source = snapshot(grid).blocks;
  const transformed = source.map(block => rotateCoordinateZ(block, normalizedTurns, grid.width, grid.height));
  return applyTransformed(grid, transformed);
}

export function mirrorPlane(grid, axis = "x", coordinate = null) {
  const limit = axisLimit(grid, axis);
  const plane = coordinate == null ? Math.floor(limit / 2) : Math.trunc(coordinate);
  const blocks = snapshot(grid).blocks;
  const transformed = [];
  for (const block of blocks) {
    const distance = axisValue(block, axis) - plane;
    const target = { ...block };
    if (distance <= 0) transformed.push(target);
    else {
      const next = plane - distance;
      target[axis] = next;
      if (axisValue(target, axis) >= 0 && axisValue(target, axis) < limit) transformed.push(target);
    }
  }
  return applyTransformed(grid, transformed);
}

export function symmetricSet(grid, axis = "x", coordinate = null) {
  const limit = axisLimit(grid, axis);
  const plane = coordinate == null ? Math.floor((limit - 1) / 2) : Math.trunc(coordinate);
  const source = snapshot(grid).blocks;
  const mirrored = source.map(block => ({
    ...block,
    [axis]: plane * 2 - axisValue(block, axis) - (axis === "x" || axis === "y" || axis === "z" ? 0 : 0)
  }));
  const valid = mirrored.filter(block => axisValue(block, axis) >= 0 && axisValue(block, axis) < limit);
  return applyTransformed(grid, [...source, ...valid]);
}

export function layerRecords(grid, axis = "y") {
  const layers = new Map();
  grid.forEachBlock(block => {
    const value = axisValue(block, axis);
    if (!layers.has(value)) layers.set(value, []);
    layers.get(value).push(block);
  });
  return [...layers.entries()].sort((a, b) => a[0] - b[0]).map(([index, blocks]) => ({ index, blocks }));
}

export function setLayerVisibility(root, index, visible) {
  for (const mesh of root.children || []) {
    const coordinate = mesh.userData?.voxel;
    if (!coordinate) continue;
    mesh.visible = coordinate[1] === index ? visible : mesh.visible;
  }
}

function applyTransformed(grid, blocks) {
  const before = snapshot(grid);
  grid.clear();
  for (const block of blocks) {
    if (!grid.isInside(block.x, block.y, block.z)) continue;
    grid.setBlock(block.x, block.y, block.z, block.blockId, block.properties || null);
  }
  return { before, after: snapshot(grid), changed: grid.getVoxelCount() };
}

function axisLimit(grid, axis) {
  return axis === "x" ? grid.width : axis === "y" ? grid.height : grid.depth;
}

function axisValue(block, axis) {
  return block[axis];
}

function mirrorCoordinate(block, axis, limit) {
  return { [axis]: limit - 1 - axisValue(block, axis) };
}

function rotateCoordinateY(block, turns, width, depth) {
  let x = block.x, z = block.z;
  for (let i = 0; i < turns; i++) [x, z] = [depth - 1 - z, x];
  return { ...block, x, z };
}

function rotateCoordinateX(block, turns, height, depth) {
  let y = block.y, z = block.z;
  for (let i = 0; i < turns; i++) [y, z] = [depth - 1 - z, y];
  return { ...block, y, z };
}

function rotateCoordinateZ(block, turns, width, height) {
  let x = block.x, y = block.y;
  for (let i = 0; i < turns; i++) [x, y] = [height - 1 - y, x];
  return { ...block, x, y };
}
