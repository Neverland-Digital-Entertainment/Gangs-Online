import * as GUI from "@babylonjs/gui";
import { Room } from "colyseus.js";
import { IItem } from "@gangs-online/shared";

/**
 * InventorySystem - Phase 8
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

    constructor(room: Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.room = room;
        this.uiTexture = uiTexture;

        // 創建主面板
        this.panel = this.createMainPanel();
        this.moneyText = this.createMoneyDisplay();
        this.itemList = this.createItemList();

        this.panel.addControl(this.moneyText);
        this.panel.addControl(this.itemList);
        this.uiTexture.addControl(this.panel);

        // 設置通知監聽器
        this.setupNotificationListener();
    }

    /**
     * 創建主面板（右下角）
     */
    private createMainPanel(): GUI.StackPanel {
        const panel = new GUI.StackPanel();
        panel.width = "220px";
        panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.paddingBottom = "20px";
        panel.paddingRight = "20px";
        panel.isVertical = true;

        return panel;
    }

    /**
     * 創建金錢顯示
     */
    private createMoneyDisplay(): GUI.TextBlock {
        const moneyText = new GUI.TextBlock();
        moneyText.text = "HKD: $0";
        moneyText.color = "gold";
        moneyText.height = "35px";
        moneyText.fontSize = 22;
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
     * 創建物品按鈕
     */
    private createItemButton(item: IItem, index: number): GUI.Button {
        const button = GUI.Button.CreateSimpleButton(
            `item_${index}`,
            `${item.name} ${item.type === "consumable" ? `(+${item.value} HP)` : ""}`
        );

        button.width = "100%";
        button.height = "35px";
        button.color = "white";
        button.fontSize = 15;
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
     * 顯示浮動通知
     */
    private showNotification(text: string): void {
        const notification = new GUI.TextBlock();
        notification.text = text;
        notification.color = "yellow";
        notification.fontSize = 24;
        notification.fontWeight = "bold";
        notification.shadowBlur = 4;
        notification.shadowColor = "black";
        notification.top = "-120px";
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
