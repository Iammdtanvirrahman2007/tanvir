# Voxel Mode 2.0 Status

## Target

Voxel Mode is treated as a production-oriented asset authoring system for Minecraft-like structure generation. The canonical data model remains `VoxelGrid`; UI modules are adapters around that model.

## Implemented

- Sparse deterministic `VoxelGrid`
- Bounds-safe reads/writes and serialization
- Seven built-in block definitions through a canonical `VoxelBlockRegistry`
- Registry export/import contract
- Paint, erase, fill, flood fill, region selection, copy/paste, duplicate
- Mirror X/Y/Z, rotate X/Y/Z 90-degree transforms, symmetry and layer helpers
- Global editor history integration for voxel edits
- RKP v2 voxel payload persistence
- Voxel validation with machine-readable errors/warnings
- Generated AABB collision runs for collidable blocks
- Chunked greedy meshing with internal-face culling and quad merging
- Optimized preview using greedy geometry instead of one mesh per voxel
- Grid snap utility and runtime snap controls
- Voxel 2.0 QA panel for validation, collision generation and registry inspection
- Automated Node test coverage for registry, validation, collision and greedy meshing
- GitHub Actions test workflow on `main`

## Verification

The new Voxel 2.0 core tests pass locally:

- 4 tests passed
- 0 failed
- Registry export/lookup
- Unknown-block validation
- Collision run generation
- Greedy mesher face culling + quad merge

## Remaining work for a broader voxel game runtime

- Streaming/paging chunks for very large worlds
- Texture atlas/UV material pipeline
- Rich custom block authoring UI integrated directly into the placement palette
- Model-to-voxel conversion
- Voxel-to-game-asset packaging pipeline integration
- Procedural generation systems
- Runtime terrain/world streaming and persistence

These are intentionally treated as the next game/runtime layers rather than hidden inside the Voxel Editor core.
