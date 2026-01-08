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

        for (const mesh of meshes) {
            // 跳過 __root__ 節點
            if (mesh.name === "__root__") {
                result.rootMesh = mesh;
                // 設定根節點位置到原點，朝向北方
                mesh.position = BABYLON.Vector3.Zero();
                mesh.rotation = BABYLON.Vector3.Zero();
                continue;
            }

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
                console.log(`🏢 [SceneLoader] Building: ${mesh.name}`);
            } else {
                // 其他物件
                result.otherMeshes.push(mesh);
                console.log(`📦 [SceneLoader] Other: ${mesh.name}`);
            }
        }

        console.log(`📊 [SceneLoader] Summary:`);
        console.log(`   - Terrain meshes: ${result.terrainMeshes.length}`);
        console.log(`   - Building meshes: ${result.buildingMeshes.length}`);
        console.log(`   - Other meshes: ${result.otherMeshes.length}`);

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

        // 為建築物創建獨立材質以便控制透明度
        if (mesh.material) {
            // 複製現有材質
            const originalMat = mesh.material as BABYLON.StandardMaterial;
            const buildingMat = originalMat.clone(`${mesh.name}_mat`);

            if (buildingMat instanceof BABYLON.StandardMaterial) {
                buildingMat.alpha = 1.0;
                // 啟用透明度需要的設定
                buildingMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
                mesh.material = buildingMat;
                this.buildingMaterials.set(mesh, buildingMat);
            }
        } else {
            // 如果沒有材質，創建一個預設材質
            const buildingMat = new BABYLON.StandardMaterial(`${mesh.name}_mat`, this.scene);
            buildingMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            buildingMat.alpha = 1.0;
            buildingMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
            mesh.material = buildingMat;
            this.buildingMaterials.set(mesh, buildingMat);
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
