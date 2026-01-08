import * as BABYLON from "@babylonjs/core";

/**
 * 城市生成器（備案用）
 * 負責生成程序化的城市環境（道路、人行道、建築物）
 * Phase 15: 移除安全區視覺效果，改用 SceneManager 為主要場景載入
 */
export class CityGenerator {
    private scene: BABYLON.Scene;
    private buildings: BABYLON.Mesh[] = []; // 存儲所有建築物以便遮擋檢測

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 創建整個城市
     * Phase 15: 移除安全區
     */
    generate(): void {
        this.createRoad();
        // Phase 15: 移除安全區 - this.createSafeZone();
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

    // Phase 15: 移除安全區視覺效果 - createSafeZone 方法已刪除

    /**
     * 創建建築物和人行道
     */
    private createBuildings(): void {
        // Sidewalk material (Lighter Grey)
        const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", this.scene);
        sidewalkMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

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

                // 為每個建築物創建獨立材質（以便單獨控制透明度）
                const buildingMat = new BABYLON.StandardMaterial(`bMat_${i}_${j}`, this.scene);
                buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
                buildingMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2);
                buildingMat.alpha = 1.0; // 初始為不透明
                building.material = buildingMat;

                // ENABLE COLLISION ON BUILDINGS
                building.checkCollisions = true;

                // 保存建築物引用以便後續遮擋檢測
                this.buildings.push(building);

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

    /**
     * 更新建築物遮擋效果 (Phase 10)
     * 當玩家在建築物後面時，將建築物設置為半透明，讓玩家可見
     */
    updateBuildingOcclusion(playerPosition: BABYLON.Vector3, camera: BABYLON.Camera): void {
        const cameraPos = camera.position;

        for (const building of this.buildings) {
            // 從相機到玩家創建射線
            const direction = playerPosition.subtract(cameraPos).normalize();
            const distance = BABYLON.Vector3.Distance(cameraPos, playerPosition);

            const ray = new BABYLON.Ray(cameraPos, direction, distance);

            // 檢查射線是否擊中這個建築物
            const hit = ray.intersectsMesh(building, false);

            if (hit.hit && building.material instanceof BABYLON.StandardMaterial) {
                // 玩家被這個建築物遮擋，設置為半透明
                building.material.alpha = 0.3;
            } else if (building.material instanceof BABYLON.StandardMaterial) {
                // 玩家沒有被遮擋，恢復不透明
                building.material.alpha = 1.0;
            }
        }
    }
}
