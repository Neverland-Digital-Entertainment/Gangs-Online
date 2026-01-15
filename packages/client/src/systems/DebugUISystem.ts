import * as BABYLON from "@babylonjs/core";

/**
 * Debug UI 系統 (Phase 15)
 *
 * 在畫面頂部顯示效能監控指標：
 * - FPS (每秒幀數)
 * - Map Triangles (地圖三角形數 - 來自 T/B 開頭的 GLB mesh)
 * - Char Triangles (角色/其他物件三角形數)
 * - Draw Calls (繪製調用數)
 * - Player X/Z 座標
 */
export class DebugUISystem {
    private scene: BABYLON.Scene;
    private container: HTMLElement | null = null;
    private fpsElement: HTMLElement | null = null;
    private mapTrianglesElement: HTMLElement | null = null;
    private charTrianglesElement: HTMLElement | null = null;
    private drawCallsElement: HTMLElement | null = null;
    private posXElement: HTMLElement | null = null;
    private posZElement: HTMLElement | null = null;
    private isVisible: boolean = true;
    private playerPosition: BABYLON.Vector3 = BABYLON.Vector3.Zero();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.createUI();
        this.startUpdate();
        this.setupDebugCommand();
    }

    /**
     * 設定 debug 指令（在 console 輸入 window.debugTriangles() 查看詳細分佈）
     */
    private setupDebugCommand(): void {
        (window as any).debugTriangles = () => {
            const breakdown: { [key: string]: number } = {};

            this.scene.meshes.forEach((mesh) => {
                if (mesh.isEnabled() && mesh.isVisible) {
                    if (mesh instanceof BABYLON.Mesh && mesh.geometry) {
                        const triangles = Math.round(mesh.geometry.getTotalIndices() / 3);
                        const category = this.isMapMesh(mesh) ? "MAP" : "OTHER";
                        const key = `[${category}] ${mesh.name}`;
                        breakdown[key] = (breakdown[key] || 0) + triangles;
                    }
                }
            });

            // 排序並顯示
            const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
            console.log("=== Triangle Breakdown ===");
            let mapTotal = 0, otherTotal = 0;
            for (const [name, count] of sorted) {
                console.log(`${name}: ${count.toLocaleString()}`);
                if (name.startsWith("[MAP]")) mapTotal += count;
                else otherTotal += count;
            }
            console.log("=== Totals ===");
            console.log(`Map: ${mapTotal.toLocaleString()}`);
            console.log(`Other: ${otherTotal.toLocaleString()}`);
            console.log(`Total: ${(mapTotal + otherTotal).toLocaleString()}`);
        };
        console.log("📊 [DebugUI] Type window.debugTriangles() in console to see triangle breakdown");
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

        // Map Triangles 顯示 (來自 GLB 地圖的 T/B mesh)
        this.mapTrianglesElement = document.createElement("div");
        this.mapTrianglesElement.style.marginBottom = "4px";
        this.mapTrianglesElement.textContent = "Map Tris: --";

        // Char Triangles 顯示 (角色、敵人等其他物件)
        this.charTrianglesElement = document.createElement("div");
        this.charTrianglesElement.style.marginBottom = "4px";
        this.charTrianglesElement.style.color = "#aaaaaa";
        this.charTrianglesElement.textContent = "Other Tris: --";

        // Draw Calls 顯示
        this.drawCallsElement = document.createElement("div");
        this.drawCallsElement.style.marginBottom = "4px";
        this.drawCallsElement.textContent = "Draw Calls: --";

        // Position X 顯示
        this.posXElement = document.createElement("div");
        this.posXElement.style.marginBottom = "4px";
        this.posXElement.style.color = "#88ccff";
        this.posXElement.textContent = "X: --";

        // Position Z 顯示
        this.posZElement = document.createElement("div");
        this.posZElement.style.color = "#88ccff";
        this.posZElement.textContent = "Z: --";

        // 組裝 UI
        this.container.appendChild(this.fpsElement);
        this.container.appendChild(this.mapTrianglesElement);
        this.container.appendChild(this.charTrianglesElement);
        this.container.appendChild(this.drawCallsElement);
        this.container.appendChild(this.posXElement);
        this.container.appendChild(this.posZElement);

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
     * 檢查是否為地圖 mesh（來自 GLB 的 T/B 開頭 mesh）
     */
    private isMapMesh(mesh: BABYLON.AbstractMesh): boolean {
        const name = mesh.name.toUpperCase();
        // T = Terrain, B = Building (from GLB map)
        // Also check for root containers from chunk loader
        return name.startsWith("T") ||
               name.startsWith("B") ||
               mesh.metadata?.type === "terrain" ||
               mesh.metadata?.type === "building" ||
               mesh.metadata?.chunkId; // Loaded from chunk system
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

        // 分開統計 Map 和 Character 三角形
        let mapIndices = 0;
        let charIndices = 0;

        this.scene.meshes.forEach((mesh) => {
            if (mesh.isEnabled() && mesh.isVisible) {
                // 檢查是否為 Mesh 類型（有 geometry 屬性）
                if (mesh instanceof BABYLON.Mesh && mesh.geometry) {
                    const indices = mesh.geometry.getTotalIndices();
                    if (this.isMapMesh(mesh)) {
                        mapIndices += indices;
                    } else {
                        charIndices += indices;
                    }
                }
            }
        });

        // Map Triangles (來自 GLB 地圖)
        const mapTriangles = Math.round(mapIndices / 3);
        if (this.mapTrianglesElement) {
            this.mapTrianglesElement.textContent = `Map Tris: ${this.formatNumber(mapTriangles)}`;
        }

        // Char Triangles (角色、敵人等)
        const charTriangles = Math.round(charIndices / 3);
        if (this.charTrianglesElement) {
            this.charTrianglesElement.textContent = `Other Tris: ${this.formatNumber(charTriangles)}`;
        }

        // Draw Calls (使用 active meshes 作為估算)
        if (this.drawCallsElement) {
            this.drawCallsElement.textContent = `Draw Calls: ~${activeMeshes}`;
        }

        // Player Position
        if (this.posXElement) {
            this.posXElement.textContent = `X: ${this.playerPosition.x.toFixed(1)}`;
        }
        if (this.posZElement) {
            this.posZElement.textContent = `Z: ${this.playerPosition.z.toFixed(1)}`;
        }
    }

    /**
     * 設定玩家位置（用於顯示座標）
     */
    setPlayerPosition(position: BABYLON.Vector3): void {
        this.playerPosition = position;
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
