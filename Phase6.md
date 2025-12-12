Gangs Online: Phase 6 - NPCs & PVE System
Objective: Implement server-side AI for NPCs (Enemies), sync them to the client, and allow players to combat them.
Please modify the following files.
Step 1: Update Shared Definitions
We need to define Enemy structure and types.
Modify packages/shared/src/index.ts:
Update IPlayerData and constants:
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

// Player extends Entity
export interface IPlayerData extends IEntityData {
    sessionId: string;
    role: PlayerRole;
}

// Enemy extends Entity
export interface IEnemyData extends IEntityData {
    state: 'idle' | 'chase' | 'attack';
}

export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.15,
    ENEMY_SPEED: 0.1, // Slower than players
    ATTACK_RANGE: 2.0,
    ATTACK_DAMAGE: 10,
    ENEMY_DETECT_RANGE: 10.0, // Aggro range
    ENEMY_SPAWN_COUNT: 10
};


Step 2: Server-Side Enemy Logic & AI Loop
We need to add an Enemy schema class and implement the Simulation Interval (Game Loop) to drive AI.
Modify packages/server/src/rooms/schema/GameState.ts first:
// packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";
import { IPlayerData, IEnemyData, PlayerRole } from "@gangs-online/shared";

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
}

export class Enemy extends Schema implements IEnemyData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0; // Use z for 3D logic
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


Now modify packages/server/src/rooms/GameRoom.ts to implement the AI Loop:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Setup AI Loop (Tick 20 times per second = 50ms)
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        // Spawn Initial Enemies
        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) {
            const enemy = new Enemy();
            enemy.id = `mob_${i}`;
            enemy.x = Math.random() * 40 - 20;
            enemy.z = Math.random() * 40 - 20;
            enemy.name = "Street Thug";
            this.state.enemies.set(enemy.id, enemy);
        }

        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = input.x;
                player.z = input.z;
            }
        });

        // Updated Attack Handler (Player vs Player OR Player vs Enemy)
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' }) => {
            const attacker = this.state.players.get(client.sessionId);
            let target: Player | Enemy | undefined;

            if (payload.type === 'player') {
                target = this.state.players.get(payload.targetId);
            } else if (payload.type === 'enemy') {
                target = this.state.enemies.get(payload.targetId);
            }

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
                    
                    if (target.hp <= 0) {
                        target.hp = 0;
                        this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} killed ${target.name}!` });
                        
                        // Respawn Logic
                        if (payload.type === 'player') {
                            this.clock.setTimeout(() => this.respawnPlayer(payload.targetId), 3000);
                        } else {
                            // Remove enemy and spawn new one later
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

    // AI Loop
    update(deltaTime: number) {
        this.state.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;

            let nearestPlayer: Player | null = null;
            let minDist = 9999;

            // Find nearest player
            this.state.players.forEach(player => {
                if (player.hp <= 0) return;
                const dx = player.x - enemy.x;
                const dz = player.z - enemy.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < minDist) {
                    minDist = dist;
                    nearestPlayer = player;
                }
            });

            if (nearestPlayer && minDist < GAME_CONSTANTS.ENEMY_DETECT_RANGE) {
                if (minDist > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                    // Chase
                    enemy.state = "chase";
                    const dx = nearestPlayer.x - enemy.x;
                    const dz = nearestPlayer.z - enemy.z;
                    // Normalize and move
                    enemy.x += (dx / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                    enemy.z += (dz / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                } else {
                    // Attack (Simple cooldown logic could go here)
                    enemy.state = "attack";
                    if (Math.random() < 0.02) { // Random chance to hit per tick
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
        if (p) {
            p.hp = p.maxHp;
            p.x = Math.random() * 10 - 5;
            p.z = Math.random() * 10 - 5;
        }
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
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client) {
        this.state.players.delete(client.sessionId);
    }
}


Step 3: Client-Side Enemy Rendering
We need to visualize the enemies using the same model but maybe tinted red, and handle clicks on them.
Modify packages/client/src/main.ts:
Update createScene to handle room.state.enemies:
// packages/client/src/main.ts
// ... (Imports remain same) ...

// ... (Helper functions remain same) ...

const createScene = async () => {
    // ... (Engine, Camera, Light, City Setup remain same) ...
    // ... Ensure uiTexture is created ...
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Reuse helper for UI creation
    const createEntityUI = (mesh: BABYLON.AbstractMesh, name: string, isEnemy: boolean) => {
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

    // Unified Entity Store
    const entities: any = {}; 
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

        const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy');

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
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        // Setup Chat UI ... (keep existing)

        // --- PLAYERS ---
        room.state.players.onAdd((player, sessionId) => {
            spawnEntityVisuals(player, sessionId, 'player');
        });
        room.state.players.onRemove((player, sessionId) => {
            if (entities[sessionId]) {
                entities[sessionId].mesh.dispose();
                entities[sessionId].ui.container.dispose();
                delete entities[sessionId];
                delete targets[sessionId];
            }
        });

        // --- ENEMIES ---
        room.state.enemies.onAdd((enemy, enemyId) => {
            spawnEntityVisuals(enemy, enemyId, 'enemy');
        });
        room.state.enemies.onRemove((enemy, enemyId) => {
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

    } catch (e) { console.error(e); }

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


