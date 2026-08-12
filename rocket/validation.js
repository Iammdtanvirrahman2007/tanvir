import { isPartCategory, isNodeType } from "./categories.js";

export function validateRocketPart(part) {
    const errors = [];
    if (!part?.id) errors.push("Missing part ID");
    if (!String(part?.name || "").trim()) errors.push("Missing part name");
    if (!isPartCategory(part?.category)) errors.push("Invalid part category");

    const physical = part?.physical || {};
    for (const key of ["mass", "height", "diameter", "width", "depth"]) {
        if (!Number.isFinite(Number(physical[key])) || Number(physical[key]) <= 0) {
            errors.push(`Invalid physical ${key}`);
        }
    }

    if (!Array.isArray(part?.attachmentNodes)) {
        errors.push("Attachment nodes must be an array");
    } else {
        const ids = new Set();
        for (const node of part.attachmentNodes) {
            if (!node?.id) errors.push("Attachment node missing ID");
            if (node?.id && ids.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
            if (node?.id) ids.add(node.id);
            if (!isNodeType(node?.type)) errors.push(`Invalid node type: ${node?.type || "unknown"}`);

            if (!validVector(node?.position)) {
                errors.push(`Invalid position for node: ${node?.id || "unknown"}`);
            }
            if (!validVector(node?.rotation)) {
                errors.push(`Invalid rotation for node: ${node?.id || "unknown"}`);
            }
            if (!validDirection(node?.direction)) {
                errors.push(`Invalid direction for node: ${node?.id || "unknown"}`);
            }

            if (!Array.isArray(node?.compatibleCategories)) {
                errors.push(`Invalid compatible categories for node: ${node?.id || "unknown"}`);
            } else {
                for (const category of node.compatibleCategories) {
                    if (!isPartCategory(category)) errors.push(`Invalid compatible category: ${category}`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

function validVector(value) {
    return Array.isArray(value) && value.length === 3 && value.every(item => Number.isFinite(Number(item)));
}

function validDirection(value) {
    if (!validVector(value)) return false;
    const length = Math.hypot(Number(value[0]), Number(value[1]), Number(value[2]));
    return length > 1e-8 && Math.abs(length - 1) < 1e-3;
}
