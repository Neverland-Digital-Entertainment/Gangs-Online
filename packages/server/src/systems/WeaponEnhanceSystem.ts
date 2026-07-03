/**
 * Weapon Enhance System (Phase 21)
 *
 * 武器升級系統：
 * - 無稀有度，同名武器以 +0 ~ +15 區分強弱（顯示如「唐刀 +7」）
 * - 消耗強化石 + 金幣，每級有成功率（權威伺服器運算）
 * - 失敗懲罰：只損失金錢與強化石（不降級、不損毀）
 * - 保底：同一把武器連續失敗 5 次後，下一次必定成功
 * - 每次結果寫入 Firebase weapon_enhance_logs（供 Dashboard 檢視）
 */
import { Client } from "colyseus";
import { Player, Item } from "../rooms/schema/GameState";
import {
    WEAPON_ENHANCE_CONFIG,
    IEnhanceResult,
    IEnhanceLog,
    getWeaponDisplayName,
} from "@gangs-online/shared";
import { getFirestore } from "../services/FirebaseService";

const CFG = WEAPON_ENHANCE_CONFIG;

export class WeaponEnhanceSystem {
    /**
     * 處理武器強化請求（Server 權威）
     */
    handleEnhance(client: Client, player: Player, itemIndex: number): void {
        const result = this.enhance(player, itemIndex);
        client.send("enhanceResult", result);
    }

    private enhance(player: Player, itemIndex: number): IEnhanceResult {
        // 驗證武器
        if (itemIndex < 0 || itemIndex >= player.inventory.length) {
            return { success: false, message: "找不到該武器" };
        }
        const weapon = player.inventory.at(itemIndex);
        if (!weapon || weapon.type !== "weapon") {
            return { success: false, message: "這個物品不是武器" };
        }
        if (weapon.enhanceLevel >= CFG.MAX_LEVEL) {
            return { success: false, message: `已達強化上限 +${CFG.MAX_LEVEL}` };
        }

        const level = weapon.enhanceLevel;
        const goldCost = CFG.GOLD_COSTS[level];
        const stoneCost = CFG.STONE_COSTS[level];

        // 驗證金幣
        if (player.money < goldCost) {
            return { success: false, message: `金幣不足（需要 $${goldCost}）` };
        }

        // 驗證強化石數量
        const stoneIndices: number[] = [];
        for (let i = 0; i < player.inventory.length; i++) {
            const it = player.inventory.at(i);
            if (it && it.baseId === CFG.ENHANCE_STONE_ITEM_ID) {
                stoneIndices.push(i);
                if (stoneIndices.length >= stoneCost) break;
            }
        }
        if (stoneIndices.length < stoneCost) {
            return { success: false, message: `強化石不足（需要 ${stoneCost} 顆）` };
        }

        // 扣除資源（失敗也照扣 — 唯一的失敗懲罰）
        // 刪除強化石會使後面的背包 index 前移，需同步修正裝備指標與目標武器 index
        player.money -= goldCost;
        let targetIndex = itemIndex;
        stoneIndices.sort((a, b) => b - a).forEach((i) => {
            player.inventory.deleteAt(i);
            this.onInventoryRemoved(player, i);
            if (i < targetIndex) targetIndex -= 1;
        });

        // 判定成功率（保底：連續失敗達標後必定成功）
        const pityTriggered = weapon.failCount >= CFG.PITY_FAIL_COUNT;
        const rate = CFG.SUCCESS_RATES[level];
        const enhanceSuccess = pityTriggered || Math.random() < rate;

        const baseName = weapon.name.replace(/\s\+\d+$/, "");
        const fromLevel = weapon.enhanceLevel;

        if (enhanceSuccess) {
            weapon.enhanceLevel += 1;
            weapon.failCount = 0;
            weapon.name = getWeaponDisplayName(baseName, weapon.enhanceLevel);

            // 若強化的是裝備中的武器，同步更新攻擊加成
            if (player.equippedWeaponIndex === targetIndex) {
                player.attackBonus = this.getWeaponAttack(weapon);
                player.equippedWeaponName = weapon.name;
            }
        } else {
            weapon.failCount += 1;
        }

        this.writeLog(player, weapon, baseName, fromLevel, enhanceSuccess, pityTriggered, goldCost, stoneCost);

        return {
            success: true,
            enhanceSuccess,
            pityTriggered,
            message: enhanceSuccess
                ? (pityTriggered ? `保底觸發！${weapon.name} 強化成功！` : `${weapon.name} 強化成功！`)
                : `強化失敗... 損失 $${goldCost} 與 ${stoneCost} 顆強化石（連續失敗 ${weapon.failCount} 次，滿 ${CFG.PITY_FAIL_COUNT} 次下一次必成功）`,
            weaponName: weapon.name,
            enhanceLevel: weapon.enhanceLevel,
            failCount: weapon.failCount,
        };
    }

    /**
     * 武器總攻擊力 = 基礎攻擊力（item.value）+ 強化等級加成（遞增曲線）
     */
    getWeaponAttack(weapon: Item): number {
        return weapon.value + (CFG.ATTACK_BONUS[weapon.enhanceLevel] ?? 0);
    }

    /**
     * 裝備 / 卸下武器
     */
    handleEquip(client: Client, player: Player, itemIndex: number): void {
        // itemIndex = -1 → 卸下
        if (itemIndex === -1) {
            player.equippedWeaponIndex = -1;
            player.equippedWeaponName = "";
            player.attackBonus = 0;
            client.send("notification", "已卸下武器");
            return;
        }
        if (itemIndex < 0 || itemIndex >= player.inventory.length) return;
        const weapon = player.inventory.at(itemIndex);
        if (!weapon || weapon.type !== "weapon") {
            client.send("notification", "這個物品不是武器");
            return;
        }
        player.equippedWeaponIndex = itemIndex;
        player.equippedWeaponName = weapon.name;
        player.attackBonus = this.getWeaponAttack(weapon);
        client.send("notification", `已裝備 ${weapon.name}（攻擊力 +${player.attackBonus}）`);
    }

    /**
     * 背包物品被刪除時修正裝備 index（呼叫端在刪除背包物品後調用）
     */
    onInventoryRemoved(player: Player, removedIndex: number): void {
        if (player.equippedWeaponIndex === removedIndex) {
            player.equippedWeaponIndex = -1;
            player.equippedWeaponName = "";
            player.attackBonus = 0;
        } else if (player.equippedWeaponIndex > removedIndex) {
            player.equippedWeaponIndex -= 1;
        }
    }

    private writeLog(
        player: Player, weapon: Item, baseName: string, fromLevel: number,
        success: boolean, pityTriggered: boolean, goldCost: number, stoneCost: number
    ): void {
        const db = getFirestore();
        if (!db) return;
        const log: IEnhanceLog = {
            userId: player.firebaseUid || player.sessionId,
            playerName: player.name,
            weaponId: weapon.baseId || weapon.id,
            weaponName: baseName,
            fromLevel,
            toLevel: weapon.enhanceLevel,
            success,
            pityTriggered,
            goldCost,
            stoneCost,
            timestamp: Date.now(),
        };
        db.collection("weapon_enhance_logs").add(log)
            .catch((e: any) => console.error("[WeaponEnhance] 寫入強化紀錄失敗:", e));
    }
}
