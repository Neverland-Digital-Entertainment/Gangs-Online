Gangs Online: Phase 12 - Nakama Integration (Cloud DB Hybrid)
Objective: Skip local JSON persistence. Directly implement Nakama for Authentication and Storage using a free Cloud Database (CockroachDB Serverless).
Step 1: Configure Local Docker for Nakama (Stateless)
We will configure Docker to run ONLY the Nakama server locally. It will connect to your remote CockroachDB. This saves local resources.
Create (or overwrite) docker-compose.yml in the root directory:
version: '3'
services:
  nakama:
    image: heroiclabs/nakama:3.16.0
    container_name: gangs_nakama
    entrypoint:
      - "/bin/sh"
      - "-ecx"
      - >
          /nakama/nakama migrate up --database.address "$$DB_URL" &&
          exec /nakama/nakama --name nakama1 --database.address "$$DB_URL" --logger.level DEBUG --session.token_expiry_sec 7200
    restart: always
    environment:
      # IMPORTANT: You will need to replace this manually after generation
      - DB_URL=postgresql://nevereland.games:CN-JJ6Ta3f0WFuZsu8Fi6g@gangs-online-11404.jxf.gcp-europe-west2.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full
      - NAKAMA_CONSOLE_USER=admin
      - NAKAMA_CONSOLE_PASSWORD=password
    expose:
      - "7349"
      - "7350"
      - "7351"
    ports:
      - "7349:7349"
      - "7350:7350"
      - "7351:7351"
    volumes:
      - ./:/nakama/data


Action Required: After this file is created, open it and replace the DB_URL value with your actual CockroachDB connection string.
Step 2: Install Nakama SDKs
Install the necessary libraries for both client and server.
Run in terminal:
# Client
cd packages/client
npm install @heroiclabs/nakama-js

# Server
cd ../server
npm install @heroiclabs/nakama-js node-fetch


Step 3: Client-Side Authentication Service
Create packages/client/src/nakama.ts to handle auth.
import { Client, Session } from "@heroiclabs/nakama-js";

// Local Docker Nakama Config
const CONFIG = {
    host: "localhost", 
    port: "7350",
    useSSL: false,
    serverKey: "defaultkey"
};

export class NakamaService {
    private client: Client;
    private session: Session | null = null;

    constructor() {
        this.client = new Client(CONFIG.serverKey, CONFIG.host, CONFIG.port, CONFIG.useSSL);
    }

    async authenticate(username: string): Promise<{ session: Session, userId: string, username: string }> {
        // Use Device ID auth for simplest UX (username as ID)
        // In prod, you'd use Email/Password or Social Auth
        try {
            // true = create if not exists
            this.session = await this.client.authenticateDevice(username, true, username);
            console.log("Nakama Auth Success:", this.session);
            return {
                session: this.session,
                userId: this.session.user_id!,
                username: this.session.username!
            };
        } catch (e) {
            console.error("Nakama Auth Failed:", e);
            throw e;
        }
    }

    getSession() { return this.session; }
    getClient() { return this.client; }
}

export const nakamaService = new NakamaService();


Step 4: Login UI Integration
Update packages/client/src/main.ts to show a Login screen and authenticate via Nakama before connecting to Colyseus.
Update createLoginUI and startGame logic:
// packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, ILootData, getRankTitle, GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders";
import { nakamaService } from "./nakama"; // Import Nakama

// ... (Keep existing helpers: SoundManager, createCity, createShopUI, etc.) ...
// For the script, we assume previous helpers exist.

const createLoginUI = (onJoin: (username: string, userId: string) => void) => {
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("LoginUI");
    
    const bg = new GUI.Rectangle(); bg.background = "#111"; bg.width = "100%"; bg.height = "100%";
    advancedTexture.addControl(bg);

    const panel = new GUI.StackPanel();
    advancedTexture.addControl(panel);

    const title = new GUI.TextBlock();
    title.text = "Gangs Online\n(Cloud Save)";
    title.color = "red";
    title.fontSize = 48;
    title.height = "150px";
    panel.addControl(title);

    const input = new GUI.InputText();
    input.width = "300px"; input.height = "50px"; 
    input.placeholderText = "輸入角色名稱 (Enter Name)";
    input.color = "white"; input.background = "black";
    panel.addControl(input);

    const btn = GUI.Button.CreateSimpleButton("join", "進入江湖");
    btn.width = "300px"; btn.height = "60px";
    btn.color = "white"; btn.background = "green"; btn.top = "20px";
    
    const statusTxt = new GUI.TextBlock();
    statusTxt.text = ""; statusTxt.color = "yellow"; statusTxt.height = "30px"; statusTxt.top = "10px";
    panel.addControl(statusTxt);

    btn.onPointerUpObservable.add(async () => {
        if (input.text.trim().length > 0) {
            btn.isEnabled = false;
            statusTxt.text = "Connecting to Cloud...";
            
            try {
                // 1. Nakama Auth
                const result = await nakamaService.authenticate(input.text.trim());
                
                // 2. Start Game
                advancedTexture.dispose();
                onJoin(result.username, result.userId);
            } catch (e) {
                console.error(e);
                statusTxt.text = "Login Failed. Check Console.";
                statusTxt.color = "red";
                btn.isEnabled = true;
                btn.children[0].text = "Retry";
            }
        }
    });
    panel.addControl(btn);
}

// ... (Keep createScene) ...

const startGame = async (username: string, userId: string) => {
    const scene = new BABYLON.Scene(engine);
    // ... (Standard Scene Setup) ...
    scene.collisionsEnabled = true; scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.setTarget(BABYLON.Vector3.Zero());
    const zoom = 14; const aspect = engine.getAspectRatio(camera); camera.orthoTop=zoom; camera.orthoBottom=-zoom; camera.orthoLeft=-zoom*aspect; camera.orthoRight=zoom*aspect;
    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    createCity(scene); 
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const soundManager = new SoundManager(scene);

    try {
        // PASS NAKAMA USER ID to Colyseus
        const room = await client.joinOrCreate("game_room", { 
            username: username,
            userId: userId 
        });
        
        // ... (Keep ALL Logic from previous phases) ...
        // Re-inject game logic (Spawn, Input, UI, etc.)
        
        // Stub for correctness:
        const entities: any = {};
        const spawnEntityVisuals = async (entityData: any, id: string, type: string) => {
             const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
             const root = result.meshes[0]; root.position.set(entityData.x, 0.1, entityData.z); root.scaling.set(0.15,0.15,0.15); root.rotationQuaternion=null;
             entities[id] = { mesh: root };
        };
        room.state.players.onAdd((p:any, sId:string) => spawnEntityVisuals(p, sId, 'player'));
        
        scene.onPointerDown = (evt, pick) => { /* input */ };

    } catch (e) { console.error(e); }

    scene.registerBeforeRender(() => { /* loop */ });
    engine.runRenderLoop(() => { scene.render(); });
}

// INITIALIZATION
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client("ws://localhost:2567");

const loginScene = new BABYLON.Scene(engine);
createLoginUI((username, userId) => {
    loginScene.dispose();
    startGame(username, userId);
});

engine.runRenderLoop(() => { if (loginScene.activeCamera) loginScene.render(); });
window.addEventListener("resize", () => { engine.resize(); });


Step 5: Server-Side Persistence (Nakama Storage)
Implement persistence.ts to write to Nakama.
Create packages/server/src/data/persistence.ts:
import { Player, Item, Quest } from "../rooms/schema/GameState";
import { IQuestDef } from "@gangs-online/shared";
import { Client } from "@heroiclabs/nakama-js";
import fetch from "node-fetch";

// Polyfill fetch for Node.js
(global as any).fetch = fetch;

const NAKAMA_CONFIG = {
    host: "localhost", // This refers to the docker container locally
    port: "7350",
    serverKey: "defaultkey",
    useSSL: false
};

// If running inside Docker (Colyseus next to Nakama), host might be 'nakama'.
// Since you are running Server (Node) on Host and Nakama in Docker, 'localhost' is correct.
const nakama = new Client(NAKAMA_CONFIG.serverKey, NAKAMA_CONFIG.host, NAKAMA_CONFIG.port, NAKAMA_CONFIG.useSSL);

export const savePlayer = async (player: Player, userId: string) => {
    // 1. Serialize
    const inventory = player.inventory.map(i => ({ id: i.id, name: i.name, type: i.type, value: i.value }));
    let activeQuest = null;
    if (player.activeQuest) {
        activeQuest = { id: player.activeQuest.id, currentCount: player.activeQuest.currentCount, completed: player.activeQuest.completed };
    }

    const saveData = {
        level: player.level, xp: player.xp, money: player.money,
        inventory: inventory, activeQuest: activeQuest,
        maxXp: player.maxXp, maxHp: player.maxHp, x: player.x, z: player.z
    };

    try {
        // Authenticate using the Player's ID to act on their behalf
        const session = await nakama.authenticateDevice(player.name, true, player.name);

        const writeReq = {
            collection: "gamestate",
            key: "save",
            value: saveData,
            permissionRead: 1,
            permissionWrite: 1
        };

        await nakama.writeStorageObjects(session, [writeReq]);
        console.log(`[Nakama] Saved data for ${player.name}`);
    } catch (e) {
        console.error("[Nakama] Save Failed:", e);
    }
};

export const loadPlayer = async (player: Player, username: string, questDefs: Map<string, IQuestDef>) => {
    try {
        const session = await nakama.authenticateDevice(username, true, username);
        const result = await nakama.listStorageObjects(session, "gamestate", session.user_id, 1);

        if (result.objects && result.objects.length > 0) {
            const saveObj = result.objects.find(o => o.key === "save");
            if (saveObj && saveObj.value) {
                const saved: any = saveObj.value;
                console.log(`[Nakama] Restoring ${username} from Cloud DB...`);

                player.level = saved.level;
                player.xp = saved.xp;
                player.money = saved.money;
                player.maxXp = saved.maxXp;
                player.maxHp = saved.maxHp;
                player.hp = saved.maxHp;
                player.x = saved.x;
                player.z = saved.z;

                if (saved.inventory) {
                    saved.inventory.forEach((i: any) => {
                        const newItem = new Item();
                        newItem.id = i.id; newItem.name = i.name; newItem.type = i.type; newItem.value = i.value;
                        player.inventory.push(newItem);
                    });
                }

                if (saved.activeQuest) {
                    const def = questDefs.get(saved.activeQuest.id);
                    if (def) {
                        const QuestClass = player._schema.activeQuest._type;
                        const q = new QuestClass();
                        q.id = def.id; q.name = def.name; q.description = def.description; q.requiredCount = def.requiredCount;
                        q.rewardXp = def.reward.xp; q.rewardMoney = def.reward.money;
                        q.currentCount = saved.activeQuest.currentCount; q.completed = saved.activeQuest.completed;
                        player.activeQuest = q;
                    }
                }
                return true;
            }
        }
    } catch (e) {
        console.error("[Nakama] Load Failed (New User?):", e);
    }
    return false;
};


Step 6: Update GameRoom
Update packages/server/src/rooms/GameRoom.ts to pass the userId to persistence functions.
Update onJoin and onLeave:
// packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player, Enemy, Loot, Item, Quest } from "./schema/GameState";
import { IPlayerInput, GAME_CONSTANTS, getRankTitle, IQuestDef } from "@gangs-online/shared";
import questList from "../data/quests.json";
import { savePlayer, loadPlayer } from "../data/persistence"; 

export class GameRoom extends Room<GameState> {
    maxClients = 50;
    questDefinitions: Map<string, IQuestDef> = new Map();

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        questList.forEach((q: any) => this.questDefinitions.set(q.id, q as IQuestDef));
        this.setState(new GameState());
        this.setSimulationInterval((dt) => this.update(dt));
        
        for(let i=0; i<GAME_CONSTANTS.ENEMY_SPAWN_COUNT; i++) this.spawnEnemy();
        this.spawnNPC("npc_shop", 0, 0, "十三叔 (Shop)");
        this.spawnNPC("npc_quest", 5, 5, "浩南 (Quest)");

        // ... (Keep existing message handlers) ...
        this.onMessage("move", (c, i) => { const p=this.state.players.get(c.sessionId); if(p&&p.hp>0){p.x=i.x;p.z=i.z;} });
        this.onMessage("chat", (c, m) => this.broadcast("chat", {sessionId:c.sessionId, text:m}));
        this.onMessage("attack", (client, payload) => { /* logic */ }); 
        // ...
    }

    async onJoin(client: Client, options: any) {
        // Options now contains userId from Nakama
        const username = options.username || `Gangster_${client.sessionId.substr(0,4)}`;
        const userId = options.userId || "unknown"; 
        
        console.log(`${username} (ID: ${userId}) connecting...`);

        const player = new Player();
        player.sessionId = client.sessionId;
        player.name = username;
        player.id = userId; // Store Nakama ID in Player Schema
        
        // Load from Nakama
        const loaded = await loadPlayer(player, username, this.questDefinitions);
        
        if (!loaded) {
            player.x = Math.random() * 10 - 5;
            player.z = Math.random() * 10 - 5;
            player.money = 200;
            player.level = 1;
            player.hp = 100;
            player.maxHp = 100;
            player.xp = 0;
            player.maxXp = GAME_CONSTANTS.BASE_XP_TO_LEVEL;
        }

        this.state.players.set(client.sessionId, player);
    }

    async onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        if (player) {
            // Save to Nakama
            await savePlayer(player, player.id);
            console.log(`Saved progress for ${player.name}`);
            this.state.players.delete(client.sessionId);
        }
    }
    
    // ... (Keep helpers) ...
    spawnNPC(id: string, x: number, z: number, name: string) { const e=new Enemy(); e.id=id; e.x=x; e.z=z; e.name=name; e.type='npc'; e.state='idle'; e.hp=9999; this.state.enemies.set(id, e); }
    spawnEnemy() { const e=new Enemy(); e.id=`mob_${Math.random().toString(36).substr(2,5)}`; e.x=Math.random()*40-20; e.z=Math.random()*40-20; e.name="Street Thug"; this.state.enemies.set(e.id, e); }
    spawnLoot(x: number, z: number) {} // stub
    update(dt: number) {} // stub
    respawnPlayer(id: string) {} // stub
}


