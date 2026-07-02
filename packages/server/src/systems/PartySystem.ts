/**
 * Party System (Phase 21: 組隊系統)
 *
 * - 隊伍上限 5 人（PARTY_CONFIG.MAX_MEMBERS）
 * - 經驗分配：擊殺時，同 Room 且在擊殺點 XP_SHARE_RANGE 範圍內的每位隊員
 *   各獲得「全額」經驗（不均分 — 均分會使組隊失去價值）
 * - 隊伍狀態存在記憶體（Room 生命週期內），隊伍快照同步寫入 Firebase
 *   runtime_parties collection 供 Dashboard 檢視
 */
import { Room, Client } from "colyseus";
import { GameState, Player } from "../rooms/schema/GameState";
import { PARTY_CONFIG, IPartyInfo } from "@gangs-online/shared";
import { getFirestore } from "../services/FirebaseService";

interface IParty {
    id: string;
    leaderSessionId: string;
    memberSessionIds: string[];
}

interface IPendingInvite {
    partyId: string;
    inviterName: string;
    expiresAt: number;
}

export class PartySystem {
    private room!: Room<GameState>;
    private parties: Map<string, IParty> = new Map();
    private invites: Map<string, IPendingInvite> = new Map(); // key = 被邀請者 sessionId
    private partyIdCounter = 0;

    initialize(room: Room<GameState>): void {
        this.room = room;
    }

    // ==================== 邀請 / 加入 / 離開 ====================

    /** 發出組隊邀請（目標用玩家名稱或 sessionId） */
    invite(client: Client, inviter: Player, targetNameOrId: string): void {
        // 找目標玩家
        let targetSessionId = "";
        this.room.state.players.forEach((p, sid) => {
            if (sid === targetNameOrId || p.name === targetNameOrId) targetSessionId = sid;
        });
        if (!targetSessionId || targetSessionId === inviter.sessionId) {
            client.send("notification", "找不到該玩家"); return;
        }
        const target = this.room.state.players.get(targetSessionId)!;
        if (target.partyId) { client.send("notification", `${target.name} 已經在其他隊伍中`); return; }

        // 邀請者的隊伍（沒有則建立）
        let party = inviter.partyId ? this.parties.get(inviter.partyId) : undefined;
        if (party && party.leaderSessionId !== inviter.sessionId) {
            client.send("notification", "只有隊長可以邀請隊員"); return;
        }
        if (party && party.memberSessionIds.length >= PARTY_CONFIG.MAX_MEMBERS) {
            client.send("notification", `隊伍已滿（上限 ${PARTY_CONFIG.MAX_MEMBERS} 人）`); return;
        }
        if (!party) {
            party = { id: `party_${++this.partyIdCounter}`, leaderSessionId: inviter.sessionId, memberSessionIds: [inviter.sessionId] };
            this.parties.set(party.id, party);
            inviter.partyId = party.id;
        }

        this.invites.set(targetSessionId, {
            partyId: party.id,
            inviterName: inviter.name,
            expiresAt: Date.now() + PARTY_CONFIG.INVITE_EXPIRE_MS,
        });

        const targetClient = this.room.clients.find((c) => c.sessionId === targetSessionId);
        targetClient?.send("partyInvite", { inviterName: inviter.name, partyId: party.id });
        client.send("notification", `已向 ${target.name} 發出組隊邀請`);
        this.syncParty(party);
    }

    /** 接受邀請 */
    accept(client: Client, player: Player): void {
        const invite = this.invites.get(client.sessionId);
        if (!invite || invite.expiresAt < Date.now()) {
            this.invites.delete(client.sessionId);
            client.send("notification", "邀請已過期"); return;
        }
        this.invites.delete(client.sessionId);
        const party = this.parties.get(invite.partyId);
        if (!party) { client.send("notification", "隊伍已解散"); return; }
        if (party.memberSessionIds.length >= PARTY_CONFIG.MAX_MEMBERS) {
            client.send("notification", "隊伍已滿"); return;
        }
        if (player.partyId) { client.send("notification", "你已經在隊伍中"); return; }

        party.memberSessionIds.push(client.sessionId);
        player.partyId = party.id;
        this.broadcastToParty(party, `${player.name} 加入了隊伍`);
        this.syncParty(party);
    }

    /** 拒絕邀請 */
    decline(client: Client): void {
        this.invites.delete(client.sessionId);
        client.send("notification", "已拒絕組隊邀請");
    }

    /** 離開隊伍（隊長離開則移交隊長或解散） */
    leave(client: Client, player: Player): void {
        this.removeFromParty(client.sessionId, player, "離開了隊伍");
    }

    /** 玩家斷線時清理 */
    onPlayerLeave(sessionId: string, player: Player | undefined): void {
        this.invites.delete(sessionId);
        if (player) this.removeFromParty(sessionId, player, "已離線，退出隊伍");
    }

    private removeFromParty(sessionId: string, player: Player, reason: string): void {
        if (!player.partyId) return;
        const party = this.parties.get(player.partyId);
        player.partyId = "";
        if (!party) return;

        party.memberSessionIds = party.memberSessionIds.filter((s) => s !== sessionId);
        this.broadcastToParty(party, `${player.name} ${reason}`);

        if (party.memberSessionIds.length <= 1) {
            // 剩 0~1 人 → 解散
            party.memberSessionIds.forEach((sid) => {
                const p = this.room.state.players.get(sid);
                if (p) p.partyId = "";
                this.room.clients.find((c) => c.sessionId === sid)?.send("partyUpdate", null);
                this.room.clients.find((c) => c.sessionId === sid)?.send("notification", "隊伍已解散");
            });
            this.parties.delete(party.id);
            this.removePartySnapshot(party.id);
            return;
        }
        if (party.leaderSessionId === sessionId) {
            party.leaderSessionId = party.memberSessionIds[0];
            const newLeader = this.room.state.players.get(party.leaderSessionId);
            this.broadcastToParty(party, `${newLeader?.name || "?"} 成為新隊長`);
        }
        this.syncParty(party);
    }

    // ==================== 經驗分享 ====================

    /**
     * 擊殺結算時調用：回傳除擊殺者外、應獲得全額經驗的隊員清單
     * 條件：同隊、同 Room、存活、距擊殺點 XP_SHARE_RANGE 內
     */
    getXpShareMembers(killer: Player, killX: number, killZ: number): { player: Player; client: Client }[] {
        if (!killer.partyId) return [];
        const party = this.parties.get(killer.partyId);
        if (!party) return [];

        const result: { player: Player; client: Client }[] = [];
        party.memberSessionIds.forEach((sid) => {
            if (sid === killer.sessionId) return;
            const p = this.room.state.players.get(sid);
            if (!p || p.hp <= 0) return;
            const d = Math.hypot(p.x - killX, p.z - killZ);
            if (d > PARTY_CONFIG.XP_SHARE_RANGE) return;
            const c = this.room.clients.find((cl) => cl.sessionId === sid);
            if (c) result.push({ player: p, client: c });
        });
        return result;
    }

    // ==================== 查詢 / 同步 ====================

    getPartyInfo(partyId: string): IPartyInfo | null {
        const party = this.parties.get(partyId);
        if (!party) return null;
        return {
            partyId: party.id,
            leaderSessionId: party.leaderSessionId,
            members: party.memberSessionIds
                .map((sid) => this.room.state.players.get(sid))
                .filter((p): p is Player => !!p)
                .map((p) => ({ sessionId: p.sessionId, name: p.name, level: p.level })),
        };
    }

    private broadcastToParty(party: IParty, systemMessage?: string): void {
        const info = this.getPartyInfo(party.id);
        party.memberSessionIds.forEach((sid) => {
            const c = this.room.clients.find((cl) => cl.sessionId === sid);
            if (c) {
                c.send("partyUpdate", info);
                if (systemMessage) c.send("notification", `[隊伍] ${systemMessage}`);
            }
        });
    }

    /** 同步隊伍快照到 Firebase（供 Dashboard 檢視） */
    private syncParty(party: IParty): void {
        this.broadcastToParty(party);
        const db = getFirestore();
        if (!db) return;
        const info = this.getPartyInfo(party.id);
        if (!info) return;
        db.collection("runtime_parties").doc(party.id).set({
            ...info,
            updatedAt: Date.now(),
        }).catch((e: any) => console.error("[Party] 快照寫入失敗:", e));
    }

    private removePartySnapshot(partyId: string): void {
        const db = getFirestore();
        if (!db) return;
        db.collection("runtime_parties").doc(partyId).delete()
            .catch((e: any) => console.error("[Party] 快照刪除失敗:", e));
    }
}
