import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { SHOP_ITEMS, IItem } from "@gangs-online/shared";

/**
 * 商店 Popup 系統 (Phase 10.1)
 * 整合商店和道具到統一的 popup 介面
 */
export class ShopPopupSystem {
    private room: Room;
    private currentTab: "shop" | "inventory" = "shop";
    private playerMoney: number = 0;
    private playerInventory: IItem[] = [];

    constructor(room: Room) {
        this.room = room;
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
     * 創建道具 Popup 內容（包含商店和背包分頁）
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

        // 分頁按鈕
        const tabPanel = new GUI.StackPanel();
        tabPanel.isVertical = false;
        tabPanel.height = "45px";
        tabPanel.spacing = 10;
        mainPanel.addControl(tabPanel);

        const shopTab = GUI.Button.CreateSimpleButton("shopTab", "🏪 商店");
        shopTab.width = "120px";
        shopTab.height = "40px";
        shopTab.color = "white";
        shopTab.background = this.currentTab === "shop" ? "#1E90FF" : "#444444";
        shopTab.cornerRadius = 5;
        shopTab.fontSize = 16;
        shopTab.onPointerUpObservable.add(() => {
            this.currentTab = "shop";
            // 需要重新渲染
        });
        tabPanel.addControl(shopTab);

        const inventoryTab = GUI.Button.CreateSimpleButton("inventoryTab", "🎒 背包");
        inventoryTab.width = "120px";
        inventoryTab.height = "40px";
        inventoryTab.color = "white";
        inventoryTab.background = this.currentTab === "inventory" ? "#1E90FF" : "#444444";
        inventoryTab.cornerRadius = 5;
        inventoryTab.fontSize = 16;
        inventoryTab.onPointerUpObservable.add(() => {
            this.currentTab = "inventory";
            // 需要重新渲染
        });
        tabPanel.addControl(inventoryTab);

        // 分隔線
        const separator = new GUI.Rectangle();
        separator.width = "100%";
        separator.height = "2px";
        separator.background = "#444444";
        separator.thickness = 0;
        mainPanel.addControl(separator);

        // 內容區域
        if (this.currentTab === "shop") {
            const shopContent = this.createShopContent();
            mainPanel.addControl(shopContent);
        } else {
            const inventoryContent = this.createInventoryContent();
            mainPanel.addControl(inventoryContent);
        }

        controls.push(mainPanel);
        return controls;
    }

    /**
     * 創建商店內容
     */
    private createShopContent(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 8;

        // 商店標題
        const title = new GUI.TextBlock();
        title.text = "十三叔雜貨鋪";
        title.color = "#ffd700";
        title.fontSize = 20;
        title.fontWeight = "bold";
        title.height = "35px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(title);

        // 提示信息
        const tip = new GUI.TextBlock();
        tip.text = "💡 走近十三叔 (藍色 NPC) 才能購買";
        tip.color = "#888888";
        tip.fontSize = 14;
        tip.height = "25px";
        tip.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(tip);

        // 商品列表
        SHOP_ITEMS.forEach((item) => {
            const itemPanel = this.createShopItemPanel(item);
            panel.addControl(itemPanel);
        });

        return panel;
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
     * 創建背包內容
     */
    private createInventoryContent(): GUI.Container {
        const panel = new GUI.StackPanel();
        panel.isVertical = true;
        panel.width = "100%";
        panel.spacing = 8;

        // 背包標題
        const title = new GUI.TextBlock();
        title.text = `🎒 背包 (${this.playerInventory.length} 件物品)`;
        title.color = "#ffd700";
        title.fontSize = 20;
        title.fontWeight = "bold";
        title.height = "35px";
        title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.addControl(title);

        if (this.playerInventory.length === 0) {
            // 空背包提示
            const emptyText = new GUI.TextBlock();
            emptyText.text = "背包是空的...\n去打怪或商店買點東西吧！";
            emptyText.color = "#888888";
            emptyText.fontSize = 16;
            emptyText.height = "80px";
            emptyText.textWrapping = true;
            panel.addControl(emptyText);
        } else {
            // 物品列表
            this.playerInventory.forEach((item, index) => {
                const itemPanel = this.createInventoryItemPanel(item, index);
                panel.addControl(itemPanel);
            });
        }

        return panel;
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

    /**
     * 設置當前分頁
     */
    setTab(tab: "shop" | "inventory"): void {
        this.currentTab = tab;
    }

    /**
     * 獲取當前分頁
     */
    getTab(): "shop" | "inventory" {
        return this.currentTab;
    }
}
