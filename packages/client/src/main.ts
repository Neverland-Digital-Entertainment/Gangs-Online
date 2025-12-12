import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { PlayerData } from "@gangs-online/shared";
import "@babylonjs/loaders";

// Import our modular systems
import { config } from "./config";
import { LoadingScreen } from "./systems/LoadingScreen";
import { ChatSystem } from "./systems/ChatSystem";
import { UISystem } from "./systems/UISystem";
import { WeaponSystem } from "./systems/WeaponSystem";
import { CityGenerator } from "./world/CityGenerator";
import { PlayerManager } from "./entities/PlayerManager";
import { createEngine, createIsometricCamera, setupScene, updateCameraFollow } from "./utils/BabylonUtils";

/**
 * 主入口 - 游戏初始化和场景创建
 */

// --- 初始化加载屏幕 ---
console.log("🎮 Initializing Gangs Online...");
const loadingScreen = new LoadingScreen();
loadingScreen.updateText("正在初始化引擎...");

// --- 获取 Canvas ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
if (!canvas) {
    console.error("❌ Canvas element not found!");
    throw new Error("Canvas element 'renderCanvas' not found");
}
console.log("✅ Canvas found:", canvas);

// --- 创建引擎 ---
const engine = createEngine(canvas);
console.log("✅ BabylonJS Engine created");

// --- 创建 Colyseus 客户端 ---
loadingScreen.updateText("正在连接服务器...");
const client = new Client.Client(config.serverUrl);
console.log("✅ Colyseus Client created, server:", config.serverUrl);

/**
 * 创建游戏场景
 */
const createScene = async (): Promise<BABYLON.Scene> => {
    console.log("🌍 Creating scene...");
    loadingScreen.updateText("正在创建游戏世界...");

    const scene = new BABYLON.Scene(engine);

    // 设置场景（光照、碰撞等）
    setupScene(scene);

    // 创建相机
    const camera = createIsometricCamera(scene, engine);

    // 创建城市环境
    const cityGenerator = new CityGenerator(scene);
    cityGenerator.generate();

    // --- UI Layer ---
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // --- 初始化系统 ---
    const uiSystem = new UISystem(uiTexture);
    const weaponSystem = new WeaponSystem();
    const playerManager = new PlayerManager(scene, uiSystem, weaponSystem);

    let mySessionId: string | null = null;

    try {
        // 连接游戏房间
        loadingScreen.updateText("正在连接游戏房间...");
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        // 初始化聊天系统
        loadingScreen.updateText("正在准备游戏界面...");
        const chatSystem = new ChatSystem(room, scene, uiTexture);
        chatSystem.createChatInput();

        // 监听聊天消息
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
                loadingScreen.updateText("正在加载角色模型...");
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

            // 同步战斗状态
            player.listen("inCombatWith", (targetId: string) => {
                playerManager.updateCombatState(sessionId, !!(targetId && targetId !== ""));
            });
        });

        // 移除玩家
        (room.state as any).players.onRemove((player: PlayerData, sessionId: string) => {
            playerManager.removePlayer(sessionId);
        });

        // --- 输入处理：点击攻击或移动 ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                // 检查是否点击了玩家
                let clickedMesh: BABYLON.Node = pickResult.pickedMesh;
                while (clickedMesh.parent) {
                    clickedMesh = clickedMesh.parent;
                }

                if (
                    clickedMesh instanceof BABYLON.AbstractMesh &&
                    clickedMesh.metadata &&
                    clickedMesh.metadata.sessionId
                ) {
                    // 点击玩家 -> 攻击
                    const targetId = clickedMesh.metadata.sessionId;
                    if (targetId !== mySessionId) {
                        console.log("Attacking:", targetId);
                        room.send("attack", { targetSessionId: targetId });
                        return;
                    }
                }

                // 点击地面 -> 移动
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

    // --- 游戏循环（动画 & 移动）---
    scene.registerBeforeRender(() => {
        // 更新所有玩家
        playerManager.updateAll();

        // 相机跟随
        if (mySessionId) {
            const myEntity = playerManager.getEntity(mySessionId);
            if (myEntity) {
                updateCameraFollow(camera, myEntity.mesh);
            }
        }
    });

    return scene;
};

// --- 启动应用 ---
console.log("🚀 Starting application...");
createScene()
    .then((scene) => {
        console.log("✅ Scene created successfully!");
        loadingScreen.updateText("即将进入游戏...");

        // 延迟隐藏加载屏幕，确保一切就绪
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

// --- 窗口大小调整 ---
window.addEventListener("resize", () => {
    engine.resize();
});
