import * as BABYLON from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders"; // Important for loading .glb/.gltf

// --- Configuration ---
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";

// --- Setup ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client(SERVER_URL);

// Log server URL for debugging
console.log(`Server URL: ${SERVER_URL}`);

// --- Loading Screen Control ---
const loadingScreen = document.getElementById("loadingScreen") as HTMLDivElement;
const loadingText = document.querySelector(".loading-text") as HTMLDivElement;

const updateLoadingText = (text: string) => {
    if (loadingText) loadingText.textContent = text;
};

const hideLoading = () => {
    if (loadingScreen) {
        loadingScreen.classList.add("hidden");
        setTimeout(() => {
            loadingScreen.style.display = "none";
        }, 500);
    }
};

// --- Debug Console ---
const debugConsole = document.getElementById("debugConsole") as HTMLDivElement;
const debugToggle = document.getElementById("debugToggle") as HTMLButtonElement;
const debugContent = document.getElementById("debugContent") as HTMLDivElement;

const debugLog = (message: string, color: string = "#00ff00") => {
    if (debugContent) {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement("div");
        line.style.color = color;
        line.textContent = `[${timestamp}] ${message}`;
        debugContent.appendChild(line);
        debugContent.scrollTop = debugContent.scrollHeight;

        // Keep only last 50 messages
        while (debugContent.children.length > 50) {
            debugContent.removeChild(debugContent.firstChild!);
        }
    }
};

// Toggle debug console
if (debugToggle) {
    debugToggle.addEventListener("click", () => {
        debugConsole.classList.toggle("collapsed");
        debugToggle.textContent = debugConsole.classList.contains("collapsed") ? "🐛" : "✖️";
    });
}

// Override console.log to also show in debug console
const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    debugLog(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
};

// --- WEAPON ATTACHMENT ---
const attachWeapon = (rootMesh: BABYLON.AbstractMesh, skinnedMesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
    // Create a wooden bat (cylinder)
    const bat = BABYLON.MeshBuilder.CreateCylinder("bat", { height: 0.6, diameter: 0.08 }, scene);
    const mat = new BABYLON.StandardMaterial("batMat", scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString("#8B4513"); // Brown wood
    mat.emissiveColor = new BABYLON.Color3(0.2, 0.1, 0.05); // Slight glow
    bat.material = mat;

    // Try to find skeleton on the skinned mesh
    const skeleton = skinnedMesh.skeleton;
    if (skeleton) {
        // Try to find hand bone - HVGirl model may have different bone names
        const handBone = skeleton.bones.find(b =>
            b.name.toLowerCase().includes("righthand") ||
            b.name.toLowerCase().includes("r_hand") ||
            b.name.toLowerCase().includes("hand_r") ||
            b.name.toLowerCase().includes("mixamorig:righthand")
        );

        if (handBone) {
            bat.attachToBone(handBone, skinnedMesh);
            bat.position = new BABYLON.Vector3(0, 0.1, 0);
            bat.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Point outward
            return;
        }
    }

    // Fallback: Parent to root and position near where hand would be
    // Since the model is scaled to 0.15, we need to account for that
    bat.parent = rootMesh;
    bat.position = new BABYLON.Vector3(2, 8, 0); // Position relative to root (in model scale)
    bat.rotation = new BABYLON.Vector3(0, 0, Math.PI / 4);
};

// --- CHAT BUBBLE ---
const createChatBubble = (mesh: BABYLON.AbstractMesh, text: string, uiTexture: GUI.AdvancedDynamicTexture) => {
    const rect = new GUI.Rectangle();
    rect.width = "150px";
    rect.height = "40px";
    rect.cornerRadius = 10;
    rect.color = "black";
    rect.thickness = 1;
    rect.background = "white";
    uiTexture.addControl(rect);
    rect.linkWithMesh(mesh);
    rect.linkOffsetY = -180; // Higher than name tag

    const label = new GUI.TextBlock();
    label.text = text;
    label.fontSize = 12;
    label.textWrapping = true;
    label.color = "black";
    rect.addControl(label);

    // Fade out and destroy
    setTimeout(() => {
        rect.dispose();
    }, 4000);
};

// --- CHAT UI ---
const createChatUI = (room: Client.Room, scene: BABYLON.Scene) => {
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("ChatUI");

    // Chat Log (Above input box) - Responsive width
    const chatLog = new GUI.TextBlock();
    chatLog.width = 0.9; // 90% of screen width
    chatLog.height = "200px";
    chatLog.color = "white";
    chatLog.fontSize = 14;
    chatLog.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    chatLog.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    chatLog.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    chatLog.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    chatLog.left = "20px";
    chatLog.top = "-70px";
    chatLog.textWrapping = true;
    chatLog.resizeToFit = false;
    advancedTexture.addControl(chatLog);

    const chatMessages: string[] = [];
    const addChatMessage = (msg: string) => {
        chatMessages.push(msg);
        if (chatMessages.length > 8) chatMessages.shift(); // Keep last 8 messages
        chatLog.text = chatMessages.join('\n');
    };

    // Send message function
    const sendMessage = () => {
        if (input.text.trim()) {
            room.send("chat", input.text);
            input.text = "";
        }
    };

    // Chat Input Container
    const inputContainer = new GUI.StackPanel();
    inputContainer.isVertical = false;
    inputContainer.height = "50px";
    inputContainer.width = 0.9; // 90% of screen width
    inputContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    inputContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    inputContainer.left = "20px";
    inputContainer.top = "-10px";
    advancedTexture.addControl(inputContainer);

    // Chat Input Box - Flexible width
    const input = new GUI.InputText();
    input.width = 0.75; // 75% of container
    input.height = "40px";
    input.text = "";
    input.color = "white";
    input.background = "rgba(0,0,0,0.5)";
    input.placeholderText = "輸入訊息或指令...";
    input.placeholderColor = "gray";
    input.focusedBackground = "rgba(0,0,0,0.8)";
    input.paddingLeft = "10px";

    // Send on Enter (for desktop)
    input.onKeyboardEventProcessedObservable.add((ev) => {
        if (ev.key === "Enter") {
            sendMessage();
        }
    });
    inputContainer.addControl(input);

    // Send Button (for mobile)
    const sendButton = GUI.Button.CreateSimpleButton("sendBtn", "傳送");
    sendButton.width = 0.25; // 25% of container
    sendButton.height = "40px";
    sendButton.color = "white";
    sendButton.background = "#4CAF50";
    sendButton.thickness = 0;
    sendButton.cornerRadius = 5;
    sendButton.fontSize = 16;
    sendButton.paddingLeft = "5px";

    sendButton.onPointerClickObservable.add(() => {
        sendMessage();
    });

    // Hover effect
    sendButton.onPointerEnterObservable.add(() => {
        sendButton.background = "#45a049";
    });
    sendButton.onPointerOutObservable.add(() => {
        sendButton.background = "#4CAF50";
    });

    inputContainer.addControl(sendButton);

    return { advancedTexture, addChatMessage };
};

// --- City Generator (Procedural Greybox) ---
const createCity = (scene: BABYLON.Scene) => {
    // 1. Asphalt Road
    const ground = BABYLON.MeshBuilder.CreateGround("road", { width: 100, height: 100 }, scene);
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;

    // ENABLE COLLISION ON GROUND
    ground.checkCollisions = true;

    // 2. Sidewalks (Lighter Grey)
    const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", scene);
    sidewalkMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // 3. Buildings (Neon Blocks)
    const buildingMat = new BABYLON.StandardMaterial("bMat", scene);
    buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
    buildingMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2);

    // Generate random blocks
    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;

            const height = Math.random() * 8 + 4;

            const building = BABYLON.MeshBuilder.CreateBox(`b_${i}_${j}`, { height: height, width: 8, depth: 8 }, scene);
            building.position.set(i * 12, height / 2, j * 12);
            building.material = buildingMat;

            // ENABLE COLLISION ON BUILDINGS
            building.checkCollisions = true;

            const walk = BABYLON.MeshBuilder.CreateGround(`w_${i}_${j}`, { width: 10, height: 10 }, scene);
            walk.position.set(i * 12, 0.05, j * 12);
            walk.material = sidewalkMat;

            // ENABLE COLLISION ON SIDEWALKS
            walk.checkCollisions = true;
        }
    }
}

// --- Entity UI: Name Tag + Health Bar ---
const createEntityUI = (mesh: BABYLON.AbstractMesh, name: string, isEnemy: boolean, uiTexture: GUI.AdvancedDynamicTexture) => {
    const container = new GUI.Rectangle();
    container.width = "120px";
    container.height = "60px";
    container.thickness = 0;
    uiTexture.addControl(container);
    container.linkWithMesh(mesh);
    container.linkOffsetY = -130;

    const label = new GUI.TextBlock();
    label.text = name;
    label.color = isEnemy ? "#FF4444" : "white"; // Red text for enemies
    label.top = "-15px";
    container.addControl(label);

    const hpBg = new GUI.Rectangle();
    hpBg.width = "80px";
    hpBg.height = "8px";
    hpBg.background = "red";
    hpBg.thickness = 0;
    hpBg.top = "10px";
    container.addControl(hpBg);

    const hpFg = new GUI.Rectangle();
    hpFg.width = "80px";
    hpFg.height = "8px";
    hpFg.background = isEnemy ? "orange" : "#00FF00";
    hpFg.thickness = 0;
    hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(hpFg);

    return { container, hpFg };
}

const createScene = async () => {
    updateLoadingText("正在準備遊戲介面...");
    const scene = new BABYLON.Scene(engine);

    // --- ENABLE GLOBAL COLLISIONS ---
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0); // Standard Gravity

    updateLoadingText("正在設定攝影機...");

    // --- Camera (True Isometric) ---
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero());

    // Zoom
    const zoom = 14;
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom;
    camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom * aspect;
    camera.orthoRight = zoom * aspect;

    // --- Lighting ---
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;

    // --- Environment ---
    updateLoadingText("正在建立城市環境...");
    createCity(scene);

    // --- UI Layer ---
    updateLoadingText("正在初始化 UI...");
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Unified Entity Store
    const entities: any = {};
    const targets: any = {};
    let mySessionId: string | null = null;

    // Helper to spawn visual mesh
    const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy') => {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/", "HVGirl.glb", scene);
        const root = result.meshes[0];
        root.position.set(entityData.x, 0.1, entityData.z);
        root.scaling.set(0.15, 0.15, 0.15);
        root.rotationQuaternion = null;
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);

        // Metadata for click detection
        root.metadata = { id: id, type: type };

        // Tint Enemies Red
        if (type === 'enemy') {
            const meshes = root.getChildMeshes();
            meshes.forEach(m => {
                if (m.material) {
                    // Clone material to not affect others
                    const newMat = m.material.clone(`enemyMat_${id}`);
                    if (newMat && 'emissiveColor' in newMat) {
                         (newMat as any).emissiveColor = new BABYLON.Color3(0.5, 0, 0); // Red Glow
                    }
                    m.material = newMat;
                }
            });
        }

        const idle = result.animationGroups.find(a => a.name === "Idle");
        const run = result.animationGroups.find(a => a.name === "Walking");
        if (idle) idle.play(true);

        const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy', uiTexture);

        entities[id] = {
            mesh: root,
            ui,
            idleAnim: idle,
            runAnim: run,
            currentAnim: "idle"
        };
        targets[id] = { x: entityData.x, z: entityData.z };

        // Sync Logic
        entityData.onChange(() => {
            targets[id].x = entityData.x;
            targets[id].z = entityData.z;
        });

        entityData.listen("hp", (val: number) => {
             const pct = Math.max(0, val/entityData.maxHp);
             ui.hpFg.width = `${pct * 80}px`;
             if (val <= 0) root.visibility = 0.5;
             else root.visibility = 1;
        });
    };

    try {
        updateLoadingText("正在連接伺服器...");
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        updateLoadingText("正在載入遊戲資源...");

        // Create Chat Input
        const { addChatMessage } = createChatUI(room, scene);

        // Listen for Chat Broadcasts
        room.onMessage("chat", (msg: { sessionId: string, text: string }) => {
            // Show in chat log
            const displayMsg = msg.sessionId === "DEBUG" ? msg.text : `${msg.sessionId.substr(0, 4)}: ${msg.text}`;
            addChatMessage(displayMsg);

            // Show chat bubble for players (not DEBUG messages)
            if (msg.sessionId !== "DEBUG" && entities[msg.sessionId]) {
                createChatBubble(entities[msg.sessionId].mesh, msg.text, uiTexture);
            }
        });

        // --- PLAYERS ---
        (room.state as any).players.onAdd((player: any, sessionId: string) => {
            spawnEntityVisuals(player, sessionId, 'player');
        });
        (room.state as any).players.onRemove((player: any, sessionId: string) => {
            if (entities[sessionId]) {
                entities[sessionId].mesh.dispose();
                entities[sessionId].ui.container.dispose();
                delete entities[sessionId];
                delete targets[sessionId];
            }
        });

        // --- ENEMIES ---
        (room.state as any).enemies.onAdd((enemy: any, enemyId: string) => {
            console.log(`[CLIENT] Enemy spawned: ${enemy.name} [${enemyId}] at (${enemy.x.toFixed(2)}, ${enemy.z.toFixed(2)})`);
            spawnEntityVisuals(enemy, enemyId, 'enemy');
        });
        (room.state as any).enemies.onRemove((enemy: any, enemyId: string) => {
            console.log(`[CLIENT] Enemy removed: [${enemyId}]`);
            if (entities[enemyId]) {
                entities[enemyId].mesh.dispose();
                entities[enemyId].ui.container.dispose();
                delete entities[enemyId];
                delete targets[enemyId];
            }
        });

        // --- INPUT ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                let m = pickResult.pickedMesh;
                while (m.parent) m = m.parent as BABYLON.AbstractMesh;

                if (m.metadata) {
                    const targetId = m.metadata.id;
                    const type = m.metadata.type;

                    if (targetId !== mySessionId) {
                        // Attack Player OR Enemy
                        room.send("attack", { targetId: targetId, type: type });
                        return;
                    }
                }

                if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road")) {
                     room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
                }
            }
        };

        // Hide loading screen when everything is ready
        updateLoadingText("準備完成！");
        setTimeout(() => {
            hideLoading();
            console.log("Game loaded successfully!");
        }, 500);

    } catch (e) {
        console.error("Connection Failed:", e);
        updateLoadingText("連接失敗！請重新整理頁面");
        debugLog("ERROR: " + e, "#ff0000");
    }

    // --- RENDER LOOP ---
    scene.registerBeforeRender(() => {
        // Updated loop to handle both players and enemies in `entities`
        for (const id in entities) {
            const entity = entities[id];
            const target = targets[id];
            if (entity && target) {
                 const mesh = entity.mesh;
                 const dx = target.x - mesh.position.x;
                 const dz = target.z - mesh.position.z;
                 const dist = Math.sqrt(dx*dx + dz*dz);
                 if (dist > 0.1) {
                     const velocity = new BABYLON.Vector3(dx, -0.5, dz).normalize().scale(0.15); // Sync speed visual
                     if (dist < 0.15) velocity.scaleInPlace(dist/0.15);

                     const targetAngle = Math.atan2(dx, dz);
                     // Smooth rotation
                     mesh.rotation.y = BABYLON.Scalar.Lerp(mesh.rotation.y, targetAngle, 0.2);
                     mesh.moveWithCollisions(velocity);

                     if (entity.currentAnim !== "run") {
                         entity.idleAnim?.stop(); entity.runAnim?.play(true); entity.currentAnim = "run";
                     }
                 } else {
                     if (entity.currentAnim !== "idle") {
                         entity.runAnim?.stop(); entity.idleAnim?.play(true); entity.currentAnim = "idle";
                     }
                 }
            }
        }

        // Camera Follow
        if (mySessionId && entities[mySessionId]) {
             const t = entities[mySessionId].mesh.position;
             camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, t.x+20, 0.1);
             camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, t.y+20, 0.1);
             camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, t.z-20, 0.1);
             camera.setTarget(t);
        }
    });

    return scene;
};

createScene().then((scene) => {
    engine.runRenderLoop(() => {
        scene.render();
    });
});

window.addEventListener("resize", () => {
    engine.resize();
});
