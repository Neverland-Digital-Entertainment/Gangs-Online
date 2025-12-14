/**
 * 加載螢幕系統
 * 負責顯示加載進度和狀態
 */
export class LoadingScreen {
    private loadingText: HTMLElement | null;
    private loadingScreen: HTMLElement | null;
    private versionInfo: HTMLElement | null;

    constructor() {
        this.loadingText = document.getElementById("loadingText");
        this.loadingScreen = document.getElementById("loadingScreen");
        this.versionInfo = this.createVersionDisplay();
    }

    /**
     * 創建版本顯示元素（0.7.1）
     */
    private createVersionDisplay(): HTMLElement {
        const versionDiv = document.createElement("div");
        versionDiv.id = "versionInfo";
        versionDiv.style.position = "absolute";
        versionDiv.style.bottom = "20px";
        versionDiv.style.left = "50%";
        versionDiv.style.transform = "translateX(-50%)";
        versionDiv.style.color = "#888";
        versionDiv.style.fontSize = "14px";
        versionDiv.style.fontFamily = "monospace";
        versionDiv.style.textAlign = "center";
        versionDiv.innerHTML = "載入中...";

        if (this.loadingScreen) {
            this.loadingScreen.appendChild(versionDiv);
        }

        return versionDiv;
    }

    /**
     * 更新加載文本
     */
    updateText(text: string): void {
        if (this.loadingText) {
            this.loadingText.textContent = text;
        }
        console.log("📦", text);
    }

    /**
     * 顯示版本資訊（0.7.1）
     */
    showVersionInfo(clientVersion: string, serverVersion: string): void {
        if (this.versionInfo) {
            const match = clientVersion === serverVersion;
            const icon = match ? "✅" : "⚠️";
            const color = match ? "#4CAF50" : "#FF9800";

            this.versionInfo.innerHTML = `
                <div style="color: ${color};">
                    ${icon} Client: ${clientVersion} | Server: ${serverVersion}
                </div>
            `;

            if (!match) {
                console.warn(`⚠️ Version mismatch! Client: ${clientVersion}, Server: ${serverVersion}`);
            } else {
                console.log(`✅ Version matched: ${clientVersion}`);
            }
        }
    }

    /**
     * 隱藏加載螢幕（帶淡出動畫）
     */
    hide(): void {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add("fade-out");
            setTimeout(() => {
                this.loadingScreen?.remove();
            }, 500);
        }
    }

    /**
     * 顯示錯誤訊息
     */
    showError(error: Error): void {
        document.body.innerHTML = `
            <div style="color: white; background: red; padding: 20px; font-family: monospace;">
                <h1>Error Loading Game</h1>
                <p>${error.message}</p>
                <pre>${error.stack}</pre>
            </div>
        `;
    }
}
