import * as BABYLON from "@babylonjs/core";
import { SceneLoaderSystem, SceneLoadResult } from "../systems/SceneLoaderSystem";
import { BuildingOcclusionSystem } from "../systems/BuildingOcclusionSystem";

/**
 * 場景管理器 (Phase 15)
 *
 * 負責：
 * 1. 載入 CausewayBay.glb 場景（帶進度回調）
 * 2. 管理建築物遮擋透明效果
 * 3. 處理地形與建築物的分類（T/B 命名規則）
 */
export class SceneManager {
    private scene: BABYLON.Scene;
    private sceneLoader: SceneLoaderSystem;
    private occlusionSystem: BuildingOcclusionSystem;
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
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
            // 載入 CausewayBay.glb
            const result = await this.sceneLoader.loadScene("/maps/CausewayBay.glb", onProgress);

            // 設定地形和建築物
            this.terrainMeshes = result.terrainMeshes;
            this.buildingMeshes = result.buildingMeshes;

            // 如果沒有分類到 T/B，將所有 mesh 當作可行走區域
            if (this.terrainMeshes.length === 0 && result.otherMeshes.length > 0) {
                console.log("⚠️ [SceneManager] No T-prefixed terrain found, treating all meshes as walkable");
                // 將所有非建築物 mesh 設為可行走
                result.otherMeshes.forEach(mesh => {
                    mesh.isPickable = true;
                    mesh.checkCollisions = true;
                    this.terrainMeshes.push(mesh);
                });
            }

            // 設定遮擋系統
            this.occlusionSystem.setTerrainMeshes(this.terrainMeshes);
            this.occlusionSystem.setBuildingMeshes(this.buildingMeshes);

            this.isLoaded = true;
            console.log("✅ [SceneManager] Scene loaded successfully");
            console.log(`   - Terrain meshes: ${this.terrainMeshes.length}`);
            console.log(`   - Building meshes: ${this.buildingMeshes.length}`);
            return true;
        } catch (error) {
            console.error("❌ [SceneManager] Failed to load scene:", error);
            onProgress?.(100);
            this.isLoaded = false;
            throw error; // 直接拋出錯誤，不使用備案場景
        }
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
        this.terrainMeshes = [];
        this.buildingMeshes = [];
        this.isLoaded = false;
    }
}
