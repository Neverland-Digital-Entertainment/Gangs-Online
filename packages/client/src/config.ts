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
 * 3D模型配置
 */
export const modelConfig = {
    baseUrl: "https://models.babylonjs.com/",
    characterModel: "HVGirl.glb",
    characterScale: 0.15,
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

