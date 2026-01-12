import * as BABYLON from "@babylonjs/core";
import { ChunkLoaderSystem, LoadedChunk } from "../systems/ChunkLoaderSystem";
import { BuildingOcclusionSystem } from "../systems/BuildingOcclusionSystem";

/**
 * 場景管理器 (Phase 15 - Chunk Loading)
 *
 * 負責：
 * 1. 使用 ChunkLoaderSystem 載入地圖 chunks
 * 2. 管理建築物遮擋透明效果
 * 3. 處理地形與建築物的分類（T/B 命名規則）
 * 4. 提供玩家起始位置
 */
export class SceneManager {
    private scene: BABYLON.Scene;
    private chunkLoader: ChunkLoaderSystem;
    private occlusionSystem: BuildingOcclusionSystem;
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
    private isLoaded: boolean = false;
    private startPosition: BABYLON.Vector3 = BABYLON.Vector3.Zero();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.chunkLoader = new ChunkLoaderSystem(scene);
        this.occlusionSystem = new BuildingOcclusionSystem(scene);
    }

    /**
     * 初始化場景
     * @param onProgress 進度回調 (0-100)
     * @returns 是否成功載入 glb 檔案
     */
    async initialize(onProgress?: (progress: number) => void): Promise<boolean> {
        console.log("🌍 [SceneManager] Initializing scene with chunk loading...");

        try {
            // 載入 manifest
            await this.chunkLoader.loadManifest("/maps/manifest.json");

            // 載入起始 chunk
            const startChunk = await this.chunkLoader.loadStartChunk((progress) => {
                // 起始 chunk 佔總進度的 50%
                onProgress?.(Math.round(progress * 0.5));
            });

            // 載入所有其他 chunks（對於小地圖，一次載入全部）
            await this.chunkLoader.loadAllChunks((chunkId, progress) => {
                // 其他 chunks 佔剩餘 50%
                onProgress?.(50 + Math.round(progress * 0.5));
            });

            // 設定地形和建築物
            this.terrainMeshes = this.chunkLoader.getTerrainMeshes();
            this.buildingMeshes = this.chunkLoader.getBuildingMeshes();

            // 如果沒有分類到 T/B，將所有 mesh 當作可行走區域
            if (this.terrainMeshes.length === 0) {
                console.log("⚠️ [SceneManager] No T-prefixed terrain found");
                // 收集所有非建築物 mesh
                for (const [id, chunk] of this.chunkLoader.getLoadedChunks()) {
                    for (const mesh of chunk.meshes) {
                        if (mesh.name !== "__root__" && !mesh.name.toUpperCase().startsWith("B")) {
                            mesh.isPickable = true;
                            mesh.checkCollisions = true;
                            this.terrainMeshes.push(mesh);
                        }
                    }
                }
            }

            // 設定遮擋系統
            this.occlusionSystem.setTerrainMeshes(this.terrainMeshes);
            this.occlusionSystem.setBuildingMeshes(this.buildingMeshes);

            // 設定起始位置（從起始 chunk 中心）
            this.startPosition = this.chunkLoader.getStartPosition();

            this.isLoaded = true;
            onProgress?.(100);

            console.log("✅ [SceneManager] Scene loaded successfully with chunk loading");
            console.log(`   - Terrain meshes: ${this.terrainMeshes.length}`);
            console.log(`   - Building meshes: ${this.buildingMeshes.length}`);
            console.log(`   - Start position: (${this.startPosition.x.toFixed(1)}, ${this.startPosition.y.toFixed(1)}, ${this.startPosition.z.toFixed(1)})`);

            return true;
        } catch (error) {
            console.error("❌ [SceneManager] Failed to load scene:", error);
            onProgress?.(100);
            this.isLoaded = false;
            throw error;
        }
    }

    /**
     * 獲取玩家起始位置
     */
    getStartPosition(): BABYLON.Vector3 {
        return this.startPosition.clone();
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
     * 獲取 ChunkLoader（用於高級操作）
     */
    getChunkLoader(): ChunkLoaderSystem {
        return this.chunkLoader;
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
        this.chunkLoader.dispose();
        this.occlusionSystem.dispose();
        this.terrainMeshes = [];
        this.buildingMeshes = [];
        this.isLoaded = false;
    }
}
