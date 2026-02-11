import { Room, Client } from "colyseus";
import { GameState, Player, Item } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, EntityType, getRankTitle, IQuestDef, ChatMessageType, IChatMessage, EVIL_VALUE_CONSTANTS, IPurchaseRequest, IPurchaseResponse } from "@gangs-online/shared";
import { EnemyManager } from "../systems/EnemyManager";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { LootSystem } from "../systems/LootSystem"; // Phase 8
// Phase 15: 移除安全區系統 - import { SafeZoneSystem } from "../systems/SafeZoneSystem";
import { ShopSystem } from "../systems/ShopSystem"; // Phase 9
import { NPCManager } from "../systems/NPCManager"; // Phase 9
import { QuestManager } from "../systems/QuestManager"; // Phase 10
import { QuestBlueprintManager } from "../systems/QuestBlueprintManager"; // Phase 20
import { initializeFirebase } from "../services/FirebaseService"; // Phase 12
import { npcService } from "../services/NPCService"; // Phase 16-2
import { shopService } from "../services/ShopService"; // Phase 16-3
import { purchaseService } from "../services/PurchaseService"; // Phase 16-3
import { savePlayer, loadPlayer } from "../data/persistence"; // Phase 12
import { guildService } from "../services/GuildService"; // Phase 13
import { chatService } from "../services/ChatService"; // Phase 13
import { EvilValueSystem } from "../systems/EvilValueSystem"; // Phase 14
import { PrisonSystem } from "../systems/PrisonSystem"; // Phase 14

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    firstPlayerSessionId: string | null = null; // Track first player for special advantage
    private enemyManager!: EnemyManager; // 敵人管理系統
    private progressionSystem!: ProgressionSystem; // 進度系統 (Phase 7)
    private lootSystem!: LootSystem; // 戰利品系統 (Phase 8)
    // Phase 15: 移除安全區系統 - private safeZoneSystem!: SafeZoneSystem;
    private shopSystem!: ShopSystem; // 商店系統 (Phase 9)
    private npcManager!: NPCManager; // NPC 管理系統 (Phase 9)
    private questManager!: QuestManager; // 任務管理系統 (Phase 10)
    private questBlueprintManager!: QuestBlueprintManager; // 藍圖任務管理系統 (Phase 20)
    private evilValueSystem!: EvilValueSystem; // 罪惡值系統 (Phase 14)
    private prisonSystem!: PrisonSystem; // 監獄系統 (Phase 14)

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Phase 12: 初始化 Firebase
        initializeFirebase();

        // 初始化敵人管理系統
        this.enemyManager = new EnemyManager(this.state.enemies, this.state.players);
        this.enemyManager.initialize();

        // 初始化進度系統 (Phase 7)
        this.progressionSystem = new ProgressionSystem();

        // 初始化戰利品系統 (Phase 8)
        this.lootSystem = new LootSystem(this);

        // Phase 15: 移除安全區系統初始化
        // this.safeZoneSystem = new SafeZoneSystem();

        // 初始化商店系統 (Phase 9)
        this.shopSystem = new ShopSystem();

        // 初始化 NPC 管理系統 (Phase 9, Phase 14: 從 Firebase 載入)
        this.npcManager = new NPCManager(this.state.enemies);
        // NPC 初始化是非同步的，使用 Promise 鏈確保順序初始化
        this.initializeAsyncSystems();

        // 初始化任務管理系統 (Phase 10)
        this.questManager = new QuestManager();
        // 任務 NPC 現在從 Firebase 載入，不需要手動生成

        // 初始化藍圖任務管理系統 (Phase 20)
        this.questBlueprintManager = new QuestBlueprintManager();

        // 初始化罪惡值系統 (Phase 14)
        this.evilValueSystem = new EvilValueSystem();

        // 初始化監獄系統 (Phase 14)
        this.prisonSystem = new PrisonSystem(this.evilValueSystem);

        // 設置 NPC Manager 的引用 (Phase 14)
        this.npcManager.setReferences(
            this.state.players,
            this.evilValueSystem,
            this.prisonSystem
        );

        // 設置 AI 更新迴圈（每 50ms 執行一次 = 20 FPS）
        this.setSimulationInterval((deltaTime) => {
            this.enemyManager.update(deltaTime);

            // Phase 14: 警察 AI 更新
            this.npcManager.updatePoliceAI(deltaTime);

            // Phase 14: 監獄釋放檢查
            this.state.players.forEach((player) => {
                if (this.prisonSystem.canBeReleased(player)) {
                    this.prisonSystem.releasePlayer(player);
                    const client = this.clients.find((c) => c.sessionId === player.sessionId);
                    if (client) {
                        client.send("notification", "你已經服完刑期，重獲自由！");
                        client.send("prisonRelease", {});
                    }
                }
            });

            // Phase 14: 清理死亡的市民 NPC
            const deadNPCs = this.npcManager.removeDeadNPCs();
            deadNPCs.forEach(() => {
                // 1 分鐘後重生市民
                this.clock.setTimeout(() => {
                    this.npcManager.respawnCitizen();
                }, 60000);
            });
        });

        // Handle Movement
        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) { // Can only move if alive
                // Phase 14: 檢查監獄移動限制
                if (player.inPrison) {
                    if (!this.prisonSystem.validatePrisonMovement(player, input.x, input.z)) {
                        client.send("notification", "你還在監獄裡，不能離開！");
                        return;
                    }
                }
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Phase 15: Handle set_position (客戶端載入地圖後設定起始位置)
        this.onMessage("set_position", (client, input: { x: number; z: number }) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                console.log(`📍 [Phase 15] Setting player ${client.sessionId} position to (${input.x.toFixed(1)}, ${input.z.toFixed(1)})`);
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Handle Attack (支援攻擊玩家或敵人) - Phase 14: 增加紅名系統, Phase 15: 移除安全區檢查
        this.onMessage("attack", (client, payload: { targetId: string; type: EntityType }) => {
            const attacker = this.state.players.get(client.sessionId);

            if (!attacker || attacker.hp <= 0) {
                console.log(`❌ Attack failed: attacker not found or dead`);
                return; // 攻擊者不存在或已死亡
            }

            // Phase 14: 檢查是否在監獄中
            if (attacker.inPrison) {
                client.send("notification", "你在監獄裡不能攻擊！");
                return;
            }

            // Phase 15: 移除安全區檢查 - 全地圖回歸實戰狀態
            // if (this.safeZoneSystem.isInSafeZone(attacker.x, attacker.z)) {
            //     client.send("notification", "這裡是安全區，不能打架！");
            //     return;
            // }

            if (payload.type === "player") {
                // 攻擊玩家（PVP）
                this.handlePlayerVsPlayer(client, attacker, payload.targetId);
            } else if (payload.type === "enemy") {
                // 診斷：檢查敵人是否存在
                const enemy = this.state.enemies.get(payload.targetId);
                if (!enemy) {
                    console.log(`❌ Attack failed: enemy ${payload.targetId} not found on server!`);
                    console.log(`Current enemies:`, Array.from(this.state.enemies.keys()));
                    return;
                }

                // Phase 14: 檢查是否攻擊市民 NPC（會增加罪惡值）
                if (this.npcManager.isCitizen(payload.targetId)) {
                    // 攻擊市民會增加罪惡值
                    this.evilValueSystem.increaseEvilValue(attacker);
                    client.send("notification", `你攻擊了無辜市民！罪惡值 +1（目前: ${attacker.evilValue}）`);
                    this.npcManager.handleCitizenAttacked(client.sessionId, payload.targetId);
                    return;
                }

                // Phase 9: 檢查是否攻擊商店或任務 NPC（不能攻擊）
                const npcType = this.npcManager.getNPCType(payload.targetId);
                if (npcType === "shop" || npcType === "quest") {
                    client.send("notification", "唔好打十三叔！佢係好人嚟架！");
                    return;
                }

                // Phase 14: 檢查是否攻擊警察（警察會還手，且非常難打敗）
                if (this.npcManager.isPolice(payload.targetId)) {
                    // 攻擊警察會增加罪惡值
                    this.evilValueSystem.increaseEvilValue(attacker);
                    client.send("notification", `你竟敢襲警！罪惡值 +1（目前: ${attacker.evilValue}）`);
                    // 對警察造成傷害
                    this.npcManager.handlePoliceAttacked(client.sessionId, payload.targetId);
                    // 警察 AI 會自動還手（因為玩家現在是紅名）
                    return;
                }

                console.log(`✅ Attacking enemy ${payload.targetId}, HP: ${enemy.hp}/${enemy.maxHp}`);
                // 攻擊敵人（PVE） - Phase 10: 傳入 client 用於任務更新
                this.handlePlayerVsEnemy(client, attacker, payload.targetId);
            }
        });

        // --- Phase 13: Enhanced Chat Handler with Channels ---
        this.onMessage("chat", (client, payload: { text: string; type?: ChatMessageType; targetId?: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            // 支援舊格式（純字串）和新格式（物件）
            const text = typeof payload === "string" ? payload : payload.text;
            const chatType: ChatMessageType = typeof payload === "string" ? "GLOBAL" : (payload.type || "GLOBAL");
            const targetId = typeof payload === "string" ? undefined : payload.targetId;

            const chatMessage: IChatMessage = {
                senderId: player.firebaseUid || client.sessionId,
                senderName: player.name,
                text: text,
                type: chatType,
                targetId: targetId,
                timestamp: Date.now()
            };

            // 根據頻道類型廣播
            switch (chatType) {
                case "GLOBAL":
                    // 全服廣播
                    this.broadcast("chat", {
                        sessionId: client.sessionId,
                        text: text,
                        type: "GLOBAL",
                        senderName: player.name
                    });
                    break;

                case "GUILD":
                    // 幫會頻道：只廣播給同幫會成員
                    if (player.guildId) {
                        this.clients.forEach((c) => {
                            const p = this.state.players.get(c.sessionId);
                            if (p && p.guildId === player.guildId) {
                                c.send("chat", {
                                    sessionId: client.sessionId,
                                    text: text,
                                    type: "GUILD",
                                    senderName: player.name
                                });
                            }
                        });
                    }
                    break;

                case "PRIVATE":
                    // 私聊：只發送給目標玩家和自己
                    if (targetId) {
                        const targetClient = this.clients.find((c) => {
                            const p = this.state.players.get(c.sessionId);
                            return p && (p.firebaseUid === targetId || c.sessionId === targetId);
                        });
                        if (targetClient) {
                            targetClient.send("chat", {
                                sessionId: client.sessionId,
                                text: text,
                                type: "PRIVATE",
                                senderName: player.name
                            });
                        }
                        // 也發送給自己
                        client.send("chat", {
                            sessionId: client.sessionId,
                            text: text,
                            type: "PRIVATE",
                            senderName: player.name
                        });
                    }
                    break;
            }

            // 儲存到 Firebase（非同步，不阻塞）
            chatService.saveMessage(chatMessage);
        });

        // --- Phase 13: Guild Handlers ---
        this.onMessage("createGuild", async (client, payload: { name: string }) => {
            console.log(`[GameRoom] createGuild 收到請求: name=${payload.name}`);
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.log(`[GameRoom] createGuild 失敗: 找不到玩家`);
                client.send("notification", "請先登入才能創建幫會");
                return;
            }
            if (!player.firebaseUid) {
                console.log(`[GameRoom] createGuild 失敗: 玩家沒有 firebaseUid`);
                client.send("notification", "請先登入才能創建幫會");
                return;
            }

            console.log(`[GameRoom] createGuild 呼叫 GuildService: userId=${player.firebaseUid}`);
            const result = await guildService.createGuild(payload.name, player.firebaseUid);
            console.log(`[GameRoom] createGuild 結果:`, result);

            if (result.success && result.guildId) {
                player.guildId = result.guildId;
                player.guildName = payload.name;
                client.send("notification", `幫會「${payload.name}」創建成功！你現在是龍頭！`);
                client.send("guildUpdate", { guildId: result.guildId, guildName: payload.name, role: "龍頭" });

                // 儲存更新
                if (player.firebaseUid) {
                    savePlayer(player, player.firebaseUid);
                }
            } else {
                client.send("notification", result.error || "創建幫會失敗");
            }
        });

        this.onMessage("joinGuild", async (client, payload: { guildId: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.firebaseUid) {
                client.send("notification", "請先登入才能加入幫會");
                return;
            }

            const result = await guildService.joinGuild(payload.guildId, player.firebaseUid);
            if (result.success && result.guildName) {
                player.guildId = payload.guildId;
                player.guildName = result.guildName;
                client.send("notification", `成功加入幫會「${result.guildName}」！`);
                client.send("guildUpdate", { guildId: payload.guildId, guildName: result.guildName, role: "成員" });

                // 儲存更新
                if (player.firebaseUid) {
                    savePlayer(player, player.firebaseUid);
                }
            } else {
                client.send("notification", result.error || "加入幫會失敗");
            }
        });

        this.onMessage("leaveGuild", async (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.firebaseUid) {
                client.send("notification", "請先登入");
                return;
            }

            const guildName = player.guildName;
            const result = await guildService.leaveGuild(player.firebaseUid);
            if (result.success) {
                player.guildId = "";
                player.guildName = "";
                client.send("notification", `已離開幫會「${guildName}」`);
                client.send("guildUpdate", { guildId: "", guildName: "", role: "" });

                // 儲存更新
                if (player.firebaseUid) {
                    savePlayer(player, player.firebaseUid);
                }
            } else {
                client.send("notification", result.error || "離開幫會失敗");
            }
        });

        this.onMessage("getGuildList", async (client) => {
            const guilds = await guildService.getGuildList();
            client.send("guildList", guilds);
        });

        this.onMessage("getGuildInfo", async (client, payload: { guildId: string }) => {
            const guild = await guildService.getGuild(payload.guildId);
            if (guild) {
                client.send("guildInfo", guild);
            } else {
                client.send("notification", "幫會不存在");
            }
        });

        this.onMessage("getChatHistory", async (client, payload: { type: ChatMessageType; targetId?: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            let history: IChatMessage[] = [];

            switch (payload.type) {
                case "GLOBAL":
                    history = await chatService.getGlobalChatHistory();
                    break;
                case "GUILD":
                    if (player.guildId) {
                        history = await chatService.getGuildChatHistory(player.guildId);
                    }
                    break;
                case "PRIVATE":
                    if (payload.targetId && player.firebaseUid) {
                        history = await chatService.getPrivateChatHistory(player.firebaseUid, payload.targetId);
                    }
                    break;
            }

            client.send("chatHistory", { type: payload.type, messages: history });
        });

        // --- PHASE 8: PICKUP ITEM HANDLER ---
        this.onMessage("pickup", (client, lootId: string) => {
            const player = this.state.players.get(client.sessionId);
            const loot = this.state.lootItems.get(lootId);

            if (player && loot && player.hp > 0) {
                // 檢查距離
                if (this.lootSystem.isInPickupRange(player.x, player.z, loot.x, loot.z)) {
                    // 添加到背包
                    if (loot.item.type === 'currency') {
                        // 金錢直接加到 money
                        player.money += loot.item.value;
                        client.send("notification", `執到 $${loot.item.value}`);
                    } else {
                        // 消耗品加到背包
                        const newItem = new Item();
                        newItem.id = loot.item.id;
                        newItem.name = loot.item.name;
                        newItem.type = loot.item.type;
                        newItem.value = loot.item.value;
                        player.inventory.push(newItem);
                        client.send("notification", `執到 ${loot.item.name}`);
                    }

                    // 從世界中移除
                    this.state.lootItems.delete(lootId);
                }
            }
        });

        // --- PHASE 8: USE ITEM HANDLER ---
        this.onMessage("useItem", (client, itemIndex: number) => {
            const player = this.state.players.get(client.sessionId);

            if (player && player.hp > 0 && itemIndex >= 0 && itemIndex < player.inventory.length) {
                const item = player.inventory.at(itemIndex);

                if (item && item.type === 'consumable') {
                    // 恢復 HP
                    const healAmount = item.value;
                    player.hp = Math.min(player.hp + healAmount, player.maxHp);

                    // 從背包中移除
                    player.inventory.deleteAt(itemIndex);

                    client.send("notification", `食咗 ${item.name}，回復 ${healAmount} HP`);
                }
            }
        });

        // --- PHASE 9: BUY ITEM HANDLER (Legacy) ---
        this.onMessage("buy", (client, itemId: string) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                this.shopSystem.handlePurchase(client, player, itemId);
            }
        });

        // --- PHASE 16-3: NEW SHOP PURCHASE HANDLER ---
        this.onMessage("purchase", async (client, request: IPurchaseRequest) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || player.hp <= 0) {
                client.send("purchaseResult", {
                    success: false,
                    message: "無法購買",
                } as IPurchaseResponse);
                return;
            }

            // 檢查玩家是否在監獄中
            if (player.inPrison) {
                client.send("purchaseResult", {
                    success: false,
                    message: "你在監獄裡不能購物！",
                } as IPurchaseResponse);
                return;
            }

            try {
                const result = await purchaseService.handlePurchase(client, player, request);
                client.send("purchaseResult", result);
            } catch (error) {
                console.error("[GameRoom] Purchase error:", error);
                client.send("purchaseResult", {
                    success: false,
                    message: "購買失敗，請稍後再試",
                } as IPurchaseResponse);
            }
        });

        // --- PHASE 16-3: OPEN SHOP HANDLER ---
        this.onMessage("openShop", (client, payload: { npcId: string; shopId: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || player.hp <= 0) {
                return;
            }

            try {
                // 獲取商店資料
                const shop = shopService.getShop(payload.shopId);
                if (!shop) {
                    client.send("notification", "找不到這家商店");
                    return;
                }

                // 獲取商店中的所有商品
                const items: any[] = [];
                shop.itemList.forEach((itemConfig) => {
                    const item = shopService.getItem(itemConfig.itemId);
                    if (item) {
                        items.push(item);
                    }
                });

                // 發送商店數據給客戶端
                client.send("shopData", {
                    shop,
                    items,
                });

                console.log(`🏪 [GameRoom] Sent shop data for ${shop.name} to player ${player.name}`);
            } catch (error) {
                console.error("[GameRoom] Failed to send shop data:", error);
                client.send("notification", "無法載入商店資料");
            }
        });

        // --- PHASE 10: QUEST HANDLERS ---
        this.onMessage("acceptQuest", (client, questId: string) => {
            console.log("📋 [Server] acceptQuest received, questId:", questId);
            const player = this.state.players.get(client.sessionId);
            console.log("📋 [Server] Player found:", player ? player.name : "NOT FOUND");
            if (player && player.hp > 0) {
                // 檢查是否靠近任務 NPC
                const questNpc = this.state.enemies.get("npc_quest");
                console.log("📋 [Server] questNpc:", questNpc ? `found at (${questNpc.x}, ${questNpc.z})` : "NOT FOUND");
                if (questNpc) {
                    const dist = Math.sqrt(
                        Math.pow(player.x - questNpc.x, 2) + Math.pow(player.z - questNpc.z, 2)
                    );
                    console.log("📋 [Server] Distance:", dist, "Max allowed:", GAME_CONSTANTS.SHOP_INTERACTION_RANGE);
                    if (dist <= GAME_CONSTANTS.SHOP_INTERACTION_RANGE) {
                        console.log("📋 [Server] Calling questManager.acceptQuest...");
                        this.questManager.acceptQuest(client, player, questId);
                    } else {
                        console.log("📋 [Server] Too far from NPC!");
                        client.send("notification", "離浩南哥太遠了！");
                    }
                } else {
                    console.log("📋 [Server] ERROR: npc_quest not found in enemies!");
                    console.log("📋 [Server] Available enemies:", Array.from(this.state.enemies.keys()));
                }
            }
        });

        this.onMessage("completeQuest", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                // 檢查是否靠近任務 NPC
                const questNpc = this.state.enemies.get("npc_quest");
                if (questNpc) {
                    const dist = Math.sqrt(
                        Math.pow(player.x - questNpc.x, 2) + Math.pow(player.z - questNpc.z, 2)
                    );
                    if (dist <= GAME_CONSTANTS.SHOP_INTERACTION_RANGE) {
                        this.questManager.completeQuest(client, player, (type, data) =>
                            this.broadcast(type, data)
                        );
                    } else {
                        client.send("notification", "離浩南哥太遠了！");
                    }
                }
            }
        });

        this.onMessage("abandonQuest", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                this.questManager.abandonQuest(client, player);
            }
        });

        this.onMessage("getQuestInfo", (client) => {
            // 發送可用任務信息到客戶端
            const quest = this.questManager.getFirstAvailableQuest();
            if (quest) {
                client.send("questInfo", quest);
            }
        });

        // --- PHASE 20: BLUEPRINT QUEST HANDLERS ---
        this.onMessage("bpQuestAccept", (client, payload: { blueprintId: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || player.hp <= 0) return;
            this.questBlueprintManager.startQuest(client, player, payload.blueprintId);
        });

        this.onMessage("bpQuestDialogueNext", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.questBlueprintManager.handleDialogueNext(client, player);
        });

        this.onMessage("bpQuestChoice", (client, payload: { optionIndex: number }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.questBlueprintManager.handleChoice(client, player, payload.optionIndex);
        });

        this.onMessage("bpQuestAbandon", (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.questBlueprintManager.abandonQuest(client, player);
        });

        // Phase 16-2: NPC 互動（對話）
        this.onMessage("interact", (client, payload: { npcId: string }) => {
          try {
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                console.log(`❌ [Interact] Player not found for session ${client.sessionId}`);
                return;
            }

            const npc = this.state.enemies.get(payload.npcId);
            if (!npc || npc.type !== "npc") {
                console.log(`❌ [Interact] NPC ${payload.npcId} not found or not an NPC (found: ${!!npc}, type: ${npc?.type})`);
                client.send("notification", `[DEBUG] NPC not found or type mismatch: id=${payload.npcId}, found=${!!npc}, type=${npc?.type}`);
                return;
            }

            // 檢查距離
            const dx = player.x - npc.x;
            const dz = player.z - npc.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // TODO: 使用 npcData.interactionRadius，現在先用預設值
            const interactionRadius = 15.0;

            if (distance > interactionRadius) {
                client.send("notification", "太遠了，請靠近一點！");
                return;
            }

            // Phase 20: 檢查是否有藍圖任務可接
            // 先查找 NPC 模板 ID：優先從藍圖生成的任務 NPC 映射表查找，再從 npcService 查找
            const questNpcTemplateId = this.questBlueprintManager.getQuestNPCTemplateId(payload.npcId);
            const npcInstance = npcService.getInstance(payload.npcId);
            const npcTemplateId = questNpcTemplateId || npcInstance?.templateId || "";
            console.log(`📋 [Interact] NPC ${payload.npcId} → templateId: ${npcTemplateId || 'none'} (questNpc: ${!!questNpcTemplateId}, npcService: ${!!npcInstance})`);

            if (npcTemplateId) {
                const { blueprintId: availableBpId, reason } = this.questBlueprintManager.getAvailableQuestForNPC(npcTemplateId, player);
                if (availableBpId) {
                    const bpName = this.questBlueprintManager.getBlueprintName(availableBpId);
                    console.log(`📋 [Interact] Blueprint quest available: ${bpName} (${availableBpId})`);
                    client.send("bpQuestAvailable", {
                        blueprintId: availableBpId,
                        questName: bpName,
                    });
                    return;
                }
                console.log(`📋 [Interact] No available blueprint quest for template ${npcTemplateId}: ${reason}`);
            }

            // 從 NPCService 獲取 NPC 數據（包含對話樹）
            const npcData = npcService.getNPC(payload.npcId);
            if (!npcData) {
                // 藍圖生成的任務 NPC 不在 npcService 中，這是正常的
                if (questNpcTemplateId) {
                    const { reason } = this.questBlueprintManager.getAvailableQuestForNPC(npcTemplateId, player);
                    client.send("notification", `${npc.name} 目前沒有任務給你。[${reason}]`);
                } else {
                    console.log(`❌ [Interact] NPC data not found for ${payload.npcId}`);
                }
                return;
            }

            // 發送對話數據到客戶端
            if (npcData.dialogueTree) {
                console.log(`💬 [Interact] Player ${player.name} starts dialogue with ${npc.name}`);
                client.send("dialogue", {
                    npcId: payload.npcId,
                    npcName: npc.name,
                    dialogueTree: npcData.dialogueTree,
                });
            } else if (npcData.dialogue) {
                // 向後兼容：簡單對話文本
                console.log(`💬 [Interact] Player ${player.name} talks to ${npc.name}: ${npcData.dialogue}`);
                client.send("notification", `${npc.name}: ${npcData.dialogue}`);
            } else {
                console.log(`❌ [Interact] NPC ${npc.name} has no dialogue`);
                client.send("notification", `${npc.name} 沒有什麼想說的...`);
            }
          } catch (error: any) {
            console.error(`❌ [Interact] Error:`, error);
            client.send("notification", `[ERROR] ${error?.message || error}`);
          }
        });

        // Auto-Combat Loop (runs every ATTACK_INTERVAL) - 0.7.1: 添加 PvE 支援
        this.clock.setInterval(() => {
            this.state.players.forEach((player) => {
                if (player.hp <= 0) return; // 跳過死亡玩家

                // PvP 戰鬥
                if (player.inCombatWith) {
                    const target = this.state.players.get(player.inCombatWith);

                    if (target && target.hp > 0) {
                        // Continue attacking
                        this.dealDamage(player, target);
                    } else {
                        // Target is dead or disconnected, end combat
                        player.inCombatWith = "";
                    }
                }

                // PvE 戰鬥（0.7.1）
                if (player.inCombatWithEnemy) {
                    const enemy = this.state.enemies.get(player.inCombatWithEnemy);

                    if (enemy && enemy.hp > 0) {
                        // 玩家攻擊敵人
                        const isDead = this.enemyManager.takeDamage(player.inCombatWithEnemy, GAME_CONSTANTS.ATTACK_DAMAGE);
                        console.log(`🗡️ ${player.name} hits ${enemy.name} for ${GAME_CONSTANTS.ATTACK_DAMAGE} damage! HP: ${enemy.hp}/${enemy.maxHp}`);

                        if (isDead) {
                            // 敵人死亡
                            const deadEnemyId = player.inCombatWithEnemy; // 保存 ID 用於移除
                            console.log(`💀 Enemy ${deadEnemyId} was killed by ${player.name}`);
                            this.broadcast("chat", {
                                sessionId: "SYSTEM",
                                text: `${player.name} 擊敗了 ${enemy.name}！`,
                            });

                            // 獎勵經驗值
                            const xpGained = this.progressionSystem.getXPForEnemyKill();
                            const newLevel = this.progressionSystem.awardXP(player, xpGained);

                            if (newLevel !== null) {
                                const newTitle = getRankTitle(newLevel);
                                this.broadcast("chat", {
                                    sessionId: "SYSTEM",
                                    text: `🎉 ${player.name} 升職了！現在是 ${newTitle} (Lv${newLevel})`,
                                });
                            }

                            // Phase 8: 掉落戰利品
                            this.lootSystem.spawnLoot(enemy.x, enemy.z);

                            // Phase 10: 更新任務進度
                            const playerClient = this.clients.find((c) => c.sessionId === player.sessionId);
                            if (playerClient) {
                                this.questManager.updateKillProgress(playerClient, player, deadEnemyId);
                                // Phase 20: 更新藍圖任務進度
                                const npcInst = npcService.getInstance(deadEnemyId);
                                this.questBlueprintManager.updateKillProgress(playerClient, player, deadEnemyId, npcInst?.templateId);
                            }

                            // 結束戰鬥並移除敵人（修正 bug）
                            player.inCombatWithEnemy = "";
                            this.enemyManager.removeEnemy(deadEnemyId);
                            // 1 分鐘後重生 NPC
                            this.clock.setTimeout(() => {
                                this.enemyManager.spawnEnemy();
                            }, 60000); // 60 秒
                        } else {
                            // 敵人反擊
                            player.hp -= GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE;
                            console.log(`🧟 ${enemy.name} hits ${player.name} for ${GAME_CONSTANTS.ENEMY_ATTACK_DAMAGE} damage! HP: ${player.hp}/${player.maxHp}`);

                            if (player.hp <= 0) {
                                player.hp = 0;
                                player.inCombatWithEnemy = "";
                                console.log(`💀 Player ${player.name} was killed by ${enemy.name}`);

                                // Phase 14: 紅名玩家死亡懲罰
                                this.handleRedNameDeathPenalty(player);

                                // 重生玩家
                                this.clock.setTimeout(() => {
                                    if (this.state.players.has(player.sessionId)) {
                                        const respawnedPlayer = this.state.players.get(player.sessionId);
                                        if (respawnedPlayer) {
                                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                                            respawnedPlayer.x = Math.random() * 10 - 5;
                                            respawnedPlayer.z = Math.random() * 10 - 5;
                                        }
                                    }
                                }, 3000);
                            }
                        }
                    } else {
                        // 敵人已死亡或不存在，結束戰鬥
                        player.inCombatWithEnemy = "";
                    }
                }
            });
        }, GAME_CONSTANTS.ATTACK_INTERVAL);
    }

    /**
     * 處理玩家對玩家的攻擊（PVP） - Phase 15: 移除安全區檢查
     */
    private handlePlayerVsPlayer(client: Client, attacker: Player, targetSessionId: string): void {
        const target = this.state.players.get(targetSessionId);

        if (target && target.hp > 0) {
            // Phase 15: 移除安全區檢查 - 全地圖回歸實戰狀態
            // if (this.safeZoneSystem.isInSafeZone(target.x, target.z)) {
            //     client.send("notification", "對方在安全區內！");
            //     return;
            // }

            // Phase 14: 檢查目標是否在監獄中
            if (target.inPrison) {
                client.send("notification", "對方在監獄裡！");
                return;
            }

            // Phase 14: 攻擊非紅名玩家會增加罪惡值
            if (!this.evilValueSystem.isWanted(target)) {
                this.evilValueSystem.increaseEvilValue(attacker);
                client.send("notification", `你攻擊了無辜玩家！罪惡值 +1（目前: ${attacker.evilValue}）`);
            }

            // Check if not already in combat
            if (!attacker.inCombatWith && !target.inCombatWith) {
                // Calculate Distance
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Validate Range
                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    // START AUTO-COMBAT
                    attacker.inCombatWith = target.sessionId;
                    target.inCombatWith = attacker.sessionId;

                    console.log(`Combat started: ${attacker.sessionId} vs ${target.sessionId}`);

                    // Immediately deal first damage from both sides
                    this.dealDamage(attacker, target);
                    this.dealDamage(target, attacker);
                } else {
                    console.log(`Attack failed: Target out of range (${dist.toFixed(2)}m > ${GAME_CONSTANTS.ATTACK_RANGE}m)`);
                }
            }
        }
    }

    /**
     * 處理玩家對敵人的攻擊（PVE）- 0.7.1: 改為自動戰鬥模式
     * Phase 10: 添加 client 參數用於任務更新
     */
    private handlePlayerVsEnemy(client: Client, attacker: Player, enemyId: string): void {
        const enemy = this.state.enemies.get(enemyId);

        if (enemy && enemy.hp > 0) {
            // 檢查是否已經在戰鬥中
            if (attacker.inCombatWithEnemy || attacker.inCombatWith) {
                console.log(`Player ${attacker.name} is already in combat`);
                return;
            }

            // Calculate Distance
            const dx = attacker.x - enemy.x;
            const dz = attacker.z - enemy.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Validate Range
            if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                // 開始自動戰鬥
                attacker.inCombatWithEnemy = enemyId;
                console.log(`⚔️ Auto-combat started: ${attacker.name} vs ${enemy.name}`);

                // 立即進行第一次攻擊
                const isDead = this.enemyManager.takeDamage(enemyId, GAME_CONSTANTS.ATTACK_DAMAGE);
                console.log(`🗡️ ${attacker.name} hits ${enemy.name} for ${GAME_CONSTANTS.ATTACK_DAMAGE} damage! HP: ${enemy.hp}/${enemy.maxHp}`);

                if (isDead) {
                    // 第一擊就擊殺
                    console.log(`💀 Enemy ${enemyId} was killed by ${attacker.name} (first strike)`);
                    this.broadcast("chat", {
                        sessionId: "SYSTEM",
                        text: `${attacker.name} 秒殺了 ${enemy.name}！`,
                    });

                    const xpGained = this.progressionSystem.getXPForEnemyKill();
                    const newLevel = this.progressionSystem.awardXP(attacker, xpGained);

                    if (newLevel !== null) {
                        const newTitle = getRankTitle(newLevel);
                        this.broadcast("chat", {
                            sessionId: "SYSTEM",
                            text: `🎉 ${attacker.name} 升職了！現在是 ${newTitle} (Lv${newLevel})`,
                        });
                    }

                    // Phase 8: 掉落戰利品
                    this.lootSystem.spawnLoot(enemy.x, enemy.z);

                    // Phase 10: 更新任務進度
                    this.questManager.updateKillProgress(client, attacker, enemyId);
                    // Phase 20: 更新藍圖任務進度
                    const npcInstKill = npcService.getInstance(enemyId);
                    this.questBlueprintManager.updateKillProgress(client, attacker, enemyId, npcInstKill?.templateId);

                    // 清除戰鬥狀態並立即移除敵人
                    attacker.inCombatWithEnemy = "";
                    this.enemyManager.removeEnemy(enemyId);
                    console.log(`🧹 Removed dead enemy: ${enemyId}`);

                    // 1 分鐘後重生 NPC
                    this.clock.setTimeout(() => {
                        this.enemyManager.spawnEnemy();
                    }, 60000); // 60 秒
                }
                // 否則，自動戰鬥迴圈會繼續攻擊
            } else {
                console.log(`Attack failed: Enemy out of range (${dist.toFixed(2)}m > ${GAME_CONSTANTS.ATTACK_RANGE}m)`);
            }
        }
    }

    /**
     * 造成傷害（玩家對玩家）
     */
    dealDamage(attacker: Player, target: Player) {
        // Special advantage: First player (me) deals 50 damage, others deal 10
        const damage = attacker.sessionId === this.firstPlayerSessionId ? 50 : GAME_CONSTANTS.ATTACK_DAMAGE;

        target.hp -= damage;
        console.log(`${attacker.sessionId} hit ${target.sessionId} for ${damage} damage! HP: ${target.hp}/${target.maxHp}`);

        if (target.hp <= 0) {
            target.hp = 0;
            target.inCombatWith = ""; // Stop target from attacking

            // Stop attacker's combat
            attacker.inCombatWith = "";

            console.log(`Player ${target.sessionId} was killed by ${attacker.sessionId}`);

            // Phase 14: 紅名玩家死亡懲罰 - 隨機掉落物品
            this.handleRedNameDeathPenalty(target);

            // Special respawn for first player (me): immediate full heal
            if (target.sessionId === this.firstPlayerSessionId) {
                console.log(`First player died - instant respawn with full HP`);
                this.clock.setTimeout(() => {
                    if (this.state.players.has(target.sessionId)) {
                        const respawnedPlayer = this.state.players.get(target.sessionId);
                        if (respawnedPlayer) {
                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                            respawnedPlayer.x = Math.random() * 10 - 5;
                            respawnedPlayer.z = Math.random() * 10 - 5;
                            console.log(`First player respawned`);
                        }
                    }
                }, 1000); // 1 second respawn for first player
            } else {
                // Regular respawn (3 seconds)
                this.clock.setTimeout(() => {
                    if (this.state.players.has(target.sessionId)) {
                        const respawnedPlayer = this.state.players.get(target.sessionId);
                        if (respawnedPlayer) {
                            respawnedPlayer.hp = respawnedPlayer.maxHp;
                            respawnedPlayer.x = Math.random() * 10 - 5;
                            respawnedPlayer.z = Math.random() * 10 - 5;
                            console.log(`Player ${target.sessionId} respawned`);
                        }
                    }
                }, 3000);
            }
        }
    }

    /**
     * Phase 14: 處理紅名玩家死亡懲罰 - 隨機掉落物品
     */
    private handleRedNameDeathPenalty(player: Player): void {
        // 只有紅名玩家才會掉落物品
        if (!this.evilValueSystem.isWanted(player)) {
            return;
        }

        // 檢查玩家背包是否有物品
        if (player.inventory.length === 0) {
            console.log(`🔴 [Phase 14] ${player.name} 是紅名但背包為空，無物品掉落`);
            return;
        }

        // 根據罪惡值決定掉落數量 (evilValue 1-3 對應 1-3 件物品)
        const dropCount = Math.min(player.evilValue, player.inventory.length);

        // 隨機選擇要掉落的物品索引
        const indicesToDrop: number[] = [];
        const availableIndices = Array.from({ length: player.inventory.length }, (_, i) => i);

        for (let i = 0; i < dropCount && availableIndices.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableIndices.length);
            indicesToDrop.push(availableIndices[randomIndex]);
            availableIndices.splice(randomIndex, 1);
        }

        // 從大到小排序索引，以便從後往前刪除（避免索引偏移問題）
        indicesToDrop.sort((a, b) => b - a);

        // 記錄掉落的物品名稱
        const droppedItems: string[] = [];

        // 移除物品
        for (const index of indicesToDrop) {
            const item = player.inventory.at(index);
            if (item) {
                droppedItems.push(item.name);
                player.inventory.deleteAt(index);
            }
        }

        if (droppedItems.length > 0) {
            console.log(`🔴 [Phase 14] ${player.name} 紅名死亡，掉落了 ${droppedItems.length} 件物品: ${droppedItems.join(", ")}`);

            // 通知玩家掉落了物品
            const targetClient = this.clients.find((c) => c.sessionId === player.sessionId);
            if (targetClient) {
                targetClient.send("notification", `紅名懲罰：你掉落了 ${droppedItems.join(", ")}`);
            }
        }
    }

    /**
     * 初始化異步系統（NPC、商店、購買服務）
     * 這些服務需要從 Firebase 載入數據，所以是異步的
     */
    private async initializeAsyncSystems(): Promise<void> {
        console.log("📦 [GameRoom] Starting async systems initialization...");

        try {
            // 依序初始化各個服務
            console.log("📦 [GameRoom] Initializing NPC Manager...");
            await this.npcManager.initialize();
            console.log(`✅ [GameRoom] NPC Manager initialized - ${this.state.enemies.size} NPCs in state`);

            console.log("📦 [GameRoom] Initializing Shop Service...");
            await shopService.initialize();
            console.log("✅ [GameRoom] Shop Service initialized");

            console.log("📦 [GameRoom] Initializing Purchase Service...");
            await purchaseService.initialize();
            console.log("✅ [GameRoom] Purchase Service initialized");

            // Phase 20: 初始化藍圖任務管理系統
            console.log("📦 [GameRoom] Initializing Quest Blueprint Manager...");
            await this.questBlueprintManager.initialize();
            // 根據藍圖 Start 節點的位置生成任務 NPC
            this.questBlueprintManager.spawnQuestNPCs(this.npcManager);
            console.log("✅ [GameRoom] Quest Blueprint Manager initialized");

            console.log("✅ [GameRoom] All async systems initialized successfully!");
        } catch (error) {
            console.error("❌ [GameRoom] Failed to initialize async systems:", error);
        }
    }

    async onJoin(client: Client, options: any) {
        // Phase 12.1: 取得 Firebase UID、角色名和新用戶標記
        const firebaseUid = options.userId || "";
        const characterName = options.username || "";
        const isNewUser = options.isNewUser === true;

        console.log(`Player joining (UID: ${firebaseUid}, Name: ${characterName}, New: ${isNewUser})`);

        // Phase 13: 單一帳號登入 - 踢掉舊的連線
        if (firebaseUid) {
            for (const existingClient of this.clients) {
                const existingPlayer = this.state.players.get(existingClient.sessionId);
                if (existingPlayer && existingPlayer.firebaseUid === firebaseUid) {
                    console.log(`[GameRoom] 踢掉舊連線: ${existingClient.sessionId} (UID: ${firebaseUid})`);
                    // 先儲存舊玩家資料
                    await savePlayer(existingPlayer, firebaseUid);
                    // 發送通知給舊客戶端
                    existingClient.send("kicked", { reason: "帳號已在其他地方登入" });
                    // 踢掉舊連線
                    existingClient.leave(4000); // 4000 = custom close code for duplicate login
                    break;
                }
            }
        }

        // Track first player for special advantage
        if (!this.firstPlayerSessionId) {
            this.firstPlayerSessionId = client.sessionId;
            console.log(`First player detected: ${client.sessionId} - Will deal 50 damage per hit`);
        }

        const player = new Player();
        player.sessionId = client.sessionId;
        player.firebaseUid = firebaseUid; // Phase 12: 儲存 Firebase UID

        // Phase 12.1: 嘗試從 Firebase 載入已儲存的玩家資料
        let loaded = false;
        if (firebaseUid && !isNewUser) {
            loaded = await loadPlayer(player, firebaseUid, this.questManager.getQuestDefinitions());
        }

        // Phase 20: 從 persistence 載入已完成的藍圖任務
        if (firebaseUid && loaded) {
            await this.loadBlueprintQuestState(player, firebaseUid);
        }

        if (!loaded) {
            // 新玩家：使用客戶端提供的角色名稱
            player.name = characterName || `玩家${client.sessionId.substring(0, 6)}`;
            // Phase 15: 新玩家生成在旺角地圖的指定位置
            player.x = -835575.4;
            player.z = -819658.9;
            player.hp = 100;
            player.maxHp = 100;
            player.inCombatWith = "";
            player.inCombatWithEnemy = "";

            // === Phase 7: 初始化進度系統 ===
            this.progressionSystem.initializePlayer(player);

            // === Phase 8: 初始化背包系統 ===
            player.money = 0;

            // Phase 12.1: 新玩家立即儲存
            if (firebaseUid) {
                savePlayer(player, firebaseUid);
            }

            console.log(`New player created: ${player.name} (UID: ${firebaseUid})`);
        } else {
            // 已載入的玩家：確保戰鬥狀態清空
            player.inCombatWith = "";
            player.inCombatWithEnemy = "";
            console.log(`Returning player loaded: ${player.name} (UID: ${firebaseUid})`);
        }

        this.state.players.set(client.sessionId, player);
    }

    /**
     * Phase 20: 載入藍圖任務狀態
     */
    private async loadBlueprintQuestState(player: Player, firebaseUid: string): Promise<void> {
        const db = (await import("../services/FirebaseService")).getFirestore();
        if (!db) return;

        try {
            const doc = await db.collection("players").doc(firebaseUid).get();
            if (!doc.exists) return;

            const saved = doc.data() as any;

            // 載入已完成的藍圖任務
            if (saved.completedBlueprintIds && Array.isArray(saved.completedBlueprintIds)) {
                this.questBlueprintManager.setPlayerCompleted(firebaseUid, saved.completedBlueprintIds);
            }

            // 載入進行中的藍圖任務
            if (saved.activeBlueprintQuest && saved.activeBlueprintQuest.blueprintId) {
                const bpState = saved.activeBlueprintQuest;

                // 驗證：只恢復 task 節點（kill/collect 等有進度的任務）
                // 對話/選擇/條件等節點無法有意義地恢復（客戶端 UI 已丟失）
                const canRestore = this.questBlueprintManager.canRestoreState(
                    bpState.blueprintId,
                    bpState.currentNodeId || ""
                );

                if (canRestore) {
                    this.questBlueprintManager.restorePlayerState(player.sessionId, {
                        blueprintId: bpState.blueprintId,
                        currentNodeId: bpState.currentNodeId || "",
                        taskProgress: bpState.taskProgress || 0,
                        variables: bpState.variables || {},
                    });

                    // 恢復 Player schema 字段
                    player.activeBlueprintId = bpState.blueprintId;
                    player.activeBlueprintName = this.questBlueprintManager.getBlueprintName(bpState.blueprintId);
                    player.activeTaskType = bpState.activeTaskType || "";
                    player.activeTaskTarget = bpState.activeTaskTarget || "";
                    player.activeTaskDesc = bpState.activeTaskDesc || "";
                    player.activeTaskCurrent = bpState.taskProgress || 0;
                    player.activeTaskRequired = bpState.activeTaskRequired || 0;

                    console.log(`[Phase 20] Restored blueprint quest for ${player.name}: ${player.activeBlueprintName} (node: ${bpState.currentNodeId})`);
                } else {
                    console.log(`[Phase 20] Discarded stale blueprint quest state for ${player.name}: bp=${bpState.blueprintId}, node=${bpState.currentNodeId} (not a task node, cannot restore)`);
                    // 清除 Firebase 中的過期狀態
                    db.collection("players").doc(firebaseUid).set(
                        { activeBlueprintQuest: null },
                        { merge: true }
                    ).catch((e: any) => console.error("[Phase 20] Failed to clear stale quest state:", e));
                }
            }
        } catch (error) {
            console.error("[Phase 20] Failed to load blueprint quest state:", error);
        }
    }

    /**
     * Phase 20: 儲存藍圖任務狀態
     */
    private async saveBlueprintQuestState(player: Player, firebaseUid: string): Promise<void> {
        const db = (await import("../services/FirebaseService")).getFirestore();
        if (!db) return;

        try {
            const completedIds = this.questBlueprintManager.getPlayerCompleted(firebaseUid);
            const activeState = this.questBlueprintManager.getPlayerState(player.sessionId);

            const updateData: any = {
                completedBlueprintIds: completedIds,
            };

            if (activeState) {
                updateData.activeBlueprintQuest = {
                    blueprintId: activeState.blueprintId,
                    currentNodeId: activeState.currentNodeId,
                    taskProgress: activeState.taskProgress,
                    variables: activeState.variables,
                    activeTaskType: player.activeTaskType,
                    activeTaskTarget: player.activeTaskTarget,
                    activeTaskDesc: player.activeTaskDesc,
                    activeTaskRequired: player.activeTaskRequired,
                };
            } else {
                updateData.activeBlueprintQuest = null;
            }

            await db.collection("players").doc(firebaseUid).set(updateData, { merge: true });
            console.log(`[Phase 20] Saved blueprint quest state for ${player.name}`);
        } catch (error) {
            console.error("[Phase 20] Failed to save blueprint quest state:", error);
        }
    }

    async onLeave(client: Client, consented: boolean) {
        const leavingPlayer = this.state.players.get(client.sessionId);

        if (leavingPlayer) {
            // If player was in combat, end combat for opponent
            if (leavingPlayer.inCombatWith) {
                const opponent = this.state.players.get(leavingPlayer.inCombatWith);
                if (opponent) {
                    opponent.inCombatWith = "";
                }
            }

            // Phase 12: 儲存玩家資料到 Firebase
            if (leavingPlayer.firebaseUid) {
                // Phase 20: 儲存藍圖任務狀態
                await this.saveBlueprintQuestState(leavingPlayer, leavingPlayer.firebaseUid);
                await savePlayer(leavingPlayer, leavingPlayer.firebaseUid);
            }

            // Phase 20: 清除藍圖任務運行時狀態
            this.questBlueprintManager.clearPlayerState(client.sessionId);
        }

        this.state.players.delete(client.sessionId);
    }
}
