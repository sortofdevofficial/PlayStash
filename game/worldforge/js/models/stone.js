export function createLowPolyStone(id, scene, materials) {
    const root = new BABYLON.TransformNode(id, scene);

    // Ensure materials are passed and used for consistency
    const rockMat = materials.stone || new BABYLON.StandardMaterial(id + "_rockMat", scene);
    rockMat.diffuseColor = new BABYLON.Color3(0.4, 0.42, 0.45); // Stony grey-blue
    rockMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15); // Subtle specular highlight
    rockMat.specularPower = 32; // Crisp reflection focus

    // Create an Icosphere with subdivisions for low-poly aesthetic
    const rock = BABYLON.MeshBuilder.CreateIcoSphere(id + "_mesh", {
        radius: 1,
        subdivisions: 2
    }, scene);

    rock.parent = root;
    rock.material = rockMat;

    // Make the shape flatter and oval like a resting stone
    rock.scaling.set(1.4, 0.75, 1.15);
    rock.position.y = 0.4;

    // Displace vertices to break symmetry and create an organic rock shape
    const positions = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) {
        console.error("Failed to get vertex positions for stone.");
        return root;
    }

    const numVertices = positions.length / 3;
    for (let i = 0; i < numVertices; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        // Randomly displace vertices for organic shape
        const displacement = Math.random() * 0.2;
        positions[i * 3] = x + (Math.random() * 2 - 1) * displacement;
        positions[i * 3 + 1] = y + (Math.random() * 2 - 1) * displacement;
        positions[i * 3 + 2] = z + (Math.random() * 2 - 1) * displacement;
    }

    rock.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    rock.convertToFlatShadedMesh();
    rock.updateVerticesData(BABYLON.VertexBuffer.NormalKind, rock.getVerticesData(BABYLON.VertexBuffer.NormalKind));

    return root;
}