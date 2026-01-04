import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { PlayerUIElements } from "../types";

/**
 * UI系統
 * 負責玩家UI元素的創建和更新（名字標籤、血條、戰鬥指示器）
 */
export class UISystem {
    private uiTexture: GUI.AdvancedDynamicTexture;

    constructor(uiTexture: GUI.AdvancedDynamicTexture) {
        this.uiTexture = uiTexture;
    }

    /**
     * 為玩家創建UI元素（名字標籤 + 血條 + 戰鬥指示器）
     */
    createPlayerUI(mesh: BABYLON.AbstractMesh, name: string): PlayerUIElements {
        const container = new GUI.Rectangle();
        container.width = "120px";
        container.height = "60px";
        container.thickness = 0;
        this.uiTexture.addControl(container);
        container.linkWithMesh(mesh);
        container.linkOffsetY = -120;

        // Combat Indicator (Sword emoji)
        const combatIndicator = new GUI.TextBlock();
        combatIndicator.text = "⚔️";
        combatIndicator.color = "red";
        combatIndicator.fontSize = 24;
        combatIndicator.top = "-25px";
        combatIndicator.isVisible = false; // Hidden by default
        container.addControl(combatIndicator);

        // Name - 只顯示名字，不加等級或頭銜
        const nameLabel = new GUI.TextBlock();
        nameLabel.text = name;
        nameLabel.color = "white";
        nameLabel.fontSize = 14;
        nameLabel.top = "0px";
        nameLabel.shadowBlur = 3;
        nameLabel.shadowColor = "black";
        container.addControl(nameLabel);

        // HP Bar Background (Red)
        const hpBg = new GUI.Rectangle();
        hpBg.width = "80px";
        hpBg.height = "8px";
        hpBg.color = "black";
        hpBg.thickness = 1;
        hpBg.background = "red";
        hpBg.top = "20px";
        container.addControl(hpBg);

        // HP Bar Foreground (Green)
        const hpFg = new GUI.Rectangle();
        hpFg.width = "80px"; // Start full
        hpFg.height = "8px";
        hpFg.thickness = 0;
        hpFg.background = "#00FF00";
        hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.addControl(hpFg);

        return { container, hpFg, hpBg, combatIndicator, nameLabel };
    }

    /**
     * 更新血條
     */
    updateHealthBar(ui: PlayerUIElements, currentHp: number, maxHp: number): void {
        const percent = Math.max(0, currentHp / maxHp);
        ui.hpFg.width = `${percent * 80}px`;
    }

    /**
     * 設置戰鬥指示器可見性
     */
    setCombatIndicator(ui: PlayerUIElements, visible: boolean): void {
        ui.combatIndicator.isVisible = visible;
    }

    /**
     * 為實體創建UI（玩家或敵人）
     * @param mesh - 3D 模型
     * @param name - 名稱
     * @param isEnemy - 是否為敵人
     * @param level - 等級（僅敵人使用）
     */
    createEntityUI(
        mesh: BABYLON.Mesh,
        name: string,
        isEnemy: boolean,
        level: number = 1
    ): { container: GUI.Rectangle; hpFg: GUI.Rectangle; nameLabel: GUI.TextBlock } {
        const container = new GUI.Rectangle();
        container.width = "120px";
        container.height = "50px";
        container.thickness = 0;
        this.uiTexture.addControl(container);
        container.linkWithMesh(mesh);
        container.linkOffsetY = -130;

        // 名稱標籤
        const nameLabel = new GUI.TextBlock();
        if (isEnemy) {
            nameLabel.text = `${name} (Lv${level})`;
            nameLabel.color = "#FF4444";
        } else {
            // 玩家：只顯示名字
            nameLabel.text = name;
            nameLabel.color = "white";
        }
        nameLabel.fontSize = 12;
        nameLabel.top = "-15px";
        nameLabel.shadowBlur = 2;
        container.addControl(nameLabel);

        // 血條背景
        const hpBg = new GUI.Rectangle();
        hpBg.width = "80px";
        hpBg.height = "8px";
        hpBg.background = "red";
        hpBg.thickness = 1;
        hpBg.color = "black";
        hpBg.top = "5px";
        container.addControl(hpBg);

        // 血條前景
        const hpFg = new GUI.Rectangle();
        hpFg.width = "80px";
        hpFg.height = "8px";
        hpFg.background = isEnemy ? "orange" : "#00FF00"; // 敵人橘色，玩家綠色
        hpFg.thickness = 0;
        hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.addControl(hpFg);

        return { container, hpFg, nameLabel };
    }

    /**
     * 更新玩家名字
     */
    updatePlayerName(nameLabel: GUI.TextBlock | undefined, name: string): void {
        if (!nameLabel) return;
        nameLabel.text = name;
    }
}
