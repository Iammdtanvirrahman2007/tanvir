import { createAssetIdentity, normalizeAssetType } from "./assetTypes.js";

export const RKP_VERSION = 2;
export const RKP_FORMAT = "RKP";
export const RKP_ASSET_SCHEMA = "voxel-frontier.asset";

export function createRKPAsset(input = {}) {
  const now = new Date().toISOString();
  const identity = createAssetIdentity(input);
  return {
    format: RKP_FORMAT,
    schema: RKP_ASSET_SCHEMA,
    version: RKP_VERSION,
    metadata: {
      ...identity,
      assetType: normalizeAssetType(input.type),
      dimensions: normalizeDimensions(input.dimensions),
      transforms: normalizeTransforms(input.transforms),
      description: String(input.description || ""),
      thumbnail: input.thumbnail || null,
      createdAt: identity.createdAt || now,
      updatedAt: identity.updatedAt || now
    },
    scene: input.scene || { objects: [] },
    objects: Array.isArray(input.objects) ? input.objects : [],
    materials: Array.isArray(input.materials) ? input.materials : [],
    voxel: input.voxel || null,
    collision: input.collision || { volumes: [], layers: [] },
    sockets: Array.isArray(input.sockets) ? input.sockets : [],
    markers: Array.isArray(input.markers) ? input.markers : [],
    spawnPoints: Array.isArray(input.spawnPoints) ? input.spawnPoints : [],
    gameplay: input.gameplay || {},
    biome: input.biome || { allowed: [], forbidden: [] },
    procedural: input.procedural || {},
    variants: Array.isArray(input.variants) ? input.variants : [],
    dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
    customProperties: isRecord(input.customProperties) ? { ...input.customProperties } : {}
  };
}

export function normalizeDimensions(value) {
  if (!value || typeof value !== "object") return { x: 0, y: 0, z: 0 };
  return { x: finiteOrZero(value.x), y: finiteOrZero(value.y), z: finiteOrZero(value.z) };
}

export function normalizeTransforms(value) {
  if (!value || typeof value !== "object") return { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  return {
    position: normalizeArray(value.position, [0, 0, 0]),
    rotation: normalizeArray(value.rotation, [0, 0, 0]),
    scale: normalizeArray(value.scale, [1, 1, 1])
  };
}

export function normalizeArray(value, fallback) {
  return Array.isArray(value) && value.length >= 3
    ? [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0]
    : [...fallback];
}

function finiteOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
