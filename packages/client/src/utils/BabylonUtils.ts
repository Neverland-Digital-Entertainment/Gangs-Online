import * as BABYLON from "@babylonjs/core";
import { cameraConfig } from "../config";

/**
 * Babylon.js 工具函数
 */

/**
 * 創建引擎（帶性能優化）
 */
export function createEngine(canvas: HTMLCanvasElement): BABYLON.Engine {
    const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        disableWebGL2Support: false, // Use WebGL2 if available for better performance
        powerPreference: "high-performance", // Request high-performance GPU
    });

    // Optimize for mobile devices
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        console.log("📱 Mobile device detected, applying optimizations...");
        engine.setHardwareScalingLevel(1.5); // Reduce resolution on mobile for better performance
    }

    return engine;
}

/**
 * 創建等軸測相機
 */
export function createIsometricCamera(scene: BABYLON.Scene, engine: BABYLON.Engine): BABYLON.FreeCamera {
    const camera = new BABYLON.FreeCamera(
        "isoCamera",
        new BABYLON.Vector3(
            cameraConfig.offset.x,
            cameraConfig.offset.y,
            cameraConfig.offset.z
        ),
        scene
    );
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.setTarget(BABYLON.Vector3.Zero());

    // 初始化正交邊界
    updateCameraOrtho(camera, engine);

    return camera;
}

/**
 * 更新相機正交邊界（當畫面大小改變時調用）
 */
export function updateCameraOrtho(camera: BABYLON.FreeCamera, engine: BABYLON.Engine): void {
    const aspect = engine.getAspectRatio(camera);
    camera.orthoTop = cameraConfig.zoom;
    camera.orthoBottom = -cameraConfig.zoom;
    camera.orthoLeft = -cameraConfig.zoom * aspect;
    camera.orthoRight = cameraConfig.zoom * aspect;
}

/**
 * 更新相機跟隨玩家
 */
export function updateCameraFollow(
    camera: BABYLON.FreeCamera,
    playerMesh: BABYLON.AbstractMesh
): void {
    camera.position.x = BABYLON.Scalar.Lerp(
        camera.position.x,
        playerMesh.position.x + cameraConfig.offset.x,
        cameraConfig.followSpeed
    );
    camera.position.z = BABYLON.Scalar.Lerp(
        camera.position.z,
        playerMesh.position.z + cameraConfig.offset.z,
        cameraConfig.followSpeed
    );
    camera.position.y = BABYLON.Scalar.Lerp(
        camera.position.y,
        playerMesh.position.y + cameraConfig.offset.y,
        cameraConfig.followSpeed
    );
}

/**
 * 創建基礎場景設置（光照、碰撞等）
 */
export function setupScene(scene: BABYLON.Scene): void {
    // --- ENABLE GLOBAL COLLISIONS ---
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0); // Standard Gravity

    // --- Lighting ---
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);
    light.intensity = 0.7;

    const dirLight = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;
}
