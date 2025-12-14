import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { PlayerData } from "@gangs-online/shared";

/**
 * 玩家實體資料結構
 */
export interface PlayerEntity {
    mesh: BABYLON.AbstractMesh;
    ui: PlayerUIElements;
    idleAnim?: BABYLON.AnimationGroup;
    runAnim?: BABYLON.AnimationGroup;
    currentAnim: "idle" | "run" | "dead";
}

/**
 * 玩家UI元素
 */
export interface PlayerUIElements {
    container: GUI.Rectangle;
    hpFg: GUI.Rectangle;
    hpBg: GUI.Rectangle;
    combatIndicator: GUI.TextBlock;
    // Phase 7: 進度系統
    xpFg?: GUI.Rectangle; // XP 條（玩家專用）
    xpBg?: GUI.Rectangle; // XP 背景
    nameLabel?: GUI.TextBlock; // 名稱標籤（用於動態更新頭銜）
}

/**
 * 玩家目標位置
 */
export interface PlayerTarget {
    x: number;
    z: number;
}

/**
 * 遊戲配置
 */
export interface GameConfig {
    serverUrl: string;
    moveSpeed: number;
}

/**
 * 聊天訊息
 */
export interface ChatMessage {
    sessionId: string;
    text: string;
}
