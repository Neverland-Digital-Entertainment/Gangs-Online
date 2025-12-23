import * as BABYLON from "@babylonjs/core";

/**
 * SoundManager - Phase 11: Audio System
 * 管理遊戲中的背景音樂和音效
 * 使用 Web Audio API 生成音效，確保可靠播放
 */
export class SoundManager {
    private scene: BABYLON.Scene;
    private audioContext: AudioContext | null = null;
    private isInitialized: boolean = false;

    // 音量設置
    private masterVolume: number = 1.0;
    private bgmVolume: number = 0.3;
    private sfxVolume: number = 0.6;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * 初始化音效系統
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.isInitialized = true;
            console.log("🔊 SoundManager initialized with Web Audio API");
        } catch (error) {
            console.error("❌ Failed to initialize SoundManager:", error);
        }
    }

    /**
     * 確保 AudioContext 已啟動（需要用戶互動）
     */
    private ensureAudioContext(): boolean {
        if (!this.audioContext) return false;

        if (this.audioContext.state === "suspended") {
            this.audioContext.resume();
        }
        return true;
    }

    /**
     * 播放簡單的合成音效
     */
    private playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume: number = 0.5): void {
        if (!this.ensureAudioContext() || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        const finalVolume = volume * this.sfxVolume * this.masterVolume;
        gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    /**
     * 播放噪音（用於打擊音效）
     */
    private playNoise(duration: number, volume: number = 0.3): void {
        if (!this.ensureAudioContext() || !this.audioContext) return;

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        noise.buffer = buffer;
        filter.type = "lowpass";
        filter.frequency.value = 1000;

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const finalVolume = volume * this.sfxVolume * this.masterVolume;
        gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        noise.start();
    }

    /**
     * 播放背景音樂（簡單的環境音）
     */
    playBGM(): void {
        // BGM 需要更複雜的實現，暫時略過
        console.log("🎵 BGM would play here (not implemented for Web Audio)");
    }

    /**
     * 停止背景音樂
     */
    stopBGM(): void {
        // 略過
    }

    /**
     * 播放攻擊命中音效
     */
    playHitSound(): void {
        // 打擊音效：低頻噪音 + 中頻音
        this.playNoise(0.1, 0.4);
        this.playTone(150, 0.1, "square", 0.3);
    }

    /**
     * 播放攻擊揮空音效
     */
    playMissSound(): void {
        // 揮空音效：快速下滑音
        if (!this.ensureAudioContext() || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.15);

        const finalVolume = 0.2 * this.sfxVolume * this.masterVolume;
        gainNode.gain.setValueAtTime(finalVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    /**
     * 播放升級音效
     */
    playLevelUpSound(): void {
        // 升級音效：上升的琶音
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.2, "sine", 0.4);
            }, i * 100);
        });
    }

    /**
     * 播放拾取音效
     */
    playPickupSound(): void {
        // 拾取音效：短促的高音
        this.playTone(880, 0.1, "sine", 0.3);
        setTimeout(() => {
            this.playTone(1100, 0.1, "sine", 0.25);
        }, 50);
    }

    /**
     * 設置主音量
     */
    setMasterVolume(volume: number): void {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 設置背景音樂音量
     */
    setBGMVolume(volume: number): void {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 設置音效音量
     */
    setSFXVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 靜音/取消靜音
     */
    toggleMute(): boolean {
        if (this.masterVolume > 0) {
            this.setMasterVolume(0);
            return true;
        } else {
            this.setMasterVolume(1);
            return false;
        }
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}
