import * as BABYLON from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core";
import { PlayerData } from "@gangs-online/shared";
import { PlayerEntity, PlayerTarget } from "../types";
import { UISystem } from "../systems/UISystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import { modelConfig, config } from "../config";

/**
 * 玩家管理器
 * 負責創建、更新和管理所有玩家實體
 */
export class PlayerManager {
    private scene: BABYLON.Scene;
    private uiSystem: UISystem;
    private weaponSystem: WeaponSystem;
    private playerEntities: { [sessionId: string]: PlayerEntity } = {};
    private playerTargets: { [sessionId: string]: PlayerTarget } = {};
    private groundMeshes: BABYLON.AbstractMesh[] = []; // Phase 15: 地面偵測用

    constructor(scene: BABYLON.Scene, uiSystem: UISystem, weaponSystem: WeaponSystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
        this.weaponSystem = weaponSystem;
    }

    /**
     * Phase 15: 設定可行走的地面 mesh（用於地面偵測）
     */
    setGroundMeshes(meshes: BABYLON.AbstractMesh[]): void {
        this.groundMeshes = meshes;
        console.log(`🌍 [PlayerManager] Ground meshes set: ${meshes.length}`);
    }

    /**
     * Phase 15: 獲取指定位置的地面高度
     * 使用射線從上往下偵測
     */
    getGroundHeight(x: number, z: number): number {
        // 從高處往下發射射線
        const rayOrigin = new BABYLON.Vector3(x, 500, z);
        const rayDirection = new BABYLON.Vector3(0, -1, 0);
        const ray = new BABYLON.Ray(rayOrigin, rayDirection, 1000);

        // 只檢測地面 mesh
        const predicate = (mesh: BABYLON.AbstractMesh) => {
            // 檢查是否在地面列表中，或是 T 開頭的地形
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
     * 創建玩家實體
     */
    async createPlayer(
        player: PlayerData,
        sessionId: string,
        isSelf: boolean
    ): Promise<PlayerEntity> {
        console.log(`🎭 Creating player: ${sessionId}, isSelf: ${isSelf}`);

        // --- LOAD 3D MODEL ---
        console.log(`📦 Loading 3D model from ${modelConfig.baseUrl}${modelConfig.characterModel}`);
        const result = await SceneLoader.ImportMeshAsync(
            "",
            modelConfig.baseUrl,
            modelConfig.characterModel,
            this.scene
        );
        console.log(`✅ Model loaded, meshes count: ${result.meshes.length}`);

        const root = result.meshes[0];
        // Start slightly above ground to prevent getting stuck immediately
        root.position.set(player.x, 0.1, player.z);
        root.scaling.set(modelConfig.characterScale, modelConfig.characterScale, modelConfig.characterScale);
        root.rotationQuaternion = null; // Allow manual rotation

        // --- COLLISION SETUP ---
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
        root.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);

        // Store SessionId on the mesh for Raycasting (IMPORTANT for attack detection)
        root.metadata = { sessionId };

        // ATTACH WEAPON
        this.weaponSystem.attachWeapon(root, result.meshes[1], this.scene);

        // --- ANIMATIONS ---
        const idle = result.animationGroups.find((a) => a.name === "Idle");
        const run = result.animationGroups.find((a) => a.name === "Walking");

        if (idle) idle.play(true); // Start Idle by default

        // UI (Name + HP Bar) - 為所有玩家創建頭頂 UI，顯示名字和血條
        const ui = this.uiSystem.createPlayerUI(root, player.name);

        const entity: PlayerEntity = {
            mesh: root,
            ui,
            idleAnim: idle,
            runAnim: run,
            currentAnim: "idle",
        };

        this.playerEntities[sessionId] = entity;
        this.playerTargets[sessionId] = { x: player.x, z: player.z };

        console.log(`✅ Player created successfully: ${sessionId}`);
        console.log(`   Position: (${player.x}, ${player.z})`);
        console.log(`   Total players: ${Object.keys(this.playerEntities).length}`);

        return entity;
    }

    /**
     * 移除玩家
     */
    removePlayer(sessionId: string): void {
        const entity = this.playerEntities[sessionId];
        if (entity) {
            entity.mesh.dispose();
            entity.ui?.container?.dispose();
            entity.idleAnim?.stop();
            entity.idleAnim?.dispose();
            entity.runAnim?.stop();
            entity.runAnim?.dispose();

            delete this.playerEntities[sessionId];
            delete this.playerTargets[sessionId];
        }
    }

    /**
     * 更新玩家目標位置
     */
    updateTarget(sessionId: string, x: number, z: number): void {
        if (this.playerTargets[sessionId]) {
            this.playerTargets[sessionId].x = x;
            this.playerTargets[sessionId].z = z;
        }
    }

    /**
     * Phase 14: 瞬間傳送玩家（跳過移動動畫）
     * 用於監獄傳送等需要立即移動的情況
     */
    teleportPlayer(sessionId: string, x: number, z: number): void {
        const entity = this.playerEntities[sessionId];
        if (entity) {
            // 立即設置 mesh 位置
            entity.mesh.position.x = x;
            entity.mesh.position.z = z;

            // 同步更新目標位置，避免之後又走回去
            if (this.playerTargets[sessionId]) {
                this.playerTargets[sessionId].x = x;
                this.playerTargets[sessionId].z = z;
            }

            // 切換到 idle 動畫
            if (entity.currentAnim !== "idle") {
                if (entity.runAnim) entity.runAnim.stop();
                if (entity.idleAnim) entity.idleAnim.play(true);
                entity.currentAnim = "idle";
            }

            console.log(`🚀 [Teleport] Player ${sessionId} teleported to (${x}, ${z})`);
        }
    }

    /**
     * 更新玩家血量顯示
     */
    updateHealth(sessionId: string, currentHp: number, maxHp: number): void {
        const entity = this.playerEntities[sessionId];
        if (entity) {
            // 只為有 UI 的玩家（其他玩家）更新頭頂血條
            if (entity.ui) {
                this.uiSystem.updateHealthBar(entity.ui, currentHp, maxHp);
            }

            // Visual Feedback: Turn semi-transparent if dead
            if (currentHp <= 0) {
                entity.mesh.visibility = 0.3; // Ghost mode
                console.log(`Player ${sessionId} is dead`);
            } else {
                entity.mesh.visibility = 1;
            }
        }
    }

    /**
     * 更新戰鬥狀態
     */
    updateCombatState(sessionId: string, inCombat: boolean): void {
        const entity = this.playerEntities[sessionId];
        if (entity?.ui) {
            this.uiSystem.setCombatIndicator(entity.ui, inCombat);
        }
    }

    /**
     * 更新所有玩家的移動和動畫
     */
    updateAll(): void {
        for (const sessionId in this.playerEntities) {
            const entity = this.playerEntities[sessionId];
            const target = this.playerTargets[sessionId];

            if (entity && target) {
                const mesh = entity.mesh;

                // Calculate direction vector
                const dx = target.x - mesh.position.x;
                const dz = target.z - mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Threshold to stop moving
                if (dist > 0.1) {
                    // --- MOVEMENT WITH COLLISIONS ---
                    const velocity = new BABYLON.Vector3(dx, 0, dz)
                        .normalize()
                        .scale(config.moveSpeed);

                    // If close to target, clamp velocity to avoid overshooting
                    if (dist < config.moveSpeed) {
                        velocity.scaleInPlace(dist / config.moveSpeed);
                    }

                    // Look at target
                    const targetAngle = Math.atan2(dx, dz);
                    const currentRotation = mesh.rotation.y;
                    mesh.rotation.y = BABYLON.Scalar.Lerp(currentRotation, targetAngle, 0.2);

                    // Phase 15: 使用 moveWithCollisions 處理碰撞
                    mesh.moveWithCollisions(velocity);

                    // Play Run Animation
                    if (entity.currentAnim !== "run") {
                        if (entity.idleAnim) entity.idleAnim.stop();
                        if (entity.runAnim) entity.runAnim.play(true);
                        entity.currentAnim = "run";
                    }
                } else {
                    // Stop: Play Idle
                    if (entity.currentAnim !== "idle") {
                        if (entity.runAnim) entity.runAnim.stop();
                        if (entity.idleAnim) entity.idleAnim.play(true);
                        entity.currentAnim = "idle";
                    }
                }

                // Phase 15: 地面偵測 - 讓角色貼地行走
                const groundY = this.getGroundHeight(mesh.position.x, mesh.position.z);
                // 平滑過渡到地面高度
                mesh.position.y = BABYLON.Scalar.Lerp(mesh.position.y, groundY, 0.3);
            }
        }
    }

    /**
     * 獲取玩家實體
     */
    getEntity(sessionId: string): PlayerEntity | undefined {
        return this.playerEntities[sessionId];
    }

    /**
     * 獲取所有玩家實體
     */
    getAllEntities(): { [sessionId: string]: PlayerEntity } {
        return this.playerEntities;
    }
}
