Gangs Online: Phase 2 - Environment & UI Update
Objective: Upgrade the "Gangs Online" prototype from a black void to a playable "Greybox City" environment with UI elements and camera follow.
Please modify the following files in packages/client/src.
Step 1: Update main.ts to include GUI and City Generation
Replace the content of packages/client/src/main.ts with the following code.
This code introduces:
GUI System: Adds name tags above players.
Camera Follow: The camera now smoothly tracks the local player.
City Generator: A helper function to build a procedural block of buildings resembling Hong Kong streets.
// File: packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui"; // Need to install this if missing
import * as Client from "colyseus.js";
import { IPlayerData } from "@gangs-online/shared";

// --- Configuration ---
const SERVER_URL = "ws://localhost:2567";

// --- Setup ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client(SERVER_URL);

// --- City Generator (Procedural Greybox) ---
const createCity = (scene: BABYLON.Scene) => {
    // 1. Asphalt Road
    const ground = BABYLON.MeshBuilder.CreateGround("road", {width: 100, height: 100}, scene);
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;

    // 2. Sidewalks (Lighter Grey)
    const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", scene);
    sidewalkMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // 3. Buildings (Neon Blocks)
    const buildingMat = new BABYLON.StandardMaterial("bMat", scene);
    buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
    buildingMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2); // Slight glow

    // Generate random blocks
    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            // Leave center empty for "Causeway Bay Sogo Crossing"
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;

            // Random building height
            const height = Math.random() * 8 + 4;
            
            const building = BABYLON.MeshBuilder.CreateBox(`b_${i}_${j}`, { height: height, width: 8, depth: 8 }, scene);
            building.position.set(i * 12, height / 2, j * 12);
            building.material = buildingMat;

            // Sidewalk around building
            const walk = BABYLON.MeshBuilder.CreateGround(`w_${i}_${j}`, {width: 10, height: 10}, scene);
            walk.position.set(i * 12, 0.05, j * 12); // Slightly above road
            walk.material = sidewalkMat;
        }
    }
}

// --- Player Label (GUI) ---
const createPlayerLabel = (mesh: BABYLON.Mesh, name: string, uiTexture: GUI.AdvancedDynamicTexture) => {
    const rect = new GUI.Rectangle();
    rect.width = "100px";
    rect.height = "30px";
    rect.cornerRadius = 5;
    rect.color = "white";
    rect.thickness = 1;
    rect.background = "black";
    rect.alpha = 0.7;
    
    // Position above head
    uiTexture.addControl(rect);
    rect.linkWithMesh(mesh);
    rect.linkOffsetY = -50; // Shift up

    const label = new GUI.TextBlock();
    label.text = name;
    label.color = "white";
    label.fontSize = 14;
    rect.addControl(label);

    return rect;
}

const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    
    // --- Camera (Follow Mode) ---
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(0, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const zoom = 12;
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom;
    camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom * aspect;
    camera.orthoRight = zoom * aspect;
    
    // Angle it like a classic RPG (Isometric-ish)
    camera.rotation.x = Math.PI / 4; 

    // --- Lighting ---
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.6;
    const dirLight = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);

    // --- Environment ---
    createCity(scene);

    // --- UI Layer ---
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // --- Multiplayer Logic ---
    const playerEntities: { [sessionId: string]: { mesh: BABYLON.Mesh, label: GUI.Rectangle } } = {};
    let mySessionId: string | null = null;

    try {
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        // Add Player
        room.state.players.onAdd((player: IPlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;
            
            // Create Mesh (Capsule is better for humans than Box)
            const mesh = BABYLON.MeshBuilder.CreateCapsule("player", { height: 2, radius: 0.5 }, scene);
            mesh.position.set(player.x, 1, player.z);

            // Material
            const mat = new BABYLON.StandardMaterial("pMat", scene);
            mat.diffuseColor = isSelf ? BABYLON.Color3.FromHexString("#FF0000") : BABYLON.Color3.FromHexString("#00FF00"); // Red for me, Green for others
            mesh.material = mat;

            // Name Tag
            const label = createPlayerLabel(mesh, isSelf ? "大佬 (Me)" : "小弟", uiTexture);

            playerEntities[sessionId] = { mesh, label };

            // Sync Logic
            player.onChange(() => {
                // Simple Interpolation (LERP) could go here later
                mesh.position.x = player.x;
                mesh.position.z = player.z;
            });
        });

        // Remove Player
        room.state.players.onRemove((player: IPlayerData, sessionId: string) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].label.dispose();
                delete playerEntities[sessionId];
            }
        });

        // Input (Click to Move)
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedPoint) {
                // Ignore clicks on UI or Players, only walk on ground/sidewalk
                if (pickResult.pickedMesh?.name.startsWith("player")) return;

                room.send("move", { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z });
            }
        };

    } catch (e) {
        console.error("Connection Failed:", e);
    }

    // --- Game Loop ---
    scene.registerBeforeRender(() => {
        // Camera Follow Logic
        if (mySessionId && playerEntities[mySessionId]) {
            const myMesh = playerEntities[mySessionId].mesh;
            
            // Smoothly interpolate camera position to player position
            // Keep the offset (0, 20, -20)
            const targetPos = myMesh.position.clone();
            camera.position.x = targetPos.x;
            camera.position.z = targetPos.z - 20; // Offset Z
            camera.position.y = targetPos.y + 20; // Offset Y
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


