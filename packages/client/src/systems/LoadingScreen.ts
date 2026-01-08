/**
 * 加載螢幕系統 (Phase 15: 增加進度條)
 * 負責顯示加載進度和狀態
 */
export class LoadingScreen {
    private loadingText: HTMLElement | null;
    private loadingScreen: HTMLElement | null;
    private versionInfo: HTMLElement | null;
    private progressBar: HTMLElement | null;
    private progressFill: HTMLElement | null;
    private progressText: HTMLElement | null;

    constructor() {
        this.loadingText = document.getElementById("loadingText");
        this.loadingScreen = document.getElementById("loadingScreen");
        this.versionInfo = this.createVersionDisplay();
        this.progressBar = null;
        this.progressFill = null;
        this.progressText = null;
        this.createProgressBar();
    }

    /**
     * 創建進度條 (Phase 15)
     */
    private createProgressBar(): void {
        if (!this.loadingScreen) return;

        // 進度條容器
        const progressContainer = document.createElement("div");
        progressContainer.id = "progressContainer";
        progressContainer.style.position = "absolute";
        progressContainer.style.bottom = "80px";
        progressContainer.style.left = "50%";
        progressContainer.style.transform = "translateX(-50%)";
        progressContainer.style.width = "300px";
        progressContainer.style.textAlign = "center";

        // 進度條外框
        this.progressBar = document.createElement("div");
        this.progressBar.style.width = "100%";
        this.progressBar.style.height = "20px";
        this.progressBar.style.backgroundColor = "#333";
        this.progressBar.style.borderRadius = "10px";
        this.progressBar.style.overflow = "hidden";
        this.progressBar.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.5)";

        // 進度條填充
        this.progressFill = document.createElement("div");
        this.progressFill.style.width = "0%";
        this.progressFill.style.height = "100%";
        this.progressFill.style.backgroundColor = "#4CAF50";
        this.progressFill.style.borderRadius = "10px";
        this.progressFill.style.transition = "width 0.3s ease-out";
        this.progressFill.style.background = "linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%)";

        // 進度文字
        this.progressText = document.createElement("div");
        this.progressText.style.marginTop = "8px";
        this.progressText.style.color = "#aaa";
        this.progressText.style.fontSize = "14px";
        this.progressText.style.fontFamily = "monospace";
        this.progressText.textContent = "0%";

        this.progressBar.appendChild(this.progressFill);
        progressContainer.appendChild(this.progressBar);
        progressContainer.appendChild(this.progressText);
        this.loadingScreen.appendChild(progressContainer);
    }

    /**
     * 更新進度條 (Phase 15)
     * @param progress 進度值 (0-100)
     */
    updateProgress(progress: number): void {
        const clampedProgress = Math.max(0, Math.min(100, progress));
        if (this.progressFill) {
            this.progressFill.style.width = `${clampedProgress}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = `${Math.round(clampedProgress)}%`;
        }
    }

    /**
     * 創建版本顯示元素
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
