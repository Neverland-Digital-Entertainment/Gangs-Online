import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { GAME_CONSTANTS } from "@gangs-online/shared";
import { mapConfig } from "../config";

/**
 * 城市生成器
 * 負責載入 GLB 地圖並設置建築物透明效果
 *
 * 功能:
 * - 載入 GLB 地圖檔案（如 causeway-bay.glb）
 * - 自動識別建築物 mesh 並設置獨立材質（用於透明效果）
 * - 保留安全區視覺效果
 * - 支援建築物遮擋透明效果（玩家在建築物後面時建築物變半透明）
 */
export class CityGenerator {
    private scene: BABYLON.Scene;
    private buildings: BABYLON.AbstractMesh[] = []; // 存儲所有建築物以便遮擋檢測
    private ground: BABYLON.AbstractMesh | null = null;
    private loadedMeshes: BABYLON.AbstractMesh[] = [];
    private originalMaterials: Map<BABYLON.AbstractMesh, BABYLON.Material | null> = new Map();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 創建整個城市（同步方法，用於後向兼容）
     * 注意：此方法只創建基礎地面和安全區，實際地圖由 loadMap() 異步載入
     */
    generate(): void {
        this.createBasicGround();
        this.createSafeZone();
    }

    /**
     * 異步載入 GLB 地圖
     */
    async loadMap(): Promise<void> {
        console.log("🗺️ Loading map:", mapConfig.mapFile);

        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "", // 載入所有 mesh
                mapConfig.mapFile,
                "",
                this.scene
            );

            this.loadedMeshes = result.meshes as BABYLON.AbstractMesh[];
            console.log(`✅ Map loaded: ${this.loadedMeshes.length} meshes`);

            // 應用地圖縮放比例
            const scale = mapConfig.mapScale || 1.0;
            if (scale !== 1.0) {
                // 找到根節點並縮放
                const rootMesh = this.loadedMeshes.find(m => m.name === "__root__");
                if (rootMesh) {
                    rootMesh.scaling = new BABYLON.Vector3(scale, scale, scale);
                    console.log(`📐 Map scaled to ${scale}x`);
                } else {
                    // 如果沒有根節點，縮放所有頂層 mesh
                    for (const mesh of this.loadedMeshes) {
                        if (!mesh.parent) {
                            mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
                        }
                    }
                    console.log(`📐 Map meshes scaled to ${scale}x`);
                }

                // 縮放後需要刷新所有 mesh 的 bounding info 以確保碰撞正確
                for (const mesh of this.loadedMeshes) {
                    mesh.refreshBoundingInfo({ applySkeleton: true });
                }
            }

            // 處理載入的 mesh
            this.processLoadedMeshes();

            // 隱藏基礎地面（如果地圖有自己的地面）
            if (this.ground && this.hasGroundMesh()) {
                this.ground.isVisible = false;
            }

        } catch (error) {
            console.error("❌ Failed to load map:", error);
            // 載入失敗時保留基礎地面
        }
    }

    /**
     * 處理載入的 mesh：識別建築物、設置材質和碰撞
     */
    private processLoadedMeshes(): void {
        console.log("📋 Processing loaded meshes:");
        for (const mesh of this.loadedMeshes) {
            // 跳過空的 root mesh
            if (mesh.name === "__root__") continue;

            const boundingBox = mesh.getBoundingInfo()?.boundingBox;
            const height = boundingBox ? boundingBox.maximumWorld.y - boundingBox.minimumWorld.y : 0;
            const width = boundingBox ? boundingBox.maximumWorld.x - boundingBox.minimumWorld.x : 0;
            const depth = boundingBox ? boundingBox.maximumWorld.z - boundingBox.minimumWorld.z : 0;

            console.log(`  - ${mesh.name}: size(${width.toFixed(1)}, ${height.toFixed(1)}, ${depth.toFixed(1)}), isBuilding: ${this.isBuildingMesh(mesh)}, isGround: ${this.isGroundMesh(mesh)}`);

            // 啟用碰撞
            mesh.checkCollisions = true;

            // 判斷是否為建築物
            if (this.isBuildingMesh(mesh)) {
                this.setupBuildingMesh(mesh);
            } else if (this.isGroundMesh(mesh)) {
                // 地面 mesh
                mesh.checkCollisions = true;
                console.log(`🛤️ Ground mesh: ${mesh.name}`);
            }
        }

        console.log(`🏢 Buildings identified: ${this.buildings.length}`);
    }

    /**
     * 判斷 mesh 是否為建築物
     */
    private isBuildingMesh(mesh: BABYLON.AbstractMesh): boolean {
        const name = mesh.name.toLowerCase();

        // 排除地面、道路等
        if (this.isGroundMesh(mesh)) return false;

        // 包含 building 前綴的
        if (name.includes(mapConfig.buildingPrefix.toLowerCase())) return true;

        // 有一定高度的物件視為建築物（排除薄的平面）
        const boundingBox = mesh.getBoundingInfo()?.boundingBox;
        if (boundingBox) {
            const height = boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
            const width = boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
            const depth = boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

            // 高度大於 1 且高度大於寬度或深度的 1/3
            if (height > 1 && height > Math.min(width, depth) * 0.3) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判斷 mesh 是否為地面
     */
    private isGroundMesh(mesh: BABYLON.AbstractMesh): boolean {
        const name = mesh.name.toLowerCase();
        for (const groundName of mapConfig.groundNames) {
            if (name.includes(groundName.toLowerCase())) return true;
        }
        return false;
    }

    /**
     * 檢查是否已載入地面 mesh
     */
    private hasGroundMesh(): boolean {
        return this.loadedMeshes.some(mesh => this.isGroundMesh(mesh));
    }

    /**
     * 設置建築物 mesh（創建獨立材質以支援透明效果）
     */
    private setupBuildingMesh(mesh: BABYLON.AbstractMesh): void {
        // 保存原始材質
        this.originalMaterials.set(mesh, mesh.material);

        // 創建獨立材質（複製現有材質或創建新材質）
        if (mesh.material) {
            // 複製材質以獨立控制透明度
            const newMat = mesh.material.clone(`${mesh.material.name}_building_${mesh.name}`);
            if (newMat) {
                mesh.material = newMat;
            }
        } else {
            // 創建默認建築物材質
            const buildingMat = new BABYLON.StandardMaterial(`bMat_${mesh.name}`, this.scene);
            buildingMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
            buildingMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.08);
            buildingMat.alpha = 1.0;
            mesh.material = buildingMat;
        }

        // 啟用碰撞
        mesh.checkCollisions = true;

        // 標記為建築物（用於點擊穿透）
        if (!mesh.metadata) mesh.metadata = {};
        mesh.metadata.isBuilding = true;

        // 加入建築物列表
        this.buildings.push(mesh);

        console.log(`🏢 Building mesh: ${mesh.name}`);
    }

    /**
     * 創建基礎地面（作為後備，當 GLB 沒有地面時使用）
     */
    private createBasicGround(): void {
        const ground = BABYLON.MeshBuilder.CreateGround(
            "ground",
            { width: 200, height: 200 },
            this.scene
        );
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        ground.material = groundMat;
        ground.checkCollisions = true;
        ground.position.y = -0.01; // 稍低於地圖地面以避免 Z-fighting
        this.ground = ground;
    }

    /**
     * 創建安全區視覺效果
     */
    private createSafeZone(): void {
        const safeZone = BABYLON.MeshBuilder.CreateDisc(
            "safeZone",
            { radius: GAME_CONSTANTS.SAFE_ZONE_RADIUS },
            this.scene
        );

        safeZone.rotation.x = Math.PI / 2;
        safeZone.position.y = 0.05;

        const safeMat = new BABYLON.StandardMaterial("safeMat", this.scene);
        safeMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
        safeMat.emissiveColor = new BABYLON.Color3(0, 0.3, 0);
        safeMat.alpha = 0.2;
        safeZone.material = safeMat;

        console.log(`✅ Safe Zone created with radius ${GAME_CONSTANTS.SAFE_ZONE_RADIUS}`);
    }

    /**
     * 更新建築物遮擋效果
     * 當玩家在建築物後面時，將建築物設置為半透明
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

            // 設置透明度
            this.setBuildingAlpha(building, hit.hit ? 0.3 : 1.0);
        }
    }

    /**
     * 設置建築物透明度
     */
    private setBuildingAlpha(mesh: BABYLON.AbstractMesh, alpha: number): void {
        if (!mesh.material) return;

        // StandardMaterial
        if (mesh.material instanceof BABYLON.StandardMaterial) {
            mesh.material.alpha = alpha;
            return;
        }

        // PBRMaterial
        if (mesh.material instanceof BABYLON.PBRMaterial) {
            mesh.material.alpha = alpha;
            return;
        }

        // 嘗試設置任何有 alpha 屬性的材質
        if ('alpha' in mesh.material) {
            (mesh.material as any).alpha = alpha;
        }
    }

    /**
     * 檢查 mesh 是否為建築物（用於點擊穿透判斷）
     */
    isBuildingByMesh(mesh: BABYLON.AbstractMesh): boolean {
        return this.buildings.includes(mesh) ||
               (mesh.metadata && mesh.metadata.isBuilding) ||
               mesh.name.startsWith("b_"); // 後向兼容舊的命名
    }

    /**
     * 獲取所有建築物 mesh
     */
    getBuildings(): BABYLON.AbstractMesh[] {
        return this.buildings;
    }

    /**
     * 獲取地面 mesh
     */
    getGround(): BABYLON.AbstractMesh | null {
        return this.ground;
    }
}
