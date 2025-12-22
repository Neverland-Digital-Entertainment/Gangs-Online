import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { SHOP_ITEMS, IItem } from "@gangs-online/shared";

/**
 * 最近獲得的物品記錄 (Phase 11)
 */
interface IRecentlyAcquired {
    item: IItem;
    timestamp: number;
    isCurrency: boolean;
}

/**
 * 商店 Popup 系統 (Phase 10.1, Updated in Phase 11)
 * 商店和道具分開為兩個獨立的 UI
 */
export class ShopPopupSystem {
    private room: Room;
    private playerMoney: number = 0;
    private playerInventory: IItem[] = [];
    private recentlyAcquired: IRecentlyAcquired[] = []; // Phase 11: 最近獲得的物品
    private static readonly MAX_RECENT_ITEMS = 5; // 最多顯示 5 個最近獲得的物品
    private static readonly RECENT_ITEM_DURATION = 60000; // 60 秒後自動移除

    constructor(room: Room) {
        this.room = room;
    }

    /**
     * 添加最近獲得的物品 (Phase 11)
     */
    addRecentlyAcquired(item: IItem, isCurrency: boolean = false): void {
        // 移除過期的物品
        this.cleanupExpiredItems();

        // 添加新物品
        this.recentlyAcquired.unshift({
            item,
            timestamp: Date.now(),
            isCurrency,
        });

        // 限制數量
        if (this.recentlyAcquired.length > ShopPopupSystem.MAX_RECENT_ITEMS) {
            this.recentlyAcquired.pop();
        }
    }

    /**
     * 清理過期的物品記錄 (Phase 11)
     */
    private cleanupExpiredItems(): void {
        const now = Date.now();
        this.recentlyAcquired = this.recentlyAcquired.filter(
            (record) => now - record.timestamp < ShopPopupSystem.RECENT_ITEM_DURATION
        );
    }

    /**
     * 獲取最近獲得的物品 (Phase 11)
     */
    getRecentlyAcquired(): IRecentlyAcquired[] {
        this.cleanupExpiredItems();
        return [...this.recentlyAcquired];
    }

    /**
     * 更新玩家金錢
     */
    updateMoney(money: number): void {
        this.playerMoney = money;
    }

    /**
     * 更新玩家背包
     */
    updateInventory(inventory: IItem[]): void {
        this.playerInventory = [...inventory];
    }

    /**
     * 創建商店 Popup 內容（獨立的商店 UI，只有跟 NPC 互動才會顯示）
     */
    createShopPopupContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        // 主容器
        const mainPanel = new GUI.StackPanel();
        mainPanel.isVertical = true;
        mainPanel.width = "100%";
        mainPanel.spacing = 10;
        mainPanel.paddingTop = "10px";

        // 金錢顯示
        const moneyPanel = new GUI.Rectangle();
        moneyPanel.width = "100%";
        moneyPanel.height = "40px";
        moneyPanel.background = "rgba(50, 50, 50, 0.8)";
        moneyPanel.thickness = 0;
        moneyPanel.cornerRadius = 5;
        mainPanel.addControl(moneyPanel);

        const moneyText = new GUI.TextBlock();
        moneyText.text = `💰 現金: $${this.playerMoney.toLocaleString()}`;
        moneyText.color = "#ffd700";
        moneyText.fontSize = 18;
        moneyText.fontWeight = "bold";
        moneyPanel.addControl(moneyText);

        // 商店標題
        const title = new GUI.TextBlock();
        title.text = "🏪 十三叔雜貨鋪";
        title.color = "#ffd700";
        title.fontSize = 22;
        title.fontWeight = "bold";
        title.height = "40px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        mainPanel.addControl(title);

        // 提示信息
        const tip = new GUI.TextBlock();
        tip.text = "歡迎光臨！有咩可以幫到你？";
        tip.color = "#888888";
        tip.fontSize = 14;
        tip.height = "25px";
        tip.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        mainPanel.addControl(tip);

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.width = "100%";
        separator.height = "2px";
        separator.background = "#444444";
        separator.thickness = 0;
        mainPanel.addControl(separator);

        // 商品列表
        SHOP_ITEMS.forEach((item) => {
            const itemPanel = this.createShopItemPanel(item);
            mainPanel.addControl(itemPanel);
        });

        controls.push(mainPanel);
        return controls;
    }

    /**
     * 創建道具 Popup 內容（獨立的背包 UI，只顯示拾取的道具）
     */
    createInventoryPopupContent(): GUI.Control[] {
        const controls: GUI.Control[] = [];

        // 主容器
        const mainPanel = new GUI.StackPanel();
        mainPanel.isVertical = true;
        mainPanel.width = "100%";
        mainPanel.spacing = 10;
        mainPanel.paddingTop = "10px";

        // 金錢顯示
        const moneyPanel = new GUI.Rectangle();
        moneyPanel.width = "100%";
        moneyPanel.height = "40px";
        moneyPanel.background = "rgba(50, 50, 50, 0.8)";
        moneyPanel.thickness = 0;
        moneyPanel.cornerRadius = 5;
        mainPanel.addControl(moneyPanel);

        const moneyText = new GUI.TextBlock();
        moneyText.text = `💰 現金: $${this.playerMoney.toLocaleString()}`;
        moneyText.color = "#ffd700";
        moneyText.fontSize = 18;
        moneyText.fontWeight = "bold";
        moneyPanel.addControl(moneyText);

        // === Phase 11: 最近獲得的物品區域 ===
        const recentItems = this.getRecentlyAcquired();
        if (recentItems.length > 0) {
            const recentSection = this.createRecentlyAcquiredSection(recentItems);
            mainPanel.addControl(recentSection);

            // 分隔線
            const separator = new GUI.Rectangle();
            separator.width = "100%";
            separator.height = "2px";
            separator.background = "#444444";
            separator.thickness = 0;
            mainPanel.addControl(separator);
        }

        // 背包標題
        const title = new GUI.TextBlock();
        title.text = `🎒 背包 (${this.playerInventory.length} 件物品)`;
        title.color = "#ffd700";
        title.fontSize = 20;
        title.fontWeight = "bold";
        title.height = "35px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        mainPanel.addControl(title);

        if (this.playerInventory.length === 0 && recentItems.length === 0) {
            // 空背包提示
            const emptyText = new GUI.TextBlock();
            emptyText.text = "背包是空的...\n去打怪掉落道具吧！";
            emptyText.color = "#888888";
            emptyText.fontSize = 16;
            emptyText.height = "80px";
            emptyText.textWrapping = true;
            mainPanel.addControl(emptyText);
        } else if (this.playerInventory.length === 0) {
            // 有最近獲得但背包是空的
            const emptyText = new GUI.TextBlock();
            emptyText.text = "背包目前是空的";
            emptyText.color = "#888888";
            emptyText.fontSize = 14;
            emptyText.height = "30px";
            mainPanel.addControl(emptyText);
        } else {
            // 物品列表
            this.playerInventory.forEach((item, index) => {
                const itemPanel = this.createInventoryItemPanel(item, index);
                mainPanel.addControl(itemPanel);
            });
        }

        controls.push(mainPanel);
        return controls;
    }

    /**
     * 創建單個商品面板
     */
    private createShopItemPanel(item: { id: string; name: string; price: number; value: number }): GUI.Container {
        const container = new GUI.Rectangle();
        container.width = "100%";
        container.height = "70px";
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
        infoPanel.width = "70%";
        infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.paddingLeft = "15px";
        contentPanel.addControl(infoPanel);

        const nameText = new GUI.TextBlock();
        nameText.text = item.name;
        nameText.color = "white";
        nameText.fontSize = 16;
        nameText.height = "25px";
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(nameText);

        const descText = new GUI.TextBlock();
        descText.text = `❤️ 回復 ${item.value} HP`;
        descText.color = "#90EE90";
        descText.fontSize = 14;
        descText.height = "20px";
        descText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(descText);

        // 右側：價格和購買按鈕
        const buyBtn = GUI.Button.CreateSimpleButton(`buy_${item.id}`, `$${item.price}`);
        buyBtn.width = "90px";
        buyBtn.height = "45px";
        buyBtn.color = "white";
        buyBtn.background = this.playerMoney >= item.price ? "#228B22" : "#8B0000";
        buyBtn.cornerRadius = 5;
        buyBtn.fontSize = 18;
        buyBtn.fontWeight = "bold";
        buyBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        buyBtn.left = "-15px";
        buyBtn.onPointerUpObservable.add(() => {
            this.room.send("buy", item.id);
        });
        contentPanel.addControl(buyBtn);

        return container;
    }

    /**
     * 創建最近獲得物品區域 (Phase 11)
     */
    private createRecentlyAcquiredSection(recentItems: IRecentlyAcquired[]): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 5;

        // 標題
        const title = new GUI.TextBlock();
        title.text = "✨ 最近獲得";
        title.color = "#00ffaa";
        title.fontSize = 18;
        title.fontWeight = "bold";
        title.height = "30px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(title);

        // 最近獲得的物品列表
        recentItems.forEach((record) => {
            const itemPanel = this.createRecentItemPanel(record);
            panel.addControl(itemPanel);
        });

        return panel;
    }

    /**
     * 創建單個最近獲得物品面板 (Phase 11)
     */
    private createRecentItemPanel(record: IRecentlyAcquired): GUI.Container {
        const container = new GUI.Rectangle();
        container.width = "100%";
        container.height = "45px";
        container.background = record.isCurrency ? "rgba(255, 215, 0, 0.15)" : "rgba(0, 255, 170, 0.15)";
        container.thickness = 1;
        container.color = record.isCurrency ? "#ffd700" : "#00ffaa";
        container.cornerRadius = 5;

        const contentPanel = new GUI.StackPanel();
        contentPanel.isVertical = false;
        contentPanel.width = "100%";
        container.addControl(contentPanel);

        // 物品圖示
        const icon = new GUI.TextBlock();
        icon.text = record.isCurrency ? "💰" : "📦";
        icon.fontSize = 20;
        icon.width = "40px";
        icon.height = "40px";
        contentPanel.addControl(icon);

        // 物品名稱和描述
        const infoPanel = new GUI.StackPanel();
        infoPanel.isVertical = true;
        infoPanel.width = "calc(100% - 80px)";
        contentPanel.addControl(infoPanel);

        const nameText = new GUI.TextBlock();
        nameText.text = record.item.name;
        nameText.color = "white";
        nameText.fontSize = 14;
        nameText.height = "20px";
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(nameText);

        const descText = new GUI.TextBlock();
        if (record.isCurrency) {
            descText.text = `+$${record.item.value}`;
            descText.color = "#ffd700";
        } else {
            descText.text = record.item.type === "consumable" ? `❤️ +${record.item.value} HP` : record.item.name;
            descText.color = "#90EE90";
        }
        descText.fontSize = 12;
        descText.height = "18px";
        descText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(descText);

        // 時間戳
        const timeText = new GUI.TextBlock();
        const secondsAgo = Math.floor((Date.now() - record.timestamp) / 1000);
        timeText.text = secondsAgo < 5 ? "剛剛" : `${secondsAgo}秒前`;
        timeText.color = "#888888";
        timeText.fontSize = 11;
        timeText.width = "50px";
        timeText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        contentPanel.addControl(timeText);

        return container;
    }

    /**
     * 創建單個背包物品面板
     */
    private createInventoryItemPanel(item: IItem, index: number): GUI.Container {
        const container = new GUI.Rectangle();
        container.width = "100%";
        container.height = "60px";
        container.background = "rgba(60, 60, 60, 0.8)";
        container.thickness = 1;
        container.color = "#555555";
        container.cornerRadius = 5;

        const contentPanel = new GUI.StackPanel();
        contentPanel.isVertical = false;
        contentPanel.width = "100%";
        container.addControl(contentPanel);

        // 左側：物品信息
        const infoPanel = new GUI.StackPanel();
        infoPanel.isVertical = true;
        infoPanel.width = "70%";
        infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.paddingLeft = "15px";
        contentPanel.addControl(infoPanel);

        const nameText = new GUI.TextBlock();
        nameText.text = item.name;
        nameText.color = "white";
        nameText.fontSize = 16;
        nameText.height = "25px";
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(nameText);

        const descText = new GUI.TextBlock();
        descText.text = item.type === "consumable" ? `❤️ 回復 ${item.value} HP` : `💰 價值 $${item.value}`;
        descText.color = item.type === "consumable" ? "#90EE90" : "#ffd700";
        descText.fontSize = 14;
        descText.height = "20px";
        descText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        infoPanel.addControl(descText);

        // 右側：使用按鈕（僅消耗品）
        if (item.type === "consumable") {
            const useBtn = GUI.Button.CreateSimpleButton(`use_${index}`, "使用");
            useBtn.width = "80px";
            useBtn.height = "40px";
            useBtn.color = "white";
            useBtn.background = "#1E90FF";
            useBtn.cornerRadius = 5;
            useBtn.fontSize = 16;
            useBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            useBtn.left = "-15px";
            useBtn.onPointerUpObservable.add(() => {
                this.room.send("useItem", index);
            });
            contentPanel.addControl(useBtn);
        }

        return container;
    }
}
