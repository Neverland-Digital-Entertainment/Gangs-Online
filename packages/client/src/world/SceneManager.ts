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
 * 5. 管理獨立場景（如監獄）的載入與切換
 */
export class SceneManager {
    private scene: BABYLON.Scene;
    private chunkLoader: ChunkLoaderSystem;
    private occlusionSystem: BuildingOcclusionSystem;
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
    private isLoaded: boolean = false;
    private startPosition: BABYLON.Vector3 = BABYLON.Vector3.Zero();

    // 獨立場景管理
    private prisonMeshes: BABYLON.AbstractMesh[] = [];
    private prisonTerrainMeshes: BABYLON.AbstractMesh[] = [];
    private isPrisonLoaded: boolean = false;
    private isInPrison: boolean = false;

    // 場景切換回調
    private onSceneSwitch: ((sceneName: string, position: BABYLON.Vector3) => void) | null = null;

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
     * 獲取建築遮擋系統（供 MapOverrideSystem 註冊新增/替換的建築）
     */
    getOcclusionSystem(): BuildingOcclusionSystem {
        return this.occlusionSystem;
    }

    /**
     * 檢查場景是否已載入
     */
    isSceneLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * 設定場景切換回調
     */
    setOnSceneSwitch(callback: (sceneName: string, position: BABYLON.Vector3) => void): void {
        this.onSceneSwitch = callback;
    }

    /**
     * 載入監獄場景
     * @returns 監獄起始位置
     */
    async loadPrisonScene(): Promise<BABYLON.Vector3> {
        if (this.isPrisonLoaded) {
            console.log("ℹ️ [SceneManager] Prison already loaded, switching visibility");
            this.showPrisonScene();
            return this.getPrisonStartPosition();
        }

        console.log("🔒 [SceneManager] Loading Prison scene...");

        return new Promise((resolve, reject) => {
            BABYLON.SceneLoader.ImportMesh(
                "",
                "/maps/",
                "Prison.glb",
                this.scene,
                (meshes) => {
                    console.log(`✅ [SceneManager] Prison loaded: ${meshes.length} meshes`);

                    // 處理監獄 meshes
                    for (const mesh of meshes) {
                        if (mesh.name === "__root__") continue;

                        mesh.metadata = { ...mesh.metadata, sceneId: "Prison" };
                        this.prisonMeshes.push(mesh);

                        const firstChar = mesh.name.charAt(0).toUpperCase();
                        if (firstChar === "T") {
                            mesh.isPickable = true;
                            mesh.checkCollisions = true;
                            mesh.metadata.type = "terrain";
                            this.prisonTerrainMeshes.push(mesh);
                        } else if (firstChar === "B" || firstChar === "I") {
                            mesh.isPickable = true;
                            mesh.checkCollisions = true;
                            mesh.metadata.type = firstChar === "B" ? "building" : "item";
                        }
                    }

                    this.isPrisonLoaded = true;
                    this.showPrisonScene();

                    const startPos = this.getPrisonStartPosition();
                    console.log(`📍 [SceneManager] Prison start position: (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)})`);

                    resolve(startPos);
                },
                undefined,
                (scene, message, exception) => {
                    console.error(`❌ [SceneManager] Failed to load Prison: ${message}`, exception);
                    reject(new Error(message));
                }
            );
        });
    }

    /**
     * 獲取監獄起始位置
     */
    private getPrisonStartPosition(): BABYLON.Vector3 {
        // 計算監獄場景的中心位置
        if (this.prisonMeshes.length === 0) {
            return new BABYLON.Vector3(0, 1, 0);
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const mesh of this.prisonMeshes) {
            if (mesh.name === "__root__") continue;
            mesh.computeWorldMatrix(true);
            const boundingInfo = mesh.getBoundingInfo();
            if (boundingInfo) {
                const min = boundingInfo.boundingBox.minimumWorld;
                const max = boundingInfo.boundingBox.maximumWorld;
                minX = Math.min(minX, min.x);
                maxX = Math.max(maxX, max.x);
                minY = Math.min(minY, min.y);
                maxY = Math.max(maxY, max.y);
                minZ = Math.min(minZ, min.z);
                maxZ = Math.max(maxZ, max.z);
            }
        }

        // 返回場景中心位置，稍微高於地面
        return new BABYLON.Vector3(
            (minX + maxX) / 2,
            minY + 1,
            (minZ + maxZ) / 2
        );
    }

    /**
     * 顯示監獄場景，隱藏主地圖
     */
    private showPrisonScene(): void {
        this.isInPrison = true;

        // 隱藏主地圖的所有 chunks
        for (const [id, chunk] of this.chunkLoader.getLoadedChunks()) {
            for (const mesh of chunk.meshes) {
                mesh.setEnabled(false);
            }
        }

        // 顯示監獄
        for (const mesh of this.prisonMeshes) {
            mesh.setEnabled(true);
        }

        console.log("🔒 [SceneManager] Switched to Prison scene");
    }

    /**
     * 隱藏監獄場景，顯示主地圖
     */
    private showMainScene(): void {
        this.isInPrison = false;

        // 顯示主地圖的所有 chunks
        for (const [id, chunk] of this.chunkLoader.getLoadedChunks()) {
            for (const mesh of chunk.meshes) {
                mesh.setEnabled(true);
            }
        }

        // 隱藏監獄
        for (const mesh of this.prisonMeshes) {
            mesh.setEnabled(false);
        }

        console.log("🔓 [SceneManager] Switched to Main scene");
    }

    /**
     * 進入監獄
     * @returns 監獄起始位置
     */
    async enterPrison(): Promise<BABYLON.Vector3> {
        const position = await this.loadPrisonScene();
        this.onSceneSwitch?.("Prison", position);
        return position;
    }

    /**
     * 離開監獄，返回主地圖
     * @param releasePosition 釋放位置（主地圖座標）
     */
    exitPrison(releasePosition: BABYLON.Vector3): void {
        if (!this.isInPrison) return;

        this.showMainScene();
        this.onSceneSwitch?.("Main", releasePosition);
    }

    /**
     * 檢查是否在監獄場景中
     */
    isInPrisonScene(): boolean {
        return this.isInPrison;
    }

    /**
     * 獲取當前場景的地形 meshes（用於移動）
     */
    getCurrentTerrainMeshes(): BABYLON.AbstractMesh[] {
        if (this.isInPrison) {
            return this.prisonTerrainMeshes;
        }
        return this.terrainMeshes;
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

        // 清理監獄場景
        for (const mesh of this.prisonMeshes) {
            mesh.dispose();
        }
        this.prisonMeshes = [];
        this.prisonTerrainMeshes = [];
        this.isPrisonLoaded = false;
        this.isInPrison = false;
    }
}
