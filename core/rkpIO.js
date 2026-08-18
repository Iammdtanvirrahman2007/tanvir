import { serializeScene } from "./save.js";
import { openProjectFile } from "./load.js";
import { migrateLegacyProject, migrateToRKPv2 } from "./rkpMigration.js";
import { validateRKP } from "./rkpValidator.js";

export function buildRKPFromScene(scene, options = {}) {
  const legacy = serializeScene(scene);
  const asset = migrateLegacyProject({
    ...legacy,
    assetId: options.assetId,
    assetType: options.assetType || "model",
    category: options.category,
    tags: options.tags,
    author: options.author,
    creator: options.creator,
    description: options.description
  });
  const validation = validateRKP(asset);
  if (!validation.valid) throw new Error(formatIssues(validation.errors));
  return { asset, validation };
}

export function downloadRKP(scene, filename, options = {}) {
  const { asset, validation } = buildRKPFromScene(scene, options);
  const safeName = sanitizeFilename(filename || asset.metadata.name || "modelforge-asset");
  const blob = new Blob([JSON.stringify(asset, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.rkp`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.dispatchEvent(new CustomEvent("editor:status", { detail: `RKP v${asset.version} exported` }));
  return validation;
}

export async function validateAndOpenRKP(scene, file) {
  const parsed = JSON.parse(await file.text());
  const asset = migrateToRKPv2(parsed);
  const validation = validateRKP(asset);
  if (!validation.valid) {
    const error = new Error(formatIssues(validation.errors));
    error.validation = validation;
    throw error;
  }
  const normalizedFile = new File([JSON.stringify(asset)], file.name, { type: "application/json" });
  await openProjectFile(scene, normalizedFile);
  window.dispatchEvent(new CustomEvent("editor:rkp-opened", {
    detail: { assetId: asset.metadata.id, assetType: asset.metadata.assetType, version: asset.version, validation }
  }));
  return { asset, validation };
}

function formatIssues(issues) {
  return issues.slice(0, 5).map(issue => `${issue.code}: ${issue.message}`).join("; ") || "Invalid RKP asset.";
}

function sanitizeFilename(value) {
  return String(value || "modelforge-asset").trim().replace(/\.[^.]+$/, "").replace(/[\\/:*?\"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120).trim() || "modelforge-asset";
}
