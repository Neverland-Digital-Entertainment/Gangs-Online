/**
 * 進度系統工具函數
 * Phase 7: 客戶端進度系統工具
 */

/**
 * 根據等級獲取三合會頭銜
 * @param level 玩家等級
 * @returns 對應的頭銜
 */
export const getRankTitle = (level: number): string => {
    if (level >= 10) return "紅棍 (Red Pole)";
    if (level >= 6) return "草鞋 (Straw Sandal)";
    if (level >= 3) return "四九 (49)";
    return "藍燈籠 (Blue Lantern)";
};
