import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { DracoCompression } from "@babylonjs/core/Meshes/Compression/dracoCompression";

// 配置 Draco 解碼器 (Phase 15: 支援 Draco 壓縮的 GLB)
DracoCompression.Configuration = {
    decoder: {
        wasmUrl: "https://preview.babylonjs.com/draco_wasm_wrapper_gltf.js",
        wasmBinaryUrl: "https://preview.babylonjs.com/draco_decoder_gltf.wasm",
        fallbackUrl: "https://preview.babylonjs.com/draco_decoder_gltf.js"
    }
};

/**
 * 場景載入結果 (Phase 15)
 */
export interface SceneLoadResult {
    terrainMeshes: BABYLON.AbstractMesh[]; // T 開頭的地形物件
    buildingMeshes: BABYLON.AbstractMesh[]; // B 開頭的建築物件
    otherMeshes: BABYLON.AbstractMesh[]; // 其他物件
    rootMesh: BABYLON.AbstractMesh | null; // 根節點
}

/**
 * 場景載入系統 (Phase 15)
 *
 * 負責：
 * 1. 載入 CausewayBay.glb 場景檔案
 * 2. 提供載入進度回調
 * 3. 解析物件名稱（T 開頭 = 地形，B 開頭 = 建築）
 * 4. 設定碰撞和材質屬性
 */
export class SceneLoaderSystem {
    private scene: BABYLON.Scene;
    private loadedMeshes: BABYLON.AbstractMesh[] = [];
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
    private buildingMaterials: Map<BABYLON.AbstractMesh, BABYLON.StandardMaterial> = new Map();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 載入場景模型
     * @param modelPath 模型路徑（相對於 public 或 assets）
     * @param onProgress 進度回調 (0-100)
     * @returns 載入結果
     */
    async loadScene(
        modelPath: string = "/maps/CausewayBay.glb",
        onProgress?: (progress: number) => void
    ): Promise<SceneLoadResult> {
        console.log(`📦 [SceneLoader] Starting to load: ${modelPath}`);

        return new Promise((resolve, reject) => {
            // 使用 SceneLoader.ImportMesh 並監聽進度
            BABYLON.SceneLoader.ImportMesh(
                "", // 載入所有 mesh
                "", // 根路徑
                modelPath, // 模型路徑
                this.scene,
                // 成功回調
                (meshes, particleSystems, skeletons, animationGroups) => {
                    console.log(`✅ [SceneLoader] Loaded ${meshes.length} meshes`);
                    this.loadedMeshes = meshes;

                    // 解析並分類所有 mesh
                    const result = this.processMeshes(meshes);

                    // 最終進度
                    onProgress?.(100);

                    resolve(result);
                },
                // 進度回調
                (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        console.log(`📊 [SceneLoader] Progress: ${progress}%`);
                        onProgress?.(progress);
                    } else {
                        // 如果無法計算進度，使用載入的位元組作為參考
                        console.log(`📊 [SceneLoader] Loaded: ${event.loaded} bytes`);
                        // 假設檔案大小約 50MB，給出估計進度
                        const estimatedProgress = Math.min(95, Math.round((event.loaded / 50000000) * 100));
                        onProgress?.(estimatedProgress);
                    }
                },
                // 錯誤回調
                (scene, message, exception) => {
                    console.error(`❌ [SceneLoader] Failed to load: ${message}`, exception);
                    reject(new Error(message));
                }
            );
        });
    }

    /**
     * 處理並分類載入的 mesh
     */
    private processMeshes(meshes: BABYLON.AbstractMesh[]): SceneLoadResult {
        const result: SceneLoadResult = {
            terrainMeshes: [],
            buildingMeshes: [],
            otherMeshes: [],
            rootMesh: null
        };

        // Phase 15: 第一遍 - 找到 root mesh 並計算場景邊界
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const mesh of meshes) {
            if (mesh.name === "__root__") {
                result.rootMesh = mesh;
                continue;
            }

            // 計算邊界框
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

        // Phase 15: 計算場景中心並偏移到原點
        const centerX = (minX + maxX) / 2;
        const centerY = minY; // 使用最低點作為地面高度
        const centerZ = (minZ + maxZ) / 2;

        console.log(`📐 [SceneLoader] Original scene center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}, ${centerZ.toFixed(1)})`);
        console.log(`📐 [SceneLoader] Scene bounds BEFORE centering:`);
        console.log(`   - X: ${minX.toFixed(1)} to ${maxX.toFixed(1)} (width: ${(maxX - minX).toFixed(1)})`);
        console.log(`   - Y: ${minY.toFixed(1)} to ${maxY.toFixed(1)} (height: ${(maxY - minY).toFixed(1)})`);
        console.log(`   - Z: ${minZ.toFixed(1)} to ${maxZ.toFixed(1)} (depth: ${(maxZ - minZ).toFixed(1)})`);

        // Phase 15: 計算偏移量
        const offsetX = -centerX;
        const offsetY = -centerY;
        const offsetZ = -centerZ;
        console.log(`🔄 [SceneLoader] Applying offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}, ${offsetZ.toFixed(1)})`);

        // Phase 15: 第二遍 - 使用絕對座標偏移每個 mesh
        for (const mesh of meshes) {
            if (mesh.name === "__root__") {
                result.rootMesh = mesh;
                continue;
            }

            // 獲取當前世界座標
            const worldPos = mesh.getAbsolutePosition();

            // 計算新的世界座標
            const newX = worldPos.x + offsetX;
            const newY = worldPos.y + offsetY;
            const newZ = worldPos.z + offsetZ;

            // 使用 setAbsolutePosition 設定新的世界座標（忽略父子關係）
            mesh.setAbsolutePosition(new BABYLON.Vector3(newX, newY, newZ));

            // 重新計算世界矩陣
            mesh.computeWorldMatrix(true);

            // 根據名稱首字母分類
            const firstChar = mesh.name.charAt(0).toUpperCase();

            if (firstChar === "T") {
                // 地形物件 - 可移動區域
                this.setupTerrainMesh(mesh);
                result.terrainMeshes.push(mesh);
                this.terrainMeshes.push(mesh);
                console.log(`🌍 [SceneLoader] Terrain: ${mesh.name}`);
            } else if (firstChar === "B") {
                // 建築物件 - 有碰撞、可透明化
                this.setupBuildingMesh(mesh);
                result.buildingMeshes.push(mesh);
                this.buildingMeshes.push(mesh);
                // 減少 log 輸出，只顯示前 5 個
                if (result.buildingMeshes.length <= 5) {
                    console.log(`🏢 [SceneLoader] Building: ${mesh.name}`);
                }
            } else {
                // 其他物件
                result.otherMeshes.push(mesh);
            }
        }

        // 顯示最終邊界（偏移後）
        let newMinX = Infinity, newMaxX = -Infinity;
        let newMinZ = Infinity, newMaxZ = -Infinity;
        for (const mesh of meshes) {
            if (mesh.name === "__root__") continue;
            const boundingInfo = mesh.getBoundingInfo();
            if (boundingInfo) {
                const min = boundingInfo.boundingBox.minimumWorld;
                const max = boundingInfo.boundingBox.maximumWorld;
                newMinX = Math.min(newMinX, min.x);
                newMaxX = Math.max(newMaxX, max.x);
                newMinZ = Math.min(newMinZ, min.z);
                newMaxZ = Math.max(newMaxZ, max.z);
            }
        }

        console.log(`📊 [SceneLoader] Summary:`);
        console.log(`   - Terrain meshes: ${result.terrainMeshes.length}`);
        console.log(`   - Building meshes: ${result.buildingMeshes.length}`);
        console.log(`   - Other meshes: ${result.otherMeshes.length}`);
        console.log(`📐 [SceneLoader] Scene bounds AFTER centering:`);
        console.log(`   - X: ${newMinX.toFixed(1)} to ${newMaxX.toFixed(1)}`);
        console.log(`   - Z: ${newMinZ.toFixed(1)} to ${newMaxZ.toFixed(1)}`);

        return result;
    }

    /**
     * 設定地形 mesh 屬性
     */
    private setupTerrainMesh(mesh: BABYLON.AbstractMesh): void {
        // 地形可以被點擊（用於移動）
        mesh.isPickable = true;
        // 地形有碰撞（防止玩家掉落）
        mesh.checkCollisions = true;
        // 設定 metadata 標記為地形
        mesh.metadata = { ...mesh.metadata, type: "terrain" };
    }

    /**
     * 設定建築 mesh 屬性
     */
    private setupBuildingMesh(mesh: BABYLON.AbstractMesh): void {
        // 建築物可以被點擊（點擊後移動到後方）
        mesh.isPickable = true;
        // 建築物有碰撞（角色不可穿透）
        mesh.checkCollisions = true;
        // 設定 metadata 標記為建築
        mesh.metadata = { ...mesh.metadata, type: "building" };

        // Phase 15: 為建築物準備透明度設定（支援 PBR 和 Standard 材質）
        if (mesh.material) {
            // 複製現有材質以避免影響其他使用相同材質的 mesh
            const clonedMat = mesh.material.clone(`${mesh.name}_mat`);

            if (clonedMat) {
                mesh.material = clonedMat;

                // 根據材質類型設定透明度支援
                if (clonedMat instanceof BABYLON.PBRMaterial) {
                    clonedMat.alpha = 1.0;
                    // PBR 材質預設不透明，但準備好切換
                    clonedMat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                } else if (clonedMat instanceof BABYLON.StandardMaterial) {
                    clonedMat.alpha = 1.0;
                    clonedMat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                }
            }
        }
    }

    /**
     * 取得所有地形 mesh
     */
    getTerrainMeshes(): BABYLON.AbstractMesh[] {
        return this.terrainMeshes;
    }

    /**
     * 取得所有建築 mesh
     */
    getBuildingMeshes(): BABYLON.AbstractMesh[] {
        return this.buildingMeshes;
    }

    /**
     * 取得建築物的材質（用於透明度控制）
     */
    getBuildingMaterial(mesh: BABYLON.AbstractMesh): BABYLON.StandardMaterial | undefined {
        return this.buildingMaterials.get(mesh);
    }

    /**
     * 設定建築物透明度
     */
    setBuildingAlpha(mesh: BABYLON.AbstractMesh, alpha: number): void {
        const material = this.buildingMaterials.get(mesh);
        if (material) {
            material.alpha = alpha;
        }
    }

    /**
     * 清理載入的資源
     */
    dispose(): void {
        for (const mesh of this.loadedMeshes) {
            mesh.dispose();
        }
        this.loadedMeshes = [];
        this.terrainMeshes = [];
        this.buildingMeshes = [];
        this.buildingMaterials.clear();
    }
}
