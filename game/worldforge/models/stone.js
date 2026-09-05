export function createLowPolyStone(id, scene) {
      const root = new BABYLON.TransformNode(id, scene);
      
      const rockMat = new BABYLON.StandardMaterial(id + "_rockMat", scene);
      rockMat.diffuseColor = new BABYLON.Color3(0.4, 0.42, 0.45); // Stony grey blue
      rockMat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15); // subtle specular highlight
      rockMat.specularPower = 32; // crisp reflection focus

      // Create an Icosphere. Subdivisions 2 = ~80 triangles, ideal for low-poly.
      const rock = BABYLON.MeshBuilder.CreateIcoSphere(id + "_mesh", { 
        radius: 1, 
        subdivisions: 2 
      }, scene);
      
      rock.parent = root;
      rock.material = rockMat;

      // Make the general shape flatter and oval like a resting stone
      rock.scaling.set(1.4, 0.75, 1.15);
      rock.position.y = 0.4;

      // Displace vertices to destroy perfect symmetry and make it an organic rock shape
      const positions = rock.getVerticesData(BABYLON.VertexBuffer.Position);

      if (!positions) {
          throw new Error("Unable to get vertex positions.");
      }

      const numVertices = positions.length / 3;
      for (let i = 0; i < numVertices; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        // Randomly displace the vertices
        const displacement = Math.random() * 0.2; // Adjust for intensity
        positions[i * 3] = x + (Math.random() * 2 - 1) * displacement; // Randomly in all directions
        positions[i * 3 + 1] = y + (Math.random() * 2 - 1) * displacement;
        positions[i * 3 + 2] = z + (Math.random() * 2 - 1) * displacement;
      }
      
      rock.updateVerticesData(BABYLON.VertexBuffer.Position, positions);
      rock.convertToFlatShadedMesh();
      rock.updateVerticesData(BABYLON.VertexBuffer.Normal, rock.getVerticesData(BABYLON.VertexBuffer.Normal));
        
      return root;
    }