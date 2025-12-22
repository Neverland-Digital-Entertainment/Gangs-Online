import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { PlayerData, IEnemyData, EntityType } from "@gangs-online/shared";
import "@babylonjs/loaders";
import { GAME_VERSION } from "./version";

// Import our modular systems
import { config } from "./config";
import { LoadingScreen } from "./systems/LoadingScreen";
import { ChatSystem } from "./systems/ChatSystem";
import { UISystem } from "./systems/UISystem";
import { WeaponSystem } from "./systems/WeaponSystem";
// Phase 9.1: InventorySystem UI 已移除，金錢改為在 HUD 顯示
// Phase 10.1: ShopSystem 已整合到 HUDManager 的 Popup 系統
import { HUDManager } from "./systems/HUDManager"; // Phase 9.1
import { CityGenerator } from "./world/CityGenerator";
import { PlayerManager } from "./entities/PlayerManager";
import { EnemyManager } from "./entities/EnemyManager";
import { LootManager } from "./entities/LootManager"; // Phase 8
import { SoundManager } from "./systems/SoundManager"; // Phase 11
import { ParticleSystem } from "./systems/ParticleSystem"; // Phase 11
import { createEngine, createIsometricCamera, setupScene, updateCameraFollow, updateCameraOrtho } from "./utils/BabylonUtils";
import { getRankTitle } from "./utils/progression";

/**
 * 主入口 - 遊戲初始化和場景創建
 */

// --- 計算動態 idealWidth ---
// 根據螢幕尺寸動態設定，確保 UI 在任何設備上都有合適的大小
function calculateIdealWidth(): number {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const minDimension = Math.min(screenWidth, screenHeight);

    // 使用較小維度作為基準，確保橫屏竪屏都適用
    // 基準：375px (手機) -> 768, 1920px (桌面) -> 1920
    // 公式：minDimension * 2，但限制在 768-1920 範圍內
    return Math.max(768, Math.min(1920, minDimension * 2));
}

// --- 全局 UI Texture 引用（用於 resize 時更新）---
let globalUITexture: GUI.AdvancedDynamicTexture | null = null;

// --- 初始化載入螢幕 ---
console.log("🎮 Initializing Gangs Online...");
const loadingScreen = new LoadingScreen();
loadingScreen.updateText("正在初始化引擎...");

// --- 獲取 Canvas ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
if (!canvas) {
    console.error("❌ Canvas element not found!");
    throw new Error("Canvas element 'renderCanvas' not found");
}
console.log("✅ Canvas found:", canvas);

// --- 創建引擎 ---
const engine = createEngine(canvas);
console.log("✅ BabylonJS Engine created");

// --- 創建 Colyseus 客戶端 ---
loadingScreen.updateText("正在連接伺服器...");
const client = new Client.Client(config.serverUrl);
console.log("✅ Colyseus Client created, server:", config.serverUrl);

// --- 檢查伺服器版本（0.7.1）---
const checkServerVersion = async (): Promise<string> => {
    try {
        const httpUrl = config.serverUrl.replace("ws://", "http://").replace("wss://", "https://");
        const response = await fetch(`${httpUrl}/version`, { timeout: 5000 } as any);
        const data = await response.json();
        return data.version;
    } catch (error) {
        console.error("Failed to fetch server version:", error);
        return "unknown"; // 失敗時返回 unknown 而不是阻塞
    }
};

/**
 * 創建遊戲場景
 */
const createScene = async (): Promise<BABYLON.Scene> => {
    console.log("🌍 Creating scene...");
    loadingScreen.updateText("正在創建遊戲世界...");

    const scene = new BABYLON.Scene(engine);

    // 設置場景（光照、碰撞等）
    setupScene(scene);

    // 創建相機
    const camera = createIsometricCamera(scene, engine);

    // 創建城市環境
    const cityGenerator = new CityGenerator(scene);
    cityGenerator.generate();

    // --- UI Layer ---
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    // Phase 9.1: 動態設置理想寬度，確保 UI 在不同設備上都有合適的大小
    uiTexture.idealWidth = calculateIdealWidth();
    uiTexture.useSmallestIdeal = true;
    globalUITexture = uiTexture; // 保存引用供 resize 時使用

    // --- 初始化系統 ---
    const uiSystem = new UISystem(uiTexture);
    const weaponSystem = new WeaponSystem();
    const playerManager = new PlayerManager(scene, uiSystem, weaponSystem);
    const enemyManager = new EnemyManager(scene, uiSystem); // 敵人管理系統

    // === Phase 11: 初始化音效和粒子系統 ===
    const soundManager = new SoundManager(scene);
    const particleSystem = new ParticleSystem(scene);

    let mySessionId: string | null = null;
    let lootManager: LootManager | null = null; // Phase 8
    // Phase 10.1: shopSystem 已整合到 hudManager
    let hudManager: HUDManager | null = null; // Phase 9.1

    try {
        // 連接遊戲房間前，先檢查版本（0.7.1）
        loadingScreen.updateText("正在檢查版本...");
        try {
            const serverVersion = await checkServerVersion();
            loadingScreen.showVersionInfo(GAME_VERSION, serverVersion);
        } catch (err) {
            console.error("Version check failed, continuing anyway:", err);
            loadingScreen.showVersionInfo(GAME_VERSION, "unknown");
        }

        // 連接遊戲房間
        loadingScreen.updateText("正在連接遊戲房間...");
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        // 初始化聊天系統（只保留聊天氣泡功能）
        loadingScreen.updateText("正在準備遊戲介面...");
        const chatSystem = new ChatSystem(room, scene, uiTexture);
        // Phase 9.1: 舊的 createChatInput 已移除，改用 HUD 中的聊天輸入

        // === Phase 8: 初始化戰利品系統 ===
        lootManager = new LootManager(scene, room, soundManager, particleSystem); // Phase 11: 傳入音效和粒子系統
        // Phase 9.1: 舊的 InventorySystem UI 已移除，金錢改為在 HUD 顯示
        // Phase 10.1: ShopSystem 已整合到 HUDManager 的 Popup 系統

        // === Phase 11: 初始化音效系統並播放背景音樂 ===
        await soundManager.initialize();
        // 背景音樂在用戶互動後播放（點擊後）
        const startBGM = () => {
            soundManager.playBGM();
            document.removeEventListener("click", startBGM);
            document.removeEventListener("touchstart", startBGM);
        };
        document.addEventListener("click", startBGM, { once: true });
        document.addEventListener("touchstart", startBGM, { once: true });

        // === Phase 9.1: 初始化 HUD 管理器 ===
        hudManager = new HUDManager(uiTexture);
        await hudManager.initialize(room);

        // 監聽聊天訊息
        room.onMessage("chat", (msg: { sessionId: string; text: string; channel?: string }) => {
            const entity = playerManager.getEntity(msg.sessionId);
            if (entity) {
                chatSystem.createChatBubble(entity.mesh, msg.text);
            }
            // Phase 9.1: 同步到 HUD 聊天系統
            if (hudManager) {
                const player = (room.state as any).players.get(msg.sessionId);
                const senderName = player?.name || "Unknown";
                hudManager.addChatMessage(senderName, msg.text, msg.channel || "world");
            }
        });

        // === Phase 11: 監聽通知訊息（用於追蹤拾取的物品）===
        room.onMessage("notification", (msg: string) => {
            console.log("📢 Notification:", msg);

            // 解析拾取訊息並添加到最近獲得列表
            if (hudManager && msg.startsWith("執到")) {
                // 金錢拾取：「執到 $100」
                const moneyMatch = msg.match(/執到 \$(\d+)/);
                if (moneyMatch) {
                    const value = parseInt(moneyMatch[1], 10);
                    hudManager.addRecentlyAcquired(
                        { id: "currency", name: `$${value}`, type: "currency", value },
                        true
                    );
                }
                // 物品拾取：「執到 魚蛋 (Fishball)」
                else {
                    const itemName = msg.replace("執到 ", "");
                    hudManager.addRecentlyAcquired(
                        { id: itemName, name: itemName, type: "consumable", value: 0 },
                        false
                    );
                }
            }
        });

        // 添加玩家
        (room.state as any).players.onAdd(async (player: PlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;

            if (isSelf) {
                loadingScreen.updateText("正在載入角色模型...");
            }

            const entity = await playerManager.createPlayer(player, sessionId, isSelf);

            // 同步位置
            player.onChange(() => {
                playerManager.updateTarget(sessionId, player.x, player.z);
            });

            // 同步血量
            let prevHp = player.hp; // Phase 11: 記錄之前的 HP 用於傷害反饋
            player.listen("hp", (currentHp: number) => {
                playerManager.updateHealth(sessionId, currentHp, player.maxHp);

                // === Phase 11: 傷害反饋效果 ===
                const entity = playerManager.getEntity(sessionId);
                if (entity && currentHp < prevHp && currentHp > 0) {
                    // 被傷害時的效果
                    soundManager.playHitSound();
                    particleSystem.createBloodEffect(entity.mesh.position);
                    particleSystem.flashDamage(entity.mesh);
                } else if (entity && currentHp <= 0 && prevHp > 0) {
                    // 死亡時的效果
                    particleSystem.createDeathEffect(entity.mesh.position);
                }
                prevHp = currentHp;
            });

            // 同步戰鬥狀態
            player.listen("inCombatWith", (targetId: string) => {
                playerManager.updateCombatState(sessionId, !!(targetId && targetId !== ""));
            });

            // === Phase 7: 同步經驗值和等級 ===
            player.listen("xp", (currentXP: number) => {
                playerManager.updateXP(sessionId, currentXP, player.maxXp);
            });

            // Phase 11: 記錄之前的等級用於升級反饋
            let prevLevel = player.level;
            player.listen("level", (newLevel: number) => {
                playerManager.updateLevel(sessionId, newLevel, player.name);

                // === Phase 11: 升級效果 ===
                if (newLevel > prevLevel) {
                    const entity = playerManager.getEntity(sessionId);
                    if (entity) {
                        soundManager.playLevelUpSound();
                        particleSystem.createLevelUpEffect(entity.mesh);
                    }
                }
                prevLevel = newLevel;
            });

            // === Phase 9.1: 同步 HUD（僅限自己的角色）===
            if (isSelf && hudManager) {
                // 初始化 HUD 狀態
                hudManager.updateHP(player.hp, player.maxHp);
                hudManager.updateExp(player.xp, player.maxXp);
                hudManager.updateLevel(player.level, getRankTitle(player.level));
                hudManager.updateMoney(player.money || 0);

                // 監聽血量變化
                player.listen("hp", (currentHp: number) => {
                    hudManager?.updateHP(currentHp, player.maxHp);
                });

                // 監聽經驗值變化
                player.listen("xp", (currentXP: number) => {
                    hudManager?.updateExp(currentXP, player.maxXp);
                });

                // 監聽等級變化
                player.listen("level", (newLevel: number) => {
                    hudManager?.updateLevel(newLevel, getRankTitle(newLevel));
                });

                // 監聽金錢變化
                player.listen("money", (money: number) => {
                    hudManager?.updateMoney(money);
                    // Phase 10.1: 同步到商店 popup 系統
                    hudManager?.updateShopMoney(money);
                });

                // Phase 10.1: 初始化商店系統的金錢
                hudManager?.updateShopMoney(player.money || 0);

                // Phase 10: 監聽任務狀態變化
                player.listen("activeQuest", (quest: any) => {
                    console.log("📋 Quest state changed:", quest);
                    if (quest) {
                        hudManager?.updateQuestState({
                            id: quest.id,
                            name: quest.name,
                            description: quest.description,
                            currentCount: quest.currentCount,
                            requiredCount: quest.requiredCount,
                            completed: quest.completed,
                            rewardXp: quest.rewardXp,
                            rewardMoney: quest.rewardMoney,
                        });
                    } else {
                        hudManager?.updateQuestState(null);
                    }
                });

                // Phase 10: 初始化任務狀態
                if ((player as any).activeQuest) {
                    const quest = (player as any).activeQuest;
                    hudManager?.updateQuestState({
                        id: quest.id,
                        name: quest.name,
                        description: quest.description,
                        currentCount: quest.currentCount,
                        requiredCount: quest.requiredCount,
                        completed: quest.completed,
                        rewardXp: quest.rewardXp,
                        rewardMoney: quest.rewardMoney,
                    });
                }
            }
        });

        // 移除玩家
        (room.state as any).players.onRemove((player: PlayerData, sessionId: string) => {
            playerManager.removePlayer(sessionId);
        });

        // --- 敵人事件處理 ---
        // 使用延遲來確保狀態完全同步
        const setupEnemySystem = async () => {
            console.log("🔄 Setting up enemy system...");
            console.log("Room state:", room.state);
            console.log("Enemies map:", (room.state as any).enemies);

            try {
                const enemiesMap = (room.state as any).enemies;

                if (!enemiesMap) {
                    console.error("❌ enemies map is undefined, retrying in 500ms...");
                    setTimeout(setupEnemySystem, 500);
                    return;
                }

                console.log("✅ Enemies map found, setting up listeners...");

                // 為已存在的敵人創建實體（先創建，避免 onAdd 重複創建）
                console.log(`📦 Loading ${enemiesMap.size} existing enemies...`);
                const enemyCreationPromises: Promise<any>[] = [];
                enemiesMap.forEach((enemy: any, enemyId: string) => {
                    console.log(`🧟 Creating existing enemy: ${enemyId}`);
                    enemyCreationPromises.push(enemyManager.createEnemy(enemy, enemyId));
                });
                await Promise.all(enemyCreationPromises);
                console.log(`✅ Existing enemies loaded (${enemyCreationPromises.length})`);

                // 設置新敵人加入的監聽器（放在初始化之後，避免重複觸發）
                enemiesMap.onAdd(async (enemy: any, enemyId: string) => {
                    // 檢查是否已經存在，避免重複創建
                    if (enemyManager.getEntity(enemyId)) {
                        console.log(`⚠️ Enemy ${enemyId} already exists, skipping creation`);
                        return;
                    }
                    console.log(`🧟 Enemy joined: ${enemyId}`);
                    await enemyManager.createEnemy(enemy, enemyId);
                });

                // 設置敵人移除的監聽器
                enemiesMap.onRemove((enemy: any, enemyId: string) => {
                    console.log(`🧟 Enemy left: ${enemyId}`);
                    enemyManager.removeEnemy(enemyId);
                });

                console.log(`✅ Enemy system initialized successfully`);
            } catch (error) {
                console.error("❌ Error setting up enemy system:", error);
                console.log("Retrying in 500ms...");
                setTimeout(setupEnemySystem, 500);
            }
        };

        // 延遲執行以確保房間狀態完全初始化
        setTimeout(setupEnemySystem, 100);

        // --- Helper: 找到可互動物件（穿透建築物）---
        const findInteractiveTarget = (x: number, y: number): { type: 'loot' | 'npc' | 'enemy' | 'player' | null, mesh: BABYLON.AbstractMesh | null, id?: string } => {
            // 創建射線
            const ray = scene.createPickingRay(x, y, BABYLON.Matrix.Identity(), camera);

            // 使用 multiPickWithRay 並設定 predicate 跳過建築物
            const pickResults = scene.multiPickWithRay(ray, (mesh) => {
                // 跳過建築物（名稱以 b_ 開頭）
                if (mesh.name.startsWith("b_")) return false;
                // 跳過地面
                if (mesh.name === "ground") return false;
                return true;
            });

            if (!pickResults) return { type: null, mesh: null };

            for (const pickResult of pickResults) {
                if (!pickResult.hit || !pickResult.pickedMesh) continue;

                // 檢查戰利品
                if (lootManager && lootManager.isLootMesh(pickResult.pickedMesh)) {
                    return { type: 'loot', mesh: pickResult.pickedMesh, id: lootManager.getLootId(pickResult.pickedMesh) || undefined };
                }

                // 找到根節點
                let rootMesh: BABYLON.Node = pickResult.pickedMesh;
                while (rootMesh.parent) {
                    rootMesh = rootMesh.parent;
                }

                if (rootMesh instanceof BABYLON.AbstractMesh && rootMesh.metadata) {
                    // NPC
                    if (rootMesh.metadata.type === "npc") {
                        return { type: 'npc', mesh: rootMesh, id: rootMesh.metadata.id };
                    }
                    // 敵人
                    if (rootMesh.metadata.type === "enemy") {
                        return { type: 'enemy', mesh: rootMesh, id: rootMesh.metadata.id };
                    }
                    // 其他玩家
                    if (rootMesh.metadata.sessionId && rootMesh.metadata.sessionId !== mySessionId) {
                        return { type: 'player', mesh: rootMesh, id: rootMesh.metadata.sessionId };
                    }
                }
            }
            return { type: null, mesh: null };
        };

        // --- Phase 10.1: 滑鼠 hover 時改變 cursor ---
        const canvas = scene.getEngine().getRenderingCanvas();
        scene.onPointerObservable.add((pointerInfo) => {
            if (!canvas) return;
            if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;

            const target = findInteractiveTarget(scene.pointerX, scene.pointerY);

            switch (target.type) {
                case 'loot':
                case 'npc':
                    canvas.style.cursor = "pointer";
                    break;
                case 'enemy':
                case 'player':
                    canvas.style.cursor = "crosshair";
                    break;
                default:
                    canvas.style.cursor = "default";
            }
        });

        // --- 輸入處理：點擊攻擊、拾取戰利品或移動 (Phase 8 更新) ---
        scene.onPointerDown = (evt, pickResult) => {
            // 先用 multiPick 找可互動物件（穿透建築物）
            const target = findInteractiveTarget(scene.pointerX, scene.pointerY);

            if (target.type === 'loot' && target.id) {
                console.log("📦 Picking up loot:", target.id);
                room.send("pickup", target.id);
                return;
            }

            if (target.type === 'npc' && target.id && hudManager) {
                console.log("👔 Clicked NPC:", target.id);
                if (target.id === "npc_quest") {
                    hudManager.showPopup("任務", "quest");
                } else if (target.id === "npc_shopkeeper") {
                    hudManager.showShopPopup();
                } else {
                    hudManager.showShopPopup();
                }
                return;
            }

            if (target.type === 'enemy' && target.id) {
                console.log("🗡️ Attacking enemy:", target.id);
                soundManager.playMissSound(); // Phase 11: 攻擊音效（揮空聲）
                room.send("attack", { targetId: target.id, type: "enemy" as EntityType });
                return;
            }

            if (target.type === 'player' && target.id) {
                console.log("🗡️ Attacking player:", target.id);
                soundManager.playMissSound(); // Phase 11: 攻擊音效（揮空聲）
                room.send("attack", { targetId: target.id, type: "player" as EntityType });
                return;
            }

            // 點擊地面 -> 移動（支持穿透建筑物）
            if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedPoint) {
                let targetPoint = null;

                // 如果點擊了建筑物，嘗試穿透找到後面的道路
                if (pickResult.pickedMesh.name.startsWith("b_")) {
                    const ray = scene.createPickingRay(
                        scene.pointerX,
                        scene.pointerY,
                        BABYLON.Matrix.Identity(),
                        camera
                    );

                    const hits = scene.multiPickWithRay(ray);
                    if (hits) {
                        for (const hit of hits) {
                            if (hit.pickedMesh &&
                                !hit.pickedMesh.name.startsWith("b_") &&
                                hit.pickedPoint) {
                                targetPoint = hit.pickedPoint;
                                break;
                            }
                        }
                    }
                } else {
                    targetPoint = pickResult.pickedPoint;
                }

                if (targetPoint) {
                    room.send("move", {
                        x: targetPoint.x,
                        z: targetPoint.z,
                    });
                }
            }
        };
    } catch (e) {
        console.error("Connection Failed:", e);
    }

    // --- 遊戲迴圈（動畫 & 移動）---
    scene.registerBeforeRender(() => {
        // 更新所有玩家
        playerManager.updateAll();

        // 更新所有敵人
        enemyManager.updateAll();

        // Phase 10: 更新建築物遮擋效果
        if (mySessionId) {
            const myEntity = playerManager.getEntity(mySessionId);
            if (myEntity) {
                // 相機跟隨
                updateCameraFollow(camera, myEntity.mesh);

                // 檢查並更新建築物透明度（當玩家在建築物後面時）
                cityGenerator.updateBuildingOcclusion(myEntity.mesh.position, camera);
            }
        }
    });

    return scene;
};

// --- 啟動應用 ---
console.log("🚀 Starting application...");
createScene()
    .then((scene) => {
        console.log("✅ Scene created successfully!");
        loadingScreen.updateText("即將進入遊戲...");

        // 延遲隱藏載入螢幕，確保一切就緒
        setTimeout(() => {
            loadingScreen.hide();
        }, 1000);

        engine.runRenderLoop(() => {
            scene.render();
        });
        console.log("✅ Render loop started!");
    })
    .catch((error) => {
        console.error("❌ Failed to create scene:", error);
        console.error("Stack trace:", error.stack);
        loadingScreen.showError(error);
    });

// --- 視窗大小調整 ---
const handleResize = () => {
    engine.resize();

    // 更新 UI idealWidth，確保 HUD 在不同設備上都有合適的大小
    if (globalUITexture) {
        globalUITexture.idealWidth = calculateIdealWidth();
    }

    // 更新相機正交邊界，確保畫面不會變形
    const scene = engine.scenes[0];
    if (scene && scene.activeCamera) {
        updateCameraOrtho(scene.activeCamera as BABYLON.FreeCamera, engine);
    }
};

window.addEventListener("resize", handleResize);

// --- 全螢幕切換處理 ---
const handleFullscreenChange = () => {
    // 延遲執行以確保瀏覽器完成全螢幕切換
    setTimeout(() => {
        handleResize();
    }, 100);
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
document.addEventListener("mozfullscreenchange", handleFullscreenChange);
document.addEventListener("MSFullscreenChange", handleFullscreenChange);
