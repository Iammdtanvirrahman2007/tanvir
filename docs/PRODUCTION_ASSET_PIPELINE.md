# Production Asset Pipeline

ModelForge can prepare a loaded 3D structure for a Minecraft-like voxel world generator without redesigning the source model's visual identity.

## Workflow

1. Clone only editor asset objects (`editorObject` and not `editorOnly`).
2. Remove editor/debug/helper objects, cameras, lights, hidden nodes, and empty geometry.
3. Bake mesh transforms into geometry.
4. Normalize object and material names.
5. Recompute missing normals and keep separate meshes where their structure is useful.
6. Ground the asset so the world-space bottom is exactly `Y = 0`.
7. Center the root on the bottom-center pivot.
8. Validate geometry, bounds, pivot, forbidden objects, and rotation contract.
9. Export GLB/glTF 2.0 as the primary runtime asset.
10. Export metadata and a WebP preview.

## Default structure metadata

```json
{
  "id": "small_house_01",
  "type": "structure",
  "category": "house",
  "suggestedBiomes": ["plains", "forest"],
  "placement": {
    "origin": "bottom-center",
    "gridAligned": true,
    "terrainAligned": true,
    "voxelScale": 1
  },
  "allowedRotation": [0, 90, 180, 270]
}
```

## Output contract

- `model.glb`
- `metadata.json`
- `preview.webp`

The browser export downloads these as files named under the asset ID. A later package/ZIP step can group them into `assets/structures/<id>/` without changing the asset contract.

## Important limitation

Non-manifold repair, true duplicate-topology detection, UV repacking, and full texture baking are not silently performed by the current browser pipeline. They require a deeper geometry/texture processing stage. The validation layer reports some optimization signals instead of claiming work that was not actually performed.
