Gangs Online: Phase 7 - Progression System
Objective: Implement XP, Leveling, and Triad Ranks (Titles).
Please modify the following files.
Step 1: Update Shared Definitions
We need to add Level and XP to the Player data, and define the XP curve.
Modify packages/shared/src/index.ts:
Update IPlayerData and GAME_CONSTANTS:
// packages/shared/src/index.ts
export interface IPlayerInput {
    x: number;
    z: number;
}

export type PlayerRole = 'citizen' | 'triad' | 'police';

export interface IEntityData {
    id: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    name: string;
    type: 'player' | 'enemy';
}

export interface IPlayerData extends IEntityData {
    sessionId: string;
    role: PlayerRole;
    // NEW: Progression
    level: number;
    xp: number;
    maxXp: number;
}

export interface IEnemyData extends IEntityData {
    state: 'idle' | 'chase' | 'attack';
}

export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.15,
    ENEMY_SPEED: 0.1,
    ATTACK_RANGE: 2.0,
    ATTACK_DAMAGE: 10,
    ENEMY_DETECT_RANGE: 10.0,
    ENEMY_SPAWN_COUNT: 10,
    // NEW: XP per kill
    XP_PER_KILL: 50,
    BASE_XP_TO_LEVEL: 100
};

// NEW: Helper to get Rank Title based on Level
export const getRankTitle = (level: number): string => {
    if (level >= 10) return "紅棍 (Red Pole)";
    if (level >= 6) return "草鞋 (Straw Sandal)";
    if (level >= 3) return "四九 (49)";
    return "藍燈籠 (Blue Lantern)";
};


Step 2: Server-Side Leveling Logic
Update the Schema and GameRoom to handle XP gain.
Modify packages/server/src/rooms/schema/GameState.ts:
Add level, xp, maxXp to Player schema:
// packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";
import { IPlayerData, IEnemyData, PlayerRole, GAME_CONSTANTS } from "@gangs-online/shared";

export class Player extends Schema implements IPlayerData {
    @type("string") id: string = "";
    @type("string") sessionId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("string") role: PlayerRole = "triad"; 
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("string") name: string = "";
    @type("string") type: 'player' | 'enemy' = "player";

    // NEW
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = GAME_CONSTANTS.BASE_XP_TO_LEVEL;
}

export class Enemy extends Schema implements IEnemyData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("number") hp: number = 50;
    @type("number") maxHp: number = 50;
    @type("string") name: string = "Thug";
    @type("string") state: 'idle' | 'chase' | 'attack' = "idle";
    @type("string") type: 'player' | 'enemy' = "enemy";
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
}


Modify packages/server/src/rooms/GameRoom.ts to award XP on kill:
Update the attack handler logic:
// packages/server/src/rooms/GameRoom.ts
// ... imports ...
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, getRankTitle } from "@gangs-online/shared"; // Import helper

export class GameRoom extends Room<GameState> {
    // ... setup code ...
    maxClients = 50;

    onCreate(options: any) {
        // ... (Keep existing setup) ...
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        // Spawn Enemies
        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) this.spawnEnemy();

        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = input.x;
                player.z = input.z;
            }
        });

        // --- UPDATED ATTACK LOGIC ---
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' }) => {
            const attacker = this.state.players.get(client.sessionId);
            let target: Player | Enemy | undefined;

            if (payload.type === 'player') target = this.state.players.get(payload.targetId);
            else if (payload.type === 'enemy') target = this.state.enemies.get(payload.targetId);

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
                    
                    if (target.hp <= 0) {
                        target.hp = 0;
                        
                        // --- XP & LEVEL UP LOGIC ---
                        if (payload.type === 'enemy') {
                            attacker.xp += GAME_CONSTANTS.XP_PER_KILL;
                            
                            // Check Level Up
                            if (attacker.xp >= attacker.maxXp) {
                                attacker.xp -= attacker.maxXp; // Carry over
                                attacker.level++;
                                attacker.maxXp = Math.floor(attacker.maxXp * 1.5); // Harder to level up
                                attacker.maxHp += 20; // Stat boost
                                attacker.hp = attacker.maxHp; // Full heal
                                
                                const newTitle = getRankTitle(attacker.level);
                                this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} 升職了! 現在是 ${newTitle} (Lv${attacker.level})` });
                            }
                        }

                        if (payload.type === 'player') {
                            this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} 隊冧咗 ${target.name}!` });
                            this.clock.setTimeout(() => this.respawnPlayer(payload.targetId), 3000);
                        } else {
                            this.state.enemies.delete(payload.targetId);
                            this.clock.setTimeout(() => this.spawnEnemy(), 5000);
                        }
                    }
                }
            }
        });

        this.onMessage("chat", (client, message: string) => {
            this.broadcast("chat", { sessionId: client.sessionId, text: message });
        });
    }

    // ... (Keep update, respawnPlayer, spawnEnemy, onJoin, onLeave) ...
    // Note: Ensure spawnEnemy matches previous logic
    update(deltaTime: number) {
        this.state.enemies.forEach(enemy => {
             if (enemy.hp <= 0) return;
             let nearestPlayer: Player | null = null;
             let minDist = 9999;
             this.state.players.forEach(player => {
                 if (player.hp <= 0) return;
                 const dx = player.x - enemy.x;
                 const dz = player.z - enemy.z;
                 const dist = Math.sqrt(dx*dx + dz*dz);
                 if (dist < minDist) { minDist = dist; nearestPlayer = player; }
             });

             if (nearestPlayer && minDist < GAME_CONSTANTS.ENEMY_DETECT_RANGE) {
                 if (minDist > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                     enemy.state = "chase";
                     const dx = nearestPlayer.x - enemy.x;
                     const dz = nearestPlayer.z - enemy.z;
                     enemy.x += (dx / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                     enemy.z += (dz / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                 } else {
                     enemy.state = "attack";
                     if (Math.random() < 0.02) {
                         nearestPlayer.hp -= 5;
                         if (nearestPlayer.hp <= 0) {
                             nearestPlayer.hp = 0;
                             this.respawnPlayer(nearestPlayer.sessionId);
                         }
                     }
                 }
             } else {
                 enemy.state = "idle";
             }
        });
    }

    respawnPlayer(sessionId: string) {
        const p = this.state.players.get(sessionId);
        if (p) { p.hp = p.maxHp; p.x = Math.random() * 10 - 5; p.z = Math.random() * 10 - 5; }
    }

    spawnEnemy() {
        const enemy = new Enemy();
        enemy.id = `mob_${Math.random().toString(36).substr(2, 5)}`;
        enemy.x = Math.random() * 40 - 20;
        enemy.z = Math.random() * 40 - 20;
        enemy.name = "Street Thug";
        this.state.enemies.set(enemy.id, enemy);
    }

    onJoin(client: Client, options: any) {
        const player = new Player();
        player.sessionId = client.sessionId;
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        player.name = options.name || `Gangster ${client.sessionId.substr(0, 4)}`;
        // New players start at Level 1
        this.state.players.set(client.sessionId, player);
    }
    
    onLeave(client: Client) { this.state.players.delete(client.sessionId); }
}


Step 3: Client-Side UI Update
Update the createEntityUI function to show the yellow XP bar and rank title.
Modify packages/client/src/main.ts:
Update createEntityUI and Player spawning logic:
// packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, getRankTitle } from "@gangs-online/shared"; // Import getRankTitle
import "@babylonjs/loaders";

// ... (Keep existing Setup, createCity, createChatBubble, createChatUI) ...

// --- UPDATED UI HELPER ---
const createEntityUI = (mesh: BABYLON.AbstractMesh, name: string, isEnemy: boolean, level: number = 1) => {
    const container = new GUI.Rectangle();
    container.width = "160px"; // Wider for long titles
    container.height = "80px";
    container.thickness = 0;
    // container.linkWithMesh(mesh); // We do this outside to access uiTexture
    
    const label = new GUI.TextBlock();
    // For players, show Title + Name. For enemies, just Name.
    label.text = isEnemy ? `${name} (Lv${level})` : `[${getRankTitle(level)}] ${name}`;
    label.color = isEnemy ? "#FF4444" : "white"; 
    label.fontSize = 12;
    label.top = "-25px";
    label.shadowBlur = 2;
    container.addControl(label);

    // HP Bar (Red bg, Green fg)
    const hpBg = new GUI.Rectangle();
    hpBg.width = "100px"; hpBg.height = "8px"; hpBg.background = "red"; hpBg.thickness = 1; hpBg.color = "black";
    hpBg.top = "-5px";
    container.addControl(hpBg);

    const hpFg = new GUI.Rectangle();
    hpFg.width = "100px"; hpFg.height = "8px"; hpFg.background = isEnemy ? "orange" : "#00FF00"; hpFg.thickness = 0;
    hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(hpFg);

    // XP Bar (Yellow) - Only for Players
    let xpFg: GUI.Rectangle | null = null;
    if (!isEnemy) {
        const xpBg = new GUI.Rectangle();
        xpBg.width = "100px"; xpBg.height = "4px"; xpBg.background = "black"; xpBg.thickness = 0;
        xpBg.top = "5px"; // Below HP
        container.addControl(xpBg);

        xpFg = new GUI.Rectangle();
        xpFg.width = "0px"; // Start empty
        xpFg.height = "4px"; xpFg.background = "yellow"; xpFg.thickness = 0;
        xpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        xpBg.addControl(xpFg);
    }

    return { container, hpFg, xpFg, label };
}

// ... (Keep existing main logic) ...

const createScene = async () => {
    // ... (Keep Setup) ...
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Unified Entity Store (Updated type)
    interface EntityVisuals {
        mesh: BABYLON.AbstractMesh;
        ui: { container: GUI.Rectangle, hpFg: GUI.Rectangle, xpFg: GUI.Rectangle | null, label: GUI.TextBlock };
        idleAnim?: BABYLON.AnimationGroup;
        runAnim?: BABYLON.AnimationGroup;
        currentAnim: "idle" | "run";
    }
    const entities: { [id: string]: EntityVisuals } = {};
    const targets: any = {};
    let mySessionId: string | null = null;

    // Helper to spawn visual mesh
    const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy') => {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
        const root = result.meshes[0];
        root.position.set(entityData.x, 0.1, entityData.z); 
        root.scaling.set(0.15, 0.15, 0.15); 
        root.rotationQuaternion = null; 
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
        root.metadata = { id: id, type: type }; 

        if (type === 'enemy') {
            root.getChildMeshes().forEach(m => {
                if (m.material) {
                    const newMat = m.material.clone(`enemyMat_${id}`);
                    if (newMat && 'emissiveColor' in newMat) (newMat as any).emissiveColor = new BABYLON.Color3(0.5, 0, 0);
                    m.material = newMat;
                }
            });
        }

        const idle = result.animationGroups.find(a => a.name === "Idle");
        const run = result.animationGroups.find(a => a.name === "Walking");
        if (idle) idle.play(true);

        // UI Creation with Level
        const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy', entityData.level || 1);
        uiTexture.addControl(ui.container);
        ui.container.linkWithMesh(root);
        ui.container.linkOffsetY = -130;

        entities[id] = { mesh: root, ui, idleAnim: idle, runAnim: run, currentAnim: "idle" };
        targets[id] = { x: entityData.x, z: entityData.z };
        
        entityData.onChange(() => { targets[id].x = entityData.x; targets[id].z = entityData.z; });
        
        entityData.listen("hp", (val: number) => {
             const pct = Math.max(0, val/entityData.maxHp);
             ui.hpFg.width = `${pct * 100}px`;
             root.visibility = (val <= 0) ? 0.5 : 1;
        });

        // Listen for XP/Level changes (Players only)
        if (type === 'player') {
            entityData.listen("xp", (val: number) => {
                if (ui.xpFg) {
                    const pct = Math.max(0, val/entityData.maxXp);
                    ui.xpFg.width = `${pct * 100}px`;
                }
            });
            entityData.listen("level", (val: number) => {
                // Update Title
                ui.label.text = `[${getRankTitle(val)}] ${entityData.name}`;
                // Optional: Play Level Up Particle/Sound here
            });
        }
    };

    // ... (Rest of logic: joinOrCreate, onAdd players/enemies, input, render loop) ...
    // ... Copy from previous phase, ensuring spawnEntityVisuals is used ...
    
    try {
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        createChatUI(room, scene);

        room.onMessage("chat", (msg: { sessionId: string, text: string }) => {
            if (entities[msg.sessionId]) createChatBubble(entities[msg.sessionId].mesh, msg.text, uiTexture);
        });

        room.state.players.onAdd((p, sId) => spawnEntityVisuals(p, sId, 'player'));
        room.state.players.onRemove((p, sId) => { if(entities[sId]) { entities[sId].mesh.dispose(); entities[sId].ui.container.dispose(); delete entities[sId]; delete targets[sId]; } });

        room.state.enemies.onAdd((e, eId) => spawnEntityVisuals(e, eId, 'enemy'));
        room.state.enemies.onRemove((e, eId) => { if(entities[eId]) { entities[eId].mesh.dispose(); entities[eId].ui.container.dispose(); delete entities[eId]; delete targets[eId]; } });

        scene.onPointerDown = (evt, pickResult) => {
             if (pickResult.hit && pickResult.pickedMesh) {
                let m = pickResult.pickedMesh;
                while (m.parent) m = m.parent as BABYLON.AbstractMesh;
                if (m.metadata && m.metadata.id && m.metadata.id !== mySessionId) {
                    room.send("attack", { targetId: m.metadata.id, type: m.metadata.type });
                    return;
                }
                if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road")) {
                     room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
                }
            }
        };

    } catch(e) { console.error(e); }

    scene.registerBeforeRender(() => {
        // ... (Keep existing movement/camera logic) ...
        for (const id in entities) {
            const entity = entities[id];
            const target = targets[id];
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
                     if (entity.currentAnim !== "run") { entity.idleAnim?.stop(); entity.runAnim?.play(true); entity.currentAnim = "run"; }
                 } else {
                     if (entity.currentAnim !== "idle") { entity.runAnim?.stop(); entity.idleAnim?.play(true); entity.currentAnim = "idle"; }
                 }
            }
        }
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


