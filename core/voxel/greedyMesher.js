const AXES = ["x", "y", "z"];

export function buildGreedyChunk(grid, chunkOrigin, chunkSize = 16, registry) {
  const output = new Map();
  for (const axis of AXES) {
    const dims = chunkDimensions(grid, chunkOrigin, chunkSize);
    const d = AXES.indexOf(axis);
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;

    for (let slice = 0; slice <= dims[d]; slice++) {
      const mask = [];
      for (let j = 0; j < dims[v]; j++) {
        for (let i = 0; i < dims[u]; i++) {
          const localA = [0, 0, 0];
          const localB = [0, 0, 0];
          localA[d] = slice - 1;
          localB[d] = slice;
          localA[u] = localB[u] = i;
          localA[v] = localB[v] = j;
          const a = sample(grid, chunkOrigin, localA);
          const b = sample(grid, chunkOrigin, localB);
          const aSolid = visibleBlock(a, registry);
          const bSolid = visibleBlock(b, registry);
          let entry = null;
          if (aSolid && (!bSolid || shouldExpose(a, b, registry))) entry = { blockId: a.blockId, sign: 1 };
          else if (bSolid && (!aSolid || shouldExpose(b, a, registry))) entry = { blockId: b.blockId, sign: -1 };
          mask.push(entry);
        }
      }
      greedyMask(mask, dims[u], dims[v], (x, y, w, h, entry) => {
        addQuad(output, grid, chunkOrigin, axis, u, v, slice, x, y, w, h, entry, chunkSize);
      });
    }
  }
  return output;
}

function greedyMask(mask, width, height, emit) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width;) {
      const index = x + y * width;
      const entry = mask[index];
      if (!entry) { x++; continue; }
      let w = 1;
      while (x + w < width && sameEntry(mask[index + w], entry)) w++;
      let h = 1;
      outer: while (y + h < height) {
        for (let i = 0; i < w; i++) {
          if (!sameEntry(mask[x + i + (y + h) * width], entry)) break outer;
        }
        h++;
      }
      emit(x, y, w, h, entry);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) mask[x + xx + (y + yy) * width] = null;
      x += w;
    }
  }
}

function addQuad(output, grid, chunkOrigin, axis, u, v, slice, x, y, w, h, entry, chunkSize) {
  const d = ["x", "y", "z"].indexOf(axis);
  const base = [chunkOrigin[0], chunkOrigin[1], chunkOrigin[2]];
  const origin = [0, 0, 0];
  origin[d] = base[d] + slice;
  origin[u] = base[u] + x;
  origin[v] = base[v] + y;
  const du = [0, 0, 0], dv = [0, 0, 0];
  du[u] = w; dv[v] = h;
  const corners = entry.sign === 1
    ? [origin, addVec(origin, dv), addVec(addVec(origin, dv), du), addVec(origin, du)]
    : [origin, addVec(origin, du), addVec(addVec(origin, du), dv), addVec(origin, dv)];
  const normal = [0, 0, 0]; normal[d] = entry.sign;
  const target = output.get(entry.blockId) || { positions: [], normals: [], uvs: [], quads: 0 };
  const p = corners.map(corner => corner.map(value => value * grid.voxelSize + grid.origin[0] + (0 * value)));
  // Apply per-axis origin correctly after voxel scaling.
  const world = corners.map(corner => [
    grid.origin[0] + corner[0] * grid.voxelSize,
    grid.origin[1] + corner[1] * grid.voxelSize,
    grid.origin[2] + corner[2] * grid.voxelSize
  ]);
  const uv = [[0, 0], [0, h], [w, h], [w, 0]];
  const indices = entry.sign === 1 ? [[0,1,2],[0,2,3]] : [[0,1,2],[0,2,3]];
  for (const tri of indices) for (const idx of tri) {
    target.positions.push(...world[idx]);
    target.normals.push(...normal);
    target.uvs.push(...uv[idx]);
  }
  target.quads++;
  output.set(entry.blockId, target);
}

function sample(grid, chunkOrigin, local) {
  const x = chunkOrigin[0] + local[0];
  const y = chunkOrigin[1] + local[1];
  const z = chunkOrigin[2] + local[2];
  if (!grid.isInside(x, y, z)) return { blockId: grid.defaultBlock };
  return grid.getBlockRecord(x, y, z);
}

function visibleBlock(record, registry) {
  if (!record) return false;
  const definition = registry.get(record.blockId);
  return !!definition?.solid && record.blockId !== "air";
}

function shouldExpose(current, neighbor, registry) {
  if (!neighbor) return true;
  if (current.blockId === neighbor.blockId) return false;
  return registry.get(neighbor.blockId)?.transparent === true;
}

function sameEntry(a, b) { return !!a && !!b && a.blockId === b.blockId && a.sign === b.sign; }
function addVec(a, b) { return a.map((value, index) => value + b[index]); }

function chunkDimensions(grid, origin, size) {
  return [
    Math.max(0, Math.min(size, grid.width - origin[0])),
    Math.max(0, Math.min(size, grid.height - origin[1])),
    Math.max(0, Math.min(size, grid.depth - origin[2]))
  ];
}

export function countChunkQuads(meshData) { let count = 0; meshData.forEach(entry => { count += entry.quads; }); return count; }
