Gangs Online: Phase 11 - Audio & Visual Effects (Juice)
Objective: Add Sound Manager for BGM/SFX and Particle Systems for combat feedback (Blood) and progression (Level Up).
Please modify the following files.
Step 1: Client-Side Sound & VFX Logic
We need to create helper functions for playing sounds and spawning particles, then hook them into the existing game events.
Modify packages/client/src/main.ts:
Add SoundManager and ParticleHelper, then integrate into createScene:
// packages/client/src/main.ts
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { IPlayerData, ILootData, getRankTitle, GAME_CONSTANTS } from "@gangs-online/shared";
import "@babylonjs/loaders";

// ... (Keep existing imports and setup) ...

// --- SOUND MANAGER ---
class SoundManager {
    private scene: BABYLON.Scene;
    private sounds: { [key: string]: BABYLON.Sound } = {};

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        // Preload sounds (Using free assets from Babylon or placeholder URLs)
        // Punch
        this.sounds["punch"] = new BABYLON.Sound("punch", "[https://playground.babylonjs.com/sounds/gunshot.wav](https://playground.babylonjs.com/sounds/gunshot.wav)", scene, null, { volume: 0.5 }); 
        // We use gunshot as punch placeholder for impact
        
        // Whoosh (Miss)
        this.sounds["whoosh"] = new BABYLON.Sound("whoosh", "[https://playground.babylonjs.com/sounds/cell_fire.wav](https://playground.babylonjs.com/sounds/cell_fire.wav)", scene, null, { volume: 0.3 });

        // Level Up
        this.sounds["levelup"] = new BABYLON.Sound("levelup", "[https://playground.babylonjs.com/sounds/powerup.wav](https://playground.babylonjs.com/sounds/powerup.wav)", scene, null, { volume: 0.8 });

        // BGM (Street Ambience)
        this.sounds["bgm"] = new BABYLON.Sound("bgm", "[https://playground.babylonjs.com/sounds/violons11.wav](https://playground.babylonjs.com/sounds/violons11.wav)", scene, null, { loop: true, autoplay: true, volume: 0.2 });
    }

    play(name: string) {
        if (this.sounds[name]) {
            this.sounds[name].play();
        }
    }
}

// --- PARTICLE HELPER ---
const createBloodEffect = (position: BABYLON.Vector3, scene: BABYLON.Scene) => {
    const particleSystem = new BABYLON.ParticleSystem("blood", 50, scene);
    particleSystem.particleTexture = new BABYLON.Texture("[https://www.babylonjs-playground.com/textures/flare.png](https://www.babylonjs-playground.com/textures/flare.png)", scene);
    
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, 1, -0.1); 
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 1.5, 0.1);

    particleSystem.color1 = new BABYLON.Color4(1, 0, 0, 1);
    particleSystem.color2 = new BABYLON.Color4(0.5, 0, 0, 1);
    particleSystem.colorDead = new BABYLON.Color4(0.2, 0, 0, 0);

    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.1;

    particleSystem.minLifeTime = 0.2;
    particleSystem.maxLifeTime = 0.5;

    particleSystem.emitRate = 100;
    particleSystem.targetStopDuration = 0.1; // Burst

    particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    particleSystem.start();
};

const createLevelUpEffect = (mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene) => {
    const particleSystem = new BABYLON.ParticleSystem("levelup", 100, scene);
    particleSystem.particleTexture = new BABYLON.Texture("[https://www.babylonjs-playground.com/textures/flare.png](https://www.babylonjs-playground.com/textures/flare.png)", scene);
    
    particleSystem.emitter = mesh;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

    particleSystem.color1 = new BABYLON.Color4(1, 1, 0, 1); // Gold
    particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
    
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 1.5;
    particleSystem.emitRate = 50;
    particleSystem.targetStopDuration = 1.5;

    particleSystem.direction1 = new BABYLON.Vector3(0, 1, 0);
    particleSystem.direction2 = new BABYLON.Vector3(0, 1, 0);
    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 2;

    particleSystem.start();
}

// ... (Keep Helper Functions: createCity, createShopUI, etc.) ...
// Assume createCity, createQuestTracker, etc. are here from Phase 10

const createScene = async () => {
    const scene = new BABYLON.Scene(engine);
    // ... (Standard Setup) ...
    scene.collisionsEnabled = true; scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    const camera = new BABYLON.FreeCamera("isoCamera", new BABYLON.Vector3(20, 20, -20), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.setTarget(BABYLON.Vector3.Zero());
    const zoom = 14; const aspect = engine.getAspectRatio(camera); camera.orthoTop=zoom; camera.orthoBottom=-zoom; camera.orthoLeft=-zoom*aspect; camera.orthoRight=zoom*aspect;
    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    createCity(scene); // Ensure this creates Safe Zone Visuals
    const uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    // ... (UI Setup) ...
    const soundManager = new SoundManager(scene); // Initialize Audio

    // ... (Keep existing UI panels) ...

    const entities: any = {};
    const lootMeshes: any = {};
    let mySessionId: string | null = null;
    let inventoryUI: any = null;

    try {
        const room = await client.joinOrCreate("game_room", { name: "Player" });
        mySessionId = room.sessionId;

        // ... (Keep Chat/Inventory/Quest UI setup) ...

        const spawnEntityVisuals = async (entityData: any, id: string, type: 'player'|'enemy'|'npc') => {
             // ... (Keep Mesh Loading Logic from Phase 10) ...
             const result = await BABYLON.SceneLoader.ImportMeshAsync("", "[https://models.babylonjs.com/](https://models.babylonjs.com/)", "HVGirl.glb", scene);
             const root = result.meshes[0];
             root.position.set(entityData.x, 0.1, entityData.z); root.scaling.set(0.15, 0.15, 0.15); root.rotationQuaternion = null; 
             root.checkCollisions = true; root.ellipsoid = new BABYLON.Vector3(0.5, 1.0, 0.5); 
             root.metadata = { id: id, type: type };

             // Color Logic (Keep existing)
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

             // Sync logic
             entityData.onChange(() => { 
                const t = {x: entityData.x, z: entityData.z};
                scene.onBeforeRenderObservable.addOnce(() => {
                   root.position.x = BABYLON.Scalar.Lerp(root.position.x, t.x, 0.1);
                   root.position.z = BABYLON.Scalar.Lerp(root.position.z, t.z, 0.1);
                });
             });
             
             // --- NEW: DAMAGE FEEDBACK ---
             // Store previous HP to detect damage
             let prevHp = entityData.hp;
             entityData.listen("hp", (val: number) => {
                 const pct = Math.max(0, val/entityData.maxHp);
                 ui.hpFg.width = `${pct * 100}px`;
                 root.visibility = (val <= 0) ? 0.5 : 1;

                 // Detect Damage
                 if (val < prevHp && val > 0) {
                     soundManager.play("punch"); // Hit sound
                     createBloodEffect(root.position.clone().add(new BABYLON.Vector3(0, 1.5, 0)), scene); // Blood at head height
                     
                     // Flash Red
                     root.getChildMeshes().forEach(m => {
                         if (m.material) {
                             const originalColor = (m.material as any).emissiveColor.clone();
                             (m.material as any).emissiveColor = new BABYLON.Color3(1, 0, 0);
                             setTimeout(() => { if(m.material) (m.material as any).emissiveColor = originalColor; }, 100);
                         }
                     });
                 }
                 prevHp = val;
             });

             if(id===mySessionId && type==='player') {
                 // Inventory & Quest listeners (Keep existing)
                 // ...
                 entityData.listen("level", (val: number) => {
                    // LEVEL UP EFFECT
                    soundManager.play("levelup");
                    createLevelUpEffect(root, scene);
                    // Update UI Title logic...
                 });
             }
        };

        // ... (Keep Room Listeners: onAdd/onRemove) ...
        room.state.players.onAdd((p, sId) => spawnEntityVisuals(p, sId, 'player'));
        // ...

        // --- INPUT (Sound trigger) ---
        scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
               // ... (Existing input logic) ...
               // Add Whoosh sound on attack attempt
               let m = pickResult.pickedMesh;
               while (m.parent) m = m.parent as BABYLON.AbstractMesh;
               if (m.metadata && m.metadata.id && m.metadata.id !== mySessionId && !m.metadata.type?.startsWith('npc')) {
                   soundManager.play("whoosh"); // Swing sound
               }
               
               // Keep existing send("attack") / send("move") logic
               if (m.metadata && m.metadata.lootId) { room.send("pickup", m.metadata.lootId); return; }
               if (m.metadata && m.metadata.id) {
                   const type = m.metadata.type;
                   const id = m.metadata.id;
                   if (type === 'npc') {
                       // ... (NPC logic) ...
                       return;
                   }
                   if (id !== mySessionId) { room.send("attack", { targetId: id, type: type }); return; }
               }
               if (pickResult.pickedMesh.name.startsWith("ground") || pickResult.pickedMesh.name.startsWith("road")) {
                    room.send("move", { x: pickResult.pickedPoint!.x, z: pickResult.pickedPoint!.z });
               }
           }
       };

    } catch (e) { console.error(e); }

    // ... (Keep Render Loop) ...
    scene.registerBeforeRender(() => { /* ... */ });

    return scene;
};


