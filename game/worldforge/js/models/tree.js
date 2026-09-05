export function createLowPolyTree(name, scene, materials) {
  const root = new BABYLON.TransformNode(name, scene);

  // Helper to flat shade a wood mesh for crisp stylized polygon aesthetics
  function stylizeWood(mesh) {
    mesh.convertToFlatShadedMesh();
    mesh.material = materials.trunk;
    mesh.parent = root;
    return mesh;
  }

  // --- TRUNK & BRANCHES ---
  // Using octagonal cylinders for a classic sharp, hard-surface wooden log look
  const tess = 6; 

  const baseTrunk = BABYLON.MeshBuilder.CreateCylinder(name + "_t_base", {
    height: 1.6, diameterTop: 0.45, diameterBottom: 0.8, tessellation: tess
  }, scene);
  baseTrunk.position.y = 0.8;
  stylizeWood(baseTrunk);

  // Creating some angled base roots overlapping to break the cylindrical bottom shape
  for (let i = 0; i < 4; i++) {
    const rootPart = BABYLON.MeshBuilder.CreateCylinder(name + "_t_root" + i, {
        height: 1.0, diameterTop: 0.1, diameterBottom: 0.45, tessellation: 4
    }, scene);
    rootPart.position.set(
      Math.cos((i * Math.PI) / 2) * 0.35, 
      0.3, 
      Math.sin((i * Math.PI) / 2) * 0.35
    );
    rootPart.rotation.x = Math.PI / 4 * Math.sin((i * Math.PI) / 2);
    rootPart.rotation.z = Math.PI / 4 * Math.cos((i * Math.PI) / 2);
    // Add random horizontal rotation offset
    rootPart.rotation.y = Math.random(); 
    stylizeWood(rootPart);
  }

  const midTrunk = BABYLON.MeshBuilder.CreateCylinder(name + "_t_mid", {
    height: 1.5, diameterTop: 0.28, diameterBottom: 0.45, tessellation: tess
  }, scene);
  midTrunk.position.set(0.08, 2.2, 0.05);
  midTrunk.rotation.set(0, 0, -0.08);
  stylizeWood(midTrunk);

  // Natural Branches 
  const branch1 = BABYLON.MeshBuilder.CreateCylinder(name + "_b1", {
    height: 1.3, diameterTop: 0.1, diameterBottom: 0.25, tessellation: 4
  }, scene);
  branch1.position.set(0.38, 2.4, 0.15);
  branch1.rotation.set(0.15, -0.3, -Math.PI / 3.8);
  stylizeWood(branch1);

  const branch2 = BABYLON.MeshBuilder.CreateCylinder(name + "_b2", {
    height: 1.1, diameterTop: 0.08, diameterBottom: 0.22, tessellation: 4
  }, scene);
  branch2.position.set(-0.28, 2.7, -0.15);
  branch2.rotation.set(-0.25, 0.4, Math.PI / 3.5);
  stylizeWood(branch2);


  // --- FOLIAGE CLUSTERS ---
  const foliageSpecs = [
    { n: "main", r: 1.45, pos: [0.1, 4.0, 0.05], rot: [0.2, 1.2, -0.1] },
    { n: "left", r: 1.25, pos: [-0.75, 3.25, -0.2], rot: [0.8, -0.4, 0.6] },
    { n: "right", r: 1.15, pos: [0.85, 3.1, 0.2], rot: [-0.5, 0.8, -0.3] },
    { n: "back", r: 1.10, pos: [-0.25, 3.5, 0.85], rot: [0.1, 2.4, 0.9] },
    { n: "front",r: 1.05, pos: [0.1, 3.3, -0.75], rot: [0.3, -1.0, 0.4] },
    { n: "top",  r: 0.95, pos: [-0.15, 4.9, 0.2], rot: [-0.7, -0.2, 1.1] }
  ];

  foliageSpecs.forEach((spec) => {
    // We use Icosphere with subdivisions 2 so it has a reasonable density of triangles, 
    // which will create many crisp shaded shapes when flattened.
    const cluster = BABYLON.MeshBuilder.CreateIcoSphere(name + "_f_" + spec.n, {
      radius: spec.r, subdivisions: 2
    }, scene);

    cluster.position.set(...spec.pos);
    cluster.rotation.set(...spec.rot);

    // Give foliage a squished organic horizontal spread (broader/fatter instead of perfectly spherical)
    cluster.scaling.set(1.15, 0.85 + (Math.random()*0.1), 1.05);

    // Apply procedural randomness directly into vertices for highly customized/organic bumpy surfaces!
    const positions = cluster.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
      // Small +/- random offset magnitude (leaves buckling irregularly in space)
      let noise = 0.82 + (Math.random() * 0.36); 
      positions[i]     *= noise;
      positions[i + 1] *= noise;
      positions[i + 2] *= noise;
    }
    cluster.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    
    // Explicit flat shaded edges so light distinctly separates the individual foliage geometric clumps.
    cluster.convertToFlatShadedMesh();

    cluster.material = materials.foliage;
    cluster.parent = root;
  });

  return root;
}