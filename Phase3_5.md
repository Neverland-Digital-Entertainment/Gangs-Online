Gangs Online: Phase 3.5 - Collision & Gravity
Objective: Enable collision detection so characters slide along walls instead of walking through them, and apply basic gravity.
Please modify packages/client/src/main.ts.
Step 1: Update createCity to Enable Collisions
We need to set .checkCollisions = true on the ground and buildings.
In packages/client/src/main.ts, replace the createCity function with:
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


Step 2: Update createScene to Handle Physics
We need to:
Enable scene.collisionsEnabled.
Define the player's collision ellipsoid.
Change the movement logic from direct position assignment to moveWithCollisions.
Replace the createScene function with this updated version:
const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    
    // --- ENABLE GLOBAL COLLISIONS ---
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0); // Standard Gravity

    // --- Camera ---
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero()); 

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
    interface PlayerEntity {
        mesh: BABYLON.AbstractMesh;
        label: GUI.Rectangle;
        idleAnim?: BABYLON.AnimationGroup;
        runAnim?: BABYLON.AnimationGroup;
        currentAnim: "idle" | "run";
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
            
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
            
            const root = result.meshes[0];
            // Start slightly above ground to prevent getting stuck immediately
            root.position.set(player.x, 0.1, player.z); 
            root.scaling.set(0.15, 0.15, 0.15); 
            root.rotationQuaternion = null; 

            // --- COLLISION SETUP ---
            root.checkCollisions = true;
            // Define the "body" size (Radius X, Y, Z)
            // Note: HVGirl is scaled 0.15, so the ellipsoid needs to match the visual size roughly
            root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5);
            // Offset the ellipsoid center (usually up by radius Y)
            root.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);

            const idle = result.animationGroups.find(a => a.name === "Idle");
            const run = result.animationGroups.find(a => a.name === "Walking");
            
            if (idle) idle.play(true);

            const label = createPlayerLabel(root as BABYLON.Mesh, isSelf ? "大佬 (Me)" : "小弟", uiTexture);
            label.linkOffsetY = -120; 

            playerEntities[sessionId] = { 
                mesh: root, 
                label, 
                idleAnim: idle, 
                runAnim: run,
                currentAnim: "idle"
            };
            playerTargets[sessionId] = { x: player.x, z: player.z };

            player.onChange(() => {
                playerTargets[sessionId].x = player.x;
                playerTargets[sessionId].z = player.z;
            });
        });

        room.state.players.onRemove((player: IPlayerData, sessionId: string) => {
            if (playerEntities[sessionId]) {
                playerEntities[sessionId].mesh.dispose();
                playerEntities[sessionId].label.dispose();
                delete playerEntities[sessionId];
                delete playerTargets[sessionId];
            }
        });

        // Input
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedPoint) {
                // Prevent clicking ON buildings (simple filter)
                if (pickResult.pickedMesh?.name.startsWith("b_")) return;
                
                room.send("move", { x: pickResult.pickedPoint.x, z: pickResult.pickedPoint.z });
            }
        };

    } catch (e) {
        console.error("Connection Failed:", e);
    }

    // --- Game Loop ---
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
                const dist = Math.sqrt(dx*dx + dz*dz);
                
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

                    // Play Run
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
            camera.position.x = BABYLON.Scalar.Lerp(camera.position.x, myMesh.position.x + 20, 0.1);
            camera.position.z = BABYLON.Scalar.Lerp(camera.position.z, myMesh.position.z - 20, 0.1);
            camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, myMesh.position.y + 20, 0.1);
            camera.setTarget(myMesh.position);
        }
    });

    return scene;
};


