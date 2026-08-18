import { createRKPAsset, normalizeDimensions, normalizeTransforms } from "./rkpSchema.js";

export const LEGACY_RKP_VERSION = 5;

export function migrateToRKPv2(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid project payload.");
  if (input.format === "RKP" && input.version === 2 && input.schema) return structuredCloneSafe(input);
  if (input.format === "ModelForgeProject") return migrateLegacyProject(input);
  if (Array.isArray(input.objects)) return migrateLegacyProject({ ...input, objects: input.objects });
  throw new Error("Unsupported project format. Expected RKP v2 or a legacy ModelForge project.");
}

export function migrateLegacyProject(project) {
  const objects = Array.isArray(project.objects) ? project.objects.map(convertLegacyObject).filter(Boolean) : [];
  const now = new Date().toISOString();
  return createRKPAsset({
    id: project.assetId || project.id,
    name: project.projectName || project.name || "Imported ModelForge Asset",
    type: project.assetType || "model",
    category: project.category || "model",
    tags: Array.isArray(project.tags) ? project.tags : [],
    author: project.author || "",
    creator: project.creator || project.author || "",
    createdAt: project.created || now,
    updatedAt: project.updated || now,
    dimensions: normalizeDimensions(project.dimensions),
    transforms: normalizeTransforms(project.transforms),
    scene: { objects },
    objects,
    materials: collectMaterials(objects),
    customProperties: { legacyVersion: project.version ?? LEGACY_RKP_VERSION }
  });
}

function convertLegacyObject(object) {
  if (!object || typeof object !== "object") return null;
  return {
    id: object.id || object.uuid || crypto.randomUUID(),
    kind: object.kind || (object.type === "Group" ? "Group" : "Mesh"),
    type: object.type || "Unknown",
    name: object.name || "Object",
    visible: object.visible ?? true,
    position: normalizeTransforms({ position: object.position }).position,
    rotation: normalizeTransforms({ rotation: object.rotation }).rotation,
    scale: normalizeTransforms({ scale: object.scale }).scale,
    materials: Array.isArray(object.materials) ? object.materials : [],
    userData: object.userData && typeof object.userData === "object" ? { ...object.userData } : {},
    children: Array.isArray(object.children) ? object.children.map(convertLegacyObject).filter(Boolean) : []
  };
}

function collectMaterials(objects) {
  const map = new Map();
  const visit = list => list.forEach(object => {
    (object.materials || []).forEach(material => {
      const key = material.id || material.name || JSON.stringify(material);
      if (!map.has(key)) map.set(key, material);
    });
    visit(object.children || []);
  });
  visit(objects);
  return [...map.values()];
}

function structuredCloneSafe(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
