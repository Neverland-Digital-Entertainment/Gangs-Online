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
        container.height = "80px"; // Increased height for combat indicator
        container.thickness = 0;
        this.uiTexture.addControl(container);
        container.linkWithMesh(mesh);
        container.linkOffsetY = -150; // Adjusted for taller container

        // Combat Indicator (Sword emoji)
        const combatIndicator = new GUI.TextBlock();
        combatIndicator.text = "⚔️";
        combatIndicator.color = "red";
        combatIndicator.fontSize = 24;
        combatIndicator.top = "-35px";
        combatIndicator.isVisible = false; // Hidden by default
        container.addControl(combatIndicator);

        // Name
        const label = new GUI.TextBlock();
        label.text = name;
        label.color = "white";
        label.fontSize = 14;
        label.top = "-10px";
        label.shadowBlur = 2;
        container.addControl(label);

        // HP Bar Background (Red)
        const hpBg = new GUI.Rectangle();
        hpBg.width = "100px";
        hpBg.height = "10px";
        hpBg.color = "black";
        hpBg.thickness = 1;
        hpBg.background = "red";
        hpBg.top = "20px";
        container.addControl(hpBg);

        // HP Bar Foreground (Green)
        const hpFg = new GUI.Rectangle();
        hpFg.width = "100px"; // Start full
        hpFg.height = "10px";
        hpFg.thickness = 0;
        hpFg.background = "#00FF00";
        hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.addControl(hpFg);

        return { container, hpFg, hpBg, combatIndicator };
    }

    /**
     * 更新血條
     */
    updateHealthBar(ui: PlayerUIElements, currentHp: number, maxHp: number): void {
        const percent = Math.max(0, currentHp / maxHp);
        ui.hpFg.width = `${percent * 100}px`;
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
     */
    createEntityUI(
        mesh: BABYLON.Mesh,
        name: string,
        isEnemy: boolean
    ): { container: GUI.Rectangle; hpFg: GUI.Rectangle; nameLabel: GUI.TextBlock } {
        const container = new GUI.Rectangle();
        container.width = "120px";
        container.height = "60px";
        container.thickness = 0;
        this.uiTexture.addControl(container);
        container.linkWithMesh(mesh);
        container.linkOffsetY = -130;

        // 名稱標籤
        const nameLabel = new GUI.TextBlock();
        nameLabel.text = name;
        nameLabel.color = isEnemy ? "#FF4444" : "white"; // 敵人紅色，玩家白色
        nameLabel.fontSize = 14;
        nameLabel.top = "-15px";
        nameLabel.shadowBlur = 2;
        container.addControl(nameLabel);

        // 血條背景
        const hpBg = new GUI.Rectangle();
        hpBg.width = "80px";
        hpBg.height = "8px";
        hpBg.background = "red";
        hpBg.thickness = 0;
        hpBg.top = "10px";
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
}
