import { GAME_CONSTANTS } from "@gangs-online/shared";

/**
 * SafeZoneSystem - 管理安全區邏輯 (Phase 9)
 *
 * 安全區位於地圖中心，半徑為 SAFE_ZONE_RADIUS
 * 在安全區內：
 * - 無法進行攻擊
 * - 敵人不會追擊玩家
 */
export class SafeZoneSystem {
    /**
     * 檢查位置是否在安全區內
     * @param x X 座標
     * @param z Z 座標
     * @returns 是否在安全區內
     */
    isInSafeZone(x: number, z: number): boolean {
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        return distanceFromCenter < GAME_CONSTANTS.SAFE_ZONE_RADIUS;
    }

    /**
     * 檢查兩個位置是否都在安全區外（允許戰鬥）
     * @param x1 位置 1 的 X 座標
     * @param z1 位置 1 的 Z 座標
     * @param x2 位置 2 的 X 座標
     * @param z2 位置 2 的 Z 座標
     * @returns 是否可以戰鬥（兩者都不在安全區內）
     */
    canFight(x1: number, z1: number, x2: number, z2: number): boolean {
        return !this.isInSafeZone(x1, z1) && !this.isInSafeZone(x2, z2);
    }
}
