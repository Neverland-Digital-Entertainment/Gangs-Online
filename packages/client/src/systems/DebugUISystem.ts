import * as BABYLON from "@babylonjs/core";

/**
 * Debug UI 系統 (Phase 15)
 *
 * 在畫面頂部顯示效能監控指標：
 * - FPS (每秒幀數)
 * - Polygons (多邊形總數)
 * - Triangles (三角形總數)
 * - Draw Calls (繪製調用數)
 */
export class DebugUISystem {
    private scene: BABYLON.Scene;
    private container: HTMLElement | null = null;
    private fpsElement: HTMLElement | null = null;
    private polygonsElement: HTMLElement | null = null;
    private trianglesElement: HTMLElement | null = null;
    private drawCallsElement: HTMLElement | null = null;
    private isVisible: boolean = true;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.createUI();
        this.startUpdate();
    }

    /**
     * 創建 Debug UI
     */
    private createUI(): void {
        // 創建容器
        this.container = document.createElement("div");
        this.container.id = "debugUI";
        this.container.style.position = "absolute";
        this.container.style.top = "10px";
        this.container.style.left = "10px";
        this.container.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        this.container.style.color = "#00ff00";
        this.container.style.fontFamily = "monospace";
        this.container.style.fontSize = "12px";
        this.container.style.padding = "10px";
        this.container.style.borderRadius = "5px";
        this.container.style.zIndex = "1000";
        this.container.style.pointerEvents = "none"; // 不阻擋點擊
        this.container.style.userSelect = "none";
        this.container.style.minWidth = "150px";

        // FPS 顯示
        this.fpsElement = document.createElement("div");
        this.fpsElement.style.marginBottom = "4px";
        this.fpsElement.textContent = "FPS: --";

        // Polygons 顯示
        this.polygonsElement = document.createElement("div");
        this.polygonsElement.style.marginBottom = "4px";
        this.polygonsElement.textContent = "Polygons: --";

        // Triangles 顯示
        this.trianglesElement = document.createElement("div");
        this.trianglesElement.style.marginBottom = "4px";
        this.trianglesElement.textContent = "Triangles: --";

        // Draw Calls 顯示
        this.drawCallsElement = document.createElement("div");
        this.drawCallsElement.textContent = "Draw Calls: --";

        // 組裝 UI
        this.container.appendChild(this.fpsElement);
        this.container.appendChild(this.polygonsElement);
        this.container.appendChild(this.trianglesElement);
        this.container.appendChild(this.drawCallsElement);

        document.body.appendChild(this.container);

        console.log("📊 [DebugUI] Debug panel created");
    }

    /**
     * 開始更新 Debug 資訊
     */
    private startUpdate(): void {
        // 使用 scene.registerBeforeRender 來更新
        this.scene.registerBeforeRender(() => {
            if (!this.isVisible) return;
            this.update();
        });
    }

    /**
     * 更新 Debug 資訊
     */
    private update(): void {
        const engine = this.scene.getEngine();

        // FPS
        const fps = engine.getFps();
        if (this.fpsElement) {
            this.fpsElement.textContent = `FPS: ${fps.toFixed(1)}`;
            // FPS 低於 30 時變紅色警告
            this.fpsElement.style.color = fps < 30 ? "#ff4444" : fps < 50 ? "#ffaa00" : "#00ff00";
        }

        // Active Meshes (可見的 mesh 數量)
        const activeMeshes = this.scene.getActiveMeshes().length;

        // Total Vertices (頂點總數 - 可用於估算多邊形)
        let totalVertices = 0;
        let totalIndices = 0;

        this.scene.meshes.forEach((mesh) => {
            if (mesh.isEnabled() && mesh.isVisible) {
                // 檢查是否為 Mesh 類型（有 geometry 屬性）
                if (mesh instanceof BABYLON.Mesh && mesh.geometry) {
                    totalVertices += mesh.geometry.getTotalVertices();
                    totalIndices += mesh.geometry.getTotalIndices();
                }
            }
        });

        // Polygons (估算：頂點數 / 3)
        const polygons = Math.round(totalVertices / 3);
        if (this.polygonsElement) {
            this.polygonsElement.textContent = `Polygons: ${this.formatNumber(polygons)}`;
        }

        // Triangles (indices / 3)
        const triangles = Math.round(totalIndices / 3);
        if (this.trianglesElement) {
            this.trianglesElement.textContent = `Triangles: ${this.formatNumber(triangles)}`;
        }

        // Draw Calls (使用 active meshes 作為估算)
        if (this.drawCallsElement) {
            this.drawCallsElement.textContent = `Draw Calls: ~${activeMeshes}`;
        }
    }

    /**
     * 格式化數字（加入千分位）
     */
    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        }
        return num.toString();
    }

    /**
     * 顯示/隱藏 Debug UI
     */
    toggle(): void {
        this.isVisible = !this.isVisible;
        if (this.container) {
            this.container.style.display = this.isVisible ? "block" : "none";
        }
    }

    /**
     * 設定可見性
     */
    setVisible(visible: boolean): void {
        this.isVisible = visible;
        if (this.container) {
            this.container.style.display = visible ? "block" : "none";
        }
    }

    /**
     * 清理 UI
     */
    dispose(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
