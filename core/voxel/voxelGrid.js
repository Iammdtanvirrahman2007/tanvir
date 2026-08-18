const DEFAULT_SIZE = 1;

export class VoxelGrid {
    constructor(options = {}) {
        this.dimensions = normalizeDimensions(options.dimensions || [16, 16, 16]);
        this.voxelSize = positiveNumber(options.voxelSize ?? DEFAULT_SIZE, DEFAULT_SIZE);
        this.origin = normalizeVector(options.origin, [0, 0, 0]);
        this.defaultBlock = String(options.defaultBlock || "air");
        this.blocks = new Map();
        this.metadata = new Map();
    }

    get width() { return this.dimensions[0]; }
    get height() { return this.dimensions[1]; }
    get depth() { return this.dimensions[2]; }

    isInside(x, y, z) {
        return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
            x >= 0 && y >= 0 && z >= 0 && x < this.width && y < this.height && z < this.depth;
    }

    key(x, y, z) { return `${x},${y},${z}`; }

    setBlock(x, y, z, blockId, properties = null) {
        assertInside(this, x, y, z);
        const id = String(blockId || this.defaultBlock);
        const key = this.key(x, y, z);
        if (id === this.defaultBlock && !properties) {
            this.blocks.delete(key);
            this.metadata.delete(key);
            return null;
        }
        this.blocks.set(key, id);
        if (properties && typeof properties === "object") this.metadata.set(key, deepClone(properties));
        else this.metadata.delete(key);
        return id;
    }

    removeBlock(x, y, z) {
        assertInside(this, x, y, z);
        const key = this.key(x, y, z);
        const previous = this.blocks.get(key) || this.defaultBlock;
        this.blocks.delete(key);
        this.metadata.delete(key);
        return previous;
    }

    getBlock(x, y, z) {
        if (!this.isInside(x, y, z)) return null;
        return this.blocks.get(this.key(x, y, z)) || this.defaultBlock;
    }

    getBlockRecord(x, y, z) {
        if (!this.isInside(x, y, z)) return null;
        const key = this.key(x, y, z);
        return { x, y, z, blockId: this.blocks.get(key) || this.defaultBlock, properties: deepClone(this.metadata.get(key) || null) };
    }

    setMetadata(x, y, z, properties) {
        assertInside(this, x, y, z);
        const key = this.key(x, y, z);
        if (properties && typeof properties === "object") this.metadata.set(key, deepClone(properties));
        else this.metadata.delete(key);
    }

    getVoxelCount() { return this.blocks.size; }

    clear() {
        this.blocks.clear();
        this.metadata.clear();
    }

    forEachBlock(callback) {
        for (const [key, blockId] of this.blocks) {
            const [x, y, z] = key.split(",").map(Number);
            callback({ x, y, z, blockId, properties: deepClone(this.metadata.get(key) || null) });
        }
    }

    serialize() {
        const blocks = [];
        this.forEachBlock(block => blocks.push(block));
        blocks.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
        return { version: 1, dimensions: [...this.dimensions], voxelSize: this.voxelSize, origin: [...this.origin], defaultBlock: this.defaultBlock, blocks };
    }

    static deserialize(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.dimensions)) throw new Error("Invalid voxel grid data");
        const grid = new VoxelGrid(data);
        for (const block of data.blocks || []) {
            if (!grid.isInside(block.x, block.y, block.z)) throw new Error(`Voxel block out of bounds: ${block.x},${block.y},${block.z}`);
            grid.setBlock(block.x, block.y, block.z, block.blockId, block.properties || null);
        }
        return grid;
    }
}

function normalizeDimensions(value) {
    if (!Array.isArray(value) || value.length < 3) throw new Error("Voxel dimensions must contain [x, y, z]");
    return value.slice(0, 3).map(Number).map(value => Math.max(1, Math.floor(value)));
}

function normalizeVector(value, fallback) {
    if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(Number);
    if (value && typeof value === "object") return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
    return [...fallback];
}

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function assertInside(grid, x, y, z) {
    if (!grid.isInside(x, y, z)) throw new RangeError(`Voxel coordinate out of bounds: ${x},${y},${z}`);
}

function deepClone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
