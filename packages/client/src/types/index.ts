import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { PlayerData } from "@gangs-online/shared";

/**
 * 玩家實體資料結構
 */
export interface PlayerEntity {
    mesh: BABYLON.AbstractMesh;
    ui: PlayerUIElements | null; // Phase 9.1: 自己的玩家不顯示頭頂 UI
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
    nameLabel: GUI.TextBlock;
}

/**
 * 玩家目標位置
 */
export interface PlayerTarget {
    /** 伺服器記錄的目標 */
    x: number;
    z: number;
    /** 去目標途中要經過的轉角點；最後一點係實際停低的位置（目標行唔到時係最接近的位置） */
    waypoints: { x: number; z: number }[];
    /** 連續幾多幀幾乎郁唔到 */
    stuckFrames: number;
    /** 今次目標已經因為卡住重新搵過一次路 */
    replanned: boolean;
    /** 卡住時擋住角色的嘢（Debug 面板顯示）；行得郁就係 null */
    blockedBy: string | null;
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
