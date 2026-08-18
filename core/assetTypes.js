const builtInTypes = [
  ["model", { label: "Model", category: "model" }],
  ["prop", { label: "Prop", category: "props" }],
  ["structure", { label: "Structure", category: "structures" }],
  ["voxel_structure", { label: "Voxel Structure", category: "structures" }],
  ["tree", { label: "Tree", category: "nature" }],
  ["rock", { label: "Rock", category: "nature" }],
  ["building", { label: "Building", category: "buildings" }],
  ["village", { label: "Village", category: "villages" }],
  ["dungeon", { label: "Dungeon", category: "dungeons" }],
  ["bridge", { label: "Bridge", category: "bridges" }],
  ["road", { label: "Road", category: "roads" }],
  ["decoration", { label: "Decoration", category: "decorations" }],
  ["biome_asset", { label: "Biome Asset", category: "biome" }],
  ["prefab", { label: "Prefab", category: "prefabs" }]
];

const registry = new Map(builtInTypes);

export function registerAssetType(id, definition = {}) {
  const key = normalizeId(id);
  if (!key) throw new Error("Asset type id is required.");
  const current = registry.get(key);
  registry.set(key, {
    label: definition.label || current?.label || toLabel(key),
    category: definition.category || current?.category || "custom",
    validate: typeof definition.validate === "function" ? definition.validate : current?.validate || null,
    metadataDefaults: { ...(current?.metadataDefaults || {}), ...(definition.metadataDefaults || {}) },
    editorMode: definition.editorMode || current?.editorMode || null,
    exportAdapter: definition.exportAdapter || current?.exportAdapter || null,
    procedural: definition.procedural ?? current?.procedural ?? false
  });
  return registry.get(key);
}

export function unregisterAssetType(id) {
  const key = normalizeId(id);
  if (!key || !registry.has(key) || builtInTypes.some(([typeId]) => typeId === key)) return false;
  return registry.delete(key);
}

export function hasAssetType(id) {
  return registry.has(normalizeId(id));
}

export function getAssetType(id) {
  return registry.get(normalizeId(id)) || registry.get("model");
}

export function listAssetTypes() {
  return [...registry.entries()].map(([id, definition]) => ({ id, ...definition }));
}

export function normalizeAssetType(id, fallback = "model") {
  const key = normalizeId(id);
  return registry.has(key) ? key : fallback;
}

export function createAssetIdentity(input = {}) {
  const type = normalizeAssetType(input.type);
  return {
    id: input.id || crypto.randomUUID(),
    name: String(input.name || "Untitled Asset").trim() || "Untitled Asset",
    type,
    category: input.category || getAssetType(type).category || "custom",
    tags: Array.isArray(input.tags) ? [...new Set(input.tags.map(String).map(v => v.trim()).filter(Boolean))] : [],
    author: input.author || "",
    creator: input.creator || input.author || "",
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString()
  };
}

function normalizeId(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
}

function toLabel(value) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
