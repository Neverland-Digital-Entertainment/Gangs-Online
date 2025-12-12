/**
 * 加載螢幕系統
 * 負責顯示加載進度和狀態
 */
export class LoadingScreen {
    private loadingText: HTMLElement | null;
    private loadingScreen: HTMLElement | null;

    constructor() {
        this.loadingText = document.getElementById("loadingText");
        this.loadingScreen = document.getElementById("loadingScreen");
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
