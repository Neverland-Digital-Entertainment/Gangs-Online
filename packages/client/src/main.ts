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
import { InventorySystem } from "./systems/InventorySystem"; // Phase 8
import { CityGenerator } from "./world/CityGenerator";
import { PlayerManager } from "./entities/PlayerManager";
import { EnemyManager } from "./entities/EnemyManager";
import { LootManager } from "./entities/LootManager"; // Phase 8
import { createEngine, createIsometricCamera, setupScene, updateCameraFollow } from "./utils/BabylonUtils";

/**
 * 主入口 - 遊戲初始化和場景創建
 */

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

    // --- 初始化系統 ---
    const uiSystem = new UISystem(uiTexture);
    const weaponSystem = new WeaponSystem();
    const playerManager = new PlayerManager(scene, uiSystem, weaponSystem);
    const enemyManager = new EnemyManager(scene, uiSystem); // 敵人管理系統

    let mySessionId: string | null = null;
    let lootManager: LootManager | null = null; // Phase 8
    let inventorySystem: InventorySystem | null = null; // Phase 8

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

        // 初始化聊天系統
        loadingScreen.updateText("正在準備遊戲介面...");
        const chatSystem = new ChatSystem(room, scene, uiTexture);
        chatSystem.createChatInput();

        // === Phase 8: 初始化戰利品和背包系統 ===
        lootManager = new LootManager(scene, room);
        inventorySystem = new InventorySystem(room, uiTexture);

        // 監聽聊天訊息
        room.onMessage("chat", (msg: { sessionId: string; text: string }) => {
            const entity = playerManager.getEntity(msg.sessionId);
            if (entity) {
                chatSystem.createChatBubble(entity.mesh, msg.text);
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
            player.listen("hp", (currentHp: number) => {
                playerManager.updateHealth(sessionId, currentHp, player.maxHp);
            });

            // 同步戰鬥狀態
            player.listen("inCombatWith", (targetId: string) => {
                playerManager.updateCombatState(sessionId, !!(targetId && targetId !== ""));
            });

            // === Phase 7: 同步經驗值和等級 ===
            player.listen("xp", (currentXP: number) => {
                playerManager.updateXP(sessionId, currentXP, player.maxXp);
            });

            player.listen("level", (newLevel: number) => {
                playerManager.updateLevel(sessionId, newLevel, player.name);
            });

            // === Phase 8: 同步背包系統（僅限自己的角色）===
            if (isSelf && inventorySystem) {
                inventorySystem.setupPlayerInventoryListener(player);
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

                // 設置新敵人加入的監聽器
                enemiesMap.onAdd(async (enemy: any, enemyId: string) => {
                    console.log(`🧟 Enemy joined: ${enemyId}`);
                    await enemyManager.createEnemy(enemy, enemyId);
                });

                // 設置敵人移除的監聽器
                enemiesMap.onRemove((enemy: any, enemyId: string) => {
                    console.log(`🧟 Enemy left: ${enemyId}`);
                    enemyManager.removeEnemy(enemyId);
                });

                // 為已存在的敵人創建實體（修正：使用 Promise.all 等待所有敵人創建完成）
                console.log(`📦 Loading ${enemiesMap.size} existing enemies...`);
                const enemyCreationPromises: Promise<any>[] = [];
                enemiesMap.forEach((enemy: any, enemyId: string) => {
                    console.log(`🧟 Creating existing enemy: ${enemyId}`);
                    enemyCreationPromises.push(enemyManager.createEnemy(enemy, enemyId));
                });
                await Promise.all(enemyCreationPromises);

                console.log(`✅ Enemy system initialized successfully (${enemyCreationPromises.length} enemies loaded)`);
            } catch (error) {
                console.error("❌ Error setting up enemy system:", error);
                console.log("Retrying in 500ms...");
                setTimeout(setupEnemySystem, 500);
            }
        };

        // 延遲執行以確保房間狀態完全初始化
        setTimeout(setupEnemySystem, 100);

        // --- 輸入處理：點擊攻擊、拾取戰利品或移動 (Phase 8 更新) ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                // === Phase 8: 檢查是否點擊了戰利品 ===
                if (lootManager && lootManager.isLootMesh(pickResult.pickedMesh)) {
                    const lootId = lootManager.getLootId(pickResult.pickedMesh);
                    if (lootId) {
                        console.log("📦 Picking up loot:", lootId);
                        room.send("pickup", lootId);
                        return;
                    }
                }

                // 檢查是否點擊了玩家或敵人
                let clickedMesh: BABYLON.Node = pickResult.pickedMesh;
                while (clickedMesh.parent) {
                    clickedMesh = clickedMesh.parent;
                }

                if (
                    clickedMesh instanceof BABYLON.AbstractMesh &&
                    clickedMesh.metadata
                ) {
                    // 檢查是否點擊了玩家
                    if (clickedMesh.metadata.sessionId) {
                        const targetId = clickedMesh.metadata.sessionId;
                        if (targetId !== mySessionId) {
                            console.log("🗡️ Attacking player:", targetId);
                            room.send("attack", { targetId: targetId, type: "player" as EntityType });
                            return;
                        }
                    }

                    // 檢查是否點擊了敵人
                    if (clickedMesh.metadata.type === "enemy" && clickedMesh.metadata.id) {
                        const enemyId = clickedMesh.metadata.id;
                        console.log("🗡️ Attacking enemy:", enemyId, "metadata:", clickedMesh.metadata);
                        room.send("attack", { targetId: enemyId, type: "enemy" as EntityType });
                        return;
                    }

                    // 診斷：顯示點擊的物體資訊
                    console.log("❓ Clicked mesh:", clickedMesh.name, "metadata:", clickedMesh.metadata);
                }

                // 點擊地面 -> 移動
                if (pickResult.pickedPoint && !pickResult.pickedMesh.name.startsWith("b_")) {
                    room.send("move", {
                        x: pickResult.pickedPoint.x,
                        z: pickResult.pickedPoint.z,
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

        // 相機跟隨
        if (mySessionId) {
            const myEntity = playerManager.getEntity(mySessionId);
            if (myEntity) {
                updateCameraFollow(camera, myEntity.mesh);
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
window.addEventListener("resize", () => {
    engine.resize();
});
