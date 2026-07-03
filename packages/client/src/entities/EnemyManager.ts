import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { IEnemyData, EntityType } from "@gangs-online/shared";
import { UISystem } from "../systems/UISystem";
import { modelConfig } from "../config";

/**
 * 敵人實體介面 (Phase 9: 也包含 NPC)
 */
interface EnemyEntity {
    mesh: BABYLON.AbstractMesh;
    ui: {
        container: GUI.Rectangle;
        hpFg: GUI.Rectangle;
        nameLabel: GUI.TextBlock;
    };
    idleAnim?: BABYLON.AnimationGroup;
    runAnim?: BABYLON.AnimationGroup;
    attackAnim?: BABYLON.AnimationGroup;
    currentAnim: string;
    targetX: number;
    targetZ: number;
    type: EntityType; // Phase 9: 追蹤實體類型
}

/**
 * EnemyManager - 客戶端敵人管理系統 (Phase 9: 也管理 NPC)
 * 負責：
 * 1. 敵人/NPC 視覺化（3D 模型、UI）
 * 2. 敵人/NPC 動畫
 * 3. 敵人移動同步（NPC 是靜態的）
 */
export class EnemyManager {
    private scene: BABYLON.Scene;
    private uiSystem: UISystem;
    private enemies: Map<string, EnemyEntity> = new Map();
    private groundMeshes: BABYLON.AbstractMesh[] = []; // Phase 16-2: 地面偵測用

    constructor(scene: BABYLON.Scene, uiSystem: UISystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
    }

    /**
     * Phase 16-2: 設定可行走的地面 mesh（用於地面偵測）
     */
    setGroundMeshes(meshes: BABYLON.AbstractMesh[]): void {
        this.groundMeshes = meshes;
        console.log(`🌍 [EnemyManager] Ground meshes set: ${meshes.length}`);
    }

    /**
     * Phase 16-2: 獲取指定位置的地面高度（跟 PlayerManager 一樣）
     * 使用射線從上往下偵測
     */
    getGroundHeight(x: number, z: number): number {
        // 從高處往下發射射線
        const rayOrigin = new BABYLON.Vector3(x, 500, z);
        const rayDirection = new BABYLON.Vector3(0, -1, 0);
        const ray = new BABYLON.Ray(rayOrigin, rayDirection, 1000);

        // 只檢測地面 mesh
        const predicate = (mesh: BABYLON.AbstractMesh) => {
            return this.groundMeshes.includes(mesh) ||
                   mesh.name.toUpperCase().startsWith("T") ||
                   mesh.metadata?.type === "terrain";
        };

        const hit = this.scene.pickWithRay(ray, predicate);

        if (hit?.hit && hit.pickedPoint) {
            return hit.pickedPoint.y;
        }

        // 如果沒偵測到地面，返回 0
        return 0;
    }

    /**
     * Phase 21: 模型載入失敗時的膠囊體佔位模型
     * 回傳與 ImportMeshAsync 相同形狀的結果（meshes + animationGroups）
     */
    private createPlaceholderModel(enemyId: string, isNPC: boolean): { meshes: BABYLON.AbstractMesh[]; animationGroups: BABYLON.AnimationGroup[] } {
        const capsule = BABYLON.MeshBuilder.CreateCapsule(`placeholder_${enemyId}`, { height: 1.8, radius: 0.4 }, this.scene);
        const mat = new BABYLON.StandardMaterial(`placeholder_mat_${enemyId}`, this.scene);
        mat.diffuseColor = isNPC ? new BABYLON.Color3(0.3, 0.5, 1) : new BABYLON.Color3(0.9, 0.2, 0.2);
        mat.emissiveColor = mat.diffuseColor.scale(0.4);
        capsule.material = mat;
        // 膠囊體原點在中心，往上抬半身高，落地時腳貼地
        capsule.position.y = 0.9;
        const root = new BABYLON.Mesh(`placeholder_root_${enemyId}`, this.scene);
        capsule.parent = root;
        return { meshes: [root, capsule], animationGroups: [] };
    }

    /**
     * 創建敵人或 NPC (Phase 9: 支援 NPC, Phase 16-2: 支援自定義模型)
     * @param enemyData - Colyseus Schema 對象（具有 onChange 和 listen 方法）
     */
    async createEnemy(enemyData: any, enemyId: string): Promise<EnemyEntity> {
        const entityType = enemyData.type || "enemy";
        const isNPC = entityType === "npc";
        console.log(`${isNPC ? '👔' : '🧟'} Creating ${isNPC ? 'NPC' : 'enemy'}: ${enemyId}`);

        // Phase 16-2: 使用自定義模型或預設模型
        const modelId = enemyData.modelId || "";
        // 檢查是否為空字符串、undefined 或字符串 "undefined"
        const useDefaultModel = !modelId || modelId.trim() === "" || modelId === "undefined";

        console.log(`📦 Model ID for ${enemyId}: raw="${enemyData.modelId}", processed="${modelId}", useDefault=${useDefaultModel}`);

        // 載入 3D 模型（使用跟 PlayerManager 相同的方式）
        // Phase 21: 預設模型來自外部網址（models.babylonjs.com），載入失敗時改用
        // 膠囊體佔位模型，確保實體永遠可見、可點擊（避免「隱形怪」圍攻玩家）
        let result;

        if (useDefaultModel) {
            // 使用預設模型（跟 PlayerManager 完全一樣的方式）
            console.log(`📦 Loading default model from ${modelConfig.baseUrl}${modelConfig.characterModel} for ${enemyId}`);
            try {
                result = await BABYLON.SceneLoader.ImportMeshAsync(
                    "",
                    modelConfig.baseUrl,
                    modelConfig.characterModel,
                    this.scene
                );
            } catch (error) {
                console.warn(`⚠️ Default model failed for ${enemyId}, using capsule placeholder:`, error);
                result = this.createPlaceholderModel(enemyId, isNPC);
            }
        } else {
            // 嘗試載入自定義模型，失敗時使用預設模型
            try {
                console.log(`📦 Loading custom model "${modelId}" for ${enemyId}`);
                result = await BABYLON.SceneLoader.ImportMeshAsync(
                    "",
                    "/models/",
                    `${modelId}.glb`,
                    this.scene
                );
            } catch (error) {
                console.warn(`⚠️ Failed to load custom model "${modelId}", falling back to default:`, error);
                try {
                    result = await BABYLON.SceneLoader.ImportMeshAsync(
                        "",
                        modelConfig.baseUrl,
                        modelConfig.characterModel,
                        this.scene
                    );
                } catch (fallbackError) {
                    console.warn(`⚠️ Default model also failed for ${enemyId}, using capsule placeholder:`, fallbackError);
                    result = this.createPlaceholderModel(enemyId, isNPC);
                }
            }
        }

        const root = result.meshes[0];

        // Phase 16-2: 使用地面高度設置 Y 坐標（跟 PlayerManager 一樣）
        const groundY = this.getGroundHeight(enemyData.x, enemyData.z);
        root.position.set(enemyData.x, groundY, enemyData.z);

        root.scaling.set(modelConfig.characterScale, modelConfig.characterScale, modelConfig.characterScale);
        root.rotationQuaternion = null;
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
        root.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0); // 跟 PlayerManager 一樣

        // Debug: Log complete model info including Y position
        console.log(`✅ ${isNPC ? 'NPC' : 'Enemy'} model loaded: id="${enemyId}"`);
        console.log(`   Position: (${root.position.x.toFixed(1)}, ${root.position.y.toFixed(1)}, ${root.position.z.toFixed(1)}) [groundY=${groundY.toFixed(1)}]`);
        console.log(`   Scale: ${root.scaling.x}, visibility=${root.visibility}, isEnabled=${root.isEnabled()}`);
        console.log(`   meshCount=${result.meshes.length}`);

        // 設置 metadata 以便點擊偵測
        root.metadata = {
            id: enemyId,
            type: entityType,
        };

        // Phase 9: 根據類型應用不同材質
        if (isNPC) {
            this.applyNPCMaterial(root); // NPC 使用藍色/白色發光
        } else {
            this.applyEnemyMaterial(root); // 敵人使用紅色發光
        }

        // 載入動畫
        const idleAnim = result.animationGroups.find((a) => a.name === "Idle");
        const runAnim = result.animationGroups.find((a) => a.name === "Walking");
        const attackAnim = result.animationGroups.find((a) => a.name === "Punching");

        if (idleAnim) idleAnim.play(true);

        // 創建 UI（名稱和血條）- Phase 7: 傳遞等級（敵人通常是 1 級）
        // Phase 14: NPC 名字為白色，只有敵對怪物（gangs）才顯示紅色
        const isHostile = !isNPC; // NPC 不敵對，敵人才敵對
        const ui = this.uiSystem.createEntityUI(root as BABYLON.Mesh, enemyData.name, true, 1, isHostile);

        const entity: EnemyEntity = {
            mesh: root,
            ui,
            idleAnim,
            runAnim,
            attackAnim,
            currentAnim: "idle",
            targetX: enemyData.x,
            targetZ: enemyData.z,
            type: entityType, // Phase 9: 儲存類型
        };

        this.enemies.set(enemyId, entity);

        // Phase 14: 市民 NPC 需要監聽 HP 變化（可被攻擊）
        const isCitizen = enemyId.startsWith("npc_citizen_");
        const isPolice = enemyId.startsWith("npc_police_");

        // Phase 9: 大部分 NPC 不需要監聽位置變化（靜態），但警察會移動
        if (!isNPC || isPolice) {
            // 監聽位置變化
            enemyData.onChange(() => {
                entity.targetX = enemyData.x;
                entity.targetZ = enemyData.z;
            });

            // 監聽狀態變化（閒置、追逐、攻擊）
            enemyData.listen("state", (state: string) => {
                this.updateState(enemyId, state as "idle" | "chase" | "attack");
            });
        }

        // 監聯血量變化（敵人、市民和警察 NPC）
        if (!isNPC || isCitizen || isPolice) {
            enemyData.listen("hp", (currentHp: number) => {
                this.updateHealth(enemyId, currentHp, enemyData.maxHp);
            });
        }

        console.log(`✅ ${isNPC ? 'NPC' : 'Enemy'} created: ${enemyId}`);
        return entity;
    }

    /**
     * 移除敵人
     */
    removeEnemy(enemyId: string): void {
        const entity = this.enemies.get(enemyId);
        if (entity) {
            entity.mesh.dispose();
            entity.ui.container.dispose();
            this.enemies.delete(enemyId);
            console.log(`🗑️ Enemy removed: ${enemyId}`);
        }
    }

    /**
     * 更新所有敵人（每幀調用）- Phase 9: 跳過靜態 NPC, Phase 14: 警察會移動
     */
    updateAll(): void {
        this.enemies.forEach((entity, enemyId) => {
            // Phase 9: 跳過靜態 NPC（商店、任務、市民）
            // Phase 14: 警察 NPC 會移動
            if (entity.type === 'npc' && !enemyId.startsWith("npc_police_")) {
                return;
            }

            const mesh = entity.mesh;
            const dx = entity.targetX - mesh.position.x;
            const dz = entity.targetZ - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.1) {
                // 移動中
                const velocity = new BABYLON.Vector3(dx, -0.5, dz).normalize().scale(0.15);
                if (dist < 0.15) {
                    velocity.scaleInPlace(dist / 0.15);
                }

                // 平滑旋轉
                const targetAngle = Math.atan2(dx, dz);
                mesh.rotation.y = BABYLON.Scalar.Lerp(mesh.rotation.y, targetAngle, 0.2);

                // 移動
                mesh.moveWithCollisions(velocity);

                // 播放跑步動畫
                if (entity.currentAnim !== "run") {
                    entity.idleAnim?.stop();
                    entity.attackAnim?.stop();
                    entity.runAnim?.play(true);
                    entity.currentAnim = "run";
                }
            } else {
                // 靜止
                if (entity.currentAnim !== "idle") {
                    entity.runAnim?.stop();
                    entity.attackAnim?.stop();
                    entity.idleAnim?.play(true);
                    entity.currentAnim = "idle";
                }
            }
        });
    }

    /**
     * 更新敵人血量
     */
    private updateHealth(enemyId: string, currentHp: number, maxHp: number): void {
        const entity = this.enemies.get(enemyId);
        if (entity) {
            const pct = Math.max(0, currentHp / maxHp);
            entity.ui.hpFg.width = `${pct * 80}px`;

            // 死亡時半透明
            if (currentHp <= 0) {
                entity.mesh.visibility = 0.3;
            } else {
                entity.mesh.visibility = 1;
            }
        }
    }

    /**
     * 更新敵人狀態（閒置、追逐、攻擊）
     */
    private updateState(enemyId: string, state: "idle" | "chase" | "attack"): void {
        const entity = this.enemies.get(enemyId);
        if (!entity) return;

        // 根據狀態切換動畫
        if (state === "attack" && entity.currentAnim !== "attack") {
            entity.idleAnim?.stop();
            entity.runAnim?.stop();
            entity.attackAnim?.play(true);
            entity.currentAnim = "attack";
        } else if (state === "idle" && entity.currentAnim !== "idle") {
            entity.runAnim?.stop();
            entity.attackAnim?.stop();
            entity.idleAnim?.play(true);
            entity.currentAnim = "idle";
        }
        // chase 狀態由 updateAll 中的移動邏輯處理
    }

    /**
     * 為敵人應用紅色材質（區分玩家和敵人）
     */
    private applyEnemyMaterial(root: BABYLON.AbstractMesh): void {
        const meshes = root.getChildMeshes();
        meshes.forEach((mesh) => {
            if (mesh.material) {
                // 克隆材質以避免影響其他模型
                const newMat = mesh.material.clone(`enemyMat_${root.name}`);
                if (newMat && "emissiveColor" in newMat) {
                    (newMat as any).emissiveColor = new BABYLON.Color3(0.5, 0, 0); // 紅色發光
                }
                mesh.material = newMat;
            }
        });
    }

    /**
     * 為 NPC 應用藍色/白色材質 (Phase 9)
     */
    private applyNPCMaterial(root: BABYLON.AbstractMesh): void {
        const meshes = root.getChildMeshes();
        meshes.forEach((mesh) => {
            if (mesh.material) {
                // 克隆材質以避免影響其他模型
                const newMat = mesh.material.clone(`npcMat_${root.name}`);
                if (newMat && "emissiveColor" in newMat) {
                    (newMat as any).emissiveColor = new BABYLON.Color3(0.3, 0.5, 1); // 藍色發光
                }
                mesh.material = newMat;
            }
        });
    }

    /**
     * 獲取敵人實體
     */
    getEntity(enemyId: string): EnemyEntity | undefined {
        return this.enemies.get(enemyId);
    }

    /**
     * 獲取所有敵人
     */
    getAllEnemies(): Map<string, EnemyEntity> {
        return this.enemies;
    }
}
