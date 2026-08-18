const BUILT_INS = [
  { id: "air", label: "Air", solid: false, transparent: true, collision: false },
  { id: "grass", label: "Grass", solid: true, transparent: false, collision: true },
  { id: "dirt", label: "Dirt", solid: true, transparent: false, collision: true },
  { id: "stone", label: "Stone", solid: true, transparent: false, collision: true },
  { id: "wood", label: "Wood", solid: true, transparent: false, collision: true },
  { id: "sand", label: "Sand", solid: true, transparent: false, collision: true },
  { id: "brick", label: "Brick", solid: true, transparent: false, collision: true },
  { id: "glass", label: "Glass", solid: true, transparent: true, collision: true }
];

export class VoxelBlockRegistry {
  constructor(definitions = BUILT_INS) {
    this.blocks = new Map();
    definitions.forEach(definition => this.register(definition));
  }

  register(definition) {
    if (!definition || typeof definition !== "object") throw new TypeError("Block definition must be an object");
    const id = String(definition.id || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id)) throw new Error(`Invalid block id: ${id}`);
    this.blocks.set(id, normalizeDefinition({ ...definition, id }));
    return this.get(id);
  }

  unregister(id) {
    const key = String(id || "").toLowerCase();
    if (["air"].includes(key)) throw new Error("The air block cannot be removed");
    return this.blocks.delete(key);
  }

  has(id) { return this.blocks.has(String(id || "").toLowerCase()); }
  get(id) { return this.blocks.get(String(id || "").toLowerCase()) || null; }
  require(id) { const block = this.get(id); if (!block) throw new Error(`Unknown voxel block: ${id}`); return block; }
  list() { return [...this.blocks.values()].map(block => ({ ...block })); }

  export() { return { version: 1, blocks: this.list() }; }

  import(payload, { replace = false } = {}) {
    if (!payload || payload.version !== 1 || !Array.isArray(payload.blocks)) throw new Error("Invalid voxel block registry");
    if (replace) this.blocks.clear();
    payload.blocks.forEach(block => this.register(block));
    if (!this.has("air")) this.register(BUILT_INS[0]);
    return this.list();
  }
}

function normalizeDefinition(definition) {
  return {
    id: definition.id,
    label: String(definition.label || definition.id),
    solid: definition.solid !== false,
    transparent: definition.transparent === true,
    collision: definition.collision !== false,
    color: Number.isFinite(Number(definition.color)) ? Number(definition.color) : 0xffffff,
    roughness: clamp(Number(definition.roughness ?? 0.9), 0, 1),
    metalness: clamp(Number(definition.metalness ?? 0), 0, 1),
    texture: definition.texture || null,
    tags: Array.isArray(definition.tags) ? [...definition.tags].map(String) : []
  };
}

function clamp(value, min, max) { return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max); }

export function createDefaultBlockRegistry() { return new VoxelBlockRegistry(BUILT_INS); }
export const BUILT_IN_BLOCKS = BUILT_INS.map(item => ({ ...item }));
