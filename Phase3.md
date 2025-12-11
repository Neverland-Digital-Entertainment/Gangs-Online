Gangs Online: Phase 3 - Characters & Animations
Objective: Replace the capsule mesh with a 3D animated character (using a built-in Babylon.js Dummy asset) and sync animations across clients.
Please modify packages/client/src/main.ts.
Step 1: Update Imports and Global Logic
We need to import SceneLoader to load models.
Modify packages/client/src/main.ts:
Add Import:
import { SceneLoader } from "@babylonjs/core";
import "@babylonjs/loaders"; // Important for loading .glb/.gltf


Update createScene function:
Replace the entire logic inside room.state.players.onAdd to load a 3D model instead of creating a capsule.
We will use the "Xbot.glb" or "Dummy" from Babylon.js CDN as a placeholder.
Replace the entire createScene function with this advanced version:
const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    
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
        label: GUI.Rectangle;
        idleAnim?: BABYLON.AnimationGroup;
        runAnim?: BABYLON.AnimationGroup;
        currentAnim: "idle" | "run";
        targetRotation: number;
    }

    const playerEntities: { [sessionId: string]: PlayerEntity } = {};
    const playerTargets: { [sessionId: string]: { x: number; z: number } } = {};
    const MOVE_SPEED = 0.15; 
    let mySessionId: string | null = null;

    try {
        const room = await client.joinOrCreate("game_room");
        mySessionId = room.sessionId;
        console.log("Connected! My ID:", mySessionId);

        // Add Player
        room.state.players.onAdd(async (player: IPlayerData, sessionId: string) => {
            const isSelf = sessionId === room.sessionId;
            
            // --- LOAD 3D MODEL ---
            // Using Babylon's default "HVGirl" or "Dummy" for testing
            // We use SceneLoader.ImportMeshAsync
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
            
            const root = result.meshes[0];
            root.position.set(player.x, 0, player.z); // Ground level
            root.scaling.set(0.15, 0.15, 0.15); // Scale down HVGirl
            root.rotationQuaternion = null; // Allow manual rotation

            // --- ANIMATIONS ---
            const idle = result.animationGroups.find(a => a.name === "Idle");
            const run = result.animationGroups.find(a => a.name === "Walking"); // HVGirl uses 'Walking'
            
            if (idle) idle.play(true); // Start Idle by default

            // Name Tag
            // We need to find the "Head" bone or attach to top of mesh
            // For simplicity, attach to root mesh but offset higher
            const label = createPlayerLabel(root as BABYLON.Mesh, isSelf ? "大佬 (Me)" : "小弟", uiTexture);
            label.linkOffsetY = -120; // Adjust for 3D model height

            playerEntities[sessionId] = { 
                mesh: root, 
                label, 
                idleAnim: idle, 
                runAnim: run,
                currentAnim: "idle",
                targetRotation: 0
            };
            playerTargets[sessionId] = { x: player.x, z: player.z };

            // Sync Logic
            player.onChange(() => {
                playerTargets[sessionId].x = player.x;
                playerTargets[sessionId].z = player.z;
            });
        });

        // Remove Player
        room.state.players.onRemove((player: IPlayerData, sessionId: string) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].label.dispose();
                delete playerEntities[sessionId];
                delete playerTargets[sessionId];
            }
        });

        // Input (Click to Move)
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedPoint) {
                // Raycast hits the ground or buildings
                room.send("move", { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z });
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
                
                // Calculate distance to target
                const dx = target.x - mesh.position.x;
                const dz = target.z - mesh.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                // Threshold to stop moving
                if (dist > 0.1) {
                    // 1. Move
                    mesh.position.x += dx * MOVE_SPEED;
                    mesh.position.z += dz * MOVE_SPEED;

                    // 2. Rotate to face direction
                    // ArcTangent2 gives the angle
                    const targetAngle = Math.atan2(dx, dz); 
                    // Smooth rotation (Lerp)
                    const currentRotation = mesh.rotation.y;
                    mesh.rotation.y = BABYLON.Scalar.Lerp(currentRotation, targetAngle, 0.2);

                    // 3. Play Run Animation
                    if (entity.currentAnim !== "run") {
                        if(entity.idleAnim) entity.idleAnim.stop();
                        if(entity.runAnim) entity.runAnim.play(true);
                        entity.currentAnim = "run";
                    }
                } else {
                    // Stop: Play Idle
                    if (entity.currentAnim !== "idle") {
                        if(entity.runAnim) entity.runAnim.stop();
                        if(entity.idleAnim) entity.idleAnim.play(true);
                        entity.currentAnim = "idle";
                    }
                }
            }
        }

        // Camera Follow
        if (mySessionId && playerEntities[mySessionId]) {
            const myMesh = playerEntities[mySessionId].mesh;
            
            // Smooth Camera Follow
            camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, myMesh.position.x + 20, 0.1);
            camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, myMesh.position.z - 20, 0.1);
            camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, myMesh.position.y + 20, 0.1);
            
            camera.setTarget(myMesh.position);
        }
    });

    return scene;
};


