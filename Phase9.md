Gangs Online: Phase 9 - Economy & Safe Zones
Objective: Implement a Safe Zone logic to prevent combat, add a Shopkeeper NPC, and a Shop UI for purchasing items.
Please modify the following files.
Step 1: Update Shared Definitions
We need to define Safe Zone constants and Shop Items.
Modify packages/shared/src/index.ts:
Update GAME_CONSTANTS and IEntityData type:
// packages/shared/src/index.ts

// ... (Existing definitions) ...
export type ItemType = 'currency' | 'consumable';
// NEW: 'npc' type
export interface IEntityData {
    id: string;
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    name: string;
    type: 'player' | 'enemy' | 'npc'; 
}

// ... (Keep IPlayerData, IEnemyData, ILootData, IItem) ...
// Ensure IPlayerData and IEnemyData inherit or match the new 'type' definition if needed, 
// though TypeScript usually handles the union string literal update automatically in IEntityData.

export const GAME_CONSTANTS = {
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
    LOOT_PICKUP_RANGE: 2.0,
    DROP_CHANCE: 0.8,
    // NEW: Safe Zone & Shop
    SAFE_ZONE_RADIUS: 15.0, // Center radius
    SHOP_ITEMS: [
        { id: "food_small", name: "魚蛋 (Fishball)", price: 50, value: 20, type: "consumable" },
        { id: "food_large", name: "叉燒飯 (Rice)", price: 100, value: 50, type: "consumable" }
    ]
};


Step 2: Server-Side Safe Zone & Shop Logic
Prevent attacks in Safe Zone.
Spawn a Shopkeeper NPC.
Handle buy requests.
Modify packages/server/src/rooms/schema/GameState.ts:
Update type field in Schema and add NPC class if desired, or reuse Enemy with type 'npc'. Let's reuse Enemy structure for simplicity but treat it as NPC.
// packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { IPlayerData, IEnemyData, ILootData, PlayerRole, GAME_CONSTANTS, IItem } from "@gangs-online/shared";

// ... (Keep Item, Player, Loot schemas) ...

export class Item extends Schema implements IItem {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") type: 'currency' | 'consumable' = "consumable";
    @type("number") value: number = 0;
}

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
    @type("string") type: 'player' | 'enemy' | 'npc' = "player";
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = GAME_CONSTANTS.BASE_XP_TO_LEVEL;
    @type("number") money: number = 200; // Start with some money for testing
    @type([ Item ]) inventory = new ArraySchema<Item>();
}

export class Loot extends Schema implements ILootData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type(Item) item: Item = new Item();
}

// We reuse Enemy class for NPCs but handle them differently based on 'type'
export class Enemy extends Schema implements IEnemyData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type("number") hp: number = 50;
    @type("number") maxHp: number = 50;
    @type("string") name: string = "Thug";
    @type("string") state: 'idle' | 'chase' | 'attack' = "idle";
    @type("string") type: 'player' | 'enemy' | 'npc' = "enemy";
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>(); // NPCs also go here for now
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}


Modify packages/server/src/rooms/GameRoom.ts:
Update attack logic and add buy handler:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy, Loot, Item } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, getRankTitle } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        // Spawn Enemies
        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) this.spawnEnemy();

        // NEW: Spawn Shopkeeper NPC (At Center)
        this.spawnNPC("npc_shop", 0, 0, "十三叔 (Shop)");

        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = input.x;
                player.z = input.z;
            }
        });

        this.onMessage("chat", (client, message: string) => {
            this.broadcast("chat", { sessionId: client.sessionId, text: message });
        });

        // --- ATTACK LOGIC (With Safe Zone Check) ---
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' | 'npc' }) => {
            const attacker = this.state.players.get(client.sessionId);
            if (!attacker || attacker.hp <= 0) return;

            // 1. Check Safe Zone
            const distFromCenter = Math.sqrt(attacker.x*attacker.x + attacker.z*attacker.z);
            if (distFromCenter < GAME_CONSTANTS.SAFE_ZONE_RADIUS) {
                client.send("notification", "這裡是安全區，不能打架！");
                return;
            }

            let target: Player | Enemy | undefined;
            if (payload.type === 'player') target = this.state.players.get(payload.targetId);
            else if (payload.type === 'enemy') target = this.state.enemies.get(payload.targetId);
            // NPCs are invincible/ignored in this simple logic

            if (target && target.hp > 0) {
                // Check Target Safe Zone (cannot snipe people inside)
                const targetDistCenter = Math.sqrt(target.x*target.x + target.z*target.z);
                if (targetDistCenter < GAME_CONSTANTS.SAFE_ZONE_RADIUS) {
                     client.send("notification", "對方在安全區內！");
                     return;
                }

                const dx = attacker.x - target.x;
                const dz = attacker.z - target.z;
                if (Math.sqrt(dx*dx+dz*dz) <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
                    // ... (Death Logic same as Phase 8) ...
                    if (target.hp <= 0) {
                        target.hp = 0;
                        if (Math.random() < GAME_CONSTANTS.DROP_CHANCE) this.spawnLoot(target.x, target.z);
                        
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

        // --- PICKUP & USE ---
        this.onMessage("pickup", (client, lootId: string) => {
             // ... (Same as Phase 8) ...
             const player = this.state.players.get(client.sessionId);
             const loot = this.state.lootItems.get(lootId);
             if (player && loot && player.hp > 0) {
                const dist = Math.sqrt(Math.pow(player.x - loot.x, 2) + Math.pow(player.z - loot.z, 2));
                if (dist <= GAME_CONSTANTS.LOOT_PICKUP_RANGE) {
                    if (loot.item.type === 'currency') {
                        player.money += loot.item.value;
                        client.send("notification", `執到 $${loot.item.value}`);
                    } else {
                        const newItem = new Item();
                        newItem.id = loot.item.id; newItem.name = loot.item.name; newItem.type = loot.item.type; newItem.value = loot.item.value;
                        player.inventory.push(newItem);
                        client.send("notification", `執到 ${loot.item.name}`);
                    }
                    this.state.lootItems.delete(lootId);
                }
            }
        });

        this.onMessage("useItem", (client, idx: number) => {
             const player = this.state.players.get(client.sessionId);
             if (player && player.hp > 0 && idx < player.inventory.length) {
                 const item = player.inventory.at(idx);
                 if (item && item.type === 'consumable') {
                     player.hp = Math.min(player.hp + item.value, player.maxHp);
                     player.inventory.deleteAt(idx);
                     client.send("notification", `食咗 ${item.name}, 回復 ${item.value} 血`);
                 }
             }
        });

        // --- NEW: BUY ITEM ---
        this.onMessage("buy", (client, itemId: string) => {
            const player = this.state.players.get(client.sessionId);
            // Check if near NPC (Simple check: center of map)
            const dist = Math.sqrt(player.x*player.x + player.z*player.z);
            if (dist > 5.0) { // Must be close to center (where NPC is)
                client.send("notification", "太遠了！要去十三叔那邊買。");
                return;
            }

            const shopItem = GAME_CONSTANTS.SHOP_ITEMS.find(i => i.id === itemId);
            if (player && shopItem) {
                if (player.money >= shopItem.price) {
                    player.money -= shopItem.price;
                    const newItem = new Item();
                    newItem.id = shopItem.id; newItem.name = shopItem.name; newItem.type = shopItem.type as any; newItem.value = shopItem.value;
                    player.inventory.push(newItem);
                    client.send("notification", `買咗 ${shopItem.name}`);
                } else {
                    client.send("notification", "錢唔夠！去打多幾個古惑仔啦。");
                }
            }
        });
    }

    spawnNPC(id: string, x: number, z: number, name: string) {
        const npc = new Enemy(); // Reuse Enemy class but different type
        npc.id = id;
        npc.x = x; npc.z = z;
        npc.name = name;
        npc.type = 'npc';
        npc.state = 'idle';
        npc.hp = 9999; // Invincible
        this.state.enemies.set(id, npc);
    }

    // ... (Keep update, respawnPlayer, spawnEnemy, spawnLoot logic) ...
    spawnLoot(x: number, z: number) {
        const loot = new Loot();
        loot.id = `loot_${Math.random().toString(36).substr(2, 5)}`;
        loot.x = x + (Math.random() - 0.5); loot.z = z + (Math.random() - 0.5);
        const item = new Item();
        if (Math.random() > 0.5) { item.id = "money"; item.name = "港幣"; item.type = "currency"; item.value = Math.floor(Math.random() * 50) + 10; } 
        else { item.id = "food"; item.name = "叉燒包"; item.type = "consumable"; item.value = 20; }
        loot.item = item;
        this.state.lootItems.set(loot.id, loot);
        this.clock.setTimeout(() => { if (this.state.lootItems.has(loot.id)) this.state.lootItems.delete(loot.id); }, 30000);
    }

    update(dt: number) {
        this.state.enemies.forEach(enemy => {
             if (enemy.type === 'npc' || enemy.hp <= 0) return; // Skip NPCs
             // ... (Keep existing Enemy AI logic) ...
             let nearestPlayer: Player | null = null;
             let minDist = 9999;
             this.state.players.forEach(player => {
                 if (player.hp <= 0) return;
                 const dx = player.x - enemy.x; const dz = player.z - enemy.z; const dist = Math.sqrt(dx*dx + dz*dz);
                 if (dist < minDist) { minDist = dist; nearestPlayer = player; }
             });
             // Only chase if player is NOT in Safe Zone
             if (nearestPlayer && minDist < GAME_CONSTANTS.ENEMY_DETECT_RANGE) {
                 const playerDistCenter = Math.sqrt(nearestPlayer.x*nearestPlayer.x + nearestPlayer.z*nearestPlayer.z);
                 if (playerDistCenter > GAME_CONSTANTS.SAFE_ZONE_RADIUS) {
                     if (minDist > GAME_CONSTANTS.ATTACK_RANGE - 0.5) {
                         enemy.state = "chase";
                         const dx = nearestPlayer.x - enemy.x; const dz = nearestPlayer.z - enemy.z;
                         enemy.x += (dx / minDist) * GAME_CONSTANTS.ENEMY_SPEED; enemy.z += (dz / minDist) * GAME_CONSTANTS.ENEMY_SPEED;
                     } else {
                         enemy.state = "attack";
                         if (Math.random() < 0.02) {
                             nearestPlayer.hp -= 5;
                             if (nearestPlayer.hp <= 0) { nearestPlayer.hp = 0; this.respawnPlayer(nearestPlayer.sessionId); }
                         }
                     }
                 } else { enemy.state = "idle"; } // Player in safe zone
             } else { enemy.state = "idle"; }
        });
    }

    respawnPlayer(id: string) { const p = this.state.players.get(id); if(p) { p.hp=p.maxHp; p.x=Math.random()*10-5; p.z=Math.random()*10-5; } }
    spawnEnemy() { const e=new Enemy(); e.id=`mob_${Math.random().toString(36).substr(2,5)}`; e.x=Math.random()*40-20; e.z=Math.random()*40-20; e.name="Street Thug"; this.state.enemies.set(e.id, e); }
    onJoin(client: Client, options: any) { const p=new Player(); p.sessionId=client.sessionId; p.x=Math.random()*10-5; p.z=Math.random()*10-5; p.name=options.name||`Gangster ${client.sessionId.substr(0,4)}`; this.state.players.set(client.sessionId, p); }
    onLeave(client: Client) { this.state.players.delete(client.sessionId); }
}


Step 3: Client-Side Shop UI & Safe Zone Visuals
Visual marker for Safe Zone (Green circle on ground).
Render NPC distinctly (Blue/White).
Shop UI Popup.
Modify packages/client/src/main.ts:
Update createCity (Safe Zone) and createScene (Shop UI):
// packages/client/src/main.ts
// ... imports ...
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, ILootData, getRankTitle, GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders";

// ... (Existing Helpers) ...

const createShopUI = (room: Client.Room, uiTexture: GUI.AdvancedDynamicTexture) => {
    // Hidden by default
    const panel = new GUI.Rectangle();
    panel.width = "300px";
    panel.height = "250px";
    panel.background = "black";
    panel.color = "gold";
    panel.thickness = 2;
    panel.isVisible = false;
    panel.top = "-50px";
    uiTexture.addControl(panel);

    const title = new GUI.TextBlock();
    title.text = "十三叔雜貨 (Shop)";
    title.color = "gold";
    title.fontSize = 20;
    title.top = "-90px";
    panel.addControl(title);

    const closeBtn = GUI.Button.CreateSimpleButton("close", "X");
    closeBtn.width = "30px"; closeBtn.height = "30px"; closeBtn.color = "red"; closeBtn.left = "130px"; closeBtn.top = "-100px";
    closeBtn.onPointerUpObservable.add(() => panel.isVisible = false);
    panel.addControl(closeBtn);

    const list = new GUI.StackPanel();
    list.top = "20px";
    panel.addControl(list);

    // Populate Items
    GAME_CONSTANTS.SHOP_ITEMS.forEach(item => {
        const btn = GUI.Button.CreateSimpleButton(`buy_${item.id}`, `${item.name} - $${item.price}`);
        btn.width = "280px";
        btn.height = "40px";
        btn.color = "white";
        btn.background = "#333";
        btn.paddingBottom = "5px";
        btn.onPointerUpObservable.add(() => {
            room.send("buy", item.id);
        });
        list.addControl(btn);
    });

    return panel;
}

const createCity = (scene: BABYLON.Scene) => {
    // ... (Existing City Code) ...
    const ground = BABYLON.MeshBuilder.CreateGround("road", { width: 100, height: 100 }, scene);
    ground.checkCollisions = true;
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;

    // SAFE ZONE MARKER (Green Circle)
    const safeZone = BABYLON.MeshBuilder.CreateDisc("safeZone", { radius: GAME_CONSTANTS.SAFE_ZONE_RADIUS }, scene);
    safeZone.rotation.x = Math.PI / 2;
    safeZone.position.y = 0.02; // Just above road
    const safeMat = new BABYLON.StandardMaterial("safeMat", scene);
    safeMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
    safeMat.alpha = 0.2;
    safeZone.material = safeMat;

    // Buildings... (Keep existing loop)
    const buildingMat = new BABYLON.StandardMaterial("bMat", scene);
    buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; // Keep center clear
            const h = Math.random()*5+5;
            const b = BABYLON.MeshBuilder.CreateBox("b", {width:8, depth:8, height:h}, scene);
            b.position.set(i*12, h/2, j*12);
            b.material = buildingMat;
            b.checkCollisions = true;
        }
    }
}

const createScene = async () => {
    // ... (Setup) ...
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true; scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.setTarget(BABYLON.Vector3.Zero());
    const zoom = 14; const aspect = engine.getAspectRatio(camera); camera.orthoTop=zoom; camera.orthoBottom=-zoom; camera.orthoLeft=-zoom*aspect; camera.orthoRight=zoom*aspect;
    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    
    createCity(scene); // Includes Safe Zone Visual

    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    // UI Panels
    let shopPanel: GUI.Rectangle;
    
    // ... (Helpers: createEntityUI, etc. - Keep them) ...
    // Reuse existing spawnEntityVisuals logic but Handle NPC type

    const entities: any = {};
    const lootMeshes: any = {};
    let mySessionId: string | null = null;
    let inventoryUI: any = null;

    try {
        const room = await client.joinOrCreate("game_room", { name: "Player" });
        mySessionId = room.sessionId;

        createChatUI(room, scene);
        inventoryUI = createInventoryUI(room, uiTexture);
        shopPanel = createShopUI(room, uiTexture); // Setup Shop

        // ... (Chat, Loot, Notification listeners - Keep them) ...
        room.onMessage("notification", (text) => { /* ... */ });
        room.onMessage("chat", (msg) => { if(entities[msg.sessionId]) createChatBubble(entities[msg.sessionId].mesh, msg.text, uiTexture); });

        const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy'|'npc') => {
             // ... (Load Mesh Logic) ...
             const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
             const root = result.meshes[0];
             root.position.set(entityData.x, 0.1, entityData.z); root.scaling.set(0.15, 0.15, 0.15); root.rotationQuaternion = null; 
             root.checkCollisions = true; root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5); 
             root.metadata = { id: id, type: type };

             // NPC Visuals (White/Blue)
             if (type === 'npc') {
                 root.getChildMeshes().forEach(m => {
                    if (m.material) {
                        const nm = m.material.clone('');
                        (nm as any).emissiveColor = new BABYLON.Color3(0.5, 0.5, 1); // Blue Glow
                        m.material = nm;
                    }
                 });
             } else if (type === 'enemy') {
                 // Red Glow...
                 root.getChildMeshes().forEach(m => { if(m.material){ const nm=m.material.clone(''); (nm as any).emissiveColor=new BABYLON.Color3(0.5,0,0); m.material=nm;}});
             }

             // Animations
             const idle = result.animationGroups.find(a => a.name === "Idle");
             const run = result.animationGroups.find(a => a.name === "Walking");
             if (idle) idle.play(true);

             // UI
             const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy', entityData.level||1);
             uiTexture.addControl(ui.container); ui.container.linkWithMesh(root);

             entities[id] = { mesh: root, ui, idleAnim: idle, runAnim: run, currentAnim: "idle" };
             
             // Sync (NPCs don't move usually but logic handles it)
             entityData.onChange(() => { 
                const t = {x: entityData.x, z: entityData.z};
                scene.onBeforeRenderObservable.addOnce(() => {
                   root.position.x = BABYLON.Scalar.Lerp(root.position.x, t.x, 0.1);
                   root.position.z = BABYLON.Scalar.Lerp(root.position.z, t.z, 0.1);
                });
             });

             // Listeners (HP, XP, Money) - Keep existing logic
             if(type!=='npc') entityData.listen("hp", (v: number) => { /* update bar */ });
             if(id===mySessionId) {
                 // Inventory Sync
                 entityData.listen("money", (v: number) => inventoryUI.updateInventory(v, entityData.inventory));
                 entityData.inventory.onAdd(()=>inventoryUI.updateInventory(entityData.money, entityData.inventory));
                 entityData.inventory.onRemove(()=>inventoryUI.updateInventory(entityData.money, entityData.inventory));
             }
        };

        room.state.players.onAdd((p, sId) => spawnEntityVisuals(p, sId, 'player'));
        room.state.players.onRemove((p, sId) => { if(entities[sId]) { entities[sId].mesh.dispose(); entities[sId].ui.container.dispose(); delete entities[sId]; }});
        
        // Handle ENEMIES (and reuse logic for NPCs if they are in enemies map, otherwise handle separate map if created)
        // In GameState, we put NPCs in `enemies` map with type='npc'.
        room.state.enemies.onAdd((e, eId) => spawnEntityVisuals(e, eId, e.type)); // e.type will be 'enemy' or 'npc'
        room.state.enemies.onRemove((e, eId) => { if(entities[eId]) { entities[eId].mesh.dispose(); entities[eId].ui.container.dispose(); delete entities[eId]; }});
        
        // Loot... (Keep existing)
        room.state.lootItems.onAdd((l, id) => { /* ... */ });
        room.state.lootItems.onRemove((l, id) => { /* ... */ });

        // --- INPUT ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
               let m = pickResult.pickedMesh;
               if (m.metadata && m.metadata.lootId) { room.send("pickup", m.metadata.lootId); return; }
               
               while (m.parent) m = m.parent as BABYLON.AbstractMesh;
               if (m.metadata && m.metadata.id) {
                   const type = m.metadata.type;
                   const id = m.metadata.id;

                   if (type === 'npc') {
                       // CLICKED NPC -> OPEN SHOP
                       shopPanel.isVisible = !shopPanel.isVisible;
                       return;
                   }
                   
                   if (id !== mySessionId) {
                       room.send("attack", { targetId: id, type: type });
                       return;
                   }
               }
               
               // Move
               if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road") || pickResult.pickedMesh.name.startsWith("safeZone")) {
                    room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
               }
           }
       };

    } catch (e) { console.error(e); }

    scene.registerBeforeRender(() => {
        // ... (Render Loop) ...
        // Re-paste render loop logic for brevity
        for (const id in entities) {
            // ... (Interpolation logic) ...
            // IMPORTANT: Don't move NPCs if they are static (check type or if target changes)
        }
        if (mySessionId && entities[mySessionId]) {
             // Camera Follow
             const t = entities[mySessionId].mesh.position;
             camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, t.x+20, 0.1);
             camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, t.y+20, 0.1);
             camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, t.z-20, 0.1);
             camera.setTarget(t);
        }
    });

    return scene;
};


