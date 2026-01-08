import * as BABYLON from "@babylonjs/core";
import { SceneLoaderSystem, SceneLoadResult } from "../systems/SceneLoaderSystem";
import { BuildingOcclusionSystem } from "../systems/BuildingOcclusionSystem";

/**
 * 場景管理器 (Phase 15)
 *
 * 負責：
 * 1. 載入 CausewayBay.glb 場景（帶進度回調）
 * 2. 若載入失敗則使用程序化生成備案
 * 3. 管理建築物遮擋透明效果
 * 4. 處理地形與建築物的分類（T/B 命名規則）
 */
export class SceneManager {
    private scene: BABYLON.Scene;
    private sceneLoader: SceneLoaderSystem;
    private occlusionSystem: BuildingOcclusionSystem;
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
    private groundMesh: BABYLON.Mesh | null = null;
    private isLoaded: boolean = false;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.sceneLoader = new SceneLoaderSystem(scene);
        this.occlusionSystem = new BuildingOcclusionSystem(scene);
    }

    /**
     * 初始化場景
     * @param onProgress 進度回調 (0-100)
     * @returns 是否成功載入 glb 檔案
     */
    async initialize(onProgress?: (progress: number) => void): Promise<boolean> {
        console.log("🌍 [SceneManager] Initializing scene...");

        try {
            // 嘗試載入 CausewayBay.glb
            const result = await this.sceneLoader.loadScene("/maps/CausewayBay.glb", onProgress);

            // 設定地形和建築物
            this.terrainMeshes = result.terrainMeshes;
            this.buildingMeshes = result.buildingMeshes;

            // 設定遮擋系統
            this.occlusionSystem.setTerrainMeshes(this.terrainMeshes);
            this.occlusionSystem.setBuildingMeshes(this.buildingMeshes);

            // 如果沒有地形，創建一個地面作為備案
            if (this.terrainMeshes.length === 0) {
                console.log("⚠️ [SceneManager] No terrain meshes found, creating ground plane");
                this.createGroundPlane();
            }

            this.isLoaded = true;
            console.log("✅ [SceneManager] Scene loaded successfully");
            return true;
        } catch (error) {
            console.error("❌ [SceneManager] Failed to load scene:", error);
            console.log("⚠️ [SceneManager] Falling back to procedural generation");

            // 回調到 100% 以完成進度條
            onProgress?.(100);

            // 使用程序化生成備案
            this.createFallbackScene();
            return false;
        }
    }

    /**
     * 創建備案場景（程序化生成）
     * 當 glb 載入失敗時使用
     */
    private createFallbackScene(): void {
        console.log("🔧 [SceneManager] Creating fallback procedural scene");

        // 創建地面
        this.createGroundPlane();

        // 創建簡單的測試建築物
        this.createTestBuildings();

        this.isLoaded = true;
    }

    /**
     * 創建地面
     */
    private createGroundPlane(): void {
        this.groundMesh = BABYLON.MeshBuilder.CreateGround(
            "T_Ground",
            { width: 200, height: 200 },
            this.scene
        );

        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        this.groundMesh.material = groundMat;
        this.groundMesh.checkCollisions = true;
        this.groundMesh.isPickable = true;
        this.groundMesh.metadata = { type: "terrain" };

        this.terrainMeshes.push(this.groundMesh);
        this.occlusionSystem.addTerrainMesh(this.groundMesh);
    }

    /**
     * 創建測試用建築物（備案用）
     */
    private createTestBuildings(): void {
        const positions = [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: -20, z: 20 },
            { x: 20, z: 20 },
            { x: 0, z: 30 },
            { x: 0, z: -30 },
        ];

        positions.forEach((pos, index) => {
            const height = 5 + Math.random() * 10;
            const building = BABYLON.MeshBuilder.CreateBox(
                `B_Building_${index}`,
                { height, width: 8, depth: 8 },
                this.scene
            );

            building.position.set(pos.x, height / 2, pos.z);

            const buildingMat = new BABYLON.StandardMaterial(`B_Building_${index}_mat`, this.scene);
            buildingMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.5);
            buildingMat.alpha = 1.0;
            buildingMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            building.material = buildingMat;

            building.checkCollisions = true;
            building.isPickable = true;
            building.metadata = { type: "building" };

            this.buildingMeshes.push(building);
            this.occlusionSystem.addBuildingMesh(building);
        });

        console.log(`🏢 [SceneManager] Created ${positions.length} test buildings`);
    }

    /**
     * 更新建築物遮擋效果
     * 每幀調用此方法
     */
    updateBuildingOcclusion(playerPosition: BABYLON.Vector3, camera: BABYLON.Camera): void {
        if (!this.isLoaded) return;
        this.occlusionSystem.update(playerPosition, camera);
    }

    /**
     * 檢查 mesh 是否為建築物
     */
    isBuilding(mesh: BABYLON.AbstractMesh): boolean {
        return this.occlusionSystem.isBuilding(mesh) ||
               mesh.name.toUpperCase().startsWith("B") ||
               mesh.metadata?.type === "building";
    }

    /**
     * 檢查 mesh 是否為地形
     */
    isTerrain(mesh: BABYLON.AbstractMesh): boolean {
        return this.occlusionSystem.isTerrain(mesh) ||
               mesh.name.toUpperCase().startsWith("T") ||
               mesh.metadata?.type === "terrain";
    }

    /**
     * 獲取點擊建築物後應該移動到的地形位置
     */
    getTerrainBehindBuilding(
        buildingMesh: BABYLON.AbstractMesh,
        cameraPos: BABYLON.Vector3
    ): BABYLON.Vector3 | null {
        return this.occlusionSystem.getTerrainBehindBuilding(buildingMesh, cameraPos);
    }

    /**
     * 獲取所有地形 mesh
     */
    getTerrainMeshes(): BABYLON.AbstractMesh[] {
        return this.terrainMeshes;
    }

    /**
     * 獲取所有建築物 mesh
     */
    getBuildingMeshes(): BABYLON.AbstractMesh[] {
        return this.buildingMeshes;
    }

    /**
     * 檢查場景是否已載入
     */
    isSceneLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.sceneLoader.dispose();
        this.occlusionSystem.dispose();

        if (this.groundMesh) {
            this.groundMesh.dispose();
        }

        this.terrainMeshes = [];
        this.buildingMeshes = [];
        this.isLoaded = false;
    }
}
