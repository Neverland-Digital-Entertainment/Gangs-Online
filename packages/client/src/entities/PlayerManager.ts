import * as BABYLON from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core";
import { PlayerData } from "@gangs-online/shared";
import { PlayerEntity, PlayerTarget } from "../types";
import { UISystem } from "../systems/UISystem";
import { WeaponSystem } from "../systems/WeaponSystem";
import { NavigationSystem, NavPoint } from "../systems/NavigationSystem";
import { modelConfig, config, characterCollisionConfig } from "../config";

/** 連續幾多幀幾乎郁唔到就當卡住 */
const STUCK_FRAMES = 20;

/**
 * 玩家管理器
 * 負責創建、更新和管理所有玩家實體
 */
export class PlayerManager {
    private scene: BABYLON.Scene;
    private uiSystem: UISystem;
    private weaponSystem: WeaponSystem;
    private navigation: NavigationSystem;
    private playerEntities: { [sessionId: string]: PlayerEntity } = {};
    private playerTargets: { [sessionId: string]: PlayerTarget } = {};
    /** resolveDestination 搵到的路：伺服器回傳同一個目標時直接用，唔使再搵多次 */
    private resolvedPaths: { [sessionId: string]: { from: NavPoint; path: NavPoint[] } } = {};
    /** 今幀 moveWithCollisions 撞到的 mesh（Debug：卡住時顯示係乜嘢擋住） */
    private lastCollision: { [sessionId: string]: BABYLON.AbstractMesh | null } = {};
    private groundMeshes: BABYLON.AbstractMesh[] = []; // Phase 15: 地面偵測用

    constructor(scene: BABYLON.Scene, uiSystem: UISystem, weaponSystem: WeaponSystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
        this.weaponSystem = weaponSystem;
        this.navigation = new NavigationSystem(
            scene,
            (mesh) => this.isGroundMesh(mesh),
            (x, z) => this.getGroundHeight(x, z)
        );
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
        const hit = this.scene.pickWithRay(ray, (mesh) => this.isGroundMesh(mesh));

        if (hit?.hit && hit.pickedPoint) {
            return hit.pickedPoint.y;
        }

        // 如果沒偵測到地面，返回 0
        return 0;
    }

    /** 是否地面：在地面列表中，或是 T 開頭的地形 */
    private isGroundMesh(mesh: BABYLON.AbstractMesh): boolean {
        return this.groundMeshes.includes(mesh) ||
               mesh.name.toUpperCase().startsWith("T") ||
               mesh.metadata?.type === "terrain";
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
        const cc = characterCollisionConfig;
        root.ellipsoid = new BABYLON.Vector3(cc.radius, cc.halfHeight, cc.radius);
        root.ellipsoidOffset = new BABYLON.Vector3(0, cc.halfHeight + cc.stepHeight, 0);

        // Store SessionId on the mesh for Raycasting (IMPORTANT for attack detection)
        root.metadata = { sessionId };
        root.onCollideObservable.add((mesh) => {
            this.lastCollision[sessionId] = mesh;
        });

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
        this.playerTargets[sessionId] = {
            x: player.x, z: player.z, waypoints: [], stuckFrames: 0, replanned: false, blockedBy: null,
        };

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
            delete this.resolvedPaths[sessionId];
            delete this.lastCollision[sessionId];
        }
    }

    /**
     * 更新玩家目標位置
     */
    updateTarget(sessionId: string, x: number, z: number): void {
        const target = this.playerTargets[sessionId];
        const entity = this.playerEntities[sessionId];
        if (!target || !entity) return;
        // onChange 喺任何欄位（例如血量）變都會觸發，位置冇變就唔使重新搵路
        if (target.x === x && target.z === z) return;

        target.x = x;
        target.z = z;
        target.replanned = false;
        this.planPath(sessionId, entity, target);
    }

    /**
     * 撳地圖行路前用：目標行唔到（例如喺大廈入面）就改為最接近而又行得到的位置，
     * 伺服器記錄的位置先會同角色實際停低的地方一致。
     */
    resolveDestination(sessionId: string, x: number, z: number): NavPoint {
        const entity = this.playerEntities[sessionId];
        if (!entity) return { x, z };
        const from = { x: entity.mesh.position.x, z: entity.mesh.position.z };
        const path = this.navigation.findPath(from, { x, z });
        if (!path) return { x, z };
        this.resolvedPaths[sessionId] = { from, path };
        return path[path.length - 1];
    }

    /** 由角色而家的位置搵路去 target；搵唔到就照舊直線行 */
    private planPath(sessionId: string, entity: PlayerEntity, target: PlayerTarget): void {
        const pos = entity.mesh.position;
        target.stuckFrames = 0;

        // 等伺服器回傳期間角色仲未郁得遠，撳嗰陣搵到的路照用
        const resolved = this.resolvedPaths[sessionId];
        delete this.resolvedPaths[sessionId];
        const end = resolved?.path[resolved.path.length - 1];
        if (resolved && end && end.x === target.x && end.z === target.z &&
            Math.hypot(pos.x - resolved.from.x, pos.z - resolved.from.z) < 1) {
            target.waypoints = resolved.path;
            return;
        }

        const path = this.navigation.findPath({ x: pos.x, z: pos.z }, { x: target.x, z: target.z });
        target.waypoints = path ?? [{ x: target.x, z: target.z }];
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
            const target = this.playerTargets[sessionId];
            if (target) {
                target.x = x;
                target.z = z;
                target.waypoints = [];
                target.stuckFrames = 0;
                target.blockedBy = null;
            }
            delete this.resolvedPaths[sessionId];

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
                const waypoints = target.waypoints;

                // 到咗中途轉角點就轉去下一點；最後一點先要準確停低
                while (
                    waypoints.length > 1 &&
                    Math.hypot(waypoints[0].x - mesh.position.x, waypoints[0].z - mesh.position.z) <= config.moveSpeed
                ) {
                    waypoints.shift();
                }

                // Calculate direction vector
                const next = waypoints[0];
                const dx = next ? next.x - mesh.position.x : 0;
                const dz = next ? next.z - mesh.position.z : 0;
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

                    // Look at target（行最短的角度轉身，唔會由 170° 兜一個大圈轉去 -170°）
                    const targetAngle = Math.atan2(dx, dz);
                    mesh.rotation.y = BABYLON.Scalar.LerpAngle(mesh.rotation.y, targetAngle, 0.2);

                    // Phase 15: 使用 moveWithCollisions 處理碰撞（搵路之外的保險，例如貼住牆角滑過去）
                    const prevX = mesh.position.x;
                    const prevZ = mesh.position.z;
                    this.lastCollision[sessionId] = null;
                    mesh.moveWithCollisions(velocity);
                    const moved = Math.hypot(mesh.position.x - prevX, mesh.position.z - prevZ);
                    this.checkStuck(sessionId, entity, target, moved, velocity.length());

                    // Play Run Animation
                    if (entity.currentAnim !== "run") {
                        if (entity.idleAnim) entity.idleAnim.stop();
                        if (entity.runAnim) entity.runAnim.play(true);
                        entity.currentAnim = "run";
                    }
                } else {
                    waypoints.length = 0;

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
     * 撞到搵路唔知道的嘢（例如之後先載入的碰撞體）會原地踏步：先由而家的位置
     * 重新搵一次路，再卡住就停低，唔好一直對住牆跑。
     */
    private checkStuck(
        sessionId: string,
        entity: PlayerEntity,
        target: PlayerTarget,
        moved: number,
        expected: number
    ): void {
        if (moved >= expected * 0.3) {
            target.stuckFrames = 0;
            target.blockedBy = null;
            return;
        }
        if (++target.stuckFrames < STUCK_FRAMES) return;

        // Debug：記低係乜嘢擋住（Debug 面板會顯示），換咗另一樣嘢擋住先再印 log
        const hit = this.lastCollision[sessionId];
        const blockedBy = hit ? this.describeObstacle(hit) : null;
        if (blockedBy && blockedBy !== target.blockedBy) {
            target.blockedBy = blockedBy;
            const p = entity.mesh.position;
            console.warn(
                `🚧 [PlayerManager] ${sessionId} 卡住喺 (${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)})，` +
                    `擋住佢的係 ${target.blockedBy}`,
                hit?.metadata ?? {}
            );
        }

        if (!target.replanned) {
            target.replanned = true;
            this.planPath(sessionId, entity, target);
        } else {
            target.waypoints = [];
            target.stuckFrames = 0;
        }
    }

    /** 擋路 mesh 的描述：地形多數係行人路邊等高低級，其他係大廈／道具的碰撞方塊 */
    private describeObstacle(mesh: BABYLON.AbstractMesh): string {
        const bb = mesh.getBoundingInfo().boundingBox;
        const kind = this.isGroundMesh(mesh) ? "地形" : mesh.metadata?.isOverrideCollider ? "覆蓋層碰撞方塊" : "mesh";
        return `${kind} ${mesh.name}（y ${bb.minimumWorld.y.toFixed(2)}～${bb.maximumWorld.y.toFixed(2)}）`;
    }

    /** 角色而家卡住的話，回傳擋住佢的嘢（Debug 面板用）；冇卡住回傳 null */
    getBlockedBy(sessionId: string): string | null {
        return this.playerTargets[sessionId]?.blockedBy ?? null;
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
