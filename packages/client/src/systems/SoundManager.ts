import * as BABYLON from "@babylonjs/core";

/**
 * SoundManager - Phase 11: Audio System
 * 管理遊戲中的背景音樂和音效
 */
export class SoundManager {
    private scene: BABYLON.Scene;
    private sounds: { [key: string]: BABYLON.Sound } = {};
    private isInitialized: boolean = false;
    private pendingSounds: string[] = [];

    // 音量設置
    private masterVolume: number = 1.0;
    private bgmVolume: number = 0.3;
    private sfxVolume: number = 0.6;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 初始化音效系統
     * 因為瀏覽器安全策略，需要在用戶互動後才能播放音效
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 預載入音效
            await this.preloadSounds();
            this.isInitialized = true;
            console.log("🔊 SoundManager initialized");

            // 播放等待中的音效
            this.pendingSounds.forEach((soundName) => this.play(soundName));
            this.pendingSounds = [];
        } catch (error) {
            console.error("❌ Failed to initialize SoundManager:", error);
        }
    }

    /**
     * 預載入所有音效
     */
    private async preloadSounds(): Promise<void> {
        // 使用 Babylon.js playground 的免費音效
        const soundDefs: { name: string; url: string; options: BABYLON.ISoundOptions }[] = [
            {
                name: "punch",
                url: "https://playground.babylonjs.com/sounds/gunshot.wav",
                options: { volume: 0.5 * this.sfxVolume * this.masterVolume },
            },
            {
                name: "whoosh",
                url: "https://playground.babylonjs.com/sounds/cell_fire.wav",
                options: { volume: 0.3 * this.sfxVolume * this.masterVolume },
            },
            {
                name: "levelup",
                url: "https://playground.babylonjs.com/sounds/powerup.wav",
                options: { volume: 0.8 * this.sfxVolume * this.masterVolume },
            },
            {
                name: "pickup",
                url: "https://playground.babylonjs.com/sounds/coin.wav",
                options: { volume: 0.6 * this.sfxVolume * this.masterVolume },
            },
            {
                name: "bgm",
                url: "https://playground.babylonjs.com/sounds/violons11.wav",
                options: {
                    loop: true,
                    autoplay: false,
                    volume: this.bgmVolume * this.masterVolume,
                },
            },
        ];

        // 使用 Promise.allSettled 來載入所有音效，即使部分失敗也不會阻塞
        const loadPromises = soundDefs.map(
            (def) =>
                new Promise<void>((resolve) => {
                    try {
                        this.sounds[def.name] = new BABYLON.Sound(
                            def.name,
                            def.url,
                            this.scene,
                            () => {
                                console.log(`🔊 Sound loaded: ${def.name}`);
                                resolve();
                            },
                            def.options
                        );
                    } catch (error) {
                        console.warn(`⚠️ Failed to load sound: ${def.name}`, error);
                        resolve(); // 繼續載入其他音效
                    }
                })
        );

        await Promise.allSettled(loadPromises);
    }

    /**
     * 播放指定音效
     */
    play(name: string): void {
        // 如果尚未初始化，加入等待列表
        if (!this.isInitialized) {
            this.pendingSounds.push(name);
            return;
        }

        const sound = this.sounds[name];
        if (sound) {
            // 如果是可以重疊播放的音效，克隆一份來播放
            if (name !== "bgm") {
                sound.play();
            } else {
                // BGM 不重疊
                if (!sound.isPlaying) {
                    sound.play();
                }
            }
        } else {
            console.warn(`⚠️ Sound not found: ${name}`);
        }
    }

    /**
     * 停止指定音效
     */
    stop(name: string): void {
        const sound = this.sounds[name];
        if (sound && sound.isPlaying) {
            sound.stop();
        }
    }

    /**
     * 播放背景音樂
     */
    playBGM(): void {
        this.play("bgm");
    }

    /**
     * 停止背景音樂
     */
    stopBGM(): void {
        this.stop("bgm");
    }

    /**
     * 播放攻擊命中音效
     */
    playHitSound(): void {
        this.play("punch");
    }

    /**
     * 播放攻擊揮空音效
     */
    playMissSound(): void {
        this.play("whoosh");
    }

    /**
     * 播放升級音效
     */
    playLevelUpSound(): void {
        this.play("levelup");
    }

    /**
     * 播放拾取音效
     */
    playPickupSound(): void {
        this.play("pickup");
    }

    /**
     * 設置主音量
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }

    /**
     * 設置背景音樂音量
     */
    setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        if (this.sounds["bgm"]) {
            this.sounds["bgm"].setVolume(this.bgmVolume * this.masterVolume);
        }
    }

    /**
     * 設置音效音量
     */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }

    /**
     * 更新所有音效音量
     */
    private updateAllVolumes(): void {
        Object.entries(this.sounds).forEach(([name, sound]) => {
            if (name === "bgm") {
                sound.setVolume(this.bgmVolume * this.masterVolume);
            } else {
                sound.setVolume(this.sfxVolume * this.masterVolume);
            }
        });
    }

    /**
     * 靜音/取消靜音
     */
    toggleMute(): boolean {
        if (this.masterVolume > 0) {
            this.setMasterVolume(0);
            return true; // 已靜音
        } else {
            this.setMasterVolume(1);
            return false; // 已取消靜音
        }
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        Object.values(this.sounds).forEach((sound) => {
            sound.dispose();
        });
        this.sounds = {};
        this.isInitialized = false;
    }
}
