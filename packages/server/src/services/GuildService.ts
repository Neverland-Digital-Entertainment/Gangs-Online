/**
 * Guild Service (Phase 13: Guild System)
 * 負責幫會的建立、加入、退出等管理功能
 * 使用 Firebase Firestore 進行資料持久化
 *
 * 資料結構設計：
 * - guilds 集合：存放幫會資料，成員只存 userId 和 role
 * - players 集合：存放玩家資料，包含 name
 * - 讀取幫會資料時，動態從 players 集合取得成員名稱
 */
import { getFirestore, getFieldValue, isFirebaseInitialized } from "./FirebaseService";
import { IGuildData, IGuildDataStored, IGuildMember, IGuildMemberStored, GuildRole, GUILD_CONSTANTS } from "@gangs-online/shared";

// Firestore 路徑常數（簡化：放在 DB 根層）
const GUILDS_PATH = "guilds";
const PLAYERS_PATH = "players";

/**
 * 幫會服務類別
 */
export class GuildService {
    /**
     * 建立幫會
     * @param name 幫會名稱
     * @param userId 創建者的 Firebase UID
     * @returns 新建幫會的 ID，失敗時返回 null
     */
    async createGuild(name: string, userId: string): Promise<{ success: boolean; guildId?: string; error?: string }> {
        if (!isFirebaseInitialized()) {
            return { success: false, error: "Firebase 未初始化" };
        }

        const db = getFirestore();
        if (!db) {
            return { success: false, error: "Firestore 連接失敗" };
        }

        // 驗證幫會名稱
        if (name.length < GUILD_CONSTANTS.MIN_GUILD_NAME_LENGTH) {
            return { success: false, error: `幫會名稱至少需要 ${GUILD_CONSTANTS.MIN_GUILD_NAME_LENGTH} 個字` };
        }
        if (name.length > GUILD_CONSTANTS.MAX_GUILD_NAME_LENGTH) {
            return { success: false, error: `幫會名稱不能超過 ${GUILD_CONSTANTS.MAX_GUILD_NAME_LENGTH} 個字` };
        }

        try {
            // 檢查玩家是否已在幫會
            const userDoc = await db.collection(PLAYERS_PATH).doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData?.guildId) {
                    return { success: false, error: "你已經是其他幫會的成員" };
                }
            }

            // 建立幫會文檔（成員只存 userId 和 role，不存 name）
            const guildRef = db.collection(GUILDS_PATH).doc();
            const guildId = guildRef.id;
            const now = Date.now();

            const guildData: IGuildDataStored = {
                id: guildId,
                name: name,
                leaderId: userId,
                createdAt: now,
                memberCount: 1,
                description: "",
                members: {
                    [userId]: {
                        userId: userId,
                        role: "龍頭" as GuildRole,
                        joinTime: now
                    }
                }
            };

            await guildRef.set(guildData);

            // 更新用戶的幫會資訊
            await db.collection(PLAYERS_PATH).doc(userId).set({
                guildId: guildId,
                guildName: name
            }, { merge: true });

            console.log(`[GuildService] 幫會創建成功: ${name} (${guildId})`);
            return { success: true, guildId };

        } catch (error) {
            console.error("[GuildService] 創建幫會失敗:", error);
            return { success: false, error: "創建幫會時發生錯誤" };
        }
    }

    /**
     * 加入幫會
     * @param guildId 幫會 ID
     * @param userId 玩家的 Firebase UID
     */
    async joinGuild(guildId: string, userId: string): Promise<{ success: boolean; guildName?: string; error?: string }> {
        if (!isFirebaseInitialized()) {
            return { success: false, error: "Firebase 未初始化" };
        }

        const db = getFirestore();
        if (!db) {
            return { success: false, error: "Firestore 連接失敗" };
        }

        try {
            // 檢查玩家是否已在幫會
            const userDoc = await db.collection(PLAYERS_PATH).doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData?.guildId) {
                    return { success: false, error: "你已經是其他幫會的成員" };
                }
            }

            // 獲取幫會資料
            const guildDoc = await db.collection(GUILDS_PATH).doc(guildId).get();
            if (!guildDoc.exists) {
                return { success: false, error: "幫會不存在" };
            }

            const guildData = guildDoc.data() as IGuildDataStored;

            // 檢查人數上限
            if (guildData.memberCount >= GUILD_CONSTANTS.MAX_GUILD_MEMBERS) {
                return { success: false, error: "幫會人數已滿" };
            }

            const now = Date.now();

            // 添加成員到幫會（只存 userId 和 role，不存 name）
            await db.collection(GUILDS_PATH).doc(guildId).update({
                [`members.${userId}`]: {
                    userId: userId,
                    role: "成員" as GuildRole,
                    joinTime: now
                },
                memberCount: guildData.memberCount + 1
            });

            // 更新用戶的幫會資訊
            await db.collection(PLAYERS_PATH).doc(userId).set({
                guildId: guildId,
                guildName: guildData.name
            }, { merge: true });

            console.log(`[GuildService] 玩家 ${userId} 加入幫會: ${guildData.name}`);
            return { success: true, guildName: guildData.name };

        } catch (error) {
            console.error("[GuildService] 加入幫會失敗:", error);
            return { success: false, error: "加入幫會時發生錯誤" };
        }
    }

    /**
     * 離開幫會
     * @param userId 玩家的 Firebase UID
     */
    async leaveGuild(userId: string): Promise<{ success: boolean; error?: string }> {
        if (!isFirebaseInitialized()) {
            return { success: false, error: "Firebase 未初始化" };
        }

        const db = getFirestore();
        if (!db) {
            return { success: false, error: "Firestore 連接失敗" };
        }

        try {
            // 獲取用戶的幫會資訊
            const userDoc = await db.collection(PLAYERS_PATH).doc(userId).get();
            if (!userDoc.exists) {
                return { success: false, error: "用戶不存在" };
            }

            const userData = userDoc.data();
            if (!userData?.guildId) {
                return { success: false, error: "你不在任何幫會中" };
            }

            const guildId = userData.guildId;

            // 獲取幫會資料
            const guildDoc = await db.collection(GUILDS_PATH).doc(guildId).get();
            if (!guildDoc.exists) {
                // 幫會不存在，清除用戶的幫會資訊
                await db.collection(PLAYERS_PATH).doc(userId).update({
                    guildId: "",
                    guildName: ""
                });
                return { success: true };
            }

            const guildData = guildDoc.data() as IGuildDataStored;

            // 檢查是否為龍頭
            if (guildData.leaderId === userId) {
                // 龍頭離開：如果只有一人，解散幫會；否則禁止離開
                if (guildData.memberCount === 1) {
                    // 解散幫會
                    await db.collection(GUILDS_PATH).doc(guildId).delete();
                    console.log(`[GuildService] 幫會已解散: ${guildData.name}`);
                } else {
                    return { success: false, error: "龍頭不能直接離開，請先轉讓職位或解散幫會" };
                }
            } else {
                // 普通成員離開
                const FieldValue = getFieldValue();
                await db.collection(GUILDS_PATH).doc(guildId).update({
                    [`members.${userId}`]: FieldValue.delete(),
                    memberCount: guildData.memberCount - 1
                });
            }

            // 清除用戶的幫會資訊
            await db.collection(PLAYERS_PATH).doc(userId).update({
                guildId: "",
                guildName: ""
            });

            console.log(`[GuildService] 玩家 ${userId} 離開幫會: ${guildData.name}`);
            return { success: true };

        } catch (error) {
            console.error("[GuildService] 離開幫會失敗:", error);
            return { success: false, error: "離開幫會時發生錯誤" };
        }
    }

    /**
     * 獲取幫會資料（包含成員名稱）
     * 從 players 集合動態取得成員名稱
     * @param guildId 幫會 ID
     */
    async getGuild(guildId: string): Promise<IGuildData | null> {
        if (!isFirebaseInitialized()) {
            return null;
        }

        const db = getFirestore();
        if (!db) {
            return null;
        }

        try {
            const guildDoc = await db.collection(GUILDS_PATH).doc(guildId).get();
            if (!guildDoc.exists) {
                return null;
            }

            const storedData = guildDoc.data() as IGuildDataStored;

            // 取得所有成員的 userId
            const memberIds = Object.keys(storedData.members);

            // 從 players 集合批量取得成員名稱
            const memberNames: { [userId: string]: string } = {};
            for (const userId of memberIds) {
                try {
                    const playerDoc = await db.collection(PLAYERS_PATH).doc(userId).get();
                    if (playerDoc.exists) {
                        const playerData = playerDoc.data();
                        memberNames[userId] = playerData?.name || `玩家${userId.substring(0, 6)}`;
                    } else {
                        memberNames[userId] = `玩家${userId.substring(0, 6)}`;
                    }
                } catch (err) {
                    console.error(`[GuildService] 取得玩家 ${userId} 名稱失敗:`, err);
                    memberNames[userId] = `玩家${userId.substring(0, 6)}`;
                }
            }

            // 組合成完整的幫會資料（包含成員名稱）
            const members: { [userId: string]: IGuildMember } = {};
            for (const [userId, storedMember] of Object.entries(storedData.members)) {
                members[userId] = {
                    userId: storedMember.userId,
                    name: memberNames[userId],
                    role: storedMember.role,
                    joinTime: storedMember.joinTime
                };
            }

            const guildData: IGuildData = {
                id: storedData.id,
                name: storedData.name,
                leaderId: storedData.leaderId,
                createdAt: storedData.createdAt,
                memberCount: storedData.memberCount,
                description: storedData.description,
                members: members
            };

            return guildData;
        } catch (error) {
            console.error("[GuildService] 獲取幫會資料失敗:", error);
            return null;
        }
    }

    /**
     * 獲取用戶的幫會資訊
     * @param userId 玩家的 Firebase UID
     */
    async getUserGuildInfo(userId: string): Promise<{ guildId: string; guildName: string } | null> {
        if (!isFirebaseInitialized()) {
            return null;
        }

        const db = getFirestore();
        if (!db) {
            return null;
        }

        try {
            const userDoc = await db.collection(PLAYERS_PATH).doc(userId).get();
            if (!userDoc.exists) {
                return null;
            }
            const userData = userDoc.data();
            if (!userData?.guildId) {
                return null;
            }
            return {
                guildId: userData.guildId,
                guildName: userData.guildName || ""
            };
        } catch (error) {
            console.error("[GuildService] 獲取用戶幫會資訊失敗:", error);
            return null;
        }
    }

    /**
     * 獲取幫會列表（用於顯示可加入的幫會）
     * 注意：列表不需要成員名稱，直接返回存儲的資料
     * @param limit 返回的幫會數量上限
     */
    async getGuildList(limit: number = 20): Promise<IGuildDataStored[]> {
        if (!isFirebaseInitialized()) {
            return [];
        }

        const db = getFirestore();
        if (!db) {
            return [];
        }

        try {
            // 注意：根據 Phase13.md 的限制，不使用 orderBy
            const snapshot = await db.collection(GUILDS_PATH).limit(limit).get();
            const guilds: IGuildDataStored[] = [];
            snapshot.forEach(doc => {
                guilds.push(doc.data() as IGuildDataStored);
            });
            return guilds;
        } catch (error) {
            console.error("[GuildService] 獲取幫會列表失敗:", error);
            return [];
        }
    }

    /**
     * 檢查玩家是否為幫會龍頭
     * @param guildId 幫會 ID
     * @param userId 玩家的 Firebase UID
     */
    async isGuildLeader(guildId: string, userId: string): Promise<boolean> {
        const guild = await this.getGuild(guildId);
        if (!guild) {
            return false;
        }
        return guild.leaderId === userId;
    }

    /**
     * 踢出成員（僅龍頭可用）
     * @param guildId 幫會 ID
     * @param leaderId 龍頭的 Firebase UID
     * @param targetUserId 要踢出的成員 Firebase UID
     */
    async kickMember(guildId: string, leaderId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
        if (!isFirebaseInitialized()) {
            return { success: false, error: "Firebase 未初始化" };
        }

        const db = getFirestore();
        if (!db) {
            return { success: false, error: "Firestore 連接失敗" };
        }

        try {
            // 驗證操作者是否為龍頭
            const guild = await this.getGuild(guildId);
            if (!guild) {
                return { success: false, error: "幫會不存在" };
            }

            if (guild.leaderId !== leaderId) {
                return { success: false, error: "只有龍頭可以踢出成員" };
            }

            if (targetUserId === leaderId) {
                return { success: false, error: "不能踢出自己" };
            }

            // 檢查目標是否在幫會中
            if (!guild.members[targetUserId]) {
                return { success: false, error: "該玩家不在幫會中" };
            }

            // 移除成員
            const FieldValue = getFieldValue();
            await db.collection(GUILDS_PATH).doc(guildId).update({
                [`members.${targetUserId}`]: FieldValue.delete(),
                memberCount: guild.memberCount - 1
            });

            // 清除被踢成員的幫會資訊
            await db.collection(PLAYERS_PATH).doc(targetUserId).update({
                guildId: "",
                guildName: ""
            });

            console.log(`[GuildService] 成員 ${targetUserId} 被踢出幫會: ${guild.name}`);
            return { success: true };

        } catch (error) {
            console.error("[GuildService] 踢出成員失敗:", error);
            return { success: false, error: "踢出成員時發生錯誤" };
        }
    }
}

// 導出單例
export const guildService = new GuildService();
