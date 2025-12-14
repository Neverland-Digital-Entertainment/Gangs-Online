import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { IEnemyData } from "@gangs-online/shared";
import { UISystem } from "../systems/UISystem";

/**
 * 敵人實體介面
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
}

/**
 * EnemyManager - 客戶端敵人管理系統
 * 負責：
 * 1. 敵人視覺化（3D 模型、UI）
 * 2. 敵人動畫
 * 3. 敵人移動同步
 */
export class EnemyManager {
    private scene: BABYLON.Scene;
    private uiSystem: UISystem;
    private enemies: Map<string, EnemyEntity> = new Map();

    constructor(scene: BABYLON.Scene, uiSystem: UISystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
    }

    /**
     * 創建敵人
     * @param enemyData - Colyseus Schema 對象（具有 onChange 和 listen 方法）
     */
    async createEnemy(enemyData: any, enemyId: string): Promise<EnemyEntity> {
        console.log(`🧟 Creating enemy: ${enemyId}`);

        // 載入 3D 模型
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "https://models.babylonjs.com/",
            "HVGirl.glb",
            this.scene
        );

        const root = result.meshes[0];
        root.position.set(enemyData.x, 0.1, enemyData.z);
        root.scaling.set(0.15, 0.15, 0.15);
        root.rotationQuaternion = null;
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);

        // 設置 metadata 以便點擊偵測
        root.metadata = {
            id: enemyId,
            type: "enemy",
        };

        // 為敵人添加紅色發光效果
        this.applyEnemyMaterial(root);

        // 載入動畫
        const idleAnim = result.animationGroups.find((a) => a.name === "Idle");
        const runAnim = result.animationGroups.find((a) => a.name === "Walking");
        const attackAnim = result.animationGroups.find((a) => a.name === "Punching");

        if (idleAnim) idleAnim.play(true);

        // 創建 UI（名稱和血條）
        const ui = this.uiSystem.createEntityUI(root as BABYLON.Mesh, enemyData.name, true);

        const entity: EnemyEntity = {
            mesh: root,
            ui,
            idleAnim,
            runAnim,
            attackAnim,
            currentAnim: "idle",
            targetX: enemyData.x,
            targetZ: enemyData.z,
        };

        this.enemies.set(enemyId, entity);

        // 監聽位置變化
        enemyData.onChange(() => {
            entity.targetX = enemyData.x;
            entity.targetZ = enemyData.z;
        });

        // 監聽血量變化
        enemyData.listen("hp", (currentHp: number) => {
            this.updateHealth(enemyId, currentHp, enemyData.maxHp);
        });

        // 監聽狀態變化（閒置、追逐、攻擊）
        enemyData.listen("state", (state: string) => {
            this.updateState(enemyId, state as "idle" | "chase" | "attack");
        });

        console.log(`✅ Enemy created: ${enemyId}`);
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
     * 更新所有敵人（每幀調用）
     */
    updateAll(): void {
        this.enemies.forEach((entity, enemyId) => {
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
