/**
 * NPC Service - Firebase NPC 資料管理 (Phase 14)
 *
 * 負責：
 * 1. 從 Firebase npcs 集合載入 NPC 定義
 * 2. 提供 NPC 資料查詢
 */
import { getFirestore, isFirebaseInitialized } from "./FirebaseService";
import { INPCData, NPCType } from "@gangs-online/shared";

/**
 * 預設 NPC 定義（當 Firebase 不可用時使用）
 */
const DEFAULT_NPCS: INPCData[] = [
    // 商店 NPC
    {
        id: "npc_shopkeeper",
        type: "shop",
        name: "十三叔 (Shop)",
        hp: 9999,
        attack: 0,
        dialogue: "歡迎光臨！有咩幫到你？",
        spawnX: 0,
        spawnZ: 0,
    },
    // 任務 NPC
    {
        id: "npc_quest",
        type: "quest",
        name: "浩南 (Quest)",
        hp: 9999,
        attack: 0,
        dialogue: "你想搵啲任務做？",
        relatedQuests: ["kill_enemies"],
        spawnX: 5,
        spawnZ: 5,
    },
    // 市民 NPC
    {
        id: "npc_citizen_1",
        type: "citizen",
        name: "路人甲",
        hp: 30,
        attack: 0,
        dialogue: "唔好搞我！",
        spawnX: -10,
        spawnZ: 8,
    },
    {
        id: "npc_citizen_2",
        type: "citizen",
        name: "阿婆",
        hp: 30,
        attack: 0,
        dialogue: "年輕人，唔好學人打打殺殺！",
        spawnX: 12,
        spawnZ: -5,
    },
    {
        id: "npc_citizen_3",
        type: "citizen",
        name: "學生仔",
        hp: 30,
        attack: 0,
        dialogue: "我要返學喇！",
        spawnX: -8,
        spawnZ: -12,
    },
    // 警察 NPC - Phase 14: 警察很難被打敗（高 HP、高攻擊）
    {
        id: "npc_police_1",
        type: "police",
        name: "警察",
        hp: 500, // 很高的血量，需要多人聯手或高級裝備才能打敗
        attack: 35, // 較高的攻擊力
        spawnX: 15,
        spawnZ: 15,
    },
    {
        id: "npc_police_2",
        type: "police",
        name: "警察",
        hp: 500,
        attack: 35,
        spawnX: -15,
        spawnZ: 15,
    },
];

class NPCService {
    private npcCache: Map<string, INPCData> = new Map();
    private initialized: boolean = false;

    /**
     * 初始化 NPC 服務，從 Firebase 載入 NPC 定義
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const db = getFirestore();
        if (!db || !isFirebaseInitialized()) {
            console.warn("[NPCService] Firebase not initialized, using default NPCs");
            this.loadDefaultNPCs();
            this.initialized = true;
            return;
        }

        try {
            const snapshot = await db.collection("npcs").get();

            if (snapshot.empty) {
                console.log("[NPCService] No NPCs in Firebase, seeding default data...");
                await this.seedDefaultNPCs();
            } else {
                snapshot.forEach((doc) => {
                    const data = doc.data() as INPCData;
                    data.id = doc.id;
                    this.npcCache.set(doc.id, data);
                });
                console.log(`[NPCService] Loaded ${this.npcCache.size} NPCs from Firebase`);
            }

            this.initialized = true;
        } catch (error) {
            console.error("[NPCService] Failed to load NPCs from Firebase:", error);
            this.loadDefaultNPCs();
            this.initialized = true;
        }
    }

    /**
     * 載入預設 NPC
     */
    private loadDefaultNPCs(): void {
        DEFAULT_NPCS.forEach((npc) => {
            this.npcCache.set(npc.id, npc);
        });
        console.log(`[NPCService] Loaded ${DEFAULT_NPCS.length} default NPCs`);
    }

    /**
     * 將預設 NPC 寫入 Firebase
     */
    async seedDefaultNPCs(): Promise<void> {
        const db = getFirestore();
        if (!db) return;

        const batch = db.batch();
        DEFAULT_NPCS.forEach((npc) => {
            const docRef = db.collection("npcs").doc(npc.id);
            batch.set(docRef, npc);
            this.npcCache.set(npc.id, npc);
        });

        await batch.commit();
        console.log(`[NPCService] Seeded ${DEFAULT_NPCS.length} NPCs to Firebase`);
    }

    /**
     * 獲取所有 NPC 定義
     */
    getAllNPCs(): INPCData[] {
        return Array.from(this.npcCache.values());
    }

    /**
     * 根據類型獲取 NPC
     */
    getNPCsByType(type: NPCType): INPCData[] {
        return Array.from(this.npcCache.values()).filter((npc) => npc.type === type);
    }

    /**
     * 獲取單個 NPC 定義
     */
    getNPC(id: string): INPCData | undefined {
        return this.npcCache.get(id);
    }

    /**
     * 動態新增 NPC（不寫入 Firebase）
     */
    addNPC(npc: INPCData): void {
        this.npcCache.set(npc.id, npc);
    }

    /**
     * 重新載入 NPC（從 Firebase）
     */
    async reload(): Promise<void> {
        this.initialized = false;
        this.npcCache.clear();
        await this.initialize();
    }
}

export const npcService = new NPCService();
