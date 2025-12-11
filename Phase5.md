Gangs Online: Phase 5 - Social & Weapons
Objective: Add a global chat system with speech bubbles and attach a weapon to the character's hand bone.
Please modify the following files.
Step 1: Server-Side Chat Logic
The server needs to listen for chat messages and broadcast them to all clients.
Modify packages/server/src/rooms/GameRoom.ts:
Add the "chat" message handler in onCreate:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = input.x;
                player.z = input.z;
            }
        });

        this.onMessage("attack", (client, payload: { targetSessionId: string }) => {
            const attacker = this.state.players.get(client.sessionId);
            const target = this.state.players.get(payload.targetSessionId);
            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
                    if (target.hp <= 0) {
                        target.hp = 0;
                        this.broadcast("kill_feed", { killer: attacker.name, victim: target.name }); // Optional: Kill feed
                        this.clock.setTimeout(() => {
                            if (this.state.players.has(target.sessionId)) {
                                const p = this.state.players.get(target.sessionId);
                                if (p) {
                                    p.hp = p.maxHp;
                                    p.x = Math.random() * 10 - 5;
                                    p.z = Math.random() * 10 - 5;
                                }
                            }
                        }, 3000);
                    }
                }
            }
        });

        // --- NEW: CHAT HANDLER ---
        this.onMessage("chat", (client, message: string) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                // Broadcast to everyone including sender
                this.broadcast("chat", { sessionId: client.sessionId, text: message });
            }
        });
    }

    onJoin(client: Client, options: any) {
        const player = new Player();
        player.sessionId = client.sessionId;
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        player.name = options.name || `Gangster ${client.sessionId.substr(0, 4)}`; // Better naming
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
    }
}


Step 2: Client-Side Chat UI & Weapon Attachment
We need to:
Create a Chat Box UI.
Handle incoming chat messages to show bubbles.
Attach a weapon mesh to the character model's hand.
Modify packages/client/src/main.ts.
Replace the file content with this updated version containing Chat and Weapons:
// packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData } from "@gangs-online/shared";
import "@babylonjs/loaders";

const SERVER_URL = "ws://localhost:2567";
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client(SERVER_URL);

// --- VISUALS: WEAPON & CHAT ---

const attachWeapon = (mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
    // 1. Create a simple Bat (Cylinder)
    const bat = BABYLON.MeshBuilder.CreateCylinder("bat", { height: 0.8, diameter: 0.05 }, scene);
    const mat = new BABYLON.StandardMaterial("batMat", scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString("#8B4513"); // Brown wood
    bat.material = mat;

    // 2. Find the Right Hand Bone
    // HVGirl skeleton usually has specific bone names. 
    // We try to attach to the mesh directly if we can find the skeleton.
    const skeleton = mesh.skeleton;
    if (skeleton) {
        // Try standard bone names
        const handBone = skeleton.bones.find(b => b.name.includes("RightHand") || b.name.includes("RightHandMiddle1"));
        if (handBone) {
            bat.attachToBone(handBone, mesh);
            // Adjust position/rotation to fit in hand
            bat.position = new BABYLON.Vector3(0, 0, 0);
            bat.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
        } else {
            bat.dispose(); // No bone found
        }
    } else {
        // Fallback: Just parent to mesh (won't animate with arm)
        bat.parent = mesh;
        bat.position.x = 0.3;
        bat.position.y = 1;
    }
};

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
    rect.addControl(label);

    // Fade out and destroy
    setTimeout(() => {
        rect.dispose();
    }, 4000);
};

const createChatUI = (room: Client.Room, scene: BABYLON.Scene) => {
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("ChatUI");

    // Chat Input Box (Bottom Left)
    const input = new GUI.InputText();
    input.width = "300px";
    input.height = "40px";
    input.text = "";
    input.color = "white";
    input.background = "rgba(0,0,0,0.5)";
    input.placeholderText = "Press Enter to Chat...";
    input.focusedBackground = "rgba(0,0,0,0.8)";
    input.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    input.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    input.left = "20px";
    input.top = "-20px";
    
    // Focus management
    input.onFocusObservable.add(() => {
        // Disable game controls if needed
    });

    // Send on Enter
    input.onKeyboardEventProcessedObservable.add((kbEvent) => {
        if (kbEvent.keyboardEvent.key === "Enter" && input.text) {
            room.send("chat", input.text);
            input.text = "";
            // Keep focus for rapid chatting? Or lose focus:
            // scene.getEngine().getRenderingCanvas()?.focus(); 
        }
    });

    advancedTexture.addControl(input);
    return advancedTexture;
};

// ... (Reuse createCity) ...
const createCity = (scene: BABYLON.Scene) => {
    const ground = BABYLON.MeshBuilder.CreateGround("road", { width: 100, height: 100 }, scene);
    ground.checkCollisions = true;
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;
    
    // Simple environment
    const buildingMat = new BABYLON.StandardMaterial("bMat", scene);
    buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
    for (let i = -4; i <= 4; i++) {
        if (i===0) continue;
        const h = Math.random()*5+5;
        const b = BABYLON.MeshBuilder.CreateBox("b", {width:8, depth:8, height:h}, scene);
        b.position.set(i*12, h/2, 12);
        b.material = buildingMat;
        b.checkCollisions = true;
    }
}

// ... (createPlayerUI helper reused from Phase 4) ...
const createPlayerUI = (mesh: BABYLON.AbstractMesh, name: string, uiTexture: GUI.AdvancedDynamicTexture) => {
    const container = new GUI.Rectangle();
    container.width = "120px";
    container.height = "60px";
    container.thickness = 0;
    uiTexture.addControl(container);
    container.linkWithMesh(mesh);
    container.linkOffsetY = -130; 

    const label = new GUI.TextBlock();
    label.text = name;
    label.color = "white";
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
    hpFg.background = "#00FF00";
    hpFg.thickness = 0;
    hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(hpFg);

    return { container, hpFg };
}

const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero()); 
    const zoom = 14; 
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom; camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom*aspect; camera.orthoRight = zoom*aspect;

    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    createCity(scene);

    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    const playerEntities: any = {};
    const playerTargets: any = {};
    let mySessionId: string | null = null;

    try {
        const room = await client.joinOrCreate("game_room", { name: "Player" });
        mySessionId = room.sessionId;

        // Create Chat Input
        createChatUI(room, scene);

        // Listen for Chat Broadcasts
        room.onMessage("chat", (msg: { sessionId: string, text: string }) => {
            if (playerEntities[msg.sessionId]) {
                createChatBubble(playerEntities[msg.sessionId].mesh, msg.text, uiTexture);
            }
        });

        room.state.players.onAdd(async (player: IPlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
            const root = result.meshes[0];
            root.position.set(player.x, 0.1, player.z); 
            root.scaling.set(0.15, 0.15, 0.15); 
            root.rotationQuaternion = null; 
            root.checkCollisions = true;
            root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
            root.metadata = { sessionId }; 

            // ATTACH WEAPON
            attachWeapon(result.meshes[1], scene); // meshes[1] is usually the skinned mesh in HVGirl

            const idle = result.animationGroups.find(a => a.name === "Idle");
            const run = result.animationGroups.find(a => a.name === "Walking");
            if (idle) idle.play(true);

            const ui = createPlayerUI(root as BABYLON.Mesh, player.name || "Gangster", uiTexture);

            playerEntities[sessionId] = { 
                mesh: root, 
                ui, 
                idleAnim: idle, 
                runAnim: run,
                currentAnim: "idle"
            };
            playerTargets[sessionId] = { x: player.x, z: player.z };

            player.onChange(() => {
                playerTargets[sessionId].x = player.x;
                playerTargets[sessionId].z = player.z;
            });

            player.listen("hp", (val: number) => {
               const pct = Math.max(0, val/player.maxHp);
               ui.hpFg.width = `${pct * 80}px`;
               if (val <= 0) root.visibility = 0.5;
               else root.visibility = 1;
            });
        });

        room.state.players.onRemove((player, sessionId) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].ui.container.dispose();
                delete playerEntities[sessionId];
            }
        });

        scene.onPointerDown = (evt, pickResult) => {
            // Check if chat input is focused? (Simplified)
            if (pickResult.hit && pickResult.pickedMesh) {
                let m = pickResult.pickedMesh;
                while (m.parent) m = m.parent as BABYLON.AbstractMesh;
                
                if (m.metadata && m.metadata.sessionId && m.metadata.sessionId !== mySessionId) {
                    room.send("attack", { targetSessionId: m.metadata.sessionId });
                    return;
                }
                if (!pickResult.pickedMesh.name.startsWith("b_")) {
                    room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
                }
            }
        };

    } catch (e) {
        console.error(e);
    }

    scene.registerBeforeRender(() => {
        // ... (Same Loop Logic as Phase 4 for Movement) ...
        for (const sessionId in playerEntities) {
            const entity = playerEntities[sessionId];
            const target = playerTargets[sessionId];
            if (entity && target) {
                 const mesh = entity.mesh;
                 const dx = target.x - mesh.position.x;
                 const dz = target.z - mesh.position.z;
                 const dist = Math.sqrt(dx*dx + dz*dz);
                 if (dist > 0.1) {
                     const velocity = new BABYLON.Vector3(dx, -0.5, dz).normalize().scale(0.15);
                     if (dist < 0.15) velocity.scaleInPlace(dist/0.15);
                     mesh.rotation.y = BABYLON.Scalar.Lerp(mesh.rotation.y, Math.atan2(dx, dz), 0.2);
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
        if (mySessionId && playerEntities[mySessionId]) {
             const t = playerEntities[mySessionId].mesh.position;
             camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, t.x+20, 0.1);
             camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, t.y+20, 0.1);
             camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, t.z-20, 0.1);
             camera.setTarget(t);
        }
    });

    return scene;
};

createScene().then((scene) => {
    engine.runRenderLoop(() => { scene.render(); });
});
window.addEventListener("resize", () => { engine.resize(); });


