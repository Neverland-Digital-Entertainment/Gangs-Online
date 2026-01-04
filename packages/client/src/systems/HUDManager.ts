import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { QuestSystem } from "./QuestSystem";
import { ShopPopupSystem } from "./ShopPopupSystem";
import { IQuestState, IItem } from "@gangs-online/shared";

/**
 * HUD 管理器 - 使用 JSON 定義的 UI
 * 負責載入和管理主要 HUD 介面
 */
export class HUDManager {
    private uiTexture: GUI.AdvancedDynamicTexture;
    private room: Room | null = null;

    // Main UI elements
    private mainHUD: GUI.Container | null = null;

    // Status elements
    private hpBarFill: GUI.Rectangle | null = null;
    private vpBarFill: GUI.Rectangle | null = null;
    private expBarFill: GUI.Rectangle | null = null;
    private levelText: GUI.TextBlock | null = null;
    private wantedIndicator: GUI.Ellipse | null = null;

    // Minimap
    private minimapContainer: GUI.Ellipse | null = null;
    private locationName: GUI.TextBlock | null = null;

    // Chat
    private chatContainer: GUI.Rectangle | null = null;
    private chatTabs: GUI.StackPanel | null = null;
    private chatScroll: GUI.ScrollViewer | null = null;
    private chatInput: GUI.InputText | null = null;
    private chatContent: GUI.StackPanel | null = null;
    private currentChatChannel: string = "all";

    // Shortcut Bar
    private shortcutSlots: GUI.Button[] = [];

    // Action Menu
    private actionMenuContainer: GUI.Rectangle | null = null;

    // Money
    private moneyText: GUI.TextBlock | null = null;

    // Popup
    private popupRoot: GUI.Container | null = null;
    private popupContainer: GUI.Rectangle | null = null;
    private popupTitle: GUI.TextBlock | null = null;
    private popupScrollViewer: GUI.ScrollViewer | null = null;
    private popupContent: GUI.StackPanel | null = null;
    private currentPopupType: string | null = null; // Phase 11: 追蹤當前打開的 popup 類型

    // Quest System (Phase 10)
    private questSystem: QuestSystem | null = null;

    // Shop Popup System (Phase 10.1)
    private shopPopupSystem: ShopPopupSystem | null = null;

    constructor(uiTexture: GUI.AdvancedDynamicTexture) {
        this.uiTexture = uiTexture;
    }

    /**
     * 初始化 HUD 系統
     */
    async initialize(room: Room): Promise<void> {
        this.room = room;

        // Load main HUD from JSON
        await this.loadMainHUD();

        // Load popup from JSON
        await this.loadPopup();

        // Setup event handlers
        this.setupEventHandlers();

        // Initialize Quest System (Phase 10)
        this.questSystem = new QuestSystem(room, this.uiTexture);
        this.questSystem.setPopupContent(this.popupContent);
        // 設置關閉 popup 的回調
        this.questSystem.setHidePopupCallback(() => {
            this.hidePopup();
        });

        // Initialize Shop Popup System (Phase 10.1)
        this.shopPopupSystem = new ShopPopupSystem(room);

        console.log("✅ HUD Manager initialized");
    }

    /**
     * 從 JSON 載入主 HUD
     */
    private async loadMainHUD(): Promise<void> {
        try {
            // Fetch the main UI JSON
            const response = await fetch("/ui/main.json");
            const jsonData = await response.json();

            // Parse the UI from JSON using Babylon.js GUI
            // The JSON format from GUI Editor contains a 'root' property
            if (jsonData.root) {
                this.mainHUD = this.parseGUIElement(jsonData.root) as GUI.Container;

                if (this.mainHUD) {
                    // Add to UI texture
                    this.uiTexture.addControl(this.mainHUD);

                    // Cache references to important elements
                    this.cacheMainHUDElements();
                }
            }

            console.log("✅ Main HUD loaded from JSON");
        } catch (error) {
            console.error("❌ Failed to load main HUD:", error);
            // Fallback: create basic HUD programmatically
            this.createFallbackHUD();
        }
    }

    /**
     * 解析 GUI 元素 JSON
     */
    private parseGUIElement(data: any): GUI.Control | null {
        let control: GUI.Control | null = null;

        // Create control based on className
        switch (data.className) {
            case "Rectangle":
                control = new GUI.Rectangle(data.name);
                break;
            case "Button":
                control = GUI.Button.CreateSimpleButton(data.name, "");
                break;
            case "TextBlock":
                control = new GUI.TextBlock(data.name, data.text || "");
                break;
            case "Image":
                control = new GUI.Image(data.name, data.source || "");
                break;
            case "Ellipse":
                control = new GUI.Ellipse(data.name);
                break;
            case "StackPanel":
                control = new GUI.StackPanel(data.name);
                break;
            case "ScrollViewer":
                control = new GUI.ScrollViewer(data.name);
                break;
            case "InputText":
                control = new GUI.InputText(data.name, data.text || "");
                break;
            case "Container":
                control = new GUI.Container(data.name);
                break;
            default:
                console.warn(`Unknown control type: ${data.className}`);
                control = new GUI.Container(data.name);
                break;
        }

        if (!control) return null;

        // Apply common properties
        this.applyCommonProperties(control, data);

        // Apply specific properties based on type
        this.applySpecificProperties(control, data);

        // Parse children recursively
        if (data.children && Array.isArray(data.children)) {
            const container = control as GUI.Container;
            for (const childData of data.children) {
                const child = this.parseGUIElement(childData);
                if (child) {
                    container.addControl(child);
                }
            }
        }

        return control;
    }

    /**
     * 應用通用屬性
     */
    private applyCommonProperties(control: GUI.Control, data: any): void {
        if (data.width) control.width = data.width;
        if (data.height) control.height = data.height;
        if (data.left) control.left = data.left;
        if (data.top) control.top = data.top;
        if (data.color) control.color = data.color;
        if (data.alpha !== undefined) control.alpha = data.alpha;
        if (data.isVisible !== undefined) control.isVisible = data.isVisible;
        if (data.isEnabled !== undefined) control.isEnabled = data.isEnabled;
        if (data.zIndex !== undefined) control.zIndex = data.zIndex;
        if (data.rotation !== undefined) control.rotation = data.rotation;
        if (data.scaleX !== undefined) control.scaleX = data.scaleX;
        if (data.scaleY !== undefined) control.scaleY = data.scaleY;

        // Alignment
        if (data.horizontalAlignment !== undefined) {
            control.horizontalAlignment = data.horizontalAlignment;
        }
        if (data.verticalAlignment !== undefined) {
            control.verticalAlignment = data.verticalAlignment;
        }

        // Padding
        if (data.paddingLeft) control.paddingLeft = data.paddingLeft;
        if (data.paddingRight) control.paddingRight = data.paddingRight;
        if (data.paddingTop) control.paddingTop = data.paddingTop;
        if (data.paddingBottom) control.paddingBottom = data.paddingBottom;

        // Shadow
        if (data.shadowBlur) control.shadowBlur = data.shadowBlur;
        if (data.shadowColor) control.shadowColor = data.shadowColor;
        if (data.shadowOffsetX) control.shadowOffsetX = data.shadowOffsetX;
        if (data.shadowOffsetY) control.shadowOffsetY = data.shadowOffsetY;

        // Font
        if (data.fontSize) control.fontSize = data.fontSize;

        // Pointer
        if (data.isPointerBlocker !== undefined) control.isPointerBlocker = data.isPointerBlocker;
        if (data.isHitTestVisible !== undefined) control.isHitTestVisible = data.isHitTestVisible;
    }

    /**
     * 應用特定類型的屬性
     */
    private applySpecificProperties(control: GUI.Control, data: any): void {
        // Rectangle specific
        if (control instanceof GUI.Rectangle) {
            if (data.background) control.background = data.background;
            if (data.thickness !== undefined) control.thickness = data.thickness;
            if (data.cornerRadius !== undefined) control.cornerRadius = data.cornerRadius;
        }

        // Ellipse specific
        if (control instanceof GUI.Ellipse) {
            if (data.background) control.background = data.background;
            if (data.thickness !== undefined) control.thickness = data.thickness;
        }

        // TextBlock specific
        if (control instanceof GUI.TextBlock) {
            if (data.text) control.text = data.text;
            if (data.textHorizontalAlignment !== undefined) {
                control.textHorizontalAlignment = data.textHorizontalAlignment;
            }
            if (data.textVerticalAlignment !== undefined) {
                control.textVerticalAlignment = data.textVerticalAlignment;
            }
            if (data.textWrapping !== undefined) control.textWrapping = data.textWrapping;
            if (data.outlineWidth !== undefined) control.outlineWidth = data.outlineWidth;
            if (data.outlineColor) control.outlineColor = data.outlineColor;
        }

        // Image specific
        if (control instanceof GUI.Image) {
            if (data.source) control.source = data.source;
            if (data.stretch !== undefined) control.stretch = data.stretch;
        }

        // StackPanel specific
        if (control instanceof GUI.StackPanel) {
            if (data.isVertical !== undefined) control.isVertical = data.isVertical;
            if (data.spacing !== undefined) control.spacing = data.spacing;
        }

        // InputText specific
        if (control instanceof GUI.InputText) {
            if (data.text) control.text = data.text;
            if (data.placeholderText) control.placeholderText = data.placeholderText;
            if (data.placeholderColor) control.placeholderColor = data.placeholderColor;
            if (data.background) control.background = data.background;
            if (data.focusedBackground) control.focusedBackground = data.focusedBackground;
            if (data.thickness !== undefined) control.thickness = data.thickness;
        }

        // Button specific
        if (control instanceof GUI.Button) {
            if (data.background) control.background = data.background;
            if (data.thickness !== undefined) control.thickness = data.thickness;
        }

        // ScrollViewer specific
        if (control instanceof GUI.ScrollViewer) {
            if (data.barColor) control.barColor = data.barColor;
            if (data.barBackground) control.barBackground = data.barBackground;
        }
    }

    /**
     * 快取主 HUD 元素的引用
     */
    private cacheMainHUDElements(): void {
        if (!this.mainHUD) return;

        // Status elements
        this.hpBarFill = this.findControlByName<GUI.Rectangle>("HP_Bar_Fill");
        this.vpBarFill = this.findControlByName<GUI.Rectangle>("VP_Bar_Fill");
        this.expBarFill = this.findControlByName<GUI.Rectangle>("Exp_Bar_Fill");
        this.levelText = this.findControlByName<GUI.TextBlock>("LevelText");
        this.wantedIndicator = this.findControlByName<GUI.Ellipse>("Wanted");

        // Minimap
        this.minimapContainer = this.findControlByName<GUI.Ellipse>("MinimapContainer");
        this.locationName = this.findControlByName<GUI.TextBlock>("LocationName");

        // Chat
        this.chatContainer = this.findControlByName<GUI.Rectangle>("ChatContainer");
        this.chatTabs = this.findControlByName<GUI.StackPanel>("ChatTabs");
        this.chatScroll = this.findControlByName<GUI.ScrollViewer>("ChatScroll");
        this.chatInput = this.findControlByName<GUI.InputText>("ChatInput");

        // Create chat content container inside scroll viewer
        if (this.chatScroll) {
            this.chatContent = new GUI.StackPanel();
            this.chatContent.isVertical = true;
            this.chatContent.width = "100%";
            this.chatContent.adaptHeightToChildren = true;
            this.chatScroll.addControl(this.chatContent);
        }

        // Shortcut slots
        for (let i = 1; i <= 10; i++) {
            const slot = this.findControlByName<GUI.Button>(`slot${i}`);
            if (slot) {
                this.shortcutSlots.push(slot);
            }
        }

        // Action Menu
        this.actionMenuContainer = this.findControlByName<GUI.Rectangle>("ActionMenuContainer");

        // Money
        this.moneyText = this.findControlByName<GUI.TextBlock>("MoneyText");
    }

    /**
     * 從 JSON 載入 Popup
     */
    private async loadPopup(): Promise<void> {
        try {
            // Fetch the popup UI JSON
            const response = await fetch("/ui/popup.json");
            const jsonData = await response.json();

            // Parse the UI from JSON
            if (jsonData.root) {
                this.popupRoot = this.parseGUIElement(jsonData.root) as GUI.Container;

                if (this.popupRoot) {
                    // Add to UI texture but hidden by default
                    this.uiTexture.addControl(this.popupRoot);
                    this.popupRoot.isVisible = false;
                    // Phase 10.1: 設置高 zIndex 確保 popup 在其他 UI 之上
                    this.popupRoot.zIndex = 100;

                    // Cache popup elements
                    this.popupContainer = this.findControlInContainer<GUI.Rectangle>(this.popupRoot, "PopupContainer");
                    this.popupTitle = this.findControlInContainer<GUI.TextBlock>(this.popupRoot, "txt_title");
                    this.popupScrollViewer = this.findControlInContainer<GUI.ScrollViewer>(this.popupRoot, "ScrollViewer");

                    // Phase 10.1: 確保 ScrollViewer 可以正確處理點擊事件
                    if (this.popupScrollViewer) {
                        this.popupScrollViewer.isPointerBlocker = true;
                    }

                    // Create content container inside scroll viewer
                    if (this.popupScrollViewer) {
                        this.popupContent = new GUI.StackPanel();
                        this.popupContent.isVertical = true;
                        this.popupContent.width = "100%";
                        this.popupContent.adaptHeightToChildren = true;
                        this.popupScrollViewer.addControl(this.popupContent);
                    }

                    // Setup close button
                    const closeBtn = this.findControlInContainer<GUI.Button>(this.popupRoot, "btn_close");
                    if (closeBtn) {
                        closeBtn.onPointerClickObservable.add(() => {
                            this.hidePopup();
                        });
                    }
                }
            }

            console.log("✅ Popup loaded from JSON");
        } catch (error) {
            console.error("❌ Failed to load popup:", error);
        }
    }

    /**
     * 設置事件處理器
     */
    private setupEventHandlers(): void {
        // Chat tabs
        const tabAll = this.findControlByName<GUI.Button>("tab_all");
        const tabWorld = this.findControlByName<GUI.Button>("tab_world");
        const tabGuild = this.findControlByName<GUI.Button>("tab_guild");
        const tabPrivate = this.findControlByName<GUI.Button>("tab_private");

        tabAll?.onPointerClickObservable.add(() => this.switchChatChannel("all"));
        tabWorld?.onPointerClickObservable.add(() => this.switchChatChannel("world"));
        tabGuild?.onPointerClickObservable.add(() => this.switchChatChannel("guild"));
        tabPrivate?.onPointerClickObservable.add(() => this.switchChatChannel("private"));

        // Chat input
        if (this.chatInput) {
            this.chatInput.onKeyboardEventProcessedObservable.add((evt) => {
                if (evt.key === "Enter" && this.chatInput?.text.trim()) {
                    this.sendChatMessage(this.chatInput.text.trim());
                    this.chatInput.text = "";
                }
            });
        }

        // Action menu buttons
        const btnCharacter = this.findControlByName<GUI.Button>("btn_character");
        const btnSkills = this.findControlByName<GUI.Button>("btn_skills");
        const btnInventory = this.findControlByName<GUI.Button>("btn_inventory");
        const btnQuest = this.findControlByName<GUI.Button>("btn_quest");
        const btnSocial = this.findControlByName<GUI.Button>("btn_social");
        const btnSystem = this.findControlByName<GUI.Button>("btn_system");

        btnCharacter?.onPointerClickObservable.add(() => this.showPopup("角色", "character"));
        btnSkills?.onPointerClickObservable.add(() => this.showPopup("技能", "skills"));
        btnInventory?.onPointerClickObservable.add(() => this.showPopup("道具", "inventory"));
        btnQuest?.onPointerClickObservable.add(() => this.showPopup("任務", "quest"));
        btnSocial?.onPointerClickObservable.add(() => this.showPopup("社交", "social"));
        btnSystem?.onPointerClickObservable.add(() => this.showPopup("設定", "system"));

        // Shortcut slots
        this.shortcutSlots.forEach((slot, index) => {
            slot.onPointerClickObservable.add(() => {
                this.useShortcutSlot(index);
            });
        });
    }

    /**
     * 在主 HUD 中尋找控件
     */
    private findControlByName<T extends GUI.Control>(name: string): T | null {
        if (!this.mainHUD) return null;
        return this.findControlInContainer<T>(this.mainHUD, name);
    }

    /**
     * 在容器中遞迴尋找控件
     */
    private findControlInContainer<T extends GUI.Control>(container: GUI.Control, name: string): T | null {
        if (container.name === name) {
            return container as T;
        }

        if (container instanceof GUI.Container) {
            for (const child of container.children) {
                const found = this.findControlInContainer<T>(child, name);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * 建立後備 HUD（當 JSON 載入失敗時）
     */
    private createFallbackHUD(): void {
        console.log("⚠️ Creating fallback HUD");

        // Create a basic container
        const mainContainer = new GUI.Rectangle();
        mainContainer.name = "MainHUD";
        mainContainer.width = "100%";
        mainContainer.height = "100%";
        mainContainer.thickness = 0;
        this.uiTexture.addControl(mainContainer);
        this.mainHUD = mainContainer;

        // Create basic status container
        const statusContainer = new GUI.Rectangle();
        statusContainer.name = "StatusContainer";
        statusContainer.width = "260px";
        statusContainer.height = "120px";
        statusContainer.background = "rgba(0,0,0,0.4)";
        statusContainer.thickness = 0;
        statusContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        statusContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        statusContainer.left = "10px";
        statusContainer.top = "10px";
        mainContainer.addControl(statusContainer);

        // HP Bar
        const hpBg = new GUI.Rectangle();
        hpBg.name = "HP_Bar_BG";
        hpBg.width = "170px";
        hpBg.height = "10px";
        hpBg.background = "black";
        hpBg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.left = "75px";
        hpBg.top = "0px";
        statusContainer.addControl(hpBg);

        this.hpBarFill = new GUI.Rectangle();
        this.hpBarFill.name = "HP_Bar_Fill";
        this.hpBarFill.width = "90%";
        this.hpBarFill.height = "100%";
        this.hpBarFill.background = "#ff4d4d";
        this.hpBarFill.thickness = 0;
        this.hpBarFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.addControl(this.hpBarFill);

        // Level text
        this.levelText = new GUI.TextBlock();
        this.levelText.name = "LevelText";
        this.levelText.text = "LV 1";
        this.levelText.color = "white";
        this.levelText.fontSize = 14;
        this.levelText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.levelText.left = "80px";
        this.levelText.top = "-30px";
        statusContainer.addControl(this.levelText);
    }

    // ==================== Public API ====================

    /**
     * 更新 HP 條
     */
    updateHP(current: number, max: number): void {
        if (this.hpBarFill) {
            const percent = Math.max(0, Math.min(100, (current / max) * 100));
            this.hpBarFill.width = `${percent}%`;
        }
    }

    /**
     * 更新 VP 條
     */
    updateVP(current: number, max: number): void {
        if (this.vpBarFill) {
            const percent = Math.max(0, Math.min(100, (current / max) * 100));
            this.vpBarFill.width = `${percent}%`;
        }
    }

    /**
     * 更新經驗值條
     */
    updateExp(current: number, max: number): void {
        if (this.expBarFill) {
            const percent = Math.max(0, Math.min(100, (current / max) * 100));
            this.expBarFill.width = `${percent}%`;
        }
    }

    /**
     * 更新等級顯示
     */
    updateLevel(level: number): void {
        if (this.levelText) {
            this.levelText.text = `Lv ${level}`;
        }
    }

    /**
     * 更新金錢顯示
     */
    updateMoney(money: number): void {
        if (this.moneyText) {
            this.moneyText.text = `HKD: $${money.toLocaleString()}`;
        }
    }

    /**
     * 設置通緝狀態
     */
    setWanted(isWanted: boolean): void {
        if (this.wantedIndicator) {
            this.wantedIndicator.isVisible = isWanted;
        }
    }

    /**
     * 更新地區名稱
     */
    updateLocationName(name: string): void {
        if (this.locationName) {
            this.locationName.text = name;
        }
    }

    /**
     * 更新小地圖邊框顏色
     */
    updateMinimapZoneColor(zoneType: "safe" | "enemy" | "neutral"): void {
        if (this.minimapContainer) {
            switch (zoneType) {
                case "safe":
                    this.minimapContainer.color = "#00ff00"; // 綠色
                    break;
                case "enemy":
                    this.minimapContainer.color = "#ff0000"; // 紅色
                    break;
                default:
                    this.minimapContainer.color = "#ffd700"; // 黃色
                    break;
            }
        }
    }

    /**
     * 切換聊天頻道
     */
    switchChatChannel(channel: string): void {
        this.currentChatChannel = channel;

        // Update tab appearances
        const tabs = ["tab_all", "tab_world", "tab_guild", "tab_private"];
        tabs.forEach((tabName) => {
            const tab = this.findControlByName<GUI.Button>(tabName);
            if (tab) {
                const isActive = tabName === `tab_${channel}`;
                tab.background = isActive ? "#444" : "#222";
            }
        });

        console.log(`📢 Switched to chat channel: ${channel}`);
    }

    /**
     * 發送聊天訊息
     */
    private sendChatMessage(text: string): void {
        if (!this.room) return;

        // 服務器期望純字符串格式
        this.room.send("chat", text);
    }

    /**
     * 添加聊天訊息到顯示區
     */
    addChatMessage(sender: string, text: string, channel: string = "world"): void {
        if (!this.chatContent) return;

        // Check if this message should be shown in current channel
        if (this.currentChatChannel !== "all" && this.currentChatChannel !== channel) {
            return;
        }

        const msgBlock = new GUI.TextBlock();
        msgBlock.text = `[${channel}] ${sender}: ${text}`;
        msgBlock.color = this.getChatChannelColor(channel);
        msgBlock.fontSize = 12;
        msgBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        msgBlock.height = "20px";
        msgBlock.resizeToFit = true;

        this.chatContent.addControl(msgBlock);

        // Auto-scroll to bottom
        if (this.chatScroll) {
            this.chatScroll.verticalBar.value = 1;
        }

        // Limit message count
        while (this.chatContent.children.length > 100) {
            this.chatContent.removeControl(this.chatContent.children[0]);
        }
    }

    /**
     * 獲取頻道顏色
     */
    private getChatChannelColor(channel: string): string {
        switch (channel) {
            case "world":
                return "#ffffff";
            case "guild":
                return "#00ff00";
            case "private":
                return "#ff69b4";
            default:
                return "#cccccc";
        }
    }

    /**
     * 使用快捷欄槽位
     */
    private useShortcutSlot(index: number): void {
        console.log(`🎯 Shortcut slot ${index + 1} activated`);
        // TODO: Implement shortcut slot usage
        if (this.room) {
            this.room.send("use_shortcut", { slot: index });
        }
    }

    /**
     * 設置快捷欄槽位
     */
    setShortcutSlot(index: number, iconUrl?: string, cooldown?: number): void {
        if (index < 0 || index >= this.shortcutSlots.length) return;

        const slot = this.shortcutSlots[index];
        if (!slot) return;

        // TODO: Set icon and cooldown display
        if (cooldown && cooldown > 0) {
            slot.alpha = 0.5;
        } else {
            slot.alpha = 1;
        }
    }

    /**
     * 顯示 Popup
     */
    showPopup(title: string, type: string): void {
        if (!this.popupRoot) return;

        if (this.popupTitle) {
            this.popupTitle.text = title;
        }

        // Clear previous content
        if (this.popupContent) {
            this.popupContent.clearControls();

            // Phase 10: Handle quest popup with QuestSystem
            if (type === "quest" && this.questSystem) {
                const questControls = this.questSystem.createQuestPopupContent();
                questControls.forEach((control) => {
                    this.popupContent!.addControl(control);
                });
            }
            // Phase 11: Handle shop popup (only when interacting with shop NPC)
            else if (type === "shop" && this.shopPopupSystem) {
                const shopControls = this.shopPopupSystem.createShopPopupContent();
                shopControls.forEach((control) => {
                    this.popupContent!.addControl(control);
                });
            }
            // Phase 11: Handle inventory popup (only shows picked up items)
            else if (type === "inventory" && this.shopPopupSystem) {
                const inventoryControls = this.shopPopupSystem.createInventoryPopupContent();
                inventoryControls.forEach((control) => {
                    this.popupContent!.addControl(control);
                });
            } else {
                // Add placeholder content based on type
                const placeholder = new GUI.TextBlock();
                placeholder.text = `${title}功能開發中...`;
                placeholder.color = "#666666";
                placeholder.fontSize = 18;
                placeholder.height = "50px";
                this.popupContent.addControl(placeholder);
            }
        }

        this.popupRoot.isVisible = true;
        this.currentPopupType = type; // Phase 11: 記錄當前 popup 類型
        console.log(`📋 Popup opened: ${type}`);
    }

    /**
     * 隱藏 Popup
     */
    hidePopup(): void {
        if (this.popupRoot) {
            this.popupRoot.isVisible = false;
        }
        this.currentPopupType = null; // Phase 11: 清除 popup 類型
    }

    /**
     * 刷新當前打開的 Popup (Phase 11)
     */
    private refreshCurrentPopup(): void {
        if (this.currentPopupType && this.popupRoot?.isVisible) {
            // 重新生成 popup 內容
            if (this.currentPopupType === "inventory") {
                this.showPopup("道具", "inventory");
            } else if (this.currentPopupType === "shop") {
                this.showPopup("商店", "shop");
            }
        }
    }

    /**
     * 設置 Popup 內容
     */
    setPopupContent(content: GUI.Control[]): void {
        if (!this.popupContent) return;

        this.popupContent.clearControls();
        content.forEach((control) => {
            this.popupContent!.addControl(control);
        });
    }

    /**
     * 獲取 UI Texture（供其他系統使用）
     */
    getUITexture(): GUI.AdvancedDynamicTexture {
        return this.uiTexture;
    }

    /**
     * 獲取 Popup 內容面板（供其他系統使用）
     */
    getPopupContent(): GUI.StackPanel | null {
        return this.popupContent;
    }

    /**
     * 更新任務狀態 (Phase 10)
     */
    updateQuestState(quest: IQuestState | null): void {
        if (this.questSystem) {
            this.questSystem.updateQuestState(quest);
        }
    }

    /**
     * 獲取任務系統 (Phase 10)
     */
    getQuestSystem(): QuestSystem | null {
        return this.questSystem;
    }

    /**
     * 更新商店系統的金錢 (Phase 10.1)
     */
    updateShopMoney(money: number): void {
        if (this.shopPopupSystem) {
            this.shopPopupSystem.updateMoney(money);
        }
    }

    /**
     * 更新商店系統的背包 (Phase 10.1)
     */
    updateShopInventory(inventory: IItem[]): void {
        if (this.shopPopupSystem) {
            this.shopPopupSystem.updateInventory(inventory);
            // Phase 11: 如果道具 popup 正在顯示，刷新它
            this.refreshCurrentPopup();
        }
    }

    /**
     * 顯示商店 popup (Phase 11) - 只有跟商店 NPC 互動才會顯示
     */
    showShopPopup(): void {
        this.showPopup("商店", "shop");
    }

    /**
     * 顯示道具 popup (Phase 11) - 只顯示拾取的道具
     */
    showInventoryPopup(): void {
        this.showPopup("道具", "inventory");
    }

    /**
     * 添加最近獲得的物品 (Phase 11)
     */
    addRecentlyAcquired(item: IItem, isCurrency: boolean = false): void {
        if (this.shopPopupSystem) {
            this.shopPopupSystem.addRecentlyAcquired(item, isCurrency);
        }
    }

    /**
     * 釋放資源
     */
    dispose(): void {
        if (this.mainHUD) {
            this.uiTexture.removeControl(this.mainHUD);
        }
        if (this.popupRoot) {
            this.uiTexture.removeControl(this.popupRoot);
        }
        // Phase 10: Dispose Quest System
        if (this.questSystem) {
            this.questSystem.dispose();
        }
    }
}
