Gangs Online: Phase 4 - Combat System
Objective: Implement player-vs-player combat, including HP synchronization, attack validation on the server, and UI health bars.
Please modify the following files.
Step 1: Update Shared Constants
We need to define the attack range and damage.
Modify packages/shared/src/index.ts:
Add ATTACK_RANGE and DAMAGE to GAME_CONSTANTS:
// packages/shared/src/index.ts
export interface IPlayerInput {
    x: number;
    z: number;
}

export type PlayerRole = 'citizen' | 'triad' | 'police';

export interface IPlayerData {
    id: string;
    sessionId: string;
    x: number;
    y: number;
    z: number;
    role: PlayerRole;
    hp: number;
    maxHp: number;
    name: string;
}

export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.2,
    ATTACK_RANGE: 3.0, // Meters
    ATTACK_DAMAGE: 10
};


Step 2: Server-Side Combat Logic
The server needs to handle the "attack" message, verify distance, and apply damage.
Modify packages/server/src/rooms/GameRoom.ts:
Update the onCreate method to handle "attack":
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Handle Movement
        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) { // Can only move if alive
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Handle Attack
        this.onMessage("attack", (client, payload: { targetSessionId: string }) => {
            const attacker = this.state.players.get(client.sessionId);
            const target = this.state.players.get(payload.targetSessionId);

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                // 1. Calculate Distance (Simple Euclidean)
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // 2. Validate Range
                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    // 3. Apply Damage
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;

                    // 4. Check Death
                    if (target.hp <= 0) {
                        target.hp = 0;
                        // Respawn Logic (Simple: Teleport away and heal after 3s)
                        this.clock.setTimeout(() => {
                            if (this.state.players.has(target.sessionId)) {
                                const respawnedPlayer = this.state.players.get(target.sessionId);
                                if (respawnedPlayer) {
                                    respawnedPlayer.hp = respawnedPlayer.maxHp;
                                    respawnedPlayer.x = Math.random() * 10 - 5;
                                    respawnedPlayer.z = Math.random() * 10 - 5;
                                }
                            }
                        }, 3000);
                    }
                }
            }
        });
    }

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined`);
        const player = new Player();
        player.sessionId = client.sessionId;
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        player.hp = 100;
        player.maxHp = 100;
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
    }
}


Step 3: Client-Side UI & Input
We need to:
Draw a Health Bar above players.
Detect clicks on other players to send "attack".
Update the Health Bar when HP changes.
Modify packages/client/src/main.ts.
Replace createPlayerLabel and update createScene logic:
// packages/client/src/main.ts
// ... existing imports ...
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, GAME_CONSTANTS } from "@gangs-online/shared";
// ... imports end ...

// ... (Keep createCity same as before) ...
const createCity = (scene: BABYLON.Scene) => {
    // ... (Keep existing createCity code) ...
    // Note: Ensure you keep the code that enables collisions!
    // Re-paste the createCity code from Phase 3.5 if needed, or simply assume it exists.
    // For safety, here is a minimal version of createCity to avoid errors in this file block:
    const ground = BABYLON.MeshBuilder.CreateGround("road", { width: 100, height: 100 }, scene);
    ground.checkCollisions = true;
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;
    // ... (Your procedural blocks code here) ...
}


// --- UPDATED UI: Name Tag + Health Bar ---
const createPlayerUI = (mesh: BABYLON.AbstractMesh, name: string, uiTexture: GUI.AdvancedDynamicTexture) => {
    const container = new GUI.Rectangle();
    container.width = "120px";
    container.height = "60px";
    container.thickness = 0;
    uiTexture.addControl(container);
    container.linkWithMesh(mesh);
    container.linkOffsetY = -130; // Adjust based on model height

    // Name
    const label = new GUI.TextBlock();
    label.text = name;
    label.color = "white";
    label.fontSize = 14;
    label.top = "-15px";
    label.shadowBlur = 2;
    container.addControl(label);

    // HP Bar Background (Red)
    const hpBg = new GUI.Rectangle();
    hpBg.width = "100px";
    hpBg.height = "10px";
    hpBg.color = "black";
    hpBg.thickness = 1;
    hpBg.background = "red";
    hpBg.top = "15px";
    container.addControl(hpBg);

    // HP Bar Foreground (Green)
    const hpFg = new GUI.Rectangle();
    hpFg.width = "100px"; // Start full
    hpFg.height = "10px";
    hpFg.thickness = 0;
    hpFg.background = "#00FF00";
    hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(hpFg);

    return { container, hpFg, hpBg };
}

// ... (Update createScene) ...
const createScene = async () => {
    // ... (Setup Engine, Camera, Light, City, Collisions as in Phase 3.5) ...
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero()); 
    // ... (Zoom setup) ...
    const zoom = 14; 
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom;
    camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom * aspect;
    camera.orthoRight = zoom * aspect;

    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    createCity(scene);

    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // --- Multiplayer State ---
    interface PlayerEntity {
        mesh: BABYLON.AbstractMesh;
        ui: { container: GUI.Rectangle, hpFg: GUI.Rectangle, hpBg: GUI.Rectangle };
        idleAnim?: BABYLON.AnimationGroup;
        runAnim?: BABYLON.AnimationGroup;
        currentAnim: "idle" | "run" | "dead";
    }

    const playerEntities: { [sessionId: string]: PlayerEntity } = {};
    const playerTargets: { [sessionId: string]: { x: number; z: number } } = {};
    const MOVE_SPEED = 0.15; 
    let mySessionId: string | null = null;

    try {
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;

        room.state.players.onAdd(async (player: IPlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;
            
            // Load Mesh
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
            const root = result.meshes[0];
            root.position.set(player.x, 0.1, player.z); 
            root.scaling.set(0.15, 0.15, 0.15); 
            root.rotationQuaternion = null; 
            root.checkCollisions = true;
            root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
            root.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);

            // Store SessionId on the mesh for Raycasting
            root.metadata = { sessionId }; 

            // Animations
            const idle = result.animationGroups.find(a => a.name === "Idle");
            const run = result.animationGroups.find(a => a.name === "Walking");
            if (idle) idle.play(true);

            // UI
            const ui = createPlayerUI(root as BABYLON.Mesh, isSelf ? "大佬 (Me)" : "Target", uiTexture);

            playerEntities[sessionId] = { 
                mesh: root, 
                ui, 
                idleAnim: idle, 
                runAnim: run,
                currentAnim: "idle"
            };
            playerTargets[sessionId] = { x: player.x, z: player.z };

            // Sync Position
            player.onChange(() => {
                playerTargets[sessionId].x = player.x;
                playerTargets[sessionId].z = player.z;
            });

            // Sync HP
            player.listen("hp", (currentHp: number) => {
                const percent = Math.max(0, currentHp / player.maxHp);
                ui.hpFg.width = `${percent * 100}px`; // Adjust bar width
                
                // Visual Feedback: Turn red if hit, or transparent if dead
                if (currentHp <= 0) {
                    root.visibility = 0.5; // Ghost mode
                    // Optionally play death anim here
                } else {
                    root.visibility = 1;
                }
            });
        });

        room.state.players.onRemove((player, sessionId) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].ui.container.dispose();
                delete playerEntities[sessionId];
            }
        });

        // --- INPUT: Click to Attack or Move ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                // Check if we clicked a player (using metadata we set earlier)
                // We need to traverse up to root because pick might hit a child mesh (e.g., arm)
                let clickedMesh = pickResult.pickedMesh;
                while (clickedMesh.parent) {
                    clickedMesh = clickedMesh.parent as BABYLON.AbstractMesh;
                }

                if (clickedMesh.metadata && clickedMesh.metadata.sessionId) {
                    // CLICKED ON ENEMY -> ATTACK
                    const targetId = clickedMesh.metadata.sessionId;
                    if (targetId !== mySessionId) {
                        console.log("Attacking:", targetId);
                        room.send("attack", { targetSessionId: targetId });
                        // Visual effect: Maybe flash a particle or play a sound
                        return; // Don't move if attacking
                    }
                }

                // CLICKED ON GROUND -> MOVE
                // Ensure we don't move into buildings (basic filter)
                if (!pickResult.pickedMesh.name.startsWith("b_")) {
                    room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
                }
            }
        };

    } catch (e) {
        console.error("Connection Failed:", e);
    }

    // --- Game Loop ---
    scene.registerBeforeRender(() => {
        for (const sessionId in playerEntities) {
            const entity = playerEntities[sessionId];
            const target = playerTargets[sessionId];

            if (entity && target) {
                const mesh = entity.mesh;
                const dx = target.x - mesh.position.x;
                const dz = target.z - mesh.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist > 0.1) {
                    const velocity = new BABYLON.Vector3(dx, -0.5, dz).normalize().scale(MOVE_SPEED);
                    if (dist < MOVE_SPEED) velocity.scaleInPlace(dist / MOVE_SPEED);

                    const targetAngle = Math.atan2(dx, dz); 
                    mesh.rotation.y = BABYLON.Scalar.Lerp(mesh.rotation.y, targetAngle, 0.2);
                    mesh.moveWithCollisions(velocity);

                    if (entity.currentAnim !== "run") {
                        if(entity.idleAnim) entity.idleAnim.stop();
                        if(entity.runAnim) entity.runAnim.play(true);
                        entity.currentAnim = "run";
                    }
                } else {
                    if (entity.currentAnim !== "idle") {
                        if(entity.runAnim) entity.runAnim.stop();
                        if(entity.idleAnim) entity.idleAnim.play(true);
                        entity.currentAnim = "idle";
                    }
                }
            }
        }

        if (mySessionId && playerEntities[mySessionId]) {
            const myMesh = playerEntities[mySessionId].mesh;
            camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, myMesh.position.x + 20, 0.1);
            camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, myMesh.position.z - 20, 0.1);
            camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, myMesh.position.y + 20, 0.1);
            camera.setTarget(myMesh.position);
        }
    });

    return scene;
};


