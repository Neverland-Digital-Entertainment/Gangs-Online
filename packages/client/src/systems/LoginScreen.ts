/**
 * Login Screen System (Phase 12.1: Full Auth System)
 * 負責顯示登入/註冊介面
 */
import { firebaseService, AuthResult } from "../services/FirebaseService";

export interface LoginResult {
    success: boolean;
    userId: string;
    characterName: string;
    isNewUser: boolean;
    error?: string;
}

export class LoginScreen {
    private container: HTMLElement | null = null;
    private onLoginComplete: ((result: LoginResult) => void) | null = null;

    /**
     * 顯示登入畫面
     * @returns Promise 返回登入結果
     */
    show(): Promise<LoginResult> {
        return new Promise((resolve) => {
            this.onLoginComplete = resolve;
            this.createLoginUI();
        });
    }

    /**
     * 創建登入 UI
     */
    private createLoginUI(): void {
        // 創建容器
        this.container = document.createElement("div");
        this.container.id = "loginScreen";
        this.container.innerHTML = `
            <div class="login-box">
                <img src="/logo-small.png" alt="Gangs Online" class="login-logo" />
                <h2>歡迎來到 Gangs Online</h2>

                <!-- 登入選項 -->
                <div id="loginOptions" class="login-section">
                    <button id="btnGoogle" class="login-btn google-btn">
                        <span class="btn-icon">G</span>
                        使用 Google 登入
                    </button>

                    <div class="divider">
                        <span>或使用 Email</span>
                    </div>

                    <div class="email-form">
                        <input type="email" id="emailInput" placeholder="Email" class="login-input" />
                        <input type="password" id="passwordInput" placeholder="密碼" class="login-input" />
                        <div class="remember-me">
                            <input type="checkbox" id="rememberMe" />
                            <label for="rememberMe">記住我</label>
                        </div>
                        <div class="email-buttons">
                            <button id="btnEmailLogin" class="login-btn email-btn">登入</button>
                            <button id="btnEmailRegister" class="login-btn register-btn">註冊</button>
                        </div>
                    </div>
                </div>

                <!-- 角色名稱輸入（新玩家）-->
                <div id="characterNameSection" class="login-section" style="display: none;">
                    <h3>創建你的角色</h3>
                    <p>請輸入你的角色名稱：</p>
                    <input type="text" id="characterNameInput" placeholder="角色名稱" class="login-input" maxlength="20" />
                    <button id="btnStartGame" class="login-btn start-btn">開始遊戲</button>
                </div>

                <!-- 錯誤訊息 -->
                <div id="loginError" class="login-error"></div>

                <!-- 載入中 -->
                <div id="loginLoading" class="login-loading" style="display: none;">
                    <div class="login-spinner"></div>
                    <span>正在處理...</span>
                </div>
            </div>
        `;

        // 添加樣式
        this.addStyles();

        // 添加到 DOM
        document.body.appendChild(this.container);

        // 綁定事件
        this.bindEvents();
    }

    /**
     * 添加 CSS 樣式
     */
    private addStyles(): void {
        const style = document.createElement("style");
        style.id = "loginScreenStyles";
        style.textContent = `
            #loginScreen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: url('/images/main-bg.jpg') center center / cover no-repeat;
                background-color: #1a1a2e;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .login-box {
                background: rgba(26, 26, 46, 0.95);
                border-radius: 16px;
                padding: 40px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                text-align: center;
            }

            .login-logo {
                max-width: 200px;
                margin-bottom: 20px;
            }

            .login-box h2 {
                color: white;
                margin: 0 0 30px 0;
                font-size: 24px;
            }

            .login-box h3 {
                color: white;
                margin: 0 0 10px 0;
                font-size: 20px;
            }

            .login-box p {
                color: rgba(255,255,255,0.7);
                margin: 0 0 20px 0;
            }

            .login-section {
                margin-bottom: 20px;
            }

            .login-btn {
                width: 100%;
                padding: 14px 20px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .login-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .login-btn:active {
                transform: translateY(0);
            }

            .btn-icon {
                font-size: 20px;
                font-weight: bold;
            }

            .google-btn {
                background: #4285f4;
                color: white;
            }

            .apple-btn {
                background: #000;
                color: white;
            }

            .email-btn {
                background: #16a34a;
                color: white;
                flex: 1;
            }

            .register-btn {
                background: #7c3aed;
                color: white;
                flex: 1;
            }

            .guest-btn {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.8);
                border: 1px solid rgba(255,255,255,0.2);
            }

            .start-btn {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
                font-size: 18px;
                padding: 16px;
            }

            .divider {
                display: flex;
                align-items: center;
                margin: 20px 0;
                color: rgba(255,255,255,0.5);
                font-size: 14px;
            }

            .divider::before,
            .divider::after {
                content: '';
                flex: 1;
                height: 1px;
                background: rgba(255,255,255,0.2);
            }

            .divider span {
                padding: 0 15px;
            }

            .email-form {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .email-buttons {
                display: flex;
                gap: 12px;
            }

            .email-buttons .login-btn {
                margin-bottom: 0;
            }

            .remember-me {
                display: flex;
                align-items: center;
                gap: 8px;
                color: rgba(255,255,255,0.8);
                font-size: 14px;
            }

            .remember-me input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #4285f4;
                cursor: pointer;
            }

            .remember-me label {
                cursor: pointer;
            }

            .login-input {
                width: 100%;
                padding: 14px 16px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 8px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 16px;
                outline: none;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }

            .login-input:focus {
                border-color: #4285f4;
            }

            .login-input::placeholder {
                color: rgba(255,255,255,0.5);
            }

            .login-error {
                color: #ef4444;
                font-size: 14px;
                margin-top: 10px;
                min-height: 20px;
            }

            .login-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                color: rgba(255,255,255,0.7);
                margin-top: 20px;
            }

            .login-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            #loginScreen.fade-out {
                animation: fadeOut 0.5s forwards;
            }

            @keyframes fadeOut {
                to {
                    opacity: 0;
                    pointer-events: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 綁定事件處理
     */
    private bindEvents(): void {
        // Google 登入
        document.getElementById("btnGoogle")?.addEventListener("click", () => {
            this.handleGoogleLogin();
        });

        // Apple 登入
        document.getElementById("btnApple")?.addEventListener("click", () => {
            this.handleAppleLogin();
        });

        // Email 登入
        document.getElementById("btnEmailLogin")?.addEventListener("click", () => {
            this.handleEmailLogin();
        });

        // Email 註冊
        document.getElementById("btnEmailRegister")?.addEventListener("click", () => {
            this.handleEmailRegister();
        });

        // 訪客模式
        document.getElementById("btnGuest")?.addEventListener("click", () => {
            this.handleGuestLogin();
        });

        // 開始遊戲（創建角色）
        document.getElementById("btnStartGame")?.addEventListener("click", () => {
            this.handleStartGame();
        });

        // Enter 鍵支援
        document.getElementById("passwordInput")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.handleEmailLogin();
            }
        });

        // 載入記住的 Email
        this.loadRememberedEmail();

        document.getElementById("characterNameInput")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.handleStartGame();
            }
        });
    }

    /**
     * 載入記住的 Email
     */
    private loadRememberedEmail(): void {
        const savedEmail = localStorage.getItem("gangs_remembered_email");
        if (savedEmail) {
            const emailInput = document.getElementById("emailInput") as HTMLInputElement;
            const rememberCheckbox = document.getElementById("rememberMe") as HTMLInputElement;
            if (emailInput) {
                emailInput.value = savedEmail;
            }
            if (rememberCheckbox) {
                rememberCheckbox.checked = true;
            }
        }
    }

    /**
     * 保存或清除記住的 Email
     */
    private saveRememberedEmail(email: string, remember: boolean): void {
        if (remember && email) {
            localStorage.setItem("gangs_remembered_email", email);
        } else {
            localStorage.removeItem("gangs_remembered_email");
        }
    }

    /**
     * 顯示載入中狀態
     */
    private showLoading(show: boolean): void {
        const loading = document.getElementById("loginLoading");
        const options = document.getElementById("loginOptions");
        const nameSection = document.getElementById("characterNameSection");

        if (loading) loading.style.display = show ? "flex" : "none";
        if (show) {
            if (options) options.style.pointerEvents = "none";
            if (nameSection) nameSection.style.pointerEvents = "none";
        } else {
            if (options) options.style.pointerEvents = "auto";
            if (nameSection) nameSection.style.pointerEvents = "auto";
        }
    }

    /**
     * 顯示錯誤訊息
     */
    private showError(message: string): void {
        const errorEl = document.getElementById("loginError");
        if (errorEl) {
            errorEl.textContent = message;
        }
    }

    /**
     * 清除錯誤訊息
     */
    private clearError(): void {
        const errorEl = document.getElementById("loginError");
        if (errorEl) {
            errorEl.textContent = "";
        }
    }

    /**
     * 處理登入成功
     */
    private handleAuthSuccess(result: AuthResult, isGuest: boolean = false): void {
        if (!result.success || !result.user) {
            this.showError(result.error || "登入失敗");
            this.showLoading(false);
            return;
        }

        // 如果是新用戶，顯示角色名稱輸入
        if (result.isNewUser) {
            this.showCharacterNameInput(result.user.uid, isGuest);
        } else {
            // 已有帳號，直接進入遊戲
            this.completeLogin(result.user.uid, "", false);
        }
    }

    /**
     * 顯示角色名稱輸入
     */
    private showCharacterNameInput(userId: string, isGuest: boolean): void {
        const options = document.getElementById("loginOptions");
        const nameSection = document.getElementById("characterNameSection");

        if (options) options.style.display = "none";
        if (nameSection) nameSection.style.display = "block";

        // 儲存 userId 供之後使用
        nameSection?.setAttribute("data-user-id", userId);
        nameSection?.setAttribute("data-is-guest", isGuest ? "true" : "false");

        this.showLoading(false);

        // 自動聚焦到輸入框
        setTimeout(() => {
            document.getElementById("characterNameInput")?.focus();
        }, 100);
    }

    /**
     * 處理開始遊戲（創建角色）
     */
    private handleStartGame(): void {
        const nameInput = document.getElementById("characterNameInput") as HTMLInputElement;
        const nameSection = document.getElementById("characterNameSection");

        const characterName = nameInput?.value.trim();
        const userId = nameSection?.getAttribute("data-user-id") || "";
        const isGuest = nameSection?.getAttribute("data-is-guest") === "true";

        if (!characterName || characterName.length < 2) {
            this.showError("角色名稱至少需要 2 個字元");
            return;
        }

        if (characterName.length > 20) {
            this.showError("角色名稱不能超過 20 個字元");
            return;
        }

        this.completeLogin(userId, characterName, true);
    }

    /**
     * 完成登入流程
     */
    private completeLogin(userId: string, characterName: string, isNewUser: boolean): void {
        if (this.onLoginComplete) {
            this.onLoginComplete({
                success: true,
                userId,
                characterName,
                isNewUser
            });
        }
        this.hide();
    }

    /**
     * Google 登入
     */
    private async handleGoogleLogin(): Promise<void> {
        this.clearError();
        this.showLoading(true);

        try {
            firebaseService.initialize();
            const result = await firebaseService.loginWithGoogle();
            this.handleAuthSuccess(result);
        } catch (error: any) {
            this.showError(error.message || "Google 登入失敗");
            this.showLoading(false);
        }
    }

    /**
     * Apple 登入
     */
    private async handleAppleLogin(): Promise<void> {
        this.clearError();
        this.showLoading(true);

        try {
            firebaseService.initialize();
            const result = await firebaseService.loginWithApple();
            this.handleAuthSuccess(result);
        } catch (error: any) {
            this.showError(error.message || "Apple 登入失敗");
            this.showLoading(false);
        }
    }

    /**
     * Email 登入
     */
    private async handleEmailLogin(): Promise<void> {
        const email = (document.getElementById("emailInput") as HTMLInputElement)?.value.trim();
        const password = (document.getElementById("passwordInput") as HTMLInputElement)?.value;
        const rememberMe = (document.getElementById("rememberMe") as HTMLInputElement)?.checked ?? false;

        if (!email || !password) {
            this.showError("請輸入 Email 和密碼");
            return;
        }

        this.clearError();
        this.showLoading(true);

        try {
            firebaseService.initialize();
            // 傳入 rememberMe 參數，決定是否持久化登入狀態
            const result = await firebaseService.loginWithEmail(email, password, rememberMe);

            // 登入成功時，根據「記住我」選項保存或清除 Email
            if (result.success) {
                this.saveRememberedEmail(email, rememberMe);
            }

            this.handleAuthSuccess(result);
        } catch (error: any) {
            this.showError(error.message || "登入失敗");
            this.showLoading(false);
        }
    }

    /**
     * Email 註冊
     */
    private async handleEmailRegister(): Promise<void> {
        const email = (document.getElementById("emailInput") as HTMLInputElement)?.value.trim();
        const password = (document.getElementById("passwordInput") as HTMLInputElement)?.value;

        if (!email || !password) {
            this.showError("請輸入 Email 和密碼");
            return;
        }

        if (password.length < 6) {
            this.showError("密碼至少需要 6 個字元");
            return;
        }

        this.clearError();
        this.showLoading(true);

        try {
            firebaseService.initialize();
            const result = await firebaseService.registerWithEmail(email, password);
            this.handleAuthSuccess(result);
        } catch (error: any) {
            this.showError(error.message || "註冊失敗");
            this.showLoading(false);
        }
    }

    /**
     * 訪客模式
     */
    private async handleGuestLogin(): Promise<void> {
        this.clearError();
        this.showLoading(true);

        try {
            firebaseService.initialize();
            const result = await firebaseService.loginAnonymous();
            this.handleAuthSuccess(result, true);
        } catch (error: any) {
            this.showError(error.message || "訪客登入失敗");
            this.showLoading(false);
        }
    }

    /**
     * 隱藏登入畫面
     */
    hide(): void {
        if (this.container) {
            this.container.classList.add("fade-out");
            setTimeout(() => {
                this.container?.remove();
                document.getElementById("loginScreenStyles")?.remove();
            }, 500);
        }
    }
}
