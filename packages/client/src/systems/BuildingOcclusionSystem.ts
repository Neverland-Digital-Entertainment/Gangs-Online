import * as BABYLON from "@babylonjs/core";

/**
 * 建築物遮擋系統 (Phase 15)
 *
 * 當玩家位於建築物後方（被相機與玩家之間的建築物遮擋）時：
 * - 將遮擋的建築物完全隱藏（但保留碰撞）
 * - 確保玩家始終可見
 *
 * 支援點擊建築物後移動到建築後方的地形座標
 */
export class BuildingOcclusionSystem {
    private scene: BABYLON.Scene;
    private buildingMeshes: BABYLON.AbstractMesh[] = [];
    private terrainMeshes: BABYLON.AbstractMesh[] = [];
    private occludedBuildings: Set<BABYLON.AbstractMesh> = new Set();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 設定建築物 mesh 列表
     */
    setBuildingMeshes(meshes: BABYLON.AbstractMesh[]): void {
        this.buildingMeshes = meshes;
        console.log(`🏢 [Occlusion] Tracking ${meshes.length} buildings`);
    }

    /**
     * 設定地形 mesh 列表
     */
    setTerrainMeshes(meshes: BABYLON.AbstractMesh[]): void {
        this.terrainMeshes = meshes;
        console.log(`🌍 [Occlusion] Tracking ${meshes.length} terrain meshes`);
    }

    /**
     * 新增建築物 mesh
     */
    addBuildingMesh(mesh: BABYLON.AbstractMesh): void {
        if (!this.buildingMeshes.includes(mesh)) {
            this.buildingMeshes.push(mesh);
        }
    }

    /**
     * 新增地形 mesh
     */
    addTerrainMesh(mesh: BABYLON.AbstractMesh): void {
        if (!this.terrainMeshes.includes(mesh)) {
            this.terrainMeshes.push(mesh);
        }
    }

    /**
     * 更新建築物遮擋效果
     * 在每幀調用此方法
     *
     * @param playerPosition 玩家位置
     * @param camera 相機
     */
    update(playerPosition: BABYLON.Vector3, camera: BABYLON.Camera): void {
        const cameraPos = camera.position;
        const newlyOccluded = new Set<BABYLON.AbstractMesh>();

        for (const building of this.buildingMeshes) {
            // 從相機到玩家創建射線
            const direction = playerPosition.subtract(cameraPos).normalize();
            const distance = BABYLON.Vector3.Distance(cameraPos, playerPosition);
            const ray = new BABYLON.Ray(cameraPos, direction, distance);

            // 檢查射線是否擊中這個建築物
            const hit = ray.intersectsMesh(building, false);

            if (hit.hit) {
                // 玩家被這個建築物遮擋
                newlyOccluded.add(building);

                // 如果還沒隱藏，則隱藏（但保留碰撞）
                if (!this.occludedBuildings.has(building)) {
                    this.setBuildingVisibility(building, false);
                }
            }
        }

        // 恢復不再遮擋的建築物
        for (const building of this.occludedBuildings) {
            if (!newlyOccluded.has(building)) {
                this.setBuildingVisibility(building, true);
            }
        }

        // 更新遮擋列表
        this.occludedBuildings = newlyOccluded;
    }

    /**
     * 設定建築物可見性（隱藏時保留碰撞）
     */
    private setBuildingVisibility(building: BABYLON.AbstractMesh, visible: boolean): void {
        // 設定主 mesh 可見性
        building.isVisible = visible;
        // 碰撞保持啟用
        building.checkCollisions = true;

        // 處理子 mesh
        building.getChildMeshes().forEach((child) => {
            child.isVisible = visible;
            child.checkCollisions = true;
        });
    }

    /**
     * 獲取點擊建築物後應該移動到的地形位置
     * 找到建築物後方的可移動地形座標
     *
     * @param buildingMesh 被點擊的建築物
     * @param cameraPos 相機位置
     * @returns 目標位置，如果找不到則返回 null
     */
    getTerrainBehindBuilding(
        buildingMesh: BABYLON.AbstractMesh,
        cameraPos: BABYLON.Vector3
    ): BABYLON.Vector3 | null {
        // 從相機穿過建築物中心的射線
        const buildingCenter = buildingMesh.getBoundingInfo().boundingBox.centerWorld;
        const direction = buildingCenter.subtract(cameraPos).normalize();

        // 計算建築物的大小，用於決定射線長度
        const boundingBox = buildingMesh.getBoundingInfo().boundingBox;
        const buildingSize = BABYLON.Vector3.Distance(
            boundingBox.minimumWorld,
            boundingBox.maximumWorld
        );

        // 創建穿透建築物的射線
        const ray = new BABYLON.Ray(
            cameraPos,
            direction,
            BABYLON.Vector3.Distance(cameraPos, buildingCenter) + buildingSize + 5
        );

        // 尋找射線擊中的地形
        for (const terrain of this.terrainMeshes) {
            const hit = ray.intersectsMesh(terrain, false);
            if (hit.hit && hit.pickedPoint) {
                // 確保這個點在建築物後面
                const distToBuilding = BABYLON.Vector3.Distance(cameraPos, buildingCenter);
                const distToTerrain = BABYLON.Vector3.Distance(cameraPos, hit.pickedPoint);

                if (distToTerrain > distToBuilding) {
                    return hit.pickedPoint;
                }
            }
        }

        // 如果射線沒有擊中地形，嘗試在建築物後方投射另一條向下的射線
        const behindBuilding = buildingCenter.add(direction.scale(buildingSize / 2 + 2));
        const downRay = new BABYLON.Ray(
            new BABYLON.Vector3(behindBuilding.x, 100, behindBuilding.z),
            BABYLON.Vector3.Down(),
            200
        );

        for (const terrain of this.terrainMeshes) {
            const hit = downRay.intersectsMesh(terrain, false);
            if (hit.hit && hit.pickedPoint) {
                return hit.pickedPoint;
            }
        }

        return null;
    }

    /**
     * 檢查一個 mesh 是否是建築物
     */
    isBuilding(mesh: BABYLON.AbstractMesh): boolean {
        return this.buildingMeshes.includes(mesh);
    }

    /**
     * 檢查一個 mesh 是否是地形
     */
    isTerrain(mesh: BABYLON.AbstractMesh): boolean {
        return this.terrainMeshes.includes(mesh);
    }

    /**
     * 清理資源
     */
    dispose(): void {
        // 恢復所有建築物為可見
        for (const building of this.occludedBuildings) {
            this.setBuildingVisibility(building, true);
        }
        this.occludedBuildings.clear();
        this.buildingMeshes = [];
        this.terrainMeshes = [];
    }
}
