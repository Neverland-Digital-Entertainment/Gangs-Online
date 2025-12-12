import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { PlayerData } from "@gangs-online/shared";

/**
 * 玩家实体数据结构
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
}

/**
 * 玩家目标位置
 */
export interface PlayerTarget {
    x: number;
    z: number;
}

/**
 * 游戏配置
 */
export interface GameConfig {
    serverUrl: string;
    moveSpeed: number;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
    sessionId: string;
    text: string;
}
