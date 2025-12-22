import * as BABYLON from "@babylonjs/core";
import { Room } from "colyseus.js";
import { ILootData } from "@gangs-online/shared";
import { SoundManager } from "../systems/SoundManager";
import { ParticleSystem } from "../systems/ParticleSystem";

/**
 * LootManager - Phase 8 (Updated in Phase 11)
 * 管理場景中的戰利品視覺效果和互動
 */
export class LootManager {
    private scene: BABYLON.Scene;
    private room: Room;
    private lootMeshes: Map<string, BABYLON.Mesh> = new Map();
    private lootData: Map<string, ILootData> = new Map(); // Phase 11: 保存戰利品數據
    private soundManager: SoundManager | null = null; // Phase 11
    private particleSystem: ParticleSystem | null = null; // Phase 11

    constructor(
        scene: BABYLON.Scene,
        room: Room,
        soundManager?: SoundManager,
        particleSystem?: ParticleSystem
    ) {
        this.scene = scene;
        this.room = room;
        this.soundManager = soundManager || null;
        this.particleSystem = particleSystem || null;
        this.setupLootListeners();
    }

    /**
     * 設置戰利品的 Colyseus 監聽器
     */
    private setupLootListeners(): void {
        // 戰利品生成時
        this.room.state.lootItems.onAdd((loot: ILootData, lootId: string) => {
            this.lootData.set(lootId, loot); // Phase 11: 保存戰利品數據
            this.createLootMesh(loot, lootId);
        });

        // 戰利品移除時（被拾取或過期）
        this.room.state.lootItems.onRemove((loot: ILootData, lootId: string) => {
            this.removeLootMesh(lootId, true); // Phase 11: 播放拾取效果
        });
    }

    /**
     * 創建戰利品的 3D 網格
     */
    private createLootMesh(loot: ILootData, lootId: string): void {
        // 創建一個發光的盒子作為戰利品
        const box = BABYLON.MeshBuilder.CreateBox(
            `loot_${lootId}`,
            { size: 0.5 },
            this.scene
        );

        box.position.set(loot.x, 0.5, loot.z);
        box.metadata = { lootId, type: "loot" };

        // 根據物品類型設置顏色
        const material = new BABYLON.StandardMaterial(`lootMat_${lootId}`, this.scene);

        if (loot.item.type === "currency") {
            // 金錢 - 金色
            material.emissiveColor = BABYLON.Color3.Yellow();
            material.diffuseColor = BABYLON.Color3.Yellow();
        } else {
            // 消耗品 - 青色
            material.emissiveColor = BABYLON.Color3.Teal();
            material.diffuseColor = BABYLON.Color3.Teal();
        }

        box.material = material;

        // 添加旋轉動畫
        this.scene.registerBeforeRender(() => {
            if (box && !box.isDisposed()) {
                box.rotation.y += 0.05;
                // 上下浮動效果
                box.position.y = 0.5 + Math.sin(Date.now() * 0.003) * 0.2;
            }
        });

        // 保存引用
        this.lootMeshes.set(lootId, box);
    }

    /**
     * 移除戰利品網格
     * @param lootId 戰利品 ID
     * @param playEffects 是否播放拾取效果（Phase 11）
     */
    private removeLootMesh(lootId: string, playEffects: boolean = false): void {
        const mesh = this.lootMeshes.get(lootId);
        const loot = this.lootData.get(lootId);

        if (mesh) {
            // Phase 11: 播放拾取效果
            if (playEffects && loot) {
                const position = mesh.position.clone();
                const isCurrency = loot.item.type === "currency";

                // 播放拾取音效
                if (this.soundManager) {
                    this.soundManager.playPickupSound();
                }

                // 播放拾取粒子效果
                if (this.particleSystem) {
                    this.particleSystem.createPickupEffect(position, isCurrency);
                }
            }

            mesh.dispose();
            this.lootMeshes.delete(lootId);
            this.lootData.delete(lootId);
        }
    }

    /**
     * 清理所有戰利品（當離開房間時調用）
     */
    dispose(): void {
        this.lootMeshes.forEach((mesh) => {
            mesh.dispose();
        });
        this.lootMeshes.clear();
        this.lootData.clear(); // Phase 11: 清理戰利品數據
    }

    /**
     * 檢查點擊的網格是否為戰利品
     */
    isLootMesh(mesh: BABYLON.AbstractMesh): boolean {
        return mesh.metadata?.type === "loot";
    }

    /**
     * 獲取戰利品 ID
     */
    getLootId(mesh: BABYLON.AbstractMesh): string | null {
        return mesh.metadata?.lootId || null;
    }
}
