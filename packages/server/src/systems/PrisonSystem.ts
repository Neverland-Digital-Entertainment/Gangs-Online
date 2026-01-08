import { Player } from "../rooms/schema/GameState";
import { PRISON_CONSTANTS, EVIL_VALUE_CONSTANTS } from "@gangs-online/shared";
import { EvilValueSystem } from "./EvilValueSystem";

/**
 * PrisonSystem - 監獄系統 (Phase 14)
 *
 * 負責：
 * 1. 將紅名玩家傳送到監獄
 * 2. 管理監獄倒數計時
 * 3. 釋放玩家並重置罪惡值
 * 4. 限制監獄內的移動範圍
 */
export class PrisonSystem {
    private evilValueSystem: EvilValueSystem;

    constructor(evilValueSystem: EvilValueSystem) {
        this.evilValueSystem = evilValueSystem;
    }

    /**
     * 將玩家傳送到監獄
     * @param player 玩家
     */
    sendToPrison(player: Player): void {
        player.inPrison = true;
        player.x = PRISON_CONSTANTS.PRISON_X;
        player.z = PRISON_CONSTANTS.PRISON_Z;
        player.prisonReleaseTime = Date.now() + EVIL_VALUE_CONSTANTS.PRISON_DURATION;

        // 重生時恢復滿血
        player.hp = player.maxHp;

        // 結束戰鬥狀態
        player.inCombatWith = "";
        player.inCombatWithEnemy = "";

        console.log(`🔒 [Prison] ${player.name} 被送進監獄，${EVIL_VALUE_CONSTANTS.PRISON_DURATION / 1000} 秒後釋放`);
    }

    /**
     * 檢查玩家是否在監獄中
     */
    isInPrison(player: Player): boolean {
        return player.inPrison;
    }

    /**
     * 檢查玩家是否可以被釋放
     */
    canBeReleased(player: Player): boolean {
        return player.inPrison && Date.now() >= player.prisonReleaseTime;
    }

    /**
     * 釋放玩家
     * @param player 玩家
     */
    releasePlayer(player: Player): void {
        if (!player.inPrison) return;

        // 重置罪惡值
        this.evilValueSystem.resetEvilValue(player);

        // 傳送到釋放點（銅鑼灣）
        player.x = PRISON_CONSTANTS.RELEASE_X;
        player.z = PRISON_CONSTANTS.RELEASE_Z;

        // 更新狀態
        player.inPrison = false;
        player.prisonReleaseTime = 0;

        console.log(`🔓 [Prison] ${player.name} 已從監獄釋放`);
    }

    /**
     * 檢查位置是否在監獄範圍內
     */
    isInPrisonBounds(x: number, z: number): boolean {
        const dx = x - PRISON_CONSTANTS.PRISON_X;
        const dz = z - PRISON_CONSTANTS.PRISON_Z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        return distance <= PRISON_CONSTANTS.PRISON_RADIUS;
    }

    /**
     * 限制監獄內的移動（如果嘗試離開監獄範圍）
     * @param player 玩家
     * @param targetX 目標 X 座標
     * @param targetZ 目標 Z 座標
     * @returns 是否允許移動
     */
    validatePrisonMovement(player: Player, targetX: number, targetZ: number): boolean {
        if (!player.inPrison) return true;

        // 檢查目標位置是否在監獄範圍內
        return this.isInPrisonBounds(targetX, targetZ);
    }

    /**
     * 獲取剩餘監禁時間（毫秒）
     */
    getRemainingTime(player: Player): number {
        if (!player.inPrison) return 0;
        return Math.max(0, player.prisonReleaseTime - Date.now());
    }
}
