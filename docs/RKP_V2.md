# RKP v2

RKP v2 is ModelForge's package boundary for Voxel Frontier assets.

## Top-level layout

```text
RKP
├── format
├── schema
├── version
├── metadata
├── scene
├── objects
├── materials
├── voxel
├── collision
├── sockets
├── markers
├── spawnPoints
├── gameplay
├── biome
├── procedural
├── variants
├── dependencies
└── customProperties
```

## Compatibility

ModelForge accepts the previous `ModelForgeProject` scene format and migrates it into RKP v2 before validation. New RKP v2 files are validated before they mutate the active editor scene.

## Asset identity

`metadata` contains a stable asset ID, name, type, category, tags, creator/author information, timestamps, dimensions, transforms and description.

Asset types are resolved through `core/assetTypes.js`, so future types can be registered without adding type-specific conditionals throughout the editor.

## Validation

`core/rkpValidator.js` produces machine-readable `ERROR`, `WARNING` and `INFO` issues. Current validation covers package identity/schema/version, required metadata, asset type, core array shapes, duplicate socket/marker IDs, marker object references, dimensions, and voxel payload expectations.

## Migration

`core/rkpMigration.js` is intentionally isolated from the renderer. This makes future migrations composable and keeps old project files readable while the runtime schema evolves.

## Current scope

This phase establishes the package and schema foundation. Voxel payload authoring, sockets, markers, collision authoring, procedural rules, variants, village composition and registry-backed publishing will build on this format in later phases.
