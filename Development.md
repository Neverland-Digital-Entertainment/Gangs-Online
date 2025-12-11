Gangs Online: Project Scaffolding Instructions
Project Name: Gangs Online
Objective: Initialize a Monorepo for a Web-based MMORPG using Node.js, Colyseus, and Babylon.js.
Tech Stack: - Root: Node.js (Monorepo with Lerna/Workspaces)
Server: Colyseus (TypeScript)
Client: Babylon.js + Vite (TypeScript)
Shared: TypeScript Interface Definitions
Please execute the following steps to scaffold the project structure.
Step 1: Root Directory & Workspaces
Create the root directory GangsOnline and the following folder structure:
packages/client
packages/server
packages/shared
Create the root package.json to manage workspaces:
// File: package.json
{
  "name": "gangs-online",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev:server": "npm run dev --workspace=@gangs-online/server",
    "dev:client": "npm run dev --workspace=@gangs-online/client",
    "build": "npm run build --workspaces"
  }
}


Step 2: Shared Module (Types)
Initialize the shared package. This package holds data structures used by both Client and Server.
// File: packages/shared/package.json
{
  "name": "@gangs-online/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}


// File: packages/shared/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "declaration": true,
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src/**/*"]
}


Create the shared type definitions.
// File: packages/shared/src/index.ts

// Input sent from Client to Server
export interface IPlayerInput {
    x: number;
    z: number; // In 3D space, we move on X and Z
}

// Player Roles (Based on GDD)
export type PlayerRole = 'citizen' | 'triad' | 'police';

// Player Data Structure for Sync
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

// Game Constants
export const GAME_CONSTANTS = {
    MAP_WIDTH: 100,
    MAP_HEIGHT: 100,
    PLAYER_SPEED: 0.2
};


Step 3: Server Module (Colyseus)
Initialize the server package logic.
// File: packages/server/package.json
{
  "name": "@gangs-online/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "start": "ts-node src/index.ts"
  },
  "dependencies": {
    "@colyseus/monitor": "^0.15.0",
    "@gangs-online/shared": "*",
    "colyseus": "^0.15.0",
    "cors": "^2.8.5",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.0",
    "@types/express": "^4.17.0",
    "nodemon": "^3.0.0",
    "ts-node": "^10.0.0",
    "typescript": "^5.0.0"
  }
}


// File: packages/server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true
  }
}


Create the Game State Schema (Synchronization Logic).
// File: packages/server/src/rooms/schema/GameState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";
import { IPlayerData, PlayerRole } from "@gangs-online/shared";

export class Player extends Schema implements IPlayerData {
    @type("string") id: string = "";
    @type("string") sessionId: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("string") role: PlayerRole = "triad"; 
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("string") name: string = "Gangster";
}

export class GameState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}


Create the Game Room Logic.
// File: packages/server/src/rooms/GameRoom.ts
import { Room, Client } from "colyseus";
import { GameState, Player } from "./schema/GameState";
import { IPlayerInput } from "@gangs-online/shared";

export class GameRoom extends Room<GameState> {
    maxClients = 50;

    onCreate(options: any) {
        console.log("Gangs Online: Room Created");
        this.setState(new GameState());

        // Handle Movement
        this.onMessage("move", (client, input: IPlayerInput) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                // In a real game, validate speed/teleport here
                player.x = input.x;
                player.z = input.z;
            }
        });
    }

    onJoin(client: Client, options: any) {
        console.log(`Player ${client.sessionId} joined Gangs Online`);
        const player = new Player();
        player.sessionId = client.sessionId;
        // Random Spawn
        player.x = Math.random() * 10 - 5;
        player.z = Math.random() * 10 - 5;
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
    }
}


Server Entry Point:
// File: packages/server/src/index.ts
import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

const gameServer = new Server({
  server: createServer(app),
});

gameServer.define("game_room", GameRoom);

gameServer.listen(port);
console.log(`[Gangs Online] Server is listening on ws://localhost:${port}`);


Step 4: Client Module (Babylon.js)
Initialize the client package with Vite.
// File: packages/client/package.json
{
  "name": "@gangs-online/client",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@babylonjs/core": "^7.0.0",
    "@babylonjs/gui": "^7.0.0",
    "@babylonjs/inspector": "^7.0.0",
    "@babylonjs/loaders": "^7.0.0",
    "@gangs-online/shared": "*",
    "colyseus.js": "^0.15.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}


// File: packages/client/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["src"]
}


HTML Entry:
<!-- File: packages/client/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gangs Online</title>
    <style>
        html, body { overflow: hidden; width: 100%; height: 100%; margin: 0; padding: 0; }
        #renderCanvas { width: 100%; height: 100%; touch-action: none; outline: none; }
    </style>
  </head>
  <body>
    <canvas id="renderCanvas"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>


Main Client Logic (Babylon Scene + Colyseus Sync):
// File: packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as Client from "colyseus.js";
import { IPlayerData } from "@gangs-online/shared";

// --- Game Configuration ---
const SERVER_URL = "ws://localhost:2567";

// --- Setup Engine ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client(SERVER_URL);

const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    
    // 1. Camera: Isometric (Orthographic)
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, 20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero());
    
    // Adjust Zoom
    const zoom = 10;
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom;
    camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom * aspect;
    camera.orthoRight = zoom * aspect;

    // 2. Lighting
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // 3. Environment (Placeholder for Hong Kong Streets)
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100}, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15); // Dark Asphalt
    ground.material = groundMat;

    // 4. Multiplayer Logic
    const playerMeshes: { [sessionId: string]: BABYLON.Mesh } = {};

    try {
        const room = await client.joinOrCreate("game_room");
        console.log("Connected to Gangs Online Server!");

        // On Player Join
        room.state.players.onAdd((player: IPlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;
            
            // Create Character Mesh (Box for now)
            const mesh = BABYLON.MeshBuilder.CreateBox("player", { height: 2, width: 1, depth: 1 }, scene);
            mesh.position.set(player.x, 1, player.z);

            const mat = new BABYLON.StandardMaterial("pMat", scene);
            mat.diffuseColor = isSelf ? BABYLON.Color3.Red() : BABYLON.Color3.Teal();
            mesh.material = mat;

            playerMeshes[sessionId] = mesh;

            // Sync Position Updates
            player.onChange(() => {
                // Interpolation could be added here for smoothness
                mesh.position.x = player.x;
                mesh.position.z = player.z;
            });
        });

        // On Player Leave
        room.state.players.onRemove((player: IPlayerData, sessionId: string) => {
            if (playerMeshes[sessionId]) {
                playerMeshes[sessionId].dispose();
                delete playerMeshes[sessionId];
            }
        });

        // 5. Input Handling (Click-to-Move Logic)
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedPoint) {
                const targetX = pickResult.pickedPoint.x;
                const targetZ = pickResult.pickedPoint.z;
                
                // Send move command to server
                room.send("move", { x: targetX, z: targetZ });
            }
        };

    } catch (e) {
        console.error("Connection Failed:", e);
    }

    return scene;
};

// --- Run Game ---
createScene().then((scene) => {
    engine.runRenderLoop(() => {
        scene.render();
    });
});

window.addEventListener("resize", () => {
    engine.resize();
});


Step 5: Install Dependencies
Run this in the root folder to link everything together:
npm install


Start the development servers:
Terminal 1: npm run dev:server
Terminal 2: npm run dev:client
