import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { PlayerUIElements } from "../types";
import { getRankTitle } from "../utils/progression";

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
     * 為玩家創建UI元素（名字標籤 + 血條 + 戰鬥指示器 + XP條）
     */
    createPlayerUI(mesh: BABYLON.AbstractMesh, name: string): PlayerUIElements {
        const container = new GUI.Rectangle();
        container.width = "160px"; // 加寬以容納更長的頭銜
        container.height = "100px"; // 增高以容納 XP 條
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

        // Name (Phase 7: 將改為顯示頭銜)
        const nameLabel = new GUI.TextBlock();
        nameLabel.text = name;
        nameLabel.color = "white";
        nameLabel.fontSize = 12;
        nameLabel.top = "-10px";
        nameLabel.shadowBlur = 2;
        container.addControl(nameLabel);

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

        // === Phase 7: XP 條 ===
        // XP 條背景
        const xpBg = new GUI.Rectangle();
        xpBg.width = "100px";
        xpBg.height = "4px";
        xpBg.background = "#333333";
        xpBg.thickness = 0;
        xpBg.top = "35px"; // 在血條下方
        container.addControl(xpBg);

        // XP 條前景（黃色）
        const xpFg = new GUI.Rectangle();
        xpFg.width = "0px"; // 初始為空
        xpFg.height = "4px";
        xpFg.background = "#FFD700"; // 金黃色
        xpFg.thickness = 0;
        xpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        xpBg.addControl(xpFg);

        return { container, hpFg, hpBg, combatIndicator, nameLabel, xpFg, xpBg };
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
     * @param level - 等級（Phase 7，可選）
     */
    createEntityUI(
        mesh: BABYLON.Mesh,
        name: string,
        isEnemy: boolean,
        level: number = 1
    ): { container: GUI.Rectangle; hpFg: GUI.Rectangle; nameLabel: GUI.TextBlock; xpFg?: GUI.Rectangle; xpBg?: GUI.Rectangle } {
        const container = new GUI.Rectangle();
        container.width = "160px"; // 加寬以容納更長的頭銜
        container.height = isEnemy ? "60px" : "80px"; // 玩家高度加高以容納 XP 條
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
            // 玩家：顯示 [頭銜] 名稱
            const title = getRankTitle(level);
            nameLabel.text = `[${title}] ${name}`;
            nameLabel.color = "white";
        }
        nameLabel.fontSize = 12;
        nameLabel.top = "-25px";
        nameLabel.shadowBlur = 2;
        container.addControl(nameLabel);

        // 血條背景
        const hpBg = new GUI.Rectangle();
        hpBg.width = "100px";
        hpBg.height = "8px";
        hpBg.background = "red";
        hpBg.thickness = 1;
        hpBg.color = "black";
        hpBg.top = "-5px";
        container.addControl(hpBg);

        // 血條前景
        const hpFg = new GUI.Rectangle();
        hpFg.width = "100px";
        hpFg.height = "8px";
        hpFg.background = isEnemy ? "orange" : "#00FF00"; // 敵人橘色，玩家綠色
        hpFg.thickness = 0;
        hpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        hpBg.addControl(hpFg);

        // === Phase 7: XP 條（僅玩家）===
        let xpFg: GUI.Rectangle | undefined = undefined;
        let xpBg: GUI.Rectangle | undefined = undefined;

        if (!isEnemy) {
            // XP 條背景
            xpBg = new GUI.Rectangle();
            xpBg.width = "100px";
            xpBg.height = "4px";
            xpBg.background = "#333333";
            xpBg.thickness = 0;
            xpBg.top = "5px"; // 在血條下方
            container.addControl(xpBg);

            // XP 條前景（黃色）
            xpFg = new GUI.Rectangle();
            xpFg.width = "0px"; // 初始為空
            xpFg.height = "4px";
            xpFg.background = "#FFD700"; // 金黃色
            xpFg.thickness = 0;
            xpFg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            xpBg.addControl(xpFg);
        }

        return { container, hpFg, nameLabel, xpFg, xpBg };
    }

    /**
     * 更新 XP 條（Phase 7）
     * @param xpFg - XP 條前景
     * @param currentXP - 當前經驗值
     * @param maxXP - 最大經驗值
     */
    updateXPBar(xpFg: GUI.Rectangle | undefined, currentXP: number, maxXP: number): void {
        if (!xpFg) return;
        const percent = Math.max(0, Math.min(1, currentXP / maxXP));
        xpFg.width = `${percent * 100}px`;
    }

    /**
     * 更新玩家頭銜（Phase 7）
     * @param nameLabel - 名稱標籤
     * @param name - 玩家名稱
     * @param level - 等級
     */
    updatePlayerTitle(nameLabel: GUI.TextBlock | undefined, name: string, level: number): void {
        if (!nameLabel) return;
        const title = getRankTitle(level);
        nameLabel.text = `[${title}] ${name}`;
    }
}
