import { Player } from "../rooms/schema/GameState";
import { EVIL_VALUE_CONSTANTS } from "@gangs-online/shared";

/**
 * EvilValueSystem - 罪惡值系統 (Phase 14)
 *
 * 負責：
 * 1. 管理玩家的罪惡值 (Evil Value)
 * 2. 判斷玩家是否為紅名狀態
 * 3. 增加/減少罪惡值
 */
export class EvilValueSystem {
    /**
     * 檢查玩家是否為紅名（罪惡值 > 0）
     */
    isWanted(player: Player): boolean {
        return player.evilValue > 0;
    }

    /**
     * 增加玩家的罪惡值
     * @param player 玩家
     * @returns 新的罪惡值
     */
    increaseEvilValue(player: Player): number {
        player.evilValue = Math.min(
            player.evilValue + EVIL_VALUE_CONSTANTS.EVIL_INCREMENT,
            EVIL_VALUE_CONSTANTS.MAX_EVIL_VALUE
        );
        console.log(`🔴 [EvilValue] ${player.name} 的罪惡值增加至 ${player.evilValue}`);
        return player.evilValue;
    }

    /**
     * 重置玩家的罪惡值
     * @param player 玩家
     */
    resetEvilValue(player: Player): void {
        player.evilValue = 0;
        console.log(`⚪ [EvilValue] ${player.name} 的罪惡值已重置`);
    }

    /**
     * 減少玩家的罪惡值
     * @param player 玩家
     * @param amount 減少量
     * @returns 新的罪惡值
     */
    decreaseEvilValue(player: Player, amount: number = 1): number {
        player.evilValue = Math.max(0, player.evilValue - amount);
        console.log(`🟡 [EvilValue] ${player.name} 的罪惡值減少至 ${player.evilValue}`);
        return player.evilValue;
    }

    /**
     * 獲取玩家的罪惡值
     */
    getEvilValue(player: Player): number {
        return player.evilValue;
    }

    /**
     * 處理攻擊無辜（市民 NPC 或非紅名玩家）
     * @param attacker 攻擊者
     * @param targetIsInnocent 目標是否無辜
     * @returns 是否增加了罪惡值
     */
    handleAttackInnocent(attacker: Player, targetIsInnocent: boolean): boolean {
        if (targetIsInnocent) {
            this.increaseEvilValue(attacker);
            return true;
        }
        return false;
    }
}
