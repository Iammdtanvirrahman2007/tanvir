import { hasAssetType } from "./assetTypes.js";
import { RKP_ASSET_SCHEMA, RKP_VERSION } from "./rkpSchema.js";

export function validateRKP(asset, options = {}) {
  const issues = [];
  const add = (severity, code, message, path = "") => issues.push({ severity, code, message, path });

  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    return { valid: false, errors: [{ severity: "ERROR", code: "RKP_NOT_OBJECT", message: "RKP asset must be an object.", path: "" }], warnings: [], info: [], issues };
  }

  if (asset.format !== "RKP") add("ERROR", "RKP_FORMAT", "format must be RKP", "format");
  if (asset.schema !== RKP_ASSET_SCHEMA) add("ERROR", "RKP_SCHEMA", `schema must be ${RKP_ASSET_SCHEMA}`, "schema");
  if (asset.version !== RKP_VERSION) add("ERROR", "RKP_VERSION", `unsupported RKP version: ${String(asset.version)}`, "version");

  const metadata = asset.metadata;
  if (!metadata || typeof metadata !== "object") add("ERROR", "META_REQUIRED", "metadata is required", "metadata");
  else {
    ["id", "name", "assetType", "createdAt", "updatedAt"].forEach(field => {
      if (!metadata[field]) add("ERROR", "META_FIELD_REQUIRED", `${field} is required`, `metadata.${field}`);
    });
    if (metadata.assetType && !hasAssetType(metadata.assetType)) add("ERROR", "ASSET_TYPE_UNKNOWN", `unknown asset type: ${metadata.assetType}`, "metadata.assetType");
    if (!Array.isArray(metadata.tags)) add("ERROR", "META_TAGS", "metadata.tags must be an array", "metadata.tags");
    if (metadata.dimensions && !validDimensions(metadata.dimensions)) add("ERROR", "META_DIMENSIONS", "dimensions must contain finite x/y/z values", "metadata.dimensions");
  }

  if (!Array.isArray(asset.objects)) add("ERROR", "OBJECTS_ARRAY", "objects must be an array", "objects");
  if (!Array.isArray(asset.materials)) add("ERROR", "MATERIALS_ARRAY", "materials must be an array", "materials");
  if (!Array.isArray(asset.sockets)) add("ERROR", "SOCKETS_ARRAY", "sockets must be an array", "sockets");
  if (!Array.isArray(asset.markers)) add("ERROR", "MARKERS_ARRAY", "markers must be an array", "markers");
  if (!Array.isArray(asset.dependencies)) add("ERROR", "DEPENDENCIES_ARRAY", "dependencies must be an array", "dependencies");

  validateUniqueIds(asset.sockets, "SOCKET_ID_DUPLICATE", "sockets", add);
  validateUniqueIds(asset.markers, "MARKER_ID_DUPLICATE", "markers", add);
  validateReferences(asset.markers, asset.objects, add);

  if (!asset.metadata?.description && options.requireDescription) add("WARNING", "DESCRIPTION_MISSING", "asset description is empty", "metadata.description");
  if (asset.metadata?.assetType === "voxel_structure" && !asset.voxel) add("WARNING", "VOXEL_DATA_MISSING", "voxel_structure has no voxel payload", "voxel");
  if (!asset.metadata?.dimensions || !validDimensions(asset.metadata.dimensions)) add("WARNING", "BOUNDS_MISSING", "asset dimensions are missing or invalid", "metadata.dimensions");

  const errors = issues.filter(issue => issue.severity === "ERROR");
  const warnings = issues.filter(issue => issue.severity === "WARNING");
  const info = issues.filter(issue => issue.severity === "INFO");
  return { valid: errors.length === 0, errors, warnings, info, issues };
}

function validateUniqueIds(items, code, path, add) {
  if (!Array.isArray(items)) return;
  const seen = new Set();
  items.forEach((item, index) => {
    const id = item?.id;
    if (!id) add("ERROR", `${code.replace("_DUPLICATE", "_MISSING")}`, `${path} item is missing id`, `${path}[${index}].id`);
    else if (seen.has(id)) add("ERROR", code, `duplicate id: ${id}`, `${path}[${index}].id`);
    seen.add(id);
  });
}

function validateReferences(markers, objects, add) {
  if (!Array.isArray(markers) || !Array.isArray(objects)) return;
  const ids = new Set(objects.map(object => object?.id).filter(Boolean));
  markers.forEach((marker, index) => {
    if (marker?.linkedObjectId && !ids.has(marker.linkedObjectId)) add("ERROR", "MARKER_REFERENCE", `marker references missing object: ${marker.linkedObjectId}`, `markers[${index}].linkedObjectId`);
  });
}

function validDimensions(value) {
  return [value?.x, value?.y, value?.z].every(item => Number.isFinite(Number(item)) && Number(item) >= 0);
}
