export class Flood {
    constructor(scene, materials) {
        this.scene = scene;
        this.materials = materials;
        this.waterLevel = 0;
        this.maxWaterLevel = 2.5;
        this.isActive = false;
        this.waterMesh = null;
        this.waterMaterial = new BABYLON.StandardMaterial("waterMat", scene);
        this.waterMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.8);
        this.waterMaterial.specularPower = 10;
        this.waterMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 1);
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.createWaterSurface();
        this.animateFlood();
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.waterMesh) {
            this.waterMesh.dispose();
            this.waterMesh = null;
        }
    }

    createWaterSurface() {
        const groundSize = 80;
        this.waterMesh = BABYLON.MeshBuilder.CreateGround("water", {
            width: groundSize,
            height: groundSize,
            subdivisions: 10
        }, this.scene);
        this.waterMesh.position.y = this.waterLevel;
        this.waterMesh.material = this.waterMaterial;
        this.waterMesh.receiveShadows = true;
    }

    animateFlood() {
        const floodDuration = 10;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed >= floodDuration) {
                this.deactivate();
                return;
            }
            this.waterLevel = Math.min(this.maxWaterLevel, elapsed * 0.5);
            if (this.waterMesh) {
                this.waterMesh.position.y = this.waterLevel;
            }
            this.scene.onBeforeRender = () => {
                this.animateFlood();
            };
        };
        animate();
    }
}