import * as BABYLON from "@babylonjs/core";
import { GAME_CONSTANTS } from "@gangs-online/shared";

/**
 * 城市生成器
 * 負責生成程序化的城市環境（道路、人行道、建築物）
 * Phase 9: 增加安全區視覺效果
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
        this.createSafeZone(); // Phase 9: 安全區
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
     * 創建安全區視覺效果 (Phase 9)
     */
    private createSafeZone(): void {
        // 創建綠色半透明圓形作為安全區標記
        const safeZone = BABYLON.MeshBuilder.CreateDisc(
            "safeZone",
            { radius: GAME_CONSTANTS.SAFE_ZONE_RADIUS },
            this.scene
        );

        // 旋轉到地面（預設是垂直的）
        safeZone.rotation.x = Math.PI / 2;
        safeZone.position.y = 0.02; // 稍微高於地面，避免 Z-fighting

        // 創建半透明綠色材質
        const safeMat = new BABYLON.StandardMaterial("safeMat", this.scene);
        safeMat.diffuseColor = new BABYLON.Color3(0, 1, 0); // 綠色
        safeMat.emissiveColor = new BABYLON.Color3(0, 0.3, 0); // 發光效果
        safeMat.alpha = 0.2; // 半透明
        safeZone.material = safeMat;

        console.log(`✅ Safe Zone created with radius ${GAME_CONSTANTS.SAFE_ZONE_RADIUS}`);
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
