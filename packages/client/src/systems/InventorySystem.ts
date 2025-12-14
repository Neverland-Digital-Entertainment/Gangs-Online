import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IItem } from "@gangs-online/shared";

/**
 * InventorySystem - Phase 8 (Mobile-friendly)
 * 管理玩家背包介面和物品使用
 */
export class InventorySystem {
    private room: Room;
    private uiTexture: GUI.AdvancedDynamicTexture;
    private panel: GUI.StackPanel;
    private moneyText: GUI.TextBlock;
    private itemList: GUI.StackPanel;
    private currentMoney: number = 0;
    private currentItems: IItem[] = [];
    private isMobile: boolean = false;

    constructor(room: Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.uiTexture = uiTexture;
        this.isMobile = window.innerWidth < 768;

        // 創建主面板
        this.panel = this.createMainPanel();
        this.moneyText = this.createMoneyDisplay();
        this.itemList = this.createItemList();

        this.panel.addControl(this.moneyText);
        this.panel.addControl(this.itemList);
        this.uiTexture.addControl(this.panel);

        // 設置通知監聽器
        this.setupNotificationListener();

        // 視窗大小調整時重新佈局
        window.addEventListener("resize", () => {
            this.handleResize();
        });
    }

    /**
     * 處理視窗大小調整
     */
    private handleResize(): void {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth < 768;

        if (wasMobile !== this.isMobile) {
            // 重新設置面板尺寸
            this.panel.width = this.isMobile ? "90%" : "240px";
            this.panel.paddingBottom = this.isMobile ? "70px" : "20px"; // 手機上避開聊天框
            this.panel.paddingRight = this.isMobile ? "5%" : "20px";

            // 重新渲染背包
            this.updateInventory(this.currentMoney, this.currentItems);
        }
    }

    /**
     * 創建主面板（右下角，Mobile-friendly）
     */
    private createMainPanel(): GUI.StackPanel {
        const panel = new GUI.StackPanel();

        // 響應式寬度
        panel.width = this.isMobile ? "90%" : "240px";
        panel.maxWidth = "400px";

        panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;

        // 手機上需要更多空間避開聊天輸入框
        panel.paddingBottom = this.isMobile ? "70px" : "20px";
        panel.paddingRight = this.isMobile ? "5%" : "20px";
        panel.isVertical = true;

        return panel;
    }

    /**
     * 創建金錢顯示（Mobile-friendly）
     */
    private createMoneyDisplay(): GUI.TextBlock {
        const moneyText = new GUI.TextBlock();
        moneyText.text = "HKD: $0";
        moneyText.color = "gold";
        moneyText.height = this.isMobile ? "40px" : "35px";
        moneyText.fontSize = this.isMobile ? 20 : 22;
        moneyText.fontWeight = "bold";
        moneyText.shadowBlur = 3;
        moneyText.shadowColor = "black";
        moneyText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        moneyText.paddingLeft = "10px";

        return moneyText;
    }

    /**
     * 創建物品列表容器
     */
    private createItemList(): GUI.StackPanel {
        const itemList = new GUI.StackPanel();
        itemList.background = "rgba(0, 0, 0, 0.6)";
        itemList.width = "100%";
        itemList.adaptHeightToChildren = true;
        itemList.paddingTop = "5px";
        itemList.paddingBottom = "5px";

        return itemList;
    }

    /**
     * 更新背包顯示
     */
    updateInventory(money: number, items: IItem[]): void {
        // 更新金錢
        this.currentMoney = money;
        this.moneyText.text = `HKD: $${money}`;

        // 更新物品列表
        this.currentItems = items;
        this.itemList.clearControls();

        if (items.length === 0) {
            // 顯示空背包提示
            const emptyText = new GUI.TextBlock();
            emptyText.text = "背包空空如也...";
            emptyText.color = "gray";
            emptyText.height = "25px";
            emptyText.fontSize = 14;
            this.itemList.addControl(emptyText);
            return;
        }

        // 為每個物品創建按鈕
        items.forEach((item, index) => {
            const itemButton = this.createItemButton(item, index);
            this.itemList.addControl(itemButton);
        });
    }

    /**
     * 創建物品按鈕（Mobile-friendly，觸控友好）
     */
    private createItemButton(item: IItem, index: number): GUI.Button {
        const button = GUI.Button.CreateSimpleButton(
            `item_${index}`,
            `${item.name} ${item.type === "consumable" ? `(+${item.value} HP)` : ""}`
        );

        button.width = "100%";
        // 手機上按鈕更高，方便觸控
        button.height = this.isMobile ? "45px" : "35px";
        button.color = "white";
        button.fontSize = this.isMobile ? 16 : 15;
        button.paddingLeft = "10px";
        button.paddingRight = "10px";

        if (item.type === "consumable") {
            // 消耗品 - 綠色，可點擊使用
            button.background = "rgba(46, 204, 113, 0.3)";
            button.hoverCursor = "pointer";

            button.onPointerEnterObservable.add(() => {
                button.background = "rgba(46, 204, 113, 0.5)";
            });

            button.onPointerOutObservable.add(() => {
                button.background = "rgba(46, 204, 113, 0.3)";
            });

            button.onPointerUpObservable.add(() => {
                this.room.send("useItem", index);
            });
        } else {
            // 其他物品 - 灰色，不可點擊
            button.background = "rgba(100, 100, 100, 0.3)";
        }

        return button;
    }

    /**
     * 設置通知監聽器（顯示拾取和使用物品的通知）
     */
    private setupNotificationListener(): void {
        this.room.onMessage("notification", (text: string) => {
            this.showNotification(text);
        });
    }

    /**
     * 顯示浮動通知（Mobile-friendly）
     */
    private showNotification(text: string): void {
        const notification = new GUI.TextBlock();
        notification.text = text;
        notification.color = "yellow";
        notification.fontSize = this.isMobile ? 20 : 24;
        notification.fontWeight = "bold";
        notification.shadowBlur = 4;
        notification.shadowColor = "black";

        // 手機上位置稍微往上，避免被背包遮擋
        notification.top = this.isMobile ? "-200px" : "-120px";
        notification.height = "40px";

        this.uiTexture.addControl(notification);

        // 2 秒後淡出並移除
        setTimeout(() => {
            if (notification) {
                notification.dispose();
            }
        }, 2000);
    }

    /**
     * 設置玩家的背包監聽器
     */
    setupPlayerInventoryListener(player: any): void {
        // 初始同步
        this.updateInventory(player.money, Array.from(player.inventory));

        // 監聽金錢變化
        player.listen("money", (value: number) => {
            this.updateInventory(value, Array.from(player.inventory));
        });

        // 監聽物品添加
        player.inventory.onAdd(() => {
            this.updateInventory(player.money, Array.from(player.inventory));
        });

        // 監聽物品移除
        player.inventory.onRemove(() => {
            this.updateInventory(player.money, Array.from(player.inventory));
        });

        // 監聽物品變化
        player.inventory.onChange(() => {
            this.updateInventory(player.money, Array.from(player.inventory));
        });
    }

    /**
     * 清理資源
     */
    dispose(): void {
        this.panel.dispose();
    }
}
