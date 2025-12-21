Gangs Online: Phase 10 - Data-Driven Quest System
Objective: Implement a Quest system where quest definitions are loaded from an external JSON file (simulating a database/editor output), separate from the game logic.
Step 1: Create Quest Data File
Create a new file packages/server/src/data/quests.json. This is the file your future Quest Editor will modify.
[
  {
    "id": "q1_first_blood",
    "name": "清理門戶",
    "description": "浩南哥話最近有班廢青係銅鑼灣搞事，你去教訓下 3 個小混混 (Street Thug)。",
    "type": "kill",
    "targetId": "mob_thug",
    "requiredCount": 3,
    "reward": {
      "xp": 300,
      "money": 500
    },
    "nextQuestId": "q2_delivery"
  },
  {
    "id": "q2_delivery",
    "name": "運送私貨",
    "description": "十三叔有批貨要運去碼頭，你去幫手。(尚未實裝)",
    "type": "talk",
    "targetId": "npc_shop",
    "requiredCount": 1,
    "reward": {
      "xp": 100,
      "money": 100
    }
  }
]

Step 2: Update Shared Definitions
We need to separate the Quest Definition (Static Data) from the Quest State (Dynamic Progress).
Modify packages/shared/src/index.ts:
Update IPlayerData, IQuest interfaces and Constants:
// packages/shared/src/index.ts

// ... (Existing definitions) ...

// 1. Static Data Structure (Matches JSON)
export interface IQuestDef {
    id: string;
    name: string;
    description: string;
    type: 'kill' | 'talk' | 'collect';
    targetId: string;
    requiredCount: number;
    reward: {
        xp: number;
        money: number;
        itemId?: string;
    };
    nextQuestId?: string;
}

// 2. Dynamic State Structure (Syncs to Client)
export interface IQuestState {
    id: string;
    name: string;
    description: string;
    currentCount: number;
    requiredCount: number;
    completed: boolean;
    rewardXp: number;
    rewardMoney: number;
}

export interface IPlayerData extends IEntityData {
    // ... (Existing fields) ...
    sessionId: string;
    role: PlayerRole;
    level: number;
    xp: number;
    maxXp: number;
    money: number;
    inventory: IItem[];
    // NEW: Active Quest State
    activeQuest: IQuestState | null; 
}

// ... (Keep existing constants) ...

export const GAME_CONSTANTS = {
    // ... (Existing constants) ...
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
    SAFE_ZONE_RADIUS: 15.0,
    SHOP_ITEMS: [
        { id: "food_small", name: "魚蛋 (Fishball)", price: 50, value: 20, type: "consumable" },
        { id: "food_large", name: "叉燒飯 (Rice)", price: 100, value: 50, type: "consumable" }
    ]
    // Note: QUESTS array is removed from here. Server loads it from JSON now.
};

Step 3: Server-Side Quest Logic
We need to:
Import the JSON data.
Update the Schema to match IQuestState.
Implement the logic using the data map.
Modify packages/server/src/rooms/schema/GameState.ts:
Update Quest schema:
// packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { IPlayerData, IEnemyData, ILootData, PlayerRole, GAME_CONSTANTS, IItem, IQuestState } from "@gangs-online/shared";

// ... (Item Schema) ...
export class Item extends Schema implements IItem {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") type: 'currency' | 'consumable' = "consumable";
    @type("number") value: number = 0;
}

// NEW: Quest Schema (Dynamic State)
export class Quest extends Schema implements IQuestState {
    @type("string") id: string = "";
    @type("string") name: string = "";
    @type("string") description: string = "";
    @type("number") currentCount: number = 0;
    @type("number") requiredCount: number = 0;
    @type("boolean") completed: boolean = false;
    @type("number") rewardXp: number = 0;
    @type("number") rewardMoney: number = 0;
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
    @type("string") type: 'player' | 'enemy' | 'npc' = "player";
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") maxXp: number = GAME_CONSTANTS.BASE_XP_TO_LEVEL;
    @type("number") money: number = 200;
    @type([ Item ]) inventory = new ArraySchema<Item>();
    
    // NEW: Active Quest
    @type(Quest) activeQuest: Quest | null = null;
}

// ... (Keep Loot, Enemy, GameState schemas) ...
export class Loot extends Schema implements ILootData {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") z: number = 0;
    @type(Item) item: Item = new Item();
}

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
    @type({ map: Enemy }) enemies = new MapSchema<Enemy>();
    @type({ map: Loot }) lootItems = new MapSchema<Loot>();
}

Modify packages/server/src/rooms/GameRoom.ts:
Import quests.json, create a Map for lookup, and implement handlers:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy, Loot, Item, Quest } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, getRankTitle, IQuestDef } from "@gangs-online/shared";

// --- LOAD DATA (Simulating Database Load) ---
// Note: In a real editor setup, you might use fs.readFileSync or a DB call.
// For now, we import the JSON directly.
import questList from "../data/quests.json"; 

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    
    // Data Cache
    questDefinitions: Map<string, IQuestDef> = new Map();

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        
        // Initialize Quest Data
        questList.forEach((q: any) => {
            this.questDefinitions.set(q.id, q as IQuestDef);
        });
        console.log(`Loaded ${this.questDefinitions.size} quests.`);

        this.setState(new GameState());
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) this.spawnEnemy();
        this.spawnNPC("npc_shop", 0, 0, "十三叔 (Shop)");
        this.spawnNPC("npc_quest", 5, 5, "浩南 (Quest)");

        // ... (Keep existing handlers: move, chat, pickup, useItem, buy) ...
        this.onMessage("move", (c, i) => { const p=this.state.players.get(c.sessionId); if(p&&p.hp>0){p.x=i.x;p.z=i.z;} });
        this.onMessage("chat", (c, m) => this.broadcast("chat", {sessionId:c.sessionId, text:m}));
        this.onMessage("pickup", (c, lId) => { 
             const player = this.state.players.get(c.sessionId);
             const loot = this.state.lootItems.get(lId);
             if (player && loot && player.hp > 0) {
                 const dist = Math.sqrt(Math.pow(player.x - loot.x, 2) + Math.pow(player.z - loot.z, 2));
                 if (dist <= GAME_CONSTANTS.LOOT_PICKUP_RANGE) {
                     if (loot.item.type === 'currency') {
                         player.money += loot.item.value;
                         c.send("notification", `執到 $${loot.item.value}`);
                     } else {
                         const newItem = new Item();
                         newItem.id = loot.item.id; newItem.name = loot.item.name; newItem.type = loot.item.type; newItem.value = loot.item.value;
                         player.inventory.push(newItem);
                         c.send("notification", `執到 ${loot.item.name}`);
                     }
                     this.state.lootItems.delete(lId);
                 }
             }
        });
        this.onMessage("useItem", (c, idx) => {
             const player = this.state.players.get(c.sessionId);
             if (player && player.hp > 0 && idx < player.inventory.length) {
                 const item = player.inventory.at(idx);
                 if (item && item.type === 'consumable') {
                     player.hp = Math.min(player.hp + item.value, player.maxHp);
                     player.inventory.deleteAt(idx);
                     c.send("notification", `食咗 ${item.name}, 回復 ${item.value} 血`);
                 }
             }
        });
        this.onMessage("buy", (client, itemId: string) => {
            const player = this.state.players.get(client.sessionId);
            const dist = Math.sqrt(player.x*player.x + player.z*player.z);
            if (dist > 5.0) { client.send("notification", "太遠了！"); return; }
            const shopItem = GAME_CONSTANTS.SHOP_ITEMS.find(i => i.id === itemId);
            if (player && shopItem) {
                if (player.money >= shopItem.price) {
                    player.money -= shopItem.price;
                    const newItem = new Item();
                    newItem.id = shopItem.id; newItem.name = shopItem.name; newItem.type = shopItem.type as any; newItem.value = shopItem.value;
                    player.inventory.push(newItem);
                    client.send("notification", `買咗 ${shopItem.name}`);
                } else { client.send("notification", "錢唔夠！"); }
            }
        });

        // --- NEW: DATA-DRIVEN QUEST HANDLERS ---
        this.onMessage("acceptQuest", (client, questId: string) => {
            const player = this.state.players.get(client.sessionId);
            const questDef = this.questDefinitions.get(questId);
            
            const npc = this.state.enemies.get("npc_quest");
            if (npc && player && questDef && !player.activeQuest) {
                const dist = Math.sqrt(Math.pow(player.x - npc.x, 2) + Math.pow(player.z - npc.z, 2));
                if (dist < 5.0) {
                    const newQuest = new Quest();
                    newQuest.id = questDef.id;
                    newQuest.name = questDef.name;
                    newQuest.description = questDef.description;
                    newQuest.requiredCount = questDef.requiredCount;
                    newQuest.rewardXp = questDef.reward.xp;
                    newQuest.rewardMoney = questDef.reward.money;
                    
                    player.activeQuest = newQuest;
                    client.send("notification", `接咗任務: ${questDef.name}`);
                }
            }
        });

        this.onMessage("completeQuest", (client) => {
            const player = this.state.players.get(client.sessionId);
            const npc = this.state.enemies.get("npc_quest");
            
            if (npc && player && player.activeQuest && player.activeQuest.completed) {
                 const dist = Math.sqrt(Math.pow(player.x - npc.x, 2) + Math.pow(player.z - npc.z, 2));
                 if (dist < 5.0) {
                     // Give Rewards
                     player.xp += player.activeQuest.rewardXp;
                     player.money += player.activeQuest.rewardMoney;
                     
                     // Level Up
                     if (player.xp >= player.maxXp) {
                         player.xp -= player.maxXp; player.level++;
                         player.maxXp = Math.floor(player.maxXp * 1.5);
                         player.maxHp += 20; player.hp = player.maxHp;
                         this.broadcast("chat", { sessionId: "SYSTEM", text: `${player.name} 升職了! (Lv${player.level})` });
                     }

                     client.send("notification", `任務完成! 獲得 $${player.activeQuest.rewardMoney}, ${player.activeQuest.rewardXp}XP`);
                     player.activeQuest = null; 
                 }
            }
        });

        // --- ATTACK LOGIC WITH QUEST CHECK ---
        this.onMessage("attack", (client, payload: { targetId: string, type: 'player' | 'enemy' | 'npc' }) => {
            const attacker = this.state.players.get(client.sessionId);
            if (!attacker || attacker.hp <= 0) return;
            const distFromCenter = Math.sqrt(attacker.x*attacker.x + attacker.z*attacker.z);
            if (distFromCenter < GAME_CONSTANTS.SAFE_ZONE_RADIUS) { client.send("notification", "安全區不能打架"); return; }

            let target: Player | Enemy | undefined;
            if (payload.type === 'player') target = this.state.players.get(payload.targetId);
            else if (payload.type === 'enemy') target = this.state.enemies.get(payload.targetId);

            if (target && target.hp > 0) {
                 const targetDist = Math.sqrt(target.x*target.x + target.z*target.z);
                 if (targetDist < GAME_CONSTANTS.SAFE_ZONE_RADIUS) { client.send("notification", "對方在安全區"); return; }

                const dx = attacker.x - target.x; const dz = attacker.z - target.z;
                if (Math.sqrt(dx*dx+dz*dz) <= GAME_CONSTANTS.ATTACK_RANGE) {
                    target.hp -= GAME_CONSTANTS.ATTACK_DAMAGE;
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

                             // --- CHECK QUEST DATA ---
                             if (attacker.activeQuest && !attacker.activeQuest.completed) {
                                 // Look up Definition to check Target Requirements
                                 // (In a simple setup, we trust the Client doesn't need to know the TargetID, 
                                 // but here we check against the loaded Data on Server)
                                 const def = this.questDefinitions.get(attacker.activeQuest.id);
                                 if (def && def.type === 'kill') {
                                     // Check if target ID (e.g. mob_x) contains the requirement (e.g. mob)
                                     // This allows killing ANY "mob_*" to satisfy "mob" requirement
                                     if (payload.targetId.includes(def.targetId)) {
                                         attacker.activeQuest.currentCount++;
                                         if (attacker.activeQuest.currentCount >= attacker.activeQuest.requiredCount) {
                                             attacker.activeQuest.completed = true;
                                             client.send("notification", "任務目標達成! 返去找浩南哥。");
                                         }
                                     }
                                 }
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
    }

    // ... (Keep existing helpers) ...
    spawnNPC(id: string, x: number, z: number, name: string) { const e=new Enemy(); e.id=id; e.x=x; e.z=z; e.name=name; e.type='npc'; e.state='idle'; e.hp=9999; this.state.enemies.set(id, e); }
    spawnLoot(x: number, z: number) { /* ... */ }
    update(dt: number) { /* ... */ }
    respawnPlayer(id: string) { /* ... */ }
    spawnEnemy() { /* ... */ }
    onJoin(client: Client, options: any) { const p=new Player(); p.sessionId=client.sessionId; p.x=Math.random()*10-5; p.z=Math.random()*10-5; p.name=options.name||`Gangster ${client.sessionId.substr(0,4)}`; this.state.players.set(client.sessionId, p); }
    onLeave(client: Client) { this.state.players.delete(client.sessionId); }
}

Step 4: Client-Side UI (Quest Dialog & Tracker)
This part is similar to before, but we ensure it uses the synced quest state properly.
Modify packages/client/src/main.ts:
Update createScene to include Quest UI:
// packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, ILootData, getRankTitle, GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders";

// ... (Keep createCity, createShopUI, createChatUI, createEntityUI, createInventoryUI) ...

const createQuestTracker = (uiTexture: GUI.AdvancedDynamicTexture) => {
    const panel = new GUI.StackPanel();
    panel.width = "200px";
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    panel.top = "20px";
    panel.left = "20px";
    uiTexture.addControl(panel);

    const title = new GUI.TextBlock();
    title.text = ""; title.color = "yellow"; title.fontSize = 18; title.height = "30px"; title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.addControl(title);

    const progress = new GUI.TextBlock();
    progress.text = ""; progress.color = "white"; progress.fontSize = 16; progress.height = "30px"; progress.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.addControl(progress);

    return { title, progress };
}

const createQuestDialog = (room: Client.Room, uiTexture: GUI.AdvancedDynamicTexture) => {
    const rect = new GUI.Rectangle();
    rect.width = "400px"; rect.height = "250px"; rect.background = "black"; rect.thickness = 2; rect.color = "white";
    rect.isVisible = false;
    uiTexture.addControl(rect);

    const txt = new GUI.TextBlock();
    txt.text = ""; txt.color = "white"; txt.textWrapping = true; txt.top = "-40px"; txt.width = "90%";
    rect.addControl(txt);

    const btn = GUI.Button.CreateSimpleButton("qBtn", "Action");
    btn.width = "150px"; btn.height = "40px"; btn.color = "white"; btn.background = "green"; btn.top = "80px";
    rect.addControl(btn);

    const close = GUI.Button.CreateSimpleButton("qClose", "X");
    close.width="30px"; close.height="30px"; close.color="red"; close.top="-105px"; close.left="180px";
    close.onPointerUpObservable.add(() => rect.isVisible = false);
    rect.addControl(close);

    return { rect, txt, btn };
}

// ... (createShopUI, loadShopUI - Keep existing) ...

const createScene = async () => {
    // ... (Setup Engine, Scene, Camera, Light, City, UI) ...
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true; scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.setTarget(BABYLON.Vector3.Zero());
    const zoom = 14; const aspect = engine.getAspectRatio(camera); camera.orthoTop=zoom; camera.orthoBottom=-zoom; camera.orthoLeft=-zoom*aspect; camera.orthoRight=zoom*aspect;
    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    createCity(scene); // Ensure this creates Safe Zone Visuals

    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    // UI Panels (Assuming createShopUI exists)
    const shopPanel = createShopUI(room, uiTexture); // Or loadShopUI if using JSON
    const questTracker = createQuestTracker(uiTexture);
    const questDialog = createQuestDialog(room, uiTexture);

    const entities: any = {};
    const lootMeshes: any = {};
    let mySessionId: string | null = null;
    let inventoryUI: any = null;

    try {
        const room = await client.joinOrCreate("game_room", { name: "Player" });
        mySessionId = room.sessionId;

        createChatUI(room, scene);
        inventoryUI = createInventoryUI(room, uiTexture);
        
        // ... (Keep Listeners) ...
        room.onMessage("chat", (msg) => { if(entities[msg.sessionId]) createChatBubble(entities[msg.sessionId].mesh, msg.text, uiTexture); });
        room.onMessage("notification", (text) => { 
             const notif = new GUI.TextBlock(); notif.text = text; notif.color = "yellow"; notif.fontSize = 24; notif.top = "-100px";
             uiTexture.addControl(notif); setTimeout(() => notif.dispose(), 2000);
        });

        const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy'|'npc') => {
             // ... (Keep Mesh Loading) ...
             const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
             const root = result.meshes[0];
             root.position.set(entityData.x, 0.1, entityData.z); root.scaling.set(0.15, 0.15, 0.15); root.rotationQuaternion = null; 
             root.checkCollisions = true; root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5); 
             root.metadata = { id: id, type: type };

             if (type === 'npc') {
                 const isQuest = id === "npc_quest";
                 root.getChildMeshes().forEach(m => { if(m.material) (m.material as any).emissiveColor = isQuest ? new BABYLON.Color3(0.8, 0, 0.8) : new BABYLON.Color3(0.5, 0.5, 1); });
             } else if (type === 'enemy') {
                 root.getChildMeshes().forEach(m => { if(m.material) (m.material as any).emissiveColor = new BABYLON.Color3(0.5, 0, 0); });
             }
             const idle = result.animationGroups.find(a => a.name === "Idle"); if (idle) idle.play(true);

             const ui = createEntityUI(root as BABYLON.Mesh, entityData.name, type === 'enemy', entityData.level||1);
             uiTexture.addControl(ui.container); ui.container.linkWithMesh(root);
             entities[id] = { mesh: root, ui };

             entityData.onChange(() => { 
                const t = {x: entityData.x, z: entityData.z};
                scene.onBeforeRenderObservable.addOnce(() => {
                   root.position.x = BABYLON.Scalar.Lerp(root.position.x, t.x, 0.1);
                   root.position.z = BABYLON.Scalar.Lerp(root.position.z, t.z, 0.1);
                });
             });
             
             if(id===mySessionId && type==='player') {
                 // Inventory
                 entityData.listen("money", (v: number) => inventoryUI.updateInventory(v, entityData.inventory));
                 entityData.inventory.onAdd(()=>inventoryUI.updateInventory(entityData.money, entityData.inventory));
                 entityData.inventory.onRemove(()=>inventoryUI.updateInventory(entityData.money, entityData.inventory));

                 // QUEST UI SYNC
                 entityData.listen("activeQuest", (quest: any) => {
                     if (quest) {
                         questTracker.title.text = quest.name;
                         questTracker.progress.text = `Progress: ${quest.currentCount} / ${quest.requiredCount}`;
                         quest.onChange(() => {
                             questTracker.progress.text = `Progress: ${quest.currentCount} / ${quest.requiredCount}`;
                             if (quest.completed) questTracker.progress.text += " (COMPLETE!)";
                         });
                     } else {
                         questTracker.title.text = "";
                         questTracker.progress.text = "";
                     }
                 });
             }
        };

        room.state.players.onAdd((p, sId) => spawnEntityVisuals(p, sId, 'player'));
        room.state.players.onRemove((p, sId) => { if(entities[sId]) { entities[sId].mesh.dispose(); entities[sId].ui.container.dispose(); delete entities[sId]; }});
        room.state.enemies.onAdd((e, eId) => spawnEntityVisuals(e, eId, e.type));
        room.state.enemies.onRemove((e, eId) => { if(entities[eId]) { entities[eId].mesh.dispose(); entities[eId].ui.container.dispose(); delete entities[eId]; }});
        room.state.lootItems.onAdd((l, id) => { /*...*/ });
        room.state.lootItems.onRemove((l, id) => { /*...*/ });

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
                       if (id === "npc_shop") {
                           shopPanel.isVisible = !shopPanel.isVisible;
                       } else if (id === "npc_quest") {
                           // OPEN QUEST DIALOG
                           const myPlayer = room.state.players.get(mySessionId!);
                           if (myPlayer) {
                               questDialog.rect.isVisible = true;
                               if (myPlayer.activeQuest) {
                                   if (myPlayer.activeQuest.completed) {
                                       questDialog.txt.text = `[${myPlayer.activeQuest.name}]\n\n做得好！這是你的獎勵。`;
                                       questDialog.btn.children[0].text = "領取獎勵";
                                       questDialog.btn.onPointerUpObservable.clear();
                                       questDialog.btn.onPointerUpObservable.add(() => { room.send("completeQuest"); questDialog.rect.isVisible = false; });
                                   } else {
                                       questDialog.txt.text = `[${myPlayer.activeQuest.name}]\n\n${myPlayer.activeQuest.description}\n\n進度: ${myPlayer.activeQuest.currentCount}/${myPlayer.activeQuest.requiredCount}`;
                                       questDialog.btn.children[0].text = "繼續努力";
                                       questDialog.btn.onPointerUpObservable.clear();
                                       questDialog.btn.onPointerUpObservable.add(() => questDialog.rect.isVisible = false);
                                   }
                               } else {
                                   // Offer First Quest (q1_first_blood)
                                   // Note: In real app, we'd fetch Quest info from server or look up local definitions
                                   // For now we hardcode the display based on ID "q1_first_blood"
                                   questDialog.txt.text = `[清理門戶]\n\n浩南哥話最近有班廢青係銅鑼灣搞事，你去教訓下 3 個小混混 (Street Thug)。\n\n獎勵: $500, 300XP`;
                                   questDialog.btn.children[0].text = "接任務";
                                   questDialog.btn.onPointerUpObservable.clear();
                                   questDialog.btn.onPointerUpObservable.add(() => { room.send("acceptQuest", "q1_first_blood"); questDialog.rect.isVisible = false; });
                               }
                           }
                       }
                       return;
                   }
                   if (id !== mySessionId) { room.send("attack", { targetId: id, type: type }); return; }
               }
               
               if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road") || pickResult.pickedMesh.name.startsWith("safeZone")) {
                    room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
               }
           }
       };

    } catch (e) { console.error(e); }

    scene.registerBeforeRender(() => {
        // ... (Render Loop) ...
        for (const id in entities) { /* lerp */ }
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


