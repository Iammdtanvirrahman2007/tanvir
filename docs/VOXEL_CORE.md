# Voxel Core Contract

ModelForge's voxel domain starts as a deterministic, sparse, data-only core before any Three.js editor UI is added.

## VoxelGrid

A grid has dimensions `[x, y, z]`, a positive `voxelSize`, a world `origin`, and a configurable `defaultBlock` (normally `air`). Only non-default blocks are stored.

## Block record

Each stored voxel has integer `x/y/z`, a stable `blockId`, and optional JSON-safe `properties` for future block metadata.

## Serialization

`VoxelGrid.serialize()` emits versioned JSON with deterministic block ordering. `VoxelGrid.deserialize()` rejects malformed payloads and out-of-bounds blocks before populating the grid.

## Architectural rule

Rendering, palette UI, undo commands, voxel mesh generation, block registries, and model-to-voxel conversion must consume this domain model rather than creating parallel voxel state.
