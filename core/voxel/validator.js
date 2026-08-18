import { createDefaultBlockRegistry } from "./blockRegistry.js";

export function validateVoxelGrid(grid, options = {}) {
  const registry = options.registry || createDefaultBlockRegistry();
  const errors = [];
  const warnings = [];

  if (!grid || !Array.isArray(grid.dimensions) || grid.dimensions.length !== 3) {
    errors.push(issue("GRID_DIMENSIONS", "Voxel grid must have [x, y, z] dimensions."));
    return result(errors, warnings);
  }
  if (grid.dimensions.some(value => !Number.isInteger(value) || value <= 0)) {
    errors.push(issue("GRID_DIMENSIONS_INVALID", "Voxel dimensions must be positive integers."));
  }
  if (!Number.isFinite(Number(grid.voxelSize)) || Number(grid.voxelSize) <= 0) {
    errors.push(issue("VOXEL_SIZE", "Voxel size must be a positive finite number."));
  }

  const seen = new Set();
  grid.forEachBlock(block => {
    const key = `${block.x},${block.y},${block.z}`;
    if (seen.has(key)) errors.push(issue("DUPLICATE_COORDINATE", `Duplicate voxel coordinate ${key}.`));
    seen.add(key);
    if (!grid.isInside(block.x, block.y, block.z)) errors.push(issue("OUT_OF_BOUNDS", `Voxel ${key} is outside the grid.`));
    if (!registry.has(block.blockId)) errors.push(issue("UNKNOWN_BLOCK", `Voxel ${key} uses unknown block '${block.blockId}'.`));
  });

  if (grid.getVoxelCount?.() === 0) warnings.push(issue("EMPTY_GRID", "Voxel grid contains no non-default blocks.", "warning"));
  if (grid.getVoxelCount?.() > 1000000) warnings.push(issue("LARGE_GRID", "Voxel count exceeds one million; chunked rendering/streaming is recommended.", "warning"));

  return result(errors, warnings);
}

export function validateVoxelClipboard(clipboard, registry = createDefaultBlockRegistry()) {
  const errors = [];
  const warnings = [];
  if (!clipboard || clipboard.version !== 1 || !Array.isArray(clipboard.size) || !Array.isArray(clipboard.blocks)) {
    errors.push(issue("CLIPBOARD_SCHEMA", "Invalid voxel clipboard payload."));
    return result(errors, warnings);
  }
  if (clipboard.size.length !== 3 || clipboard.size.some(value => !Number.isInteger(value) || value <= 0)) {
    errors.push(issue("CLIPBOARD_SIZE", "Clipboard size must contain three positive integers."));
  }
  for (const block of clipboard.blocks) {
    if (!registry.has(block.blockId)) errors.push(issue("CLIPBOARD_BLOCK", `Clipboard references unknown block '${block.blockId}'.`));
  }
  return result(errors, warnings);
}

function result(errors, warnings) { return { valid: errors.length === 0, errors, warnings }; }
function issue(code, message, severity = "error") { return { code, message, severity }; }
