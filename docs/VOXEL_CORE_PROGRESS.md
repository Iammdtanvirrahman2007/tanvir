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
- Node.js test runner via `npm test`

## Verification

Voxel core and operation tests pass in isolated local verification, covering:

- block storage + metadata
- sparse default removal
- deterministic serialization round-trip
- malformed/out-of-bounds rejection
- paint operations
- inclusive box fill
- connected-region flood fill
- copy/paste with block properties

## Still missing for MF-003

- mirror/rotate/symmetry tools
- layer visibility
- voxel grid snapping controls
- persistent voxel serialization inside RKP v2 asset payloads
- optimized chunked voxel mesh generation/greedy meshing
- material/texture registry integration
- model-to-voxel conversion
- advanced selection UX and transform handles
