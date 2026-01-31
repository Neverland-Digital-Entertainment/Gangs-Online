/**
 * NPC Service - Firebase NPC 資料管理 (Phase 16-2)
 *
 * 負責：
 * 1. 從 Firebase npc_templates 和 npc_instances 集合載入 NPC 定義
 * 2. 將模板和實例數據組合成完整的 NPC 數據
 * 3. 支持對話樹系統
 */
import { getFirestore, isFirebaseInitialized } from "./FirebaseService";
import { INPCData, INPCTemplate, INPCInstance, NPCType, NPCStatus, DialogueTree } from "@gangs-online/shared";

/**
 * 安全地將 Firestore Timestamp 轉換為 Date
 * 支援多種格式：Date、Timestamp with toDate()、Plain Object with seconds
 */
function convertToDate(value: any): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    return new Date();
}

/**
 * 完整的 NPC 數據（模板 + 實例）
 */
interface NPCCompleteData extends INPCData {
    templateId: string;
    instanceId: string;
    level: number;
    rotation: number;
    interactionRadius: number;
    modelId?: string;
}

class NPCService {
    private npcCache: Map<string, NPCCompleteData> = new Map();
    private templateCache: Map<string, INPCTemplate> = new Map();
    private instanceCache: Map<string, INPCInstance> = new Map();
    private initialized: boolean = false;

    /**
     * 初始化 NPC 服務，從 Firebase 載入模板和實例
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const db = getFirestore();
        if (!db || !isFirebaseInitialized()) {
            console.warn("[NPCService] Firebase not initialized, no NPCs will be loaded");
            this.initialized = true;
            return;
        }

        try {
            // 載入模板
            const templatesSnapshot = await db.collection("npc_templates").get();
            templatesSnapshot.forEach((doc) => {
                const data = doc.data();
                const template: INPCTemplate = {
                    id: doc.id,
                    name: data.name,
                    type: data.type,
                    modelId: data.modelId ? data.modelId : undefined,
                    description: data.description,
                    baseHp: data.baseHp,
                    baseAttack: data.baseAttack,
                    baseDefense: data.baseDefense,
                    baseSpeed: data.baseSpeed,
                    combatType: data.combatType,
                    attackRange: data.attackRange,
                    dialogueTree: data.dialogueTree,
                    createdAt: convertToDate(data.createdAt),
                    updatedAt: convertToDate(data.updatedAt),
                    isActive: data.isActive ?? true,
                };
                this.templateCache.set(doc.id, template);
            });

            // 載入實例
            const instancesSnapshot = await db.collection("npc_instances").get();
            instancesSnapshot.forEach((doc) => {
                const data = doc.data();
                const instance: INPCInstance = {
                    id: doc.id,
                    templateId: data.templateId,
                    positionX: data.positionX,
                    positionZ: data.positionZ,
                    rotation: data.rotation || 0,
                    level: data.level,
                    interactionRadius: data.interactionRadius || 2,
                    movementPattern: data.movementPattern || 'STATIC',
                    wanderRadius: data.wanderRadius,
                    wanderCenter: data.wanderCenter,
                    patrolWaypoints: data.patrolWaypoints,
                    aggroRange: data.aggroRange,
                    chaseDistance: data.chaseDistance,
                    shopId: data.shopId,
                    isAttackable: data.isAttackable ?? true,
                    mapId: data.mapId,
                    territoryId: data.territoryId,
                    createdAt: convertToDate(data.createdAt),
                    updatedAt: convertToDate(data.updatedAt),
                    isActive: data.isActive ?? true,
                };
                this.instanceCache.set(doc.id, instance);
            });

            // 組合模板和實例數據
            this.combineTemplatesAndInstances();

            console.log(`✅ [NPCService] Loaded ${this.templateCache.size} templates and ${this.instanceCache.size} instances`);
            console.log(`✅ [NPCService] Created ${this.npcCache.size} complete NPCs`);

            this.initialized = true;
        } catch (error) {
            console.error("[NPCService] Failed to load NPCs from Firebase:", error);
            this.initialized = true;
        }
    }

    /**
     * 組合模板和實例數據
     */
    private combineTemplatesAndInstances(): void {
        this.npcCache.clear();

        console.log(`📋 [NPCService] Combining templates and instances...`);
        console.log(`📋 [NPCService] Available templates: ${Array.from(this.templateCache.keys()).join(', ') || '(none)'}`);
        console.log(`📋 [NPCService] Available instances: ${Array.from(this.instanceCache.keys()).join(', ') || '(none)'}`);

        this.instanceCache.forEach((instance) => {
            const template = this.templateCache.get(instance.templateId);
            if (!template) {
                console.warn(`⚠️ [NPCService] Template "${instance.templateId}" not found for instance "${instance.id}" - skipping`);
                return;
            }

            // 只載入啟用的模板和實例
            if (!template.isActive) {
                console.log(`⏭️ [NPCService] Template "${template.name}" is inactive - skipping instance "${instance.id}"`);
                return;
            }
            if (!instance.isActive) {
                console.log(`⏭️ [NPCService] Instance "${instance.id}" is inactive - skipping`);
                return;
            }

            // 計算實際的 HP 和攻擊力（基於等級）
            const levelMultiplier = 1 + (instance.level - 1) * 0.1;
            const hp = Math.floor(template.baseHp * levelMultiplier);
            const attack = Math.floor(template.baseAttack * levelMultiplier);

            const npcData: NPCCompleteData = {
                id: instance.id,
                templateId: instance.templateId,
                instanceId: instance.id,
                type: template.type,
                name: `${template.name} Lv.${instance.level}`,
                hp,
                attack,
                modelId: template.modelId ? template.modelId : undefined,
                dialogueTree: template.dialogueTree,
                spawnX: instance.positionX,
                spawnZ: instance.positionZ,
                level: instance.level,
                rotation: instance.rotation,
                interactionRadius: instance.interactionRadius,
                status: 'active',
            };

            this.npcCache.set(instance.id, npcData);
        });
    }

    /**
     * 獲取所有 NPC 定義
     */
    getAllNPCs(): INPCData[] {
        return Array.from(this.npcCache.values());
    }

    /**
     * 獲取所有活躍的 NPC
     */
    getActiveNPCs(): INPCData[] {
        return Array.from(this.npcCache.values()).filter(
            (npc) => npc.status === "active"
        );
    }

    /**
     * 根據類型獲取 NPC
     */
    getNPCsByType(type: NPCType): INPCData[] {
        return Array.from(this.npcCache.values()).filter((npc) => npc.type === type);
    }

    /**
     * 根據類型獲取活躍的 NPC
     */
    getActiveNPCsByType(type: NPCType): INPCData[] {
        return Array.from(this.npcCache.values()).filter(
            (npc) => npc.type === type && npc.status === "active"
        );
    }

    /**
     * 獲取單個 NPC 定義
     */
    getNPC(id: string): INPCData | undefined {
        return this.npcCache.get(id);
    }

    /**
     * 獲取 NPC 模板
     */
    getTemplate(templateId: string): INPCTemplate | undefined {
        return this.templateCache.get(templateId);
    }

    /**
     * 獲取 NPC 實例
     */
    getInstance(instanceId: string): INPCInstance | undefined {
        return this.instanceCache.get(instanceId);
    }

    /**
     * 動態新增 NPC（不寫入 Firebase）
     */
    addNPC(npc: INPCData): void {
        this.npcCache.set(npc.id, npc as NPCCompleteData);
    }

    /**
     * 重新載入 NPC（從 Firebase）
     */
    async reload(): Promise<void> {
        this.initialized = false;
        this.npcCache.clear();
        this.templateCache.clear();
        this.instanceCache.clear();
        await this.initialize();
    }
}

export const npcService = new NPCService();
