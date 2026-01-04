/**
 * Chat Service (Phase 13: Chat System Migration)
 * 負責聊天訊息的持久化到 Firebase Firestore
 * 支援全服、幫會、私聊三種頻道
 */
import { getFirestore, isFirebaseInitialized } from "./FirebaseService";
import { IChatMessage, ChatMessageType, GUILD_CONSTANTS } from "@gangs-online/shared";

// Firestore 路徑常數
const FIRESTORE_APP_ID = "gangs-online";
const CHAT_HISTORY_PATH = `artifacts/${FIRESTORE_APP_ID}/public/data/chat_history`;

/**
 * 聊天服務類別
 */
export class ChatService {
    /**
     * 儲存聊天訊息到 Firestore
     * @param message 聊天訊息
     */
    async saveMessage(message: IChatMessage): Promise<boolean> {
        if (!isFirebaseInitialized()) {
            console.log("[ChatService] Firebase 未初始化，跳過訊息儲存");
            return false;
        }

        const db = getFirestore();
        if (!db) {
            return false;
        }

        try {
            await db.collection(CHAT_HISTORY_PATH).add({
                senderId: message.senderId,
                senderName: message.senderName,
                text: message.text,
                type: message.type,
                targetId: message.targetId || "",
                timestamp: message.timestamp
            });
            return true;
        } catch (error) {
            console.error("[ChatService] 儲存訊息失敗:", error);
            return false;
        }
    }

    /**
     * 獲取全服聊天歷史
     * @param limit 返回的訊息數量上限
     */
    async getGlobalChatHistory(limit: number = GUILD_CONSTANTS.CHAT_HISTORY_LIMIT): Promise<IChatMessage[]> {
        if (!isFirebaseInitialized()) {
            return [];
        }

        const db = getFirestore();
        if (!db) {
            return [];
        }

        try {
            // 注意：根據 Phase13.md 限制，避免使用 orderBy
            // 我們會在記憶體中排序
            const snapshot = await db.collection(CHAT_HISTORY_PATH)
                .limit(limit * 2) // 取多一點再過濾
                .get();

            const messages: IChatMessage[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'GLOBAL' || data.type === 'SYSTEM') {
                    messages.push({
                        id: doc.id,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        text: data.text,
                        type: data.type as ChatMessageType,
                        targetId: data.targetId,
                        timestamp: data.timestamp
                    });
                }
            });

            // 在記憶體中按時間排序，返回最新的 limit 條
            messages.sort((a, b) => b.timestamp - a.timestamp);
            return messages.slice(0, limit).reverse(); // 返回時間順序（舊的在前）

        } catch (error) {
            console.error("[ChatService] 獲取全服聊天歷史失敗:", error);
            return [];
        }
    }

    /**
     * 獲取幫會聊天歷史
     * @param guildId 幫會 ID
     * @param limit 返回的訊息數量上限
     */
    async getGuildChatHistory(guildId: string, limit: number = GUILD_CONSTANTS.CHAT_HISTORY_LIMIT): Promise<IChatMessage[]> {
        if (!isFirebaseInitialized()) {
            return [];
        }

        const db = getFirestore();
        if (!db) {
            return [];
        }

        try {
            // 注意：由於 Firestore 限制，我們需要先取得所有 GUILD 類型訊息再在記憶體過濾
            const snapshot = await db.collection(CHAT_HISTORY_PATH)
                .limit(limit * 5) // 取多一點再過濾
                .get();

            const messages: IChatMessage[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'GUILD' && data.targetId === guildId) {
                    messages.push({
                        id: doc.id,
                        senderId: data.senderId,
                        senderName: data.senderName,
                        text: data.text,
                        type: data.type as ChatMessageType,
                        targetId: data.targetId,
                        timestamp: data.timestamp
                    });
                }
            });

            // 在記憶體中按時間排序
            messages.sort((a, b) => b.timestamp - a.timestamp);
            return messages.slice(0, limit).reverse();

        } catch (error) {
            console.error("[ChatService] 獲取幫會聊天歷史失敗:", error);
            return [];
        }
    }

    /**
     * 獲取私聊歷史
     * @param oderId1 用戶1的 ID
     * @param userId2 用戶2的 ID
     * @param limit 返回的訊息數量上限
     */
    async getPrivateChatHistory(userId1: string, userId2: string, limit: number = GUILD_CONSTANTS.CHAT_HISTORY_LIMIT): Promise<IChatMessage[]> {
        if (!isFirebaseInitialized()) {
            return [];
        }

        const db = getFirestore();
        if (!db) {
            return [];
        }

        try {
            const snapshot = await db.collection(CHAT_HISTORY_PATH)
                .limit(limit * 5)
                .get();

            const messages: IChatMessage[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'PRIVATE') {
                    // 私聊訊息：發送者和接收者可能互換
                    const isMatch =
                        (data.senderId === userId1 && data.targetId === userId2) ||
                        (data.senderId === userId2 && data.targetId === userId1);

                    if (isMatch) {
                        messages.push({
                            id: doc.id,
                            senderId: data.senderId,
                            senderName: data.senderName,
                            text: data.text,
                            type: data.type as ChatMessageType,
                            targetId: data.targetId,
                            timestamp: data.timestamp
                        });
                    }
                }
            });

            messages.sort((a, b) => b.timestamp - a.timestamp);
            return messages.slice(0, limit).reverse();

        } catch (error) {
            console.error("[ChatService] 獲取私聊歷史失敗:", error);
            return [];
        }
    }
}

// 導出單例
export const chatService = new ChatService();
