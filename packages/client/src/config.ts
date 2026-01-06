import { GameConfig } from "./types";

/**
 * 遊戲配置 (Phase 12: Firebase Integration)
 */
export const config: GameConfig = {
    // Production server URL - DO NOT CHANGE
    serverUrl: import.meta.env.VITE_SERVER_URL || "wss://gangs-online.onrender.com",
    moveSpeed: 0.30, // 加快移動速度（因地圖縮小為 0.5x）
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
 * 北上視角 (North-Up) - 45度高角度俯視
 * 計算: tan(45°) = 1, y = z
 */
export const cameraConfig = {
    zoom: 18,
    offset: { x: 0, y: 20, z: -20 }, // 北上45度視角: x=0使相機正對北方
    followSpeed: 0.1,
};

/**
 * 地圖配置
 */
export const mapConfig = {
    // GLB 地圖檔案路徑（相對於 public 資料夾）
    mapFile: "/maps/causeway-bay.glb",
    // 地圖縮放比例（0.5 = 縮小一半）
    mapScale: 0.5,
    // 建築物 mesh 名稱前綴（用於識別建築物以實現透明效果）
    buildingPrefix: "building",
    // 地面 mesh 名稱（用於點擊移動）
    groundNames: ["ground", "road", "street", "pavement", "floor"],
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

