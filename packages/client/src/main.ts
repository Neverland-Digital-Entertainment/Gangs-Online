import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { PlayerData, IEnemyData, EntityType } from "@gangs-online/shared";
import "@babylonjs/loaders";

// Import our modular systems
import { config } from "./config";
import { LoadingScreen } from "./systems/LoadingScreen";
import { ChatSystem } from "./systems/ChatSystem";
import { UISystem } from "./systems/UISystem";
import { WeaponSystem } from "./systems/WeaponSystem";
import { CityGenerator } from "./world/CityGenerator";
import { PlayerManager } from "./entities/PlayerManager";
import { EnemyManager } from "./entities/EnemyManager";
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

    try {
        // 連接遊戲房間
        loadingScreen.updateText("正在連接遊戲房間...");
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        // 初始化聊天系統
        loadingScreen.updateText("正在準備遊戲介面...");
        const chatSystem = new ChatSystem(room, scene, uiTexture);
        chatSystem.createChatInput();

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
        });

        // 移除玩家
        (room.state as any).players.onRemove((player: PlayerData, sessionId: string) => {
            playerManager.removePlayer(sessionId);
        });

        // --- 敵人事件處理 ---
        // 等待下一次狀態同步後再設置敵人監聽器
        room.onStateChange.once(async (state) => {
            console.log("🔄 State synchronized, setting up enemy listeners...");

            if ((state as any).enemies) {
                // 設置新敵人加入的監聽器
                (state as any).enemies.onAdd(async (enemy: any, enemyId: string) => {
                    console.log(`🧟 Enemy joined: ${enemyId}`);
                    await enemyManager.createEnemy(enemy, enemyId);
                });

                // 設置敵人移除的監聽器
                (state as any).enemies.onRemove((enemy: any, enemyId: string) => {
                    console.log(`🧟 Enemy left: ${enemyId}`);
                    enemyManager.removeEnemy(enemyId);
                });

                // 為已存在的敵人創建實體（因為 onAdd 只對新加入的生效）
                console.log(`📦 Loading existing enemies: ${(state as any).enemies.size}`);
                (state as any).enemies.forEach(async (enemy: any, enemyId: string) => {
                    console.log(`🧟 Creating existing enemy: ${enemyId}`);
                    await enemyManager.createEnemy(enemy, enemyId);
                });

                console.log(`✅ Enemy system initialized`);
            } else {
                console.error("❌ enemies still not available after state sync");
            }
        });

        // --- 輸入處理：點擊攻擊或移動 ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
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
                        console.log("🗡️ Attacking enemy:", enemyId);
                        room.send("attack", { targetId: enemyId, type: "enemy" as EntityType });
                        return;
                    }
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
