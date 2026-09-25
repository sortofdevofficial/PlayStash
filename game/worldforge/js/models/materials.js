// Materials are allocated once per scene and shared by every instance of a
// model. They used to be built per model call and then cloned again per mesh by
// world.js, so a hundred buildings carried well over a thousand materials, each
// needing its own bind and forcing its own draw call.
//
// Keyed by scene because the build-menu previews each run in their own scene,
// and a material belongs to exactly one.
const caches = new WeakMap();

export function sharedMat(scene, key, make) {
  let byKey = caches.get(scene);
  if (!byKey) {
    byKey = new Map();
    caches.set(scene, byKey);
  }
  let mat = byKey.get(key);
  if (!mat) {
    mat = make();
    byKey.set(key, mat);
  }
  return mat;
}

// Flat, non-specular surface colour. rgb / emissive are plain [r, g, b] triples
// so the caller allocates nothing when the material already exists.
export function solidMat(scene, key, rgb, emissive) {
  return sharedMat(scene, key, () => {
    const mat = new BABYLON.StandardMaterial(key, scene);
    mat.diffuseColor = new BABYLON.Color3(rgb[0], rgb[1], rgb[2]);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    if (emissive) mat.emissiveColor = new BABYLON.Color3(emissive[0], emissive[1], emissive[2]);
    return mat;
  });
}
