import * as BABYLON from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { PlayerData, GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders"; // Important for loading .glb/.gltf

// --- Configuration ---
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://21.0.0.138:2567";

// --- Setup ---
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const client = new Client.Client(SERVER_URL);

// --- WEAPON ATTACHMENT ---
const attachWeapon = (mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
    // 1. Create a simple Bat (Cylinder) - Make it bigger and more visible
    const bat = BABYLON.MeshBuilder.CreateCylinder("bat", { height: 1.2, diameter: 0.08 }, scene);
    const mat = new BABYLON.StandardMaterial("batMat", scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString("#8B4513"); // Brown wood
    bat.material = mat;

    // 2. Find the Right Hand Bone
    const skeleton = mesh.skeleton;
    console.log("Attaching weapon. Skeleton exists:", !!skeleton);

    if (skeleton) {
        // Debug: Print all bone names
        console.log("Available bones:", skeleton.bones.map(b => b.name).join(", "));

        // Try multiple possible bone names for the right hand
        const handBone = skeleton.bones.find(b =>
            b.name.includes("RightHand") ||
            b.name.includes("RightHandMiddle") ||
            b.name.includes("R_Hand") ||
            b.name.toLowerCase().includes("hand_r")
        );

        if (handBone) {
            console.log("Found hand bone:", handBone.name);
            bat.attachToBone(handBone, mesh);
            // Adjust position/rotation to fit in hand
            bat.position = new BABYLON.Vector3(0, 0.1, 0);
            bat.rotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
        } else {
            console.warn("No hand bone found! Using fallback attachment");
            // Fallback: Just parent to mesh (won't animate with arm but will be visible)
            bat.parent = mesh;
            bat.position.x = 0.5;
            bat.position.y = 1.2;
            bat.position.z = 0;
        }
    } else {
        console.warn("No skeleton found! Using simple attachment");
        // Fallback: Just parent to mesh
        bat.parent = mesh;
        bat.position.x = 0.5;
        bat.position.y = 1.2;
        bat.position.z = 0;
    }
};

// --- CHAT BUBBLE ---
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
    label.color = "black";
    rect.addControl(label);

    // Fade out and destroy
    setTimeout(() => {
        rect.dispose();
    }, 4000);
};

// --- CHAT UI ---
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

    // Send on Enter
    input.onKeyboardEventProcessedObservable.add((ev) => {
        if (ev.key === "Enter" && input.text) {
            room.send("chat", input.text);
            input.text = "";
        }
    });

    advancedTexture.addControl(input);
    return advancedTexture;
};

// --- City Generator (Procedural Greybox) ---
const createCity = (scene: BABYLON.Scene) => {
    // 1. Asphalt Road
    const ground = BABYLON.MeshBuilder.CreateGround("road", { width: 100, height: 100 }, scene);
    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = roadMat;

    // ENABLE COLLISION ON GROUND
    ground.checkCollisions = true;

    // 2. Sidewalks (Lighter Grey)
    const sidewalkMat = new BABYLON.StandardMaterial("sidewalkMat", scene);
    sidewalkMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // 3. Buildings (Neon Blocks)
    const buildingMat = new BABYLON.StandardMaterial("bMat", scene);
    buildingMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);
    buildingMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2);

    // Generate random blocks
    for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
            if (Math.abs(i) < 2 && Math.abs(j) < 2) continue;

            const height = Math.random() * 8 + 4;

            const building = BABYLON.MeshBuilder.CreateBox(`b_${i}_${j}`, { height: height, width: 8, depth: 8 }, scene);
            building.position.set(i * 12, height / 2, j * 12);
            building.material = buildingMat;

            // ENABLE COLLISION ON BUILDINGS
            building.checkCollisions = true;

            const walk = BABYLON.MeshBuilder.CreateGround(`w_${i}_${j}`, { width: 10, height: 10 }, scene);
            walk.position.set(i * 12, 0.05, j * 12);
            walk.material = sidewalkMat;

            // ENABLE COLLISION ON SIDEWALKS
            walk.checkCollisions = true;
        }
    }
}

// --- UPDATED UI: Name Tag + Health Bar + Combat Indicator ---
const createPlayerUI = (mesh: BABYLON.AbstractMesh, name: string, uiTexture: GUI.AdvancedDynamicTexture) => {
    const container = new GUI.Rectangle();
    container.width = "120px";
    container.height = "80px"; // Increased height for combat indicator
    container.thickness = 0;
    uiTexture.addControl(container);
    container.linkWithMesh(mesh);
    container.linkOffsetY = -150; // Adjusted for taller container

    // Combat Indicator (Red Exclamation)
    const combatIndicator = new GUI.TextBlock();
    combatIndicator.text = "⚔️"; // Sword emoji
    combatIndicator.color = "red";
    combatIndicator.fontSize = 24;
    combatIndicator.top = "-35px";
    combatIndicator.isVisible = false; // Hidden by default
    container.addControl(combatIndicator);

    // Name
    const label = new GUI.TextBlock();
    label.text = name;
    label.color = "white";
    label.fontSize = 14;
    label.top = "-10px";
    label.shadowBlur = 2;
    container.addControl(label);

    // HP Bar Background (Red)
    const hpBg = new GUI.Rectangle();
    hpBg.width = "100px";
    hpBg.height = "10px";
    hpBg.color = "black";
    hpBg.thickness = 1;
    hpBg.background = "red";
    hpBg.top = "20px";
    container.addControl(hpBg);

    // HP Bar Foreground (Green)
    const hpFg = new GUI.Rectangle();
    hpFg.width = "100px"; // Start full
    hpFg.height = "10px";
    hpFg.thickness = 0;
    hpFg.background = "#00FF00";
    hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(hpFg);

    return { container, hpFg, hpBg, combatIndicator };
}

const createScene = async () => {
    const scene = new BABYLON.Scene(engine);

    // --- ENABLE GLOBAL COLLISIONS ---
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0); // Standard Gravity

    // --- Camera (True Isometric) ---
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero());

    // Zoom
    const zoom = 14;
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = zoom;
    camera.orthoBottom = -zoom;
    camera.orthoLeft = -zoom * aspect;
    camera.orthoRight = zoom * aspect;

    // --- Lighting ---
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;

    // --- Environment ---
    createCity(scene);

    // --- UI Layer ---
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // --- Multiplayer Logic ---
    // Store Mesh, Animation Groups, and Rotation Target
    interface PlayerEntity {
        mesh: BABYLON.AbstractMesh;
        ui: { container: GUI.Rectangle, hpFg: GUI.Rectangle, hpBg: GUI.Rectangle, combatIndicator: GUI.TextBlock };
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
        console.log("Connected! My ID:", mySessionId);

        // Create Chat Input
        createChatUI(room, scene);

        // Listen for Chat Broadcasts
        room.onMessage("chat", (msg: { sessionId: string, text: string }) => {
            if (playerEntities[msg.sessionId]) {
                createChatBubble(playerEntities[msg.sessionId].mesh, msg.text, uiTexture);
            }
        });

        // Add Player
        (room.state as any).players.onAdd(async (player: PlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;

            // --- LOAD 3D MODEL ---
            // Using Babylon's HVGirl model from CDN
            const result = await SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/", "HVGirl.glb", scene);

            const root = result.meshes[0];
            // Start slightly above ground to prevent getting stuck immediately
            root.position.set(player.x, 0.1, player.z);
            root.scaling.set(0.15, 0.15, 0.15); // Scale down HVGirl
            root.rotationQuaternion = null; // Allow manual rotation

            // --- COLLISION SETUP ---
            root.checkCollisions = true;
            // Define the "body" size (Radius X, Y, Z)
            root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
            // Offset the ellipsoid center (usually up by radius Y)
            root.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);

            // Store SessionId on the mesh for Raycasting (IMPORTANT for attack detection)
            root.metadata = { sessionId };

            // ATTACH WEAPON
            attachWeapon(result.meshes[1], scene); // meshes[1] is usually the skinned mesh in HVGirl

            // --- ANIMATIONS ---
            const idle = result.animationGroups.find(a => a.name === "Idle");
            const run = result.animationGroups.find(a => a.name === "Walking"); // HVGirl uses 'Walking'

            if (idle) idle.play(true); // Start Idle by default

            // UI (Name + HP Bar)
            const ui = createPlayerUI(root, isSelf ? "大佬 (Me)" : "Target", uiTexture);

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

            // Sync HP (Listen for HP changes)
            player.listen("hp", (currentHp: number) => {
                const percent = Math.max(0, currentHp / player.maxHp);
                ui.hpFg.width = `${percent * 100}px`; // Adjust bar width

                // Visual Feedback: Turn semi-transparent if dead
                if (currentHp <= 0) {
                    root.visibility = 0.3; // Ghost mode
                    console.log(`Player ${sessionId} is dead`);
                } else {
                    root.visibility = 1;
                }
            });

            // Sync Combat State
            player.listen("inCombatWith", (targetId: string) => {
                if (targetId && targetId !== "") {
                    ui.combatIndicator.isVisible = true;
                    console.log(`Player ${sessionId} entered combat with ${targetId}`);
                } else {
                    ui.combatIndicator.isVisible = false;
                    console.log(`Player ${sessionId} combat ended`);
                }
            });
        });

        // Remove Player
        (room.state as any).players.onRemove((player: PlayerData, sessionId: string) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].ui.container.dispose();
                // Stop and dispose animation groups
                playerEntities[sessionId].idleAnim?.stop();
                playerEntities[sessionId].idleAnim?.dispose();
                playerEntities[sessionId].runAnim?.stop();
                playerEntities[sessionId].runAnim?.dispose();

                delete playerEntities[sessionId];
                delete playerTargets[sessionId];
            }
        });

        // --- INPUT: Click to Attack or Move ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                // Check if we clicked a player (using metadata we set earlier)
                // We need to traverse up to root because pick might hit a child mesh
                let clickedMesh: BABYLON.Node = pickResult.pickedMesh;
                while (clickedMesh.parent) {
                    clickedMesh = clickedMesh.parent;
                }

                if (clickedMesh instanceof BABYLON.AbstractMesh && clickedMesh.metadata && clickedMesh.metadata.sessionId) {
                    // CLICKED ON PLAYER -> ATTACK
                    const targetId = clickedMesh.metadata.sessionId;
                    if (targetId !== mySessionId) {
                        console.log("Attacking:", targetId);
                        room.send("attack", { targetSessionId: targetId });
                        return; // Don't move if attacking
                    }
                }

                // CLICKED ON GROUND -> MOVE
                // Prevent clicking on buildings
                if (pickResult.pickedPoint && !pickResult.pickedMesh.name.startsWith("b_")) {
                    room.send("move", { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z });
                }
            }
        };

    } catch (e) {
        console.error("Connection Failed:", e);
    }

    // --- Game Loop (Animation & Movement) ---
    scene.registerBeforeRender(() => {
        for (const sessionId in playerEntities) {
            const entity = playerEntities[sessionId];
            const target = playerTargets[sessionId];

            if (entity && target) {
                const mesh = entity.mesh;

                // Calculate direction vector
                const dx = target.x - mesh.position.x;
                const dz = target.z - mesh.position.z;
                // Ignore Y difference for distance check (only 2D distance matters for target)
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Threshold to stop moving
                if (dist > 0.1) {
                    // --- MOVEMENT WITH COLLISIONS ---
                    // Create a velocity vector
                    // We apply Gravity (-0.5 per frame) to keep them grounded
                    const velocity = new BABYLON.Vector3(dx, -0.5, dz).normalize().scale(MOVE_SPEED);

                    // If close to target, clamp velocity to avoid overshooting
                    if (dist < MOVE_SPEED) {
                        velocity.scaleInPlace(dist / MOVE_SPEED);
                    }

                    // Look at target
                    const targetAngle = Math.atan2(dx, dz);
                    const currentRotation = mesh.rotation.y;
                    mesh.rotation.y = BABYLON.Scalar.Lerp(currentRotation, targetAngle, 0.2);

                    // Move!
                    mesh.moveWithCollisions(velocity);

                    // Play Run Animation
                    if (entity.currentAnim !== "run") {
                        if (entity.idleAnim) entity.idleAnim.stop();
                        if (entity.runAnim) entity.runAnim.play(true);
                        entity.currentAnim = "run";
                    }
                } else {
                    // Stop: Play Idle
                    if (entity.currentAnim !== "idle") {
                        if (entity.runAnim) entity.runAnim.stop();
                        if (entity.idleAnim) entity.idleAnim.play(true);
                        entity.currentAnim = "idle";
                    }
                }
            }
        }

        // Camera Follow (Smooth)
        if (mySessionId && playerEntities[mySessionId]) {
            const myMesh = playerEntities[mySessionId].mesh;


            // Smooth Camera Follow with Lerp (position only, angle locked)
            camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, myMesh.position.x + 20, 0.1);
            camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, myMesh.position.z - 20, 0.1);
            camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, myMesh.position.y + 20, 0.1);
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
