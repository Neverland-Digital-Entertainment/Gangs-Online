import { GameConfig } from "./types";

/**
 * 遊戲配置 (Phase 12: Firebase Integration)
 */
export const config: GameConfig = {
    // Production server URL - DO NOT CHANGE
    serverUrl: import.meta.env.VITE_SERVER_URL || "wss://gangs-online.onrender.com",
    moveSpeed: 0.15,
};

/**
 * 詳細 log 開關。
 *
 * NPC / 敵人每隻生成時會印近十行（模型 ID、載入路徑、座標、縮放、mesh 數…），
 * 場景一多就會把真正重要的訊息（override 套用結果、連線錯誤）沖走。
 * 預設關閉；要追模型載入問題時設 `VITE_DEBUG_VERBOSE=true` 重新 build 即可。
 */
export const debugVerbose = import.meta.env.VITE_DEBUG_VERBOSE === "true";

/**
 * 3D模型配置
 */
export const modelConfig = {
    baseUrl: "https://models.babylonjs.com/",
    characterModel: "HVGirl.glb",
    characterScale: 0.15,
};

/**
 * 角色碰撞（玩家同敵人共用）
 * 碰撞橢球底部比腳底高 stepHeight：行人路邊（約 0.2m）呢類矮級唔會擋住，
 * 高度由每幀貼地處理；大廈碰撞方塊由地底開始，照樣擋得住。
 */
export const characterCollisionConfig = {
    radius: 0.5,
    halfHeight: 1.0,
    stepHeight: 0.35,
};

/**
 * 相機配置
 */
export const cameraConfig = {
    zoom: 14,
    offset: { x: 20, y: 20, z: 20 }, // Phase 15: 再轉 180 度
    followSpeed: 0.1,
};

/**
 * 武器配置
 */
export const weaponConfig = {
    bat: {
        height: 0.6,
        diameter: 0.08,
        color: "#8B4513",
        emissiveColor: { r: 0.2, g: 0.1, b: 0.05 },
    },
};

