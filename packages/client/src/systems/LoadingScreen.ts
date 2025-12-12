/**
 * 加载屏幕系统
 * 负责显示加载进度和状态
 */
export class LoadingScreen {
    private loadingText: HTMLElement | null;
    private loadingScreen: HTMLElement | null;

    constructor() {
        this.loadingText = document.getElementById("loadingText");
        this.loadingScreen = document.getElementById("loadingScreen");
    }

    /**
     * 更新加载文本
     */
    updateText(text: string): void {
        if (this.loadingText) {
            this.loadingText.textContent = text;
        }
        console.log("📦", text);
    }

    /**
     * 隐藏加载屏幕（带淡出动画）
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
     * 显示错误消息
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
