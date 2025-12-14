import { Player } from "../rooms/schema/GameState";
import { GAME_CONSTANTS, getRankTitle } from "@gangs-online/shared";

/**
 * ProgressionSystem - 獨立的玩家進度管理系統
 * 負責：
 * 1. 經驗值獲取
 * 2. 升級邏輯
 * 3. 等級獎勵（HP 提升等）
 * 4. 頭銜系統
 */
export class ProgressionSystem {
    /**
     * 獎勵經驗值給玩家
     * @param player 玩家
     * @param xpAmount 經驗值數量
     * @returns 升級後的等級（如果有升級）或 null
     */
    awardXP(player: Player, xpAmount: number): number | null {
        if (!player || player.hp <= 0) {
            return null; // 死亡的玩家不能獲得經驗
        }

        player.xp += xpAmount;
        console.log(`⭐ ${player.name} gained ${xpAmount} XP! (${player.xp}/${player.maxXp})`);

        // 檢查是否升級
        if (player.xp >= player.maxXp) {
            return this.levelUp(player);
        }

        return null;
    }

    /**
     * 玩家升級
     * @param player 玩家
     * @returns 新等級
     */
    private levelUp(player: Player): number {
        // 攜帶過剩的經驗值到下一級
        player.xp -= player.maxXp;
        player.level++;

        // 計算下一級所需經驗值（指數增長）
        player.maxXp = Math.floor(
            GAME_CONSTANTS.BASE_XP_TO_LEVEL * Math.pow(GAME_CONSTANTS.XP_SCALING_FACTOR, player.level - 1)
        );

        // 獎勵：提升最大 HP
        player.maxHp += GAME_CONSTANTS.HP_PER_LEVEL;

        // 升級時完全恢復生命值
        player.hp = player.maxHp;

        const newTitle = getRankTitle(player.level);
        console.log(`🎉 ${player.name} leveled up to ${player.level}! New title: ${newTitle} | HP: ${player.maxHp}`);

        return player.level;
    }

    /**
     * 初始化玩家的進度資料
     * @param player 玩家
     */
    initializePlayer(player: Player): void {
        player.level = 1;
        player.xp = 0;
        player.maxXp = GAME_CONSTANTS.BASE_XP_TO_LEVEL;

        console.log(`🆕 Initialized progression for ${player.name}: Level ${player.level}, XP: ${player.xp}/${player.maxXp}`);
    }

    /**
     * 獲取玩家的頭銜
     * @param player 玩家
     * @returns 頭銜字符串
     */
    getPlayerRank(player: Player): string {
        return getRankTitle(player.level);
    }

    /**
     * 計算擊殺敵人應獲得的經驗值
     * 可以根據敵人的類型/等級調整（未來擴展）
     * @returns 經驗值
     */
    getXPForEnemyKill(): number {
        return GAME_CONSTANTS.XP_PER_KILL;
    }
}
