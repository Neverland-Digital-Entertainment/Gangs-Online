import * as GUI from "@babylonjs/gui";
import * as Client from "colyseus.js";
import { SHOP_ITEMS } from "@gangs-online/shared";

/**
 * ShopSystem - 商店 UI 系統 (Phase 9)
 *
 * 功能：
 * - 顯示商店面板
 * - 列出可購買的物品
 * - 處理購買請求
 */
export class ShopSystem {
    private shopPanel: GUI.Rectangle;
    private isVisible: boolean = false;

    constructor(room: Client.Room, uiTexture: GUI.AdvancedDynamicTexture) {
        this.shopPanel = this.createShopUI(room, uiTexture);
    }

    /**
     * 創建商店 UI
     */
    private createShopUI(room: Client.Room, uiTexture: GUI.AdvancedDynamicTexture): GUI.Rectangle {
        // 主面板
        const panel = new GUI.Rectangle();
        panel.width = "350px";
        panel.height = "300px";
        panel.background = "rgba(0, 0, 0, 0.9)";
        panel.color = "gold";
        panel.thickness = 3;
        panel.cornerRadius = 10;
        panel.isVisible = false;
        panel.top = "-50px";
        uiTexture.addControl(panel);

        // 標題
        const title = new GUI.TextBlock();
        title.text = "十三叔雜貨鋪 (Shop)";
        title.color = "gold";
        title.fontSize = 24;
        title.fontWeight = "bold";
        title.height = "40px";
        title.top = "-120px";
        panel.addControl(title);

        // 關閉按鈕
        const closeBtn = GUI.Button.CreateSimpleButton("closeShop", "✖");
        closeBtn.width = "40px";
        closeBtn.height = "40px";
        closeBtn.color = "white";
        closeBtn.background = "red";
        closeBtn.cornerRadius = 5;
        closeBtn.fontSize = 20;
        closeBtn.left = "145px";
        closeBtn.top = "-125px";
        closeBtn.onPointerUpObservable.add(() => {
            this.hide();
        });
        panel.addControl(closeBtn);

        // 商品列表容器
        const itemList = new GUI.StackPanel();
        itemList.width = "320px";
        itemList.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        itemList.top = "10px";
        panel.addControl(itemList);

        // 添加商品項目
        SHOP_ITEMS.forEach((item) => {
            const itemContainer = new GUI.Rectangle();
            itemContainer.width = "310px";
            itemContainer.height = "60px";
            itemContainer.thickness = 0;
            itemContainer.background = "rgba(40, 40, 40, 0.8)";
            itemContainer.paddingBottom = "10px";

            // 商品名稱
            const nameText = new GUI.TextBlock();
            nameText.text = item.name;
            nameText.color = "white";
            nameText.fontSize = 18;
            nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            nameText.left = "10px";
            nameText.top = "-10px";
            itemContainer.addControl(nameText);

            // 商品描述（恢復量）
            const descText = new GUI.TextBlock();
            descText.text = `回復 ${item.value} HP`;
            descText.color = "lightgreen";
            descText.fontSize = 14;
            descText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            descText.left = "10px";
            descText.top = "10px";
            itemContainer.addControl(descText);

            // 購買按鈕
            const buyBtn = GUI.Button.CreateSimpleButton(`buy_${item.id}`, `$${item.price}`);
            buyBtn.width = "80px";
            buyBtn.height = "40px";
            buyBtn.color = "white";
            buyBtn.background = "green";
            buyBtn.cornerRadius = 5;
            buyBtn.fontSize = 16;
            buyBtn.fontWeight = "bold";
            buyBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            buyBtn.left = "-10px";
            buyBtn.onPointerUpObservable.add(() => {
                room.send("buy", item.id);
            });
            itemContainer.addControl(buyBtn);

            itemList.addControl(itemContainer);
        });

        return panel;
    }

    /**
     * 顯示商店面板
     */
    show(): void {
        this.shopPanel.isVisible = true;
        this.isVisible = true;
    }

    /**
     * 隱藏商店面板
     */
    hide(): void {
        this.shopPanel.isVisible = false;
        this.isVisible = false;
    }

    /**
     * 切換顯示狀態
     */
    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 檢查是否顯示中
     */
    isShowing(): boolean {
        return this.isVisible;
    }
}
