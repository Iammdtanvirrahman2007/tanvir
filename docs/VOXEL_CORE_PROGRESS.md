# Voxel Core Progress

## Status

MF-003 Voxel Editor: 🟡 PARTIAL
MF-023 Automated Testing: 🟡 PARTIAL

## Implemented

- Deterministic sparse `VoxelGrid`
- Dimensions and voxel size
- World origin
- Configurable default block
- Block metadata
- Bounds-safe reads/writes
- Deterministic serialization
- Safe deserialization with bounds checks
- Browser voxel mode
- Block palette with seven built-in blocks
- Paint/place and erase tools
- Fill-box and flood-fill tools
- Region selection helper
- Copy/paste and duplicate tools
- Existing global undo/redo integration for voxel edits
- RKP v2 voxel payload persistence on save
- RKP migration retains the loaded asset for restoration
- Browser bridge restores saved voxel data into the voxel workspace after project open
- Mirror X/Y/Z transforms
- Rotate Y 90° transform
- X-axis symmetry transform
- Layer listing and layer visibility controls
- Canonical voxel coordinate snapping utilities
- Instanced voxel preview backend grouped by block type
- Explicit optimized-preview controller with standard-preview fallback
- Node.js test runner via `npm test`

## Verification

Voxel core, operation, and snapping tests cover:

- block storage + metadata
- sparse default removal
- deterministic serialization round-trip
- malformed/out-of-bounds rejection
- paint operations
- inclusive box fill
- connected-region flood fill
- copy/paste with block properties
- RKP v2 voxel payload presence/absence contract
- mirror transform
- rotate Y transform
- symmetry transform
- Y-layer grouping
- coordinate snapping and grid clamping
- invalid snap-step rejection

## Still missing for MF-003

- full voxel placement snapping integration for all editor tools
- optimized chunked/greedy meshing beyond instancing
- material/texture registry integration
- model-to-voxel conversion
- advanced selection UX and transform handles
