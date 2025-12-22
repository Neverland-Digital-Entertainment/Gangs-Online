import * as BABYLON from "@babylonjs/core";

/**
 * ParticleSystem - Phase 11: Visual Effects (Juice)
 * 管理遊戲中的粒子特效
 */
export class ParticleSystem {
    private scene: BABYLON.Scene;
    private particleSystems: BABYLON.ParticleSystem[] = [];

    // 粒子貼圖 URL
    private static readonly FLARE_TEXTURE = "https://www.babylonjs-playground.com/textures/flare.png";

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 創建血液特效（傷害反饋）
     * @param position 特效位置
     */
    createBloodEffect(position: BABYLON.Vector3): void {
        const particleSystem = new BABYLON.ParticleSystem("blood", 50, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture(ParticleSystem.FLARE_TEXTURE, this.scene);

        // 發射器位置（調整到角色身體高度）
        const effectPosition = position.clone();
        effectPosition.y += 1.2; // 身體中央高度
        particleSystem.emitter = effectPosition;

        // 發射範圍
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);

        // 顏色（紅色血液）
        particleSystem.color1 = new BABYLON.Color4(1, 0, 0, 1); // 鮮紅
        particleSystem.color2 = new BABYLON.Color4(0.8, 0, 0, 1); // 暗紅
        particleSystem.colorDead = new BABYLON.Color4(0.3, 0, 0, 0); // 漸隱

        // 粒子大小
        particleSystem.minSize = 0.05;
        particleSystem.maxSize = 0.15;

        // 粒子壽命
        particleSystem.minLifeTime = 0.2;
        particleSystem.maxLifeTime = 0.5;

        // 發射速率和持續時間
        particleSystem.emitRate = 100;
        particleSystem.targetStopDuration = 0.1; // 短暫爆發

        // 發射方向（向外擴散）
        particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);
        particleSystem.minEmitPower = 2;
        particleSystem.maxEmitPower = 4;

        // 重力（血液會下落）
        particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;

        // 開始播放
        particleSystem.start();

        // 自動清理
        this.scheduleDispose(particleSystem, 1000);
    }

    /**
     * 創建升級特效（金色光環）
     * @param mesh 目標模型
     */
    createLevelUpEffect(mesh: BABYLON.AbstractMesh): void {
        const particleSystem = new BABYLON.ParticleSystem("levelup", 150, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture(ParticleSystem.FLARE_TEXTURE, this.scene);

        // 發射器跟隨模型
        particleSystem.emitter = mesh;

        // 發射範圍（圍繞角色）
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.8, 0, -0.8);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.8, 0, 0.8);

        // 顏色（金色光芒）
        particleSystem.color1 = new BABYLON.Color4(1, 0.9, 0, 1); // 金色
        particleSystem.color2 = new BABYLON.Color4(1, 0.6, 0, 1); // 橙金色
        particleSystem.colorDead = new BABYLON.Color4(1, 1, 0.5, 0); // 淡金漸隱

        // 粒子大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.4;

        // 粒子壽命
        particleSystem.minLifeTime = 1.0;
        particleSystem.maxLifeTime = 2.0;

        // 發射速率和持續時間
        particleSystem.emitRate = 80;
        particleSystem.targetStopDuration = 1.5;

        // 發射方向（向上升起）
        particleSystem.direction1 = new BABYLON.Vector3(-0.3, 1, -0.3);
        particleSystem.direction2 = new BABYLON.Vector3(0.3, 1, 0.3);
        particleSystem.minEmitPower = 1.5;
        particleSystem.maxEmitPower = 3;

        // 無重力（向上飄動）
        particleSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);

        // 混合模式（發光）
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // 開始播放
        particleSystem.start();

        // 自動清理
        this.scheduleDispose(particleSystem, 3000);
    }

    /**
     * 創建拾取特效（綠色/金色閃光）
     * @param position 特效位置
     * @param isCurrency 是否為金錢
     */
    createPickupEffect(position: BABYLON.Vector3, isCurrency: boolean = false): void {
        const particleSystem = new BABYLON.ParticleSystem("pickup", 30, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture(ParticleSystem.FLARE_TEXTURE, this.scene);

        // 發射器位置
        const effectPosition = position.clone();
        effectPosition.y += 0.5;
        particleSystem.emitter = effectPosition;

        // 發射範圍
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0.3, 0.2);

        // 顏色（金錢為金色，物品為青色）
        if (isCurrency) {
            particleSystem.color1 = new BABYLON.Color4(1, 0.85, 0, 1);
            particleSystem.color2 = new BABYLON.Color4(1, 0.7, 0, 1);
            particleSystem.colorDead = new BABYLON.Color4(1, 1, 0.5, 0);
        } else {
            particleSystem.color1 = new BABYLON.Color4(0, 1, 0.8, 1);
            particleSystem.color2 = new BABYLON.Color4(0, 0.8, 0.6, 1);
            particleSystem.colorDead = new BABYLON.Color4(0.5, 1, 0.8, 0);
        }

        // 粒子大小
        particleSystem.minSize = 0.08;
        particleSystem.maxSize = 0.2;

        // 粒子壽命
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 0.6;

        // 發射速率和持續時間
        particleSystem.emitRate = 60;
        particleSystem.targetStopDuration = 0.15;

        // 發射方向（向上飄散）
        particleSystem.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
        particleSystem.direction2 = new BABYLON.Vector3(0.5, 2, 0.5);
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 2;

        // 輕微重力
        particleSystem.gravity = new BABYLON.Vector3(0, -2, 0);

        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // 開始播放
        particleSystem.start();

        // 自動清理
        this.scheduleDispose(particleSystem, 1000);
    }

    /**
     * 創建死亡特效（灰色煙霧）
     * @param position 特效位置
     */
    createDeathEffect(position: BABYLON.Vector3): void {
        const particleSystem = new BABYLON.ParticleSystem("death", 80, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture(ParticleSystem.FLARE_TEXTURE, this.scene);

        // 發射器位置
        const effectPosition = position.clone();
        effectPosition.y += 1;
        particleSystem.emitter = effectPosition;

        // 發射範圍
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.3, 0, -0.3);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.3, 0.5, 0.3);

        // 顏色（灰色煙霧）
        particleSystem.color1 = new BABYLON.Color4(0.4, 0.4, 0.4, 0.8);
        particleSystem.color2 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.6);
        particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, 0);

        // 粒子大小
        particleSystem.minSize = 0.2;
        particleSystem.maxSize = 0.5;

        // 粒子壽命
        particleSystem.minLifeTime = 0.8;
        particleSystem.maxLifeTime = 1.5;

        // 發射速率和持續時間
        particleSystem.emitRate = 50;
        particleSystem.targetStopDuration = 0.5;

        // 發射方向（向上升起並擴散）
        particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, 2, 1);
        particleSystem.minEmitPower = 0.5;
        particleSystem.maxEmitPower = 1.5;

        // 無重力
        particleSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);

        // 混合模式
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;

        // 開始播放
        particleSystem.start();

        // 自動清理
        this.scheduleDispose(particleSystem, 2500);
    }

    /**
     * 創建治療特效（綠色光環）
     * @param mesh 目標模型
     */
    createHealEffect(mesh: BABYLON.AbstractMesh): void {
        const particleSystem = new BABYLON.ParticleSystem("heal", 60, this.scene);
        particleSystem.particleTexture = new BABYLON.Texture(ParticleSystem.FLARE_TEXTURE, this.scene);

        // 發射器跟隨模型
        particleSystem.emitter = mesh;

        // 發射範圍
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

        // 顏色（綠色治療）
        particleSystem.color1 = new BABYLON.Color4(0, 1, 0.3, 1);
        particleSystem.color2 = new BABYLON.Color4(0.3, 1, 0.5, 1);
        particleSystem.colorDead = new BABYLON.Color4(0.5, 1, 0.7, 0);

        // 粒子大小
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.25;

        // 粒子壽命
        particleSystem.minLifeTime = 0.5;
        particleSystem.maxLifeTime = 1.0;

        // 發射速率和持續時間
        particleSystem.emitRate = 40;
        particleSystem.targetStopDuration = 0.8;

        // 發射方向（向上飄動）
        particleSystem.direction1 = new BABYLON.Vector3(-0.2, 1, -0.2);
        particleSystem.direction2 = new BABYLON.Vector3(0.2, 1.5, 0.2);
        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 2;

        // 輕微向上
        particleSystem.gravity = new BABYLON.Vector3(0, 1, 0);

        // 混合模式（發光）
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // 開始播放
        particleSystem.start();

        // 自動清理
        this.scheduleDispose(particleSystem, 1500);
    }

    /**
     * 使模型閃爍紅色（受傷反饋）
     * @param mesh 目標模型
     * @param duration 持續時間（毫秒）
     */
    flashDamage(mesh: BABYLON.AbstractMesh, duration: number = 150): void {
        const childMeshes = mesh.getChildMeshes();

        // 保存原始顏色
        const originalColors: Map<BABYLON.AbstractMesh, BABYLON.Color3> = new Map();

        childMeshes.forEach((m) => {
            if (m.material && (m.material as any).emissiveColor) {
                originalColors.set(m, (m.material as any).emissiveColor.clone());
                // 設為紅色
                (m.material as any).emissiveColor = new BABYLON.Color3(1, 0.2, 0.2);
            }
        });

        // 恢復原始顏色
        setTimeout(() => {
            originalColors.forEach((color, m) => {
                if (m.material && (m.material as any).emissiveColor) {
                    (m.material as any).emissiveColor = color;
                }
            });
        }, duration);
    }

    /**
     * 安排粒子系統的清理
     */
    private scheduleDispose(particleSystem: BABYLON.ParticleSystem, delay: number): void {
        this.particleSystems.push(particleSystem);

        setTimeout(() => {
            particleSystem.dispose();
            const index = this.particleSystems.indexOf(particleSystem);
            if (index > -1) {
                this.particleSystems.splice(index, 1);
            }
        }, delay);
    }

    /**
     * 釋放所有資源
     */
    dispose(): void {
        this.particleSystems.forEach((ps) => {
            ps.dispose();
        });
        this.particleSystems = [];
    }
}
