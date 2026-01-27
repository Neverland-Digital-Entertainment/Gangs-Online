import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IShop, IShopItemConfig, IPurchaseRequest, IPurchaseResponse } from "@gangs-online/shared";

/**
 * Enhanced Shop System (Phase 16.3)
 *
 * Features:
 * - Dynamic shop loading from server
 * - Operating hours display
 * - Stock management (global and personal limits)
 * - Price multipliers
 * - Multiple shops support
 */

interface ItemData {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    imageUrl: string;
}

interface ShopItemDisplay extends IShopItemConfig {
    item: ItemData;
}

export class ShopSystemV2 {
    private room: Room;
    private currentShop: IShop | null = null;
    private shopItems: ShopItemDisplay[] = [];
    private playerMoney: number = 0;

    constructor(room: Room) {
        this.room = room;
        this.setupMessageHandlers();
    }

    /**
     * 設置消息處理器
     */
    private setupMessageHandlers(): void {
        // 接收商店數據
        this.room.onMessage("shopData", (data: { shop: IShop; items: ItemData[] }) => {
            console.log("📦 [ShopSystemV2] Received shop data:", data.shop.name);
            this.currentShop = data.shop;

            // 組合商店配置和商品資料
            this.shopItems = data.shop.itemList
                .map((config) => {
                    const item = data.items.find((i) => i.id === config.itemId);
                    if (!item) return null;
                    return {
                        ...config,
                        item,
                    };
                })
                .filter((item): item is ShopItemDisplay => item !== null);
        });

        // 接收購買結果
        this.room.onMessage("purchaseResult", (result: IPurchaseResponse) => {
            if (result.success) {
                console.log("✅ [ShopSystemV2] Purchase successful:", result.message);
                // 商店會自動刷新庫存數據
            } else {
                console.log("❌ [ShopSystemV2] Purchase failed:", result.message);
            }
        });
    }

    /**
     * 請求打開商店
     * @param npcId NPC ID
     * @param shopId Shop ID
     */
    openShop(npcId: string, shopId: string): void {
        console.log(`🏪 [ShopSystemV2] Requesting shop data: ${shopId}`);
        this.room.send("openShop", { npcId, shopId });
    }

    /**
     * 更新玩家金錢
     */
    updateMoney(money: number): void {
        this.playerMoney = money;
    }

    /**
     * 購買商品
     */
    purchaseItem(itemId: string, quantity: number = 1): void {
        if (!this.currentShop) {
            console.warn("⚠️ [ShopSystemV2] No shop is open");
            return;
        }

        const request: IPurchaseRequest = {
            shopId: this.currentShop.id,
            itemId,
            quantity,
        };

        console.log(`💰 [ShopSystemV2] Purchasing item:`, request);
        this.room.send("purchase", request);
    }

    /**
     * 創建商店 Popup 內容（Phase 16.3 版本）
     */
    createShopPopupContent(): GUI.Control[] {
        if (!this.currentShop) {
            return this.createNoShopContent();
        }

        const controls: GUI.Control[] = [];

        // 主容器
        const mainPanel = new GUI.StackPanel();
        mainPanel.isVertical = true;
        mainPanel.width = "100%";
        mainPanel.spacing = 10;
        mainPanel.paddingTop = "10px";

        // 金錢顯示
        const moneyPanel = this.createMoneyPanel();
        mainPanel.addControl(moneyPanel);

        // 商店標題
        const titlePanel = this.createTitlePanel();
        mainPanel.addControl(titlePanel);

        // 營業時間資訊
        if (this.currentShop.operatingHours) {
            const hoursPanel = this.createOperatingHoursPanel();
            mainPanel.addControl(hoursPanel);
        }

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.width = "100%";
        separator.height = "2px";
        separator.background = "#444444";
        separator.thickness = 0;
        mainPanel.addControl(separator);

        // 商品列表
        if (this.shopItems.length === 0) {
            const emptyText = new GUI.TextBlock();
            emptyText.text = "此商店暫無商品...";
            emptyText.color = "#888888";
            emptyText.fontSize = 16;
            emptyText.height = "80px";
            mainPanel.addControl(emptyText);
        } else {
            this.shopItems.forEach((shopItem) => {
                const itemPanel = this.createShopItemPanel(shopItem);
                mainPanel.addControl(itemPanel);
            });
        }

        controls.push(mainPanel);
        return controls;
    }

    /**
     * 創建無商店內容
     */
    private createNoShopContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 10;
        panel.paddingTop = "10px";

        const text = new GUI.TextBlock();
        text.text = "正在載入商店資料...";
        text.color = "#888888";
        text.fontSize = 18;
        text.height = "100px";
        panel.addControl(text);

        controls.push(panel);
        return controls;
    }

    /**
     * 創建金錢面板
     */
    private createMoneyPanel(): GUI.Container {
        const moneyPanel = new GUI.Rectangle();
        moneyPanel.width = "100%";
        moneyPanel.height = "40px";
        moneyPanel.background = "rgba(50, 50, 50, 0.8)";
        moneyPanel.thickness = 0;
        moneyPanel.cornerRadius = 5;

        const moneyText = new GUI.TextBlock();
        moneyText.text = `💰 現金: $${this.playerMoney.toLocaleString()}`;
        moneyText.color = "#ffd700";
        moneyText.fontSize = 18;
        moneyText.fontWeight = "bold";
        moneyPanel.addControl(moneyText);

        return moneyPanel;
    }

    /**
     * 創建標題面板
     */
    private createTitlePanel(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 5;

        const title = new GUI.TextBlock();
        title.text = `🏪 ${this.currentShop!.name}`;
        title.color = "#ffd700";
        title.fontSize = 22;
        title.fontWeight = "bold";
        title.height = "35px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(title);

        if (this.currentShop!.description) {
            const desc = new GUI.TextBlock();
            desc.text = this.currentShop!.description;
            desc.color = "#888888";
            desc.fontSize = 14;
            desc.height = "25px";
            desc.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            panel.addControl(desc);
        }

        return panel;
    }

    /**
     * 創建營業時間面板
     */
    private createOperatingHoursPanel(): GUI.Container {
        const panel = new GUI.Rectangle();
        panel.width = "100%";
        panel.height = "30px";
        panel.background = "rgba(70, 130, 180, 0.2)";
        panel.thickness = 1;
        panel.color = "#4682B4";
        panel.cornerRadius = 5;

        const hours = this.currentShop!.operatingHours!;
        const isOpen = this.isShopOpen();

        const text = new GUI.TextBlock();
        text.text = `⏰ 營業時間: ${hours.start}:00 - ${hours.end}:00 ${isOpen ? "(營業中)" : "(休息中)"}`;
        text.color = isOpen ? "#90EE90" : "#FF6B6B";
        text.fontSize = 14;
        text.fontWeight = "bold";
        panel.addControl(text);

        return panel;
    }

    /**
     * 創建商品面板
     */
    private createShopItemPanel(shopItem: ShopItemDisplay): GUI.Container {
        const container = new GUI.Rectangle();
        container.width = "100%";
        container.height = "90px";
        container.background = "rgba(60, 60, 60, 0.8)";
        container.thickness = 1;
        container.color = "#555555";
        container.cornerRadius = 5;

        const contentPanel = new GUI.StackPanel();
        contentPanel.isVertical = false;
        contentPanel.width = "100%";
        container.addControl(contentPanel);

        // 左側：商品信息
        const infoPanel = new GUI.StackPanel();
        infoPanel.isVertical = true;
        infoPanel.width = "65%";
        infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.paddingLeft = "15px";
        infoPanel.spacing = 3;
        contentPanel.addControl(infoPanel);

        // 商品名稱
        const nameText = new GUI.TextBlock();
        nameText.text = shopItem.item.name;
        nameText.color = "white";
        nameText.fontSize = 16;
        nameText.fontWeight = "bold";
        nameText.height = "22px";
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(nameText);

        // 商品描述
        const descText = new GUI.TextBlock();
        descText.text = shopItem.item.description;
        descText.color = "#AAAAAA";
        descText.fontSize = 13;
        descText.height = "20px";
        descText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(descText);

        // 庫存和限購信息
        const stockText = new GUI.TextBlock();
        const currentStock = shopItem.currentStock ?? shopItem.globalStock;
        const stockInfo: string[] = [];

        if (currentStock === -1) {
            stockInfo.push("庫存: 無限");
        } else {
            const stockColor = currentStock > 10 ? "green" : currentStock > 0 ? "orange" : "red";
            stockInfo.push(`庫存: ${currentStock}`);
        }

        if (shopItem.personalLimit > 0) {
            stockInfo.push(`限購: ${shopItem.personalLimit}`);
        }

        stockText.text = `📦 ${stockInfo.join(" | ")}`;
        stockText.color = "#90EE90";
        stockText.fontSize = 12;
        stockText.height = "18px";
        stockText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(stockText);

        // 右側：價格和購買按鈕
        const rightPanel = new GUI.StackPanel();
        rightPanel.isVertical = true;
        rightPanel.width = "35%";
        rightPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        rightPanel.paddingRight = "15px";
        rightPanel.spacing = 5;
        contentPanel.addControl(rightPanel);

        // 價格顯示
        const basePrice = shopItem.item.price;
        const multiplier = shopItem.priceMultiplier || 1.0;
        const finalPrice = Math.floor(basePrice * multiplier);

        const priceText = new GUI.TextBlock();
        if (multiplier !== 1.0) {
            priceText.text = `$${finalPrice}\n(原價: $${basePrice})`;
            priceText.color = multiplier > 1.0 ? "#FF6B6B" : "#90EE90";
        } else {
            priceText.text = `$${finalPrice}`;
            priceText.color = "#ffd700";
        }
        priceText.fontSize = multiplier !== 1.0 ? 14 : 16;
        priceText.fontWeight = "bold";
        priceText.height = "30px";
        priceText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
        rightPanel.addControl(priceText);

        // 購買按鈕
        const canAfford = this.playerMoney >= finalPrice;
        const hasStock = currentStock === -1 || currentStock > 0;
        const canBuy = canAfford && hasStock && this.isShopOpen();

        const buyBtn = GUI.Button.CreateSimpleButton(`buy_${shopItem.itemId}`, "購買");
        buyBtn.width = "90px";
        buyBtn.height = "40px";
        buyBtn.color = "white";
        buyBtn.background = canBuy ? "#228B22" : "#666666";
        buyBtn.cornerRadius = 5;
        buyBtn.fontSize = 16;
        buyBtn.fontWeight = "bold";
        buyBtn.isEnabled = canBuy;
        buyBtn.onPointerUpObservable.add(() => {
            this.purchaseItem(shopItem.itemId, 1);
        });
        rightPanel.addControl(buyBtn);

        return container;
    }

    /**
     * 檢查商店是否營業中
     */
    private isShopOpen(): boolean {
        if (!this.currentShop || !this.currentShop.operatingHours) {
            return true; // 24小時營業
        }

        const now = new Date();
        const currentHour = now.getUTCHours() + 8; // UTC+8 for Hong Kong
        const adjustedHour = currentHour >= 24 ? currentHour - 24 : currentHour;

        const { start, end } = this.currentShop.operatingHours;

        if (start > end) {
            // 跨午夜
            return adjustedHour >= start || adjustedHour < end;
        } else {
            return adjustedHour >= start && adjustedHour < end;
        }
    }

    /**
     * 獲取當前商店
     */
    getCurrentShop(): IShop | null {
        return this.currentShop;
    }
}
