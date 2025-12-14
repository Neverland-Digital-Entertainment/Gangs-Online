Gangs Online: Phase 8 - Loot & Inventory System
Objective: Implement loot drops upon enemy death, item pickup mechanics, and a client-side inventory UI for consuming items.
Please modify the following files.
Step 1: Update Shared Definitions
We need to define Item types and Loot structures.
Modify packages/shared/src/index.ts:
Add IItem, ILoot and update IPlayerData:
// packages/shared/src/index.ts

// ... (Existing definitions) ...

export type ItemType = 'currency' | 'consumable';

export interface IItem {
    id: string;
    name: string;
    type: ItemType;
    value: number; // Amount for currency, Heal amount for consumable
}

export interface ILootData {
    id: string;
    x: number;
    z: number;
    item: IItem;
}

export interface IPlayerData extends IEntityData {
    sessionId: string;
    role: PlayerRole;
    level: number;
    xp: number;
    maxXp: number;
    // NEW: Inventory
    money: number;
    inventory: IItem[]; 
}

// ... (Keep existing IEntityData, IEnemyData) ...

export const GAME_CONSTANTS = {
    // ... (Keep existing constants) ...
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.15,
    ENEMY_SPEED: 0.1,
    ATTACK_RANGE: 2.0,
    ATTACK_DAMAGE: 10,
    ENEMY_DETECT_RANGE: 10.0,
    ENEMY_SPAWN_COUNT: 10,
    XP_PER_KILL: 50,
    BASE_XP_TO_LEVEL: 100,
    // NEW: Loot settings
    LOOT_PICKUP_RANGE: 2.0,
    DROP_CHANCE: 0.8 // 80% chance to drop
};


Step 2: Server-Side Loot Logic
We need a new Schema for Loot, and logic to spawn/pickup it.
Modify packages/server/src/rooms/schema/GameState.ts:
Add Loot schema and update Player:
// packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { IPlayerData, IEnemyData, ILootData, PlayerRole, GAME_CONSTANTS, IItem } from "@gangs-online/shared";

// Helper Schema for Items inside ArraySchema
export class Item extends Schema implements IItem {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") type: 'currency' | 'consumable' = "consumable";
    @type("number") value: number = 0;
}

export class Player extends Schema implements IPlayerData {
    // ... (Existing fields) ...
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
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = GAME_CONSTANTS.BASE_XP_TO_LEVEL;

    // NEW: Inventory
    @type("number") money: number = 0;
    @type([ Item ]) inventory = new ArraySchema<Item>();
}

// NEW: Loot Schema
export class Loot extends Schema implements ILootData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type(Item) item: Item = new Item();
}

// ... (Keep Enemy Schema) ...
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
    // NEW: Drops on the ground
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}


Modify packages/server/src/rooms/GameRoom.ts to spawn loot on death and handle pickup.
Update attack handler and add pickup/use handlers:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy, Loot, Item } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, getRankTitle } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        // ... (Existing Setup) ...
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));
        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) this.spawnEnemy();

        this.onMessage("move", (client, input: IPlayerInput) => {
             const player = this.state.players.get(client.sessionId);
             if (player && player.hp > 0) { player.x = input.x; player.z = input.z; }
        });

        this.onMessage("chat", (client, message: string) => {
            this.broadcast("chat", { sessionId: client.sessionId, text: message });
        });

        // --- ATTACK & DROP LOOT ---
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' }) => {
            const attacker = this.state.players.get(client.sessionId);
            let target: Player | Enemy | undefined;
            if (payload.type === 'player') target = this.state.players.get(payload.targetId);
            else if (payload.type === 'enemy') target = this.state.enemies.get(payload.targetId);

            if (attacker && target && attacker.hp > 0 && target.hp > 0) {
                const dist = Math.sqrt(Math.pow(attacker.x - target.x, 2) + Math.pow(attacker.z - target.z, 2));
                if (dist <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
                    if (target.hp <= 0) {
                        target.hp = 0;
                        
                        // Drop Loot Logic
                        if (Math.random() < GAME_CONSTANTS.DROP_CHANCE) {
                            this.spawnLoot(target.x, target.z);
                        }

                        if (payload.type === 'enemy') {
                            attacker.xp += GAME_CONSTANTS.XP_PER_KILL;
                            if (attacker.xp >= attacker.maxXp) {
                                attacker.xp -= attacker.maxXp; attacker.level++;
                                attacker.maxXp = Math.floor(attacker.maxXp * 1.5);
                                attacker.maxHp += 20; attacker.hp = attacker.maxHp;
                                this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} 升職了! (Lv${attacker.level})` });
                            }
                            this.state.enemies.delete(payload.targetId);
                            this.clock.setTimeout(() => this.spawnEnemy(), 5000);
                        } else {
                            this.broadcast("chat", { sessionId: "SYSTEM", text: `${attacker.name} 隊冧咗 ${target.name}!` });
                            this.clock.setTimeout(() => this.respawnPlayer(payload.targetId), 3000);
                        }
                    }
                }
            }
        });

        // --- NEW: PICKUP ITEM ---
        this.onMessage("pickup", (client, lootId: string) => {
            const player = this.state.players.get(client.sessionId);
            const loot = this.state.lootItems.get(lootId);

            if (player && loot && player.hp > 0) {
                const dist = Math.sqrt(Math.pow(player.x - loot.x, 2) + Math.pow(player.z - loot.z, 2));
                if (dist <= GAME_CONSTANTS.LOOT_PICKUP_RANGE) {
                    // Add to inventory
                    if (loot.item.type === 'currency') {
                        player.money += loot.item.value;
                        client.send("notification", `執到 $${loot.item.value}`);
                    } else {
                        const newItem = new Item();
                        newItem.id = loot.item.id;
                        newItem.name = loot.item.name;
                        newItem.type = loot.item.type;
                        newItem.value = loot.item.value;
                        player.inventory.push(newItem);
                        client.send("notification", `執到 ${loot.item.name}`);
                    }
                    // Remove from world
                    this.state.lootItems.delete(lootId);
                }
            }
        });

        // --- NEW: USE ITEM ---
        this.onMessage("useItem", (client, itemIndex: number) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0 && itemIndex >= 0 && itemIndex < player.inventory.length) {
                const item = player.inventory.at(itemIndex);
                if (item && item.type === 'consumable') {
                    // Heal
                    player.hp = Math.min(player.hp + item.value, player.maxHp);
                    // Remove item
                    player.inventory.deleteAt(itemIndex);
                    client.send("notification", `食咗 ${item.name}, 回復 ${item.value} 血`);
                }
            }
        });
    }

    spawnLoot(x: number, z: number) {
        const loot = new Loot();
        loot.id = `loot_${Math.random().toString(36).substr(2, 5)}`;
        loot.x = x + (Math.random() - 0.5); // Slight offset
        loot.z = z + (Math.random() - 0.5);
        
        // Randomize Item
        const item = new Item();
        if (Math.random() > 0.5) {
            item.id = "money"; item.name = "港幣"; item.type = "currency"; item.value = Math.floor(Math.random() * 50) + 10;
        } else {
            item.id = "food"; item.name = "叉燒包"; item.type = "consumable"; item.value = 20;
        }
        loot.item = item;
        
        this.state.lootItems.set(loot.id, loot);
        // Auto remove after 30s
        this.clock.setTimeout(() => {
            if (this.state.lootItems.has(loot.id)) this.state.lootItems.delete(loot.id);
        }, 30000);
    }
    
    // ... (Keep update, respawnPlayer, spawnEnemy, onJoin, onLeave) ...
    // Note: Re-paste update, respawnPlayer, spawnEnemy, onJoin, onLeave from previous phase to ensure completeness.
    // For brevity in this script block, I assume they exist.
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
                         if (nearestPlayer.hp <= 0) { nearestPlayer.hp = 0; this.respawnPlayer(nearestPlayer.sessionId); }
                     }
                 }
             } else { enemy.state = "idle"; }
        });
    }
    respawnPlayer(sessionId: string) { const p = this.state.players.get(sessionId); if (p) { p.hp = p.maxHp; p.x = Math.random()*10-5; p.z = Math.random()*10-5; } }
    spawnEnemy() { const e = new Enemy(); e.id = `mob_${Math.random().toString(36).substr(2,5)}`; e.x = Math.random()*40-20; e.z = Math.random()*40-20; e.name = "Street Thug"; this.state.enemies.set(e.id, e); }
    onJoin(client: Client, options: any) { const p = new Player(); p.sessionId = client.sessionId; p.x = Math.random()*10-5; p.z = Math.random()*10-5; p.name = options.name || `Gangster ${client.sessionId.substr(0,4)}`; this.state.players.set(client.sessionId, p); }
    onLeave(client: Client) { this.state.players.delete(client.sessionId); }
}


Step 3: Client-Side Inventory UI & Visuals
We need to:
Render Loot items on the ground (maybe as small glowing orbs or boxes).
Click loot to pick it up.
Add an Inventory Panel to show money and items.
Modify packages/client/src/main.ts:
Update createScene to handle Loot and Inventory UI:
// packages/client/src/main.ts
// ... imports ...
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, ILootData, getRankTitle } from "@gangs-online/shared";
import "@babylonjs/loaders";

// ... (Existing Helpers: createChatUI, createEntityUI, createCity, createChatBubble) ...

// --- NEW: INVENTORY UI ---
const createInventoryUI = (room: Client.Room, uiTexture: GUI.AdvancedDynamicTexture) => {
    // Container (Bottom Right)
    const panel = new GUI.StackPanel();
    panel.width = "200px";
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.paddingBottom = "20px";
    panel.paddingRight = "20px";
    uiTexture.addControl(panel);

    // Money Display
    const moneyText = new GUI.TextBlock();
    moneyText.text = "HKD: $0";
    moneyText.color = "gold";
    moneyText.height = "30px";
    moneyText.fontSize = 20;
    moneyText.shadowBlur = 2;
    panel.addControl(moneyText);

    // Items List
    const itemList = new GUI.StackPanel();
    itemList.background = "rgba(0,0,0,0.5)";
    panel.addControl(itemList);

    // Update Function
    const updateInventory = (money: number, items: any[]) => {
        moneyText.text = `HKD: $${money}`;
        itemList.clearControls(); // Rebuild list

        items.forEach((item, index) => {
            const btn = GUI.Button.CreateSimpleButton(`item_${index}`, `${item.name}`);
            btn.width = "100%";
            btn.height = "30px";
            btn.color = "white";
            btn.fontSize = 14;
            btn.background = "rgba(255, 255, 255, 0.2)";
            
            if (item.type === 'consumable') {
                btn.onPointerUpObservable.add(() => {
                    room.send("useItem", index);
                });
                btn.children[0].text += " (食)"; // Hint clickable
            }
            itemList.addControl(btn);
        });
    };

    return { updateInventory };
}

// ... (Main Create Scene) ...
const createScene = async () => {
    // ... (Standard Setup: Engine, Scene, Camera, Light, City, UI) ...
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

    // State Holders
    const entities: any = {};
    const lootMeshes: { [id: string]: BABYLON.Mesh } = {}; // Track Loot
    let mySessionId: string | null = null;
    let inventoryUI: any = null;

    try {
        const room = await client.joinOrCreate("game_room", { name: "Player" });
        mySessionId = room.sessionId;

        createChatUI(room, scene);
        inventoryUI = createInventoryUI(room, uiTexture);

        room.onMessage("chat", (msg) => { if(entities[msg.sessionId]) createChatBubble(entities[msg.sessionId].mesh, msg.text, uiTexture); });
        
        // Listen for Notifications (Loot pickup)
        room.onMessage("notification", (text: string) => {
             const notif = new GUI.TextBlock();
             notif.text = text; notif.color = "yellow"; notif.fontSize = 24; notif.top = "-100px";
             uiTexture.addControl(notif);
             // Float up animation could go here, for now just fade
             setTimeout(() => notif.dispose(), 2000);
        });

        // --- PLAYERS & ENEMIES (Reuse spawnEntityVisuals from Phase 7) ---
        const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy') => {
             // ... (Keep Phase 7 logic) ...
             // Re-paste spawnEntityVisuals content or ensure it exists
             // Critical: Player inventory listeners
             const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
             const root = result.meshes[0];
             root.position.set(entityData.x, 0.1, entityData.z); root.scaling.set(0.15, 0.15, 0.15); root.rotationQuaternion = null; 
             root.checkCollisions = true; root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5); root.metadata = { id: id, type: type };
             
             if(type==='enemy') { root.getChildMeshes().forEach(m=>{ if(m.material) { const nm=m.material.clone(''); (nm as any).emissiveColor=new BABYLON.Color3(0.5,0,0); m.material=nm; }}); }

             const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy', entityData.level||1);
             uiTexture.addControl(ui.container); ui.container.linkWithMesh(root);
             
             entities[id] = { mesh: root, ui }; // Simplified for brevity, add animations back if needed

             entityData.onChange(() => { 
                 // Simple interpolation
                 const t = {x: entityData.x, z: entityData.z};
                 scene.onBeforeRenderObservable.addOnce(() => {
                    root.position.x = BABYLON.Scalar.Lerp(root.position.x, t.x, 0.1);
                    root.position.z = BABYLON.Scalar.Lerp(root.position.z, t.z, 0.1);
                 });
             });

             // INVENTORY LISTENER (Self Only)
             if (id === mySessionId && type === 'player') {
                 // Initial sync
                 inventoryUI.updateInventory(entityData.money, entityData.inventory);
                 
                 entityData.listen("money", (val: number) => inventoryUI.updateInventory(val, entityData.inventory));
                 entityData.inventory.onAdd(() => inventoryUI.updateInventory(entityData.money, entityData.inventory));
                 entityData.inventory.onRemove(() => inventoryUI.updateInventory(entityData.money, entityData.inventory));
             }
        };

        room.state.players.onAdd((p, sId) => spawnEntityVisuals(p, sId, 'player'));
        room.state.players.onRemove((p, sId) => { if(entities[sId]) { entities[sId].mesh.dispose(); entities[sId].ui.container.dispose(); delete entities[sId]; }});
        room.state.enemies.onAdd((e, eId) => spawnEntityVisuals(e, eId, 'enemy'));
        room.state.enemies.onRemove((e, eId) => { if(entities[eId]) { entities[eId].mesh.dispose(); entities[eId].ui.container.dispose(); delete entities[eId]; }});

        // --- LOOT HANDLING ---
        room.state.lootItems.onAdd((loot: ILootData, lootId: string) => {
            // Create a glowing box for loot
            const box = BABYLON.MeshBuilder.CreateBox("loot", { size: 0.5 }, scene);
            box.position.set(loot.x, 0.5, loot.z);
            box.metadata = { lootId: lootId };
            
            const mat = new BABYLON.StandardMaterial("lootMat", scene);
            mat.emissiveColor = loot.item.type === 'currency' ? BABYLON.Color3.Yellow() : BABYLON.Color3.Teal();
            box.material = mat;
            
            // Spin animation
            scene.onBeforeRenderObservable.add(() => { box.rotation.y += 0.05; });

            lootMeshes[lootId] = box;
        });

        room.state.lootItems.onRemove((loot, lootId) => {
            if (lootMeshes[lootId]) {
                lootMeshes[lootId].dispose();
                delete lootMeshes[lootId];
            }
        });

        // --- INPUT ---
        scene.onPointerDown = (evt, pickResult) => {
             if (pickResult.hit && pickResult.pickedMesh) {
                let m = pickResult.pickedMesh;
                
                // Check Loot Pickup
                if (m.metadata && m.metadata.lootId) {
                    room.send("pickup", m.metadata.lootId);
                    return;
                }

                // Check Attack
                while (m.parent) m = m.parent as BABYLON.AbstractMesh;
                if (m.metadata && m.metadata.id && m.metadata.id !== mySessionId) {
                    room.send("attack", { targetId: m.metadata.id, type: m.metadata.type });
                    return;
                }
                
                // Move
                if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road")) {
                     room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
                }
            }
        };

    } catch (e) { console.error(e); }

    scene.registerBeforeRender(() => {
        // ... (Keep existing camera follow and basic render loop) ...
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


