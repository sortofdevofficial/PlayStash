// Every model in this game set `mat.flatShaded = true`, but Babylon's
// StandardMaterial has no such property - the identifier "flatShaded" appears
// zero times in babylon.js. Assigning it just hung an unused field off the
// material, so spheres and cylinders were rendering smooth-shaded: soft plastic
// blobs instead of faceted storybook low-poly.
//
// Per-face normals come from un-indexing the geometry, which is what
// convertToFlatShadedMesh() does. Call this once at the end of a model factory,
// after every mesh has been parented to the returned root.
export function flatShade(root) {
  const converted = new Set();

  for (const mesh of root.getChildMeshes()) {
    const geometry = mesh.geometry;
    // Cloned meshes (the hut's infill panels) share one Geometry, and the
    // conversion mutates it in place - running it again on the clone would
    // rebuild buffers the first pass already expanded.
    if (!geometry || converted.has(geometry.uniqueId)) continue;
    converted.add(geometry.uniqueId);
    mesh.convertToFlatShadedMesh();
  }

  return root;
}
