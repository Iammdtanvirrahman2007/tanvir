import { PART_CATEGORIES, isPartCategory, isNodeType } from "./categories.js";

const SCHEMA_VERSION = "1.0.0";
const ROOT_KEY = "rocketPart";

export function createDefaultRocketPart(source = {}) {
    const now = new Date().toISOString();
    return {
        schemaVersion: SCHEMA_VERSION,
        id: source.id || createPartId(source.category || "custom", source.name || "part"),
        name: source.name || "Rocket Part",
        version: source.version || "1.0.0",
        category: isPartCategory(source.category) ? source.category : "custom",
        description: source.description || "",
        model: {
            format: "glb",
            modelUrl: "",
            thumbnailUrl: ""
        },
        physical: {
            mass: numberOr(source.physical?.mass, 1),
            height: numberOr(source.physical?.height, 1),
            diameter: numberOr(source.physical?.diameter, 1),
            width: numberOr(source.physical?.width, 1),
            depth: numberOr(source.physical?.depth, 1)
        },
        coordinateSystem: {
            upAxis: "Y",
            forwardAxis: "Z",
            origin: [0, 0, 0]
        },
        attachmentNodes: normalizeNodes(source.attachmentNodes),
        createdAt: source.createdAt || now,
        updatedAt: now,
        creator: {
            source: "ModelForge"
        },
        publishStatus: source.publishStatus || "draft"
    };
}

export function attachRocketPartMetadata(scene, source = {}) {
    if (!scene) return createDefaultRocketPart(source);
    const current = readRocketPart(scene);
    const metadata = current
        ? mergeRocketPart(current, source)
        : createDefaultRocketPart(source);
    scene.userData = scene.userData || {};
    scene.userData[ROOT_KEY] = metadata;
    return metadata;
}

export function readRocketPart(scene) {
    const value = scene?.userData?.[ROOT_KEY];
    return value ? clone(value) : null;
}

export function updateRocketPart(scene, patch = {}) {
    const current = readRocketPart(scene) || createDefaultRocketPart(patch);
    const next = mergeRocketPart(current, patch);
    next.updatedAt = new Date().toISOString();
    if (scene) {
        scene.userData = scene.userData || {};
        scene.userData[ROOT_KEY] = next;
    }
    return next;
}

export function createAttachmentNode(source = {}) {
    return {
        id: String(source.id || `node-${Math.random().toString(36).slice(2, 8)}`),
        name: String(source.name || source.id || "Attachment Node"),
        type: isNodeType(source.type) ? source.type : "structural",
        position: vector3(source.position),
        rotation: vector3(source.rotation),
        direction: normalizeDirection(source.direction),
        compatibleCategories: Array.isArray(source.compatibleCategories)
            ? source.compatibleCategories.filter(isPartCategory)
            : ["custom"]
    };
}

export function createPartId(category = "custom", name = "part") {
    const slug = String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "part";
    const prefix = isPartCategory(category) ? category : "custom";
    return `${prefix}-${slug}-${cryptoRandomSuffix()}`;
}

function mergeRocketPart(current, patch) {
    const next = clone(current);
    if (patch.name != null) next.name = String(patch.name);
    if (patch.description != null) next.description = String(patch.description);
    if (patch.version != null) next.version = String(patch.version);
    if (patch.category != null && isPartCategory(patch.category)) next.category = patch.category;
    if (patch.publishStatus != null) next.publishStatus = String(patch.publishStatus);
    if (patch.physical) next.physical = { ...next.physical, ...normalizePhysical(patch.physical) };
    if (patch.model) next.model = { ...next.model, ...patch.model };
    if (patch.coordinateSystem) next.coordinateSystem = { ...next.coordinateSystem, ...patch.coordinateSystem };
    if (Array.isArray(patch.attachmentNodes)) next.attachmentNodes = normalizeNodes(patch.attachmentNodes);
    return next;
}

function normalizeNodes(nodes) {
    return Array.isArray(nodes) ? nodes.map(createAttachmentNode) : [];
}

function normalizePhysical(physical) {
    return {
        mass: numberOr(physical.mass, 1),
        height: numberOr(physical.height, 1),
        diameter: numberOr(physical.diameter, 1),
        width: numberOr(physical.width, 1),
        depth: numberOr(physical.depth, 1)
    };
}

function vector3(value) {
    const input = Array.isArray(value) ? value : [0, 0, 0];
    return [numberOr(input[0], 0), numberOr(input[1], 0), numberOr(input[2], 0)];
}

function normalizeDirection(value) {
    const [x, y, z] = vector3(value);
    const length = Math.hypot(x, y, z);
    return length > 1e-8 ? [x / length, y / length, z / length] : [0, 1, 0];
}

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function cryptoRandomSuffix() {
    try {
        return crypto.randomUUID().slice(0, 8);
    } catch {
        return Math.random().toString(36).slice(2, 10);
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
