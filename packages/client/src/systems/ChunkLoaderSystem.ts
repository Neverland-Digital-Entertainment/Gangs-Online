import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { DracoCompression } from "@babylonjs/core/Meshes/Compression/dracoCompression";

// 配置 Draco 解碼器
DracoCompression.Configuration = {
    decoder: {
        wasmUrl: "https://preview.babylonjs.com/draco_wasm_wrapper_gltf.js",
        wasmBinaryUrl: "https://preview.babylonjs.com/draco_decoder_gltf.wasm",
        fallbackUrl: "https://preview.babylonjs.com/draco_decoder_gltf.js"
    }
};

/**
 * Chunk 資訊介面
 */
export interface ChunkInfo {
    id: string;
    file: string;
    description?: string;
}

/**
 * Manifest 介面
 */
export interface MapManifest {
    mapName: string;
    version: string;
    startChunk: string;
    chunks: ChunkInfo[];
}

/**
 * 已載入的 Chunk 資料
 */
export interface LoadedChunk {
    id: string;
    meshes: BABYLON.AbstractMesh[];
    terrainMeshes: BABYLON.AbstractMesh[];
    buildingMeshes: BABYLON.AbstractMesh[];
    bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        minZ: number;
        maxZ: number;
    };
    center: BABYLON.Vector3;
}

/**
 * Chunk Loading 系統 (Phase 15)
 *
 * 負責：
 * 1. 載入 manifest.json 取得地圖配置
 * 2. 使用原始座標載入 chunk（不做中心化偏移）
 * 3. 自動偵測 chunk 邊界
 * 4. 根據玩家位置決定載入/卸載 chunk
 */
export class ChunkLoaderSystem {
    private scene: BABYLON.Scene;
    private manifest: MapManifest | null = null;
    private loadedChunks: Map<string, LoadedChunk> = new Map();
    private loadingChunks: Set<string> = new Set();

    // 所有地形和建築的彙總（供其他系統使用）
    private allTerrainMeshes: BABYLON.AbstractMesh[] = [];
    private allBuildingMeshes: BABYLON.AbstractMesh[] = [];

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 載入 manifest.json
     */
    async loadManifest(manifestPath: string = "/maps/manifest.json"): Promise<MapManifest> {
        console.log(`📋 [ChunkLoader] Loading manifest: ${manifestPath}`);

        const response = await fetch(manifestPath);
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.statusText}`);
        }

        this.manifest = await response.json();
        console.log(`✅ [ChunkLoader] Manifest loaded: ${this.manifest!.mapName} v${this.manifest!.version}`);
        console.log(`   - Start chunk: ${this.manifest!.startChunk}`);
        console.log(`   - Total chunks: ${this.manifest!.chunks.length}`);

        return this.manifest!;
    }

    /**
     * 載入起始 chunk
     */
    async loadStartChunk(onProgress?: (progress: number) => void): Promise<LoadedChunk> {
        if (!this.manifest) {
            throw new Error("Manifest not loaded. Call loadManifest() first.");
        }

        return this.loadChunk(this.manifest.startChunk, onProgress);
    }

    /**
     * 載入指定 chunk
     */
    async loadChunk(chunkId: string, onProgress?: (progress: number) => void): Promise<LoadedChunk> {
        // 已載入則直接返回
        if (this.loadedChunks.has(chunkId)) {
            console.log(`ℹ️ [ChunkLoader] Chunk ${chunkId} already loaded`);
            return this.loadedChunks.get(chunkId)!;
        }

        // 正在載入中
        if (this.loadingChunks.has(chunkId)) {
            console.log(`⏳ [ChunkLoader] Chunk ${chunkId} is loading...`);
            // 等待載入完成
            while (this.loadingChunks.has(chunkId)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.loadedChunks.get(chunkId)!;
        }

        if (!this.manifest) {
            throw new Error("Manifest not loaded");
        }

        const chunkInfo = this.manifest.chunks.find(c => c.id === chunkId);
        if (!chunkInfo) {
            throw new Error(`Chunk ${chunkId} not found in manifest`);
        }

        this.loadingChunks.add(chunkId);
        console.log(`📦 [ChunkLoader] Loading chunk: ${chunkId} (${chunkInfo.file})`);

        return new Promise((resolve, reject) => {
            BABYLON.SceneLoader.ImportMesh(
                "",
                "/maps/",
                chunkInfo.file,
                this.scene,
                (meshes) => {
                    console.log(`✅ [ChunkLoader] Chunk ${chunkId} loaded: ${meshes.length} meshes`);

                    // 處理 meshes（保持原始座標）
                    const loadedChunk = this.processChunkMeshes(chunkId, meshes);

                    this.loadedChunks.set(chunkId, loadedChunk);
                    this.loadingChunks.delete(chunkId);

                    onProgress?.(100);
                    resolve(loadedChunk);
                },
                (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        onProgress?.(progress);
                    } else {
                        const estimatedProgress = Math.min(95, Math.round((event.loaded / 25000000) * 100));
                        onProgress?.(estimatedProgress);
                    }
                },
                (scene, message, exception) => {
                    console.error(`❌ [ChunkLoader] Failed to load chunk ${chunkId}: ${message}`, exception);
                    this.loadingChunks.delete(chunkId);
                    reject(new Error(message));
                }
            );
        });
    }

    /**
     * 處理 chunk meshes（保持原始座標，不做偏移）
     */
    private processChunkMeshes(chunkId: string, meshes: BABYLON.AbstractMesh[]): LoadedChunk {
        const terrainMeshes: BABYLON.AbstractMesh[] = [];
        const buildingMeshes: BABYLON.AbstractMesh[] = [];

        // 計算邊界
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        // Debug: 記錄所有 mesh 的資訊
        console.log(`📦 [ChunkLoader] Processing ${meshes.length} meshes from chunk ${chunkId}:`);
        let totalTriangles = 0;

        for (const mesh of meshes) {
            if (mesh.name === "__root__") continue;

            // 計算三角形數
            let triangles = 0;
            if (mesh instanceof BABYLON.Mesh && mesh.geometry) {
                triangles = Math.round(mesh.geometry.getTotalIndices() / 3);
                totalTriangles += triangles;
            }

            // Debug: 輸出每個 mesh 的名稱和三角形數
            const firstChar = mesh.name.charAt(0).toUpperCase();
            const category = (firstChar === "T") ? "T" : (firstChar === "B") ? "B" : (firstChar === "I") ? "I" : "?";
            console.log(`   [${category}] ${mesh.name}: ${triangles.toLocaleString()} tris`);

            // 計算世界矩陣以獲取正確的邊界
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

            // 為所有來自 chunk 的 mesh 標記 chunkId（用於 Debug UI 統計）
            mesh.metadata = { ...mesh.metadata, chunkId };

            // 根據名稱首字母分類
            if (firstChar === "T") {
                this.setupTerrainMesh(mesh, chunkId);
                terrainMeshes.push(mesh);
                this.allTerrainMeshes.push(mesh);
            } else if (firstChar === "B") {
                this.setupBuildingMesh(mesh, chunkId);
                buildingMeshes.push(mesh);
                this.allBuildingMeshes.push(mesh);
            } else if (firstChar === "I") {
                // I = Items/Props（街上的物品，有碰撞但不遮擋視線）
                this.setupItemMesh(mesh, chunkId);
            }
        }

        console.log(`📊 [ChunkLoader] Total triangles in chunk: ${totalTriangles.toLocaleString()}`);

        const center = new BABYLON.Vector3(
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2
        );

        console.log(`📐 [ChunkLoader] Chunk ${chunkId} bounds:`);
        console.log(`   - X: ${minX.toFixed(1)} to ${maxX.toFixed(1)}`);
        console.log(`   - Y: ${minY.toFixed(1)} to ${maxY.toFixed(1)}`);
        console.log(`   - Z: ${minZ.toFixed(1)} to ${maxZ.toFixed(1)}`);
        console.log(`   - Center: (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
        console.log(`   - Terrain: ${terrainMeshes.length}, Buildings: ${buildingMeshes.length}`);

        return {
            id: chunkId,
            meshes,
            terrainMeshes,
            buildingMeshes,
            bounds: { minX, maxX, minY, maxY, minZ, maxZ },
            center
        };
    }

    /**
     * 設定地形 mesh 屬性
     */
    private setupTerrainMesh(mesh: BABYLON.AbstractMesh, chunkId: string): void {
        mesh.isPickable = true;
        mesh.checkCollisions = true;
        mesh.metadata = { ...mesh.metadata, type: "terrain", chunkId };
    }

    /**
     * 設定建築 mesh 屬性
     */
    private setupBuildingMesh(mesh: BABYLON.AbstractMesh, chunkId: string): void {
        mesh.isPickable = true;
        mesh.checkCollisions = true;
        mesh.metadata = { ...mesh.metadata, type: "building", chunkId };

        // 為建築物準備透明度設定
        if (mesh.material) {
            const clonedMat = mesh.material.clone(`${mesh.name}_mat`);
            if (clonedMat) {
                mesh.material = clonedMat;
                if (clonedMat instanceof BABYLON.PBRMaterial) {
                    clonedMat.alpha = 1.0;
                    clonedMat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                } else if (clonedMat instanceof BABYLON.StandardMaterial) {
                    clonedMat.alpha = 1.0;
                    clonedMat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                }
            }
        }
    }

    /**
     * 設定物品/道具 mesh 屬性
     * I = Items/Props（街上的物品，有碰撞但不會遮擋視線）
     */
    private setupItemMesh(mesh: BABYLON.AbstractMesh, chunkId: string): void {
        mesh.isPickable = true;
        mesh.checkCollisions = true;
        mesh.metadata = { ...mesh.metadata, type: "item", chunkId };
    }

    /**
     * 根據玩家位置檢查並載入需要的 chunks
     */
    async updateChunksForPosition(playerPosition: BABYLON.Vector3, loadRadius: number = 500): Promise<void> {
        if (!this.manifest) return;

        for (const chunkInfo of this.manifest.chunks) {
            const loadedChunk = this.loadedChunks.get(chunkInfo.id);

            if (loadedChunk) {
                // 檢查是否需要卸載（距離太遠）
                const distance = BABYLON.Vector3.Distance(playerPosition, loadedChunk.center);
                // 暫時不卸載，保持所有已載入的 chunks
            } else {
                // 檢查是否需要載入
                // 由於還沒載入，我們需要估計位置或載入所有相鄰的
                // 對於 2-3 個 chunks 的地圖，直接全部載入
                if (this.manifest.chunks.length <= 3) {
                    await this.loadChunk(chunkInfo.id);
                }
            }
        }
    }

    /**
     * 載入所有 chunks（適用於小地圖）
     */
    async loadAllChunks(onProgress?: (chunkId: string, progress: number) => void): Promise<LoadedChunk[]> {
        if (!this.manifest) {
            throw new Error("Manifest not loaded");
        }

        const results: LoadedChunk[] = [];

        for (let i = 0; i < this.manifest.chunks.length; i++) {
            const chunkInfo = this.manifest.chunks[i];
            const chunk = await this.loadChunk(chunkInfo.id, (progress) => {
                onProgress?.(chunkInfo.id, progress);
            });
            results.push(chunk);
        }

        return results;
    }

    /**
     * 取得玩家所在的 chunk
     */
    getChunkAtPosition(position: BABYLON.Vector3): LoadedChunk | null {
        for (const [id, chunk] of this.loadedChunks) {
            if (
                position.x >= chunk.bounds.minX && position.x <= chunk.bounds.maxX &&
                position.z >= chunk.bounds.minZ && position.z <= chunk.bounds.maxZ
            ) {
                return chunk;
            }
        }
        return null;
    }

    /**
     * 取得起始位置（起始 chunk 的中心點）
     */
    getStartPosition(): BABYLON.Vector3 {
        const startChunk = this.loadedChunks.get(this.manifest?.startChunk || "");
        if (startChunk) {
            // Phase 15: 使用 chunk 的角落而不是中心，通常角落比較空曠
            // 使用 maxX, maxZ 角落（往內縮 50 單位避免出界）
            const spawnX = startChunk.bounds.maxX - 50;
            const spawnZ = startChunk.bounds.maxZ - 50;

            console.log(`📍 [ChunkLoader] Spawn position: corner (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);

            return new BABYLON.Vector3(
                spawnX,
                startChunk.bounds.minY + 1, // 稍微高於地面
                spawnZ
            );
        }
        return BABYLON.Vector3.Zero();
    }

    /**
     * 取得所有地形 mesh
     */
    getTerrainMeshes(): BABYLON.AbstractMesh[] {
        return this.allTerrainMeshes;
    }

    /**
     * 取得所有建築 mesh
     */
    getBuildingMeshes(): BABYLON.AbstractMesh[] {
        return this.allBuildingMeshes;
    }

    /**
     * 取得已載入的 chunks
     */
    getLoadedChunks(): Map<string, LoadedChunk> {
        return this.loadedChunks;
    }

    /**
     * 清理資源
     */
    dispose(): void {
        for (const [id, chunk] of this.loadedChunks) {
            for (const mesh of chunk.meshes) {
                mesh.dispose();
            }
        }
        this.loadedChunks.clear();
        this.allTerrainMeshes = [];
        this.allBuildingMeshes = [];
    }
}
