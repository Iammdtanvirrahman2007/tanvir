export const PART_CATEGORIES = Object.freeze([
    "capsule",
    "tank",
    "engine",
    "nose-cone",
    "decoupler",
    "wing",
    "landing-leg",
    "parachute",
    "rcs",
    "docking-port",
    "utility",
    "custom"
]);

export const NODE_TYPES = Object.freeze([
    "structural",
    "fuel",
    "engine",
    "dock",
    "utility",
    "custom"
]);

export function isPartCategory(value) {
    return PART_CATEGORIES.includes(value);
}

export function isNodeType(value) {
    return NODE_TYPES.includes(value);
}
