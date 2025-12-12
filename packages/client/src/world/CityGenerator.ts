import * as BABYLON from "@babylonjs/core";

/**
 * 城市生成器
 * 負責生成程序化的城市環境（道路、人行道、建築物）
 */
export class CityGenerator {
    private scene: BABYLON.Scene;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 創建整個城市
     */
    generate(): void {
        this.createRoad();
        this.createBuildings();
    }

    /**
     * 創建瀝青道路
     */
    private createRoad(): void {
        const ground = BABYLON.MeshBuilder.CreateGround(
            "road",
            { width: 100, height: 100 },
            this.scene
        );
        const roadMat = new BABYLON.StandardMaterial("roadMat", this.scene);
        roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        ground.material = roadMat;

        // ENABLE COLLISION ON GROUND
        ground.checkCollisions = true;
    }

    /**
     * 創建建築物和人行道
     */
    private createBuildings(): void {
        // Sidewalk material (Lighter Grey)
        const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", this.scene);
        sidewalkMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

        // Building material (Neon Blocks)
        const buildingMat = new BABYLON.StandardMaterial("bMat", this.scene);
        buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
        buildingMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2);

        // Generate random blocks
        for (let i = -4; i <= 4; i++) {
            for (let j = -4; j <= 4; j++) {
                if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;

                const height = Math.random() * 8 + 4;

                const building = BABYLON.MeshBuilder.CreateBox(
                    `b_${i}_${j}`,
                    { height: height, width: 8, depth: 8 },
                    this.scene
                );
                building.position.set(i * 12, height / 2, j * 12);
                building.material = buildingMat;

                // ENABLE COLLISION ON BUILDINGS
                building.checkCollisions = true;

                const walk = BABYLON.MeshBuilder.CreateGround(
                    `w_${i}_${j}`,
                    { width: 10, height: 10 },
                    this.scene
                );
                walk.position.set(i * 12, 0.05, j * 12);
                walk.material = sidewalkMat;

                // ENABLE COLLISION ON SIDEWALKS
                walk.checkCollisions = true;
            }
        }
    }
}
