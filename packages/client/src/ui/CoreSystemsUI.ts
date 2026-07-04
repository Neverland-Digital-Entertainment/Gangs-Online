/**
 * Core Systems UI (Phase 21)
 *
 * 以「擴展」方式掛進遊戲的新系統 UI（不改動現有 UI 檔案）：
 * - U 鍵：背包 / 武器（裝備、強化 +0~+15）
 * - G 鍵：社團（職級/任免/捐獻/倉庫/社團商店）
 * - P 鍵：組隊（邀請/接受/離開）
 * - T 鍵：地盤（列表/佔領/招聘守衛）
 * - K 鍵：發放測試套件（唐刀 + 強化石 x20 + $100,000）
 * - L 鍵 / 右上角按鈕：登出（切換帳號用）
 * - R 鍵：重置座標（角色卡在地圖外時傳送回出生點）
 *
 * 全部使用 DOM 元素（與 QuestBlueprintUI 相同做法），聊天輸入框 focus 時不觸發快捷鍵。
 */
import { Room } from "colyseus.js";
import {
    WEAPON_ENHANCE_CONFIG,
    IEnhanceResult,
    IPartyInfo,
    ITerritoryStatus,
    SocietyRole,
} from "@gangs-online/shared";
import { firebaseService } from "../services/FirebaseService";

/** HTML escape：玩家名/社團名等使用者可控字串進入 innerHTML 前必須經過此函數（防 XSS） */
const esc = (s: unknown): string =>
    String(s ?? "").replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
    ));

const PANEL_STYLE = `
    display: none;
    position: fixed;
    top: 60px;
    right: 20px;
    width: 420px;
    max-height: 75vh;
    overflow-y: auto;
    background: rgba(10, 10, 15, 0.94);
    border: 2px solid #FFD700;
    border-radius: 10px;
    padding: 16px;
    color: #eee;
    font-family: "Microsoft JhengHei", sans-serif;
    font-size: 13px;
    z-index: 900;
`;

const BTN_STYLE = `
    background: #FFD700; color: #000; border: none; border-radius: 4px;
    padding: 3px 8px; margin: 2px; cursor: pointer; font-size: 12px;
`;

const BTN_DARK_STYLE = `
    background: #333; color: #FFD700; border: 1px solid #FFD700; border-radius: 4px;
    padding: 3px 8px; margin: 2px; cursor: pointer; font-size: 12px;
`;

export class CoreSystemsUI {
    private room: Room;
    private panels: Map<string, HTMLDivElement> = new Map();
    private partyInfo: IPartyInfo | null = null;
    private pendingInvite: { inviterName: string } | null = null;

    constructor(room: Room) {
        this.room = room;
        this.createPanels();
        this.setupHotkeys();
        this.setupMessages();
        this.createHintBar();
        this.createLogoutButton();
    }

    // ==================== 基礎 ====================

    /** 登出（切換帳號）：離開房間 → Firebase 登出 → 重新整理頁面回到登入畫面 */
    private async logout(): Promise<void> {
        if (!confirm("確定要登出嗎？將回到登入畫面。")) return;
        try {
            this.room.leave();
        } catch (e) {
            console.warn("離開房間時發生錯誤（忽略，繼續登出）:", e);
        }
        try {
            await firebaseService.logout();
        } catch (e) {
            console.error("登出失敗:", e);
        } finally {
            window.location.reload();
        }
    }

    private createLogoutButton(): void {
        const btn = document.createElement("button");
        btn.id = "core-logout-btn";
        btn.textContent = "🚪 登出 (L)";
        btn.style.cssText = `
            position: fixed; top: 12px; right: 20px; z-index: 950;
            background: #333; color: #FFD700; border: 1px solid #FFD700; border-radius: 6px;
            padding: 5px 10px; cursor: pointer; font-size: 12px;
            font-family: "Microsoft JhengHei", sans-serif;
        `;
        btn.onclick = () => this.logout();
        document.body.appendChild(btn);

        // 重置座標：角色卡在地圖外/掉出場景時的自救按鈕
        const resetBtn = document.createElement("button");
        resetBtn.id = "core-reset-position-btn";
        resetBtn.textContent = "📍 回到地圖 (R)";
        resetBtn.style.cssText = `
            position: fixed; top: 12px; right: 110px; z-index: 950;
            background: #333; color: #FFD700; border: 1px solid #FFD700; border-radius: 6px;
            padding: 5px 10px; cursor: pointer; font-size: 12px;
            font-family: "Microsoft JhengHei", sans-serif;
        `;
        resetBtn.onclick = () => this.resetPosition();
        document.body.appendChild(resetBtn);
    }

    /** 重置座標：角色卡在地圖外時傳送回出生點（只影響自己座標，無作弊疑慮） */
    private resetPosition(): void {
        this.room.send("resetPosition");
    }

    private createPanel(key: string, title: string): HTMLDivElement {
        const panel = document.createElement("div");
        panel.id = `core-panel-${key}`;
        panel.style.cssText = PANEL_STYLE;
        const header = document.createElement("div");
        header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;";
        header.innerHTML = `<b style="color:#FFD700;font-size:15px;">${title}</b>`;
        const close = document.createElement("button");
        close.textContent = "✕";
        close.style.cssText = BTN_DARK_STYLE;
        close.onclick = () => this.hide(key);
        header.appendChild(close);
        panel.appendChild(header);
        const body = document.createElement("div");
        body.className = "core-panel-body";
        panel.appendChild(body);
        document.body.appendChild(panel);
        this.panels.set(key, panel);
        return panel;
    }

    private createPanels(): void {
        this.createPanel("inventory", "🗡️ 背包 / 武器強化 (U)");
        this.createPanel("society", "🏮 社團 (G)");
        this.createPanel("party", "👥 組隊 (P)");
        this.createPanel("territory", "🚩 地盤 (T)");
    }

    private createHintBar(): void {
        const bar = document.createElement("div");
        bar.style.cssText = `
            position: fixed; bottom: 8px; right: 12px; z-index: 899;
            color: rgba(255,215,0,0.75); font-size: 11px; font-family: monospace;
            background: rgba(0,0,0,0.5); padding: 3px 8px; border-radius: 4px;
        `;
        bar.textContent = "U:武器強化  G:社團  P:組隊  T:地盤  K:測試套件  N:生成測試怪  L:登出  R:回到地圖";
        document.body.appendChild(bar);
    }

    private body(key: string): HTMLDivElement {
        return this.panels.get(key)!.querySelector(".core-panel-body") as HTMLDivElement;
    }

    private toggle(key: string): void {
        const panel = this.panels.get(key)!;
        if (panel.style.display === "none" || !panel.style.display) {
            this.panels.forEach((p) => (p.style.display = "none"));
            panel.style.display = "block";
            this.refresh(key);
        } else {
            panel.style.display = "none";
        }
    }

    private hide(key: string): void {
        this.panels.get(key)!.style.display = "none";
    }

    private isVisible(key: string): boolean {
        return this.panels.get(key)!.style.display === "block";
    }

    private refresh(key: string): void {
        switch (key) {
            case "inventory": this.renderInventory(); break;
            case "society": this.room.send("societyInfo"); break;
            case "party": this.room.send("partyInfo"); this.renderParty(); break;
            case "territory": this.room.send("territoryList"); break;
        }
    }

    private setupHotkeys(): void {
        document.addEventListener("keydown", (e) => {
            // 輸入框 focus 時不觸發
            const active = document.activeElement;
            if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;

            switch (e.key.toLowerCase()) {
                case "u": this.toggle("inventory"); break;
                case "g": this.toggle("society"); break;
                case "p": this.toggle("party"); break;
                case "t": this.toggle("territory"); break;
                case "k": this.room.send("giveTestKit"); break;
                case "n": this.room.send("spawnTestEnemies"); break;
                case "l": this.logout(); break;
                case "r": this.resetPosition(); break;
            }
        });
    }

    private me(): any {
        return (this.room.state as any).players.get(this.room.sessionId);
    }

    private notify(text: string): void {
        // 輕量 toast
        const el = document.createElement("div");
        el.style.cssText = `
            position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.85); color: #FFD700; padding: 8px 18px;
            border-radius: 6px; z-index: 999; font-size: 14px;
            font-family: "Microsoft JhengHei", sans-serif;
        `;
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }

    // ==================== Server 訊息 ====================

    private setupMessages(): void {
        this.room.onMessage("enhanceResult", (r: IEnhanceResult) => {
            this.notify(r.message);
            if (this.isVisible("inventory")) this.renderInventory();
        });

        this.room.onMessage("societyInfo", (info: any) => this.renderSociety(info));

        this.room.onMessage("partyInvite", (data: { inviterName: string }) => {
            this.pendingInvite = data;
            this.panels.forEach((p) => (p.style.display = "none"));
            this.panels.get("party")!.style.display = "block";
            this.renderParty();
        });

        this.room.onMessage("partyUpdate", (info: IPartyInfo | null) => {
            this.partyInfo = info;
            if (this.isVisible("party")) this.renderParty();
        });

        this.room.onMessage("territoryList", (data: { territories: ITerritoryStatus[]; currentTerritoryId: string }) => {
            this.renderTerritories(data.territories, data.currentTerritoryId);
        });
    }

    // ==================== 背包 / 武器強化 ====================

    private renderInventory(): void {
        const body = this.body("inventory");
        const me = this.me();
        if (!me) { body.innerHTML = "載入中..."; return; }

        const inv: any[] = [];
        me.inventory.forEach((item: any) => inv.push(item));
        const stoneCount = inv.filter((i) => i.baseId === WEAPON_ENHANCE_CONFIG.ENHANCE_STONE_ITEM_ID).length;

        let html = `
            <div style="margin-bottom:8px;">💰 金幣：$${me.money}　💎 強化石：${stoneCount} 顆</div>
            <div style="margin-bottom:8px;">⚔️ 裝備中：${me.equippedWeaponName || "（無）"}　攻擊加成 +${me.attackBonus}</div>
            <hr style="border-color:#444;">
        `;
        body.innerHTML = html;

        inv.forEach((item, idx) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #333;";
            const label = document.createElement("span");
            label.textContent = `${item.name}${item.type === "weapon" ? `（攻 ${item.value}）` : ""}`;
            row.appendChild(label);
            const btns = document.createElement("span");

            if (item.type === "weapon") {
                const lv = item.enhanceLevel || 0;
                const equipBtn = document.createElement("button");
                equipBtn.style.cssText = BTN_DARK_STYLE;
                equipBtn.textContent = me.equippedWeaponIndex === idx ? "卸下" : "裝備";
                equipBtn.onclick = () => {
                    this.room.send("equipWeapon", { itemIndex: me.equippedWeaponIndex === idx ? -1 : idx });
                    setTimeout(() => this.renderInventory(), 300);
                };
                btns.appendChild(equipBtn);

                if (lv < WEAPON_ENHANCE_CONFIG.MAX_LEVEL) {
                    const rate = Math.round(WEAPON_ENHANCE_CONFIG.SUCCESS_RATES[lv] * 100);
                    const gold = WEAPON_ENHANCE_CONFIG.GOLD_COSTS[lv];
                    const stones = WEAPON_ENHANCE_CONFIG.STONE_COSTS[lv];
                    const enhanceBtn = document.createElement("button");
                    enhanceBtn.style.cssText = BTN_STYLE;
                    enhanceBtn.textContent = `強化 +${lv + 1}（${rate}% | $${gold} | 石x${stones}）`;
                    enhanceBtn.onclick = () => this.room.send("enhanceWeapon", { itemIndex: idx });
                    btns.appendChild(enhanceBtn);
                } else {
                    const max = document.createElement("span");
                    max.textContent = "已滿級";
                    max.style.color = "#888";
                    btns.appendChild(max);
                }
                if (item.failCount > 0) {
                    const pity = document.createElement("span");
                    pity.style.cssText = "color:#f88;font-size:11px;margin-left:4px;";
                    pity.textContent = `連敗${item.failCount}/${WEAPON_ENHANCE_CONFIG.PITY_FAIL_COUNT}`;
                    btns.appendChild(pity);
                }
            }

            // 存入社團倉庫
            const depositBtn = document.createElement("button");
            depositBtn.style.cssText = BTN_DARK_STYLE;
            depositBtn.textContent = "入倉";
            depositBtn.title = "存入社團倉庫";
            depositBtn.onclick = () => {
                this.room.send("societyDeposit", { itemIndex: idx });
                setTimeout(() => this.renderInventory(), 400);
            };
            btns.appendChild(depositBtn);

            row.appendChild(btns);
            body.appendChild(row);
        });

        if (inv.length === 0) {
            body.innerHTML += `<div style="color:#888;">背包是空的。按 K 領取測試套件。</div>`;
        }
    }

    // ==================== 社團 ====================

    private renderSociety(info: any): void {
        const body = this.body("society");
        if (!info) {
            body.innerHTML = `<div style="color:#888;">你未加入任何社團。<br>（社團的建立/加入沿用原有幫會介面/指令）</div>`;
            return;
        }

        body.innerHTML = `
            <div><b style="color:#FFD700;">${esc(info.name)}</b>　Lv${Number(info.level)}（經驗 ${Number(info.exp)}${info.nextLevelExp ? "/" + Number(info.nextLevelExp) : "（滿級）"}）</div>
            <div>💰 社團資金：$${Number(info.funds)}　👥 成員：${Number(info.memberCount)}/${Number(info.memberCap)}</div>
            <div>我的職級：<b>${esc(info.myRole)}</b>　我的貢獻度：${Number(info.myContribution)}</div>
            <hr style="border-color:#444;">
        `;

        // 捐獻
        const donateRow = document.createElement("div");
        donateRow.innerHTML = `<b>捐獻金幣</b>（100金 = 1貢獻度，同時計入社團經驗）：`;
        const donateInput = document.createElement("input");
        donateInput.type = "number";
        donateInput.value = "1000";
        donateInput.style.cssText = "width:80px;margin:0 4px;background:#222;color:#fff;border:1px solid #555;padding:2px;";
        const donateBtn = document.createElement("button");
        donateBtn.style.cssText = BTN_STYLE;
        donateBtn.textContent = "捐獻";
        donateBtn.onclick = () => {
            this.room.send("societyDonate", { gold: parseInt(donateInput.value, 10) || 0 });
            setTimeout(() => this.room.send("societyInfo"), 500);
        };
        donateRow.appendChild(donateInput);
        donateRow.appendChild(donateBtn);
        body.appendChild(donateRow);

        // 成員列表 + 任免
        const roles: SocietyRole[] = ['坐館', '紅棍', '白紙扇', '草鞋', '四九仔'];
        const memberTitle = document.createElement("div");
        memberTitle.innerHTML = `<hr style="border-color:#444;"><b>成員</b>（任免需話事人/坐館權限）：`;
        body.appendChild(memberTitle);
        (info.members || []).forEach((m: any) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;";
            row.innerHTML = `<span>${esc(m.name)}　<b style="color:#FFD700;">${esc(m.role)}</b>　貢獻 ${Number(m.totalContribution)}</span>`;
            if (m.role !== "話事人") {
                const sel = document.createElement("select");
                sel.style.cssText = "background:#222;color:#fff;border:1px solid #555;font-size:12px;";
                roles.forEach((r) => {
                    const opt = document.createElement("option");
                    opt.value = r; opt.textContent = r;
                    if (r === m.role) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.onchange = () => {
                    this.room.send("societyAppoint", { targetUserId: m.userId, role: sel.value });
                    setTimeout(() => this.room.send("societyInfo"), 500);
                };
                row.appendChild(sel);
            }
            body.appendChild(row);
        });

        // 倉庫
        const whTitle = document.createElement("div");
        whTitle.innerHTML = `<hr style="border-color:#444;"><b>社團倉庫</b>（${(info.warehouse || []).length} 件；存入請在背包按「入倉」）：`;
        body.appendChild(whTitle);
        (info.warehouse || []).forEach((w: any, i: number) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;padding:2px 0;";
            row.innerHTML = `<span>${esc(w.name)}</span>`;
            const btn = document.createElement("button");
            btn.style.cssText = BTN_DARK_STYLE;
            btn.textContent = "取出";
            btn.onclick = () => {
                this.room.send("societyWithdraw", { warehouseIndex: i });
                setTimeout(() => this.room.send("societyInfo"), 500);
            };
            row.appendChild(btn);
            body.appendChild(row);
        });

        // 社團商店
        const shopTitle = document.createElement("div");
        shopTitle.innerHTML = `<hr style="border-color:#444;"><b>社團商店</b>（貢獻度兌換）：`;
        body.appendChild(shopTitle);
        (info.shopItems || []).forEach((s: any) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;padding:2px 0;";
            row.innerHTML = `<span>${esc(s.name)}（需社團 Lv${Number(s.minSocietyLevel)}）</span>`;
            const btn = document.createElement("button");
            btn.style.cssText = BTN_STYLE;
            btn.textContent = `${s.contributionPrice} 貢獻`;
            btn.onclick = () => {
                this.room.send("societyShopBuy", { itemId: s.itemId });
                setTimeout(() => this.room.send("societyInfo"), 500);
            };
            row.appendChild(btn);
            body.appendChild(row);
        });

        // 解散（僅話事人可成功，Server 會驗證）
        if (info.myRole === "話事人") {
            const disbandBtn = document.createElement("button");
            disbandBtn.style.cssText = BTN_DARK_STYLE + "margin-top:10px;color:#f66;border-color:#f66;";
            disbandBtn.textContent = "解散社團";
            disbandBtn.onclick = () => {
                if (confirm("確定要解散社團？此操作不可復原！")) this.room.send("societyDisband");
            };
            body.appendChild(disbandBtn);
        }
    }

    // ==================== 組隊 ====================

    private renderParty(): void {
        const body = this.body("party");
        body.innerHTML = "";

        // 待處理邀請
        if (this.pendingInvite) {
            const inviteBox = document.createElement("div");
            inviteBox.style.cssText = "border:1px solid #FFD700;border-radius:6px;padding:8px;margin-bottom:8px;";
            const inviterName = document.createElement("b");
            inviterName.textContent = this.pendingInvite.inviterName;
            inviteBox.appendChild(inviterName);
            inviteBox.appendChild(document.createTextNode(" 邀請你組隊！"));
            const acceptBtn = document.createElement("button");
            acceptBtn.style.cssText = BTN_STYLE;
            acceptBtn.textContent = "接受";
            acceptBtn.onclick = () => { this.room.send("partyAccept"); this.pendingInvite = null; };
            const declineBtn = document.createElement("button");
            declineBtn.style.cssText = BTN_DARK_STYLE;
            declineBtn.textContent = "拒絕";
            declineBtn.onclick = () => { this.room.send("partyDecline"); this.pendingInvite = null; this.renderParty(); };
            inviteBox.appendChild(document.createElement("br"));
            inviteBox.appendChild(acceptBtn);
            inviteBox.appendChild(declineBtn);
            body.appendChild(inviteBox);
        }

        // 邀請輸入
        const inviteRow = document.createElement("div");
        inviteRow.innerHTML = `<b>邀請玩家</b>（輸入玩家名稱）：`;
        const input = document.createElement("input");
        input.style.cssText = "width:120px;margin:0 4px;background:#222;color:#fff;border:1px solid #555;padding:2px;";
        const btn = document.createElement("button");
        btn.style.cssText = BTN_STYLE;
        btn.textContent = "邀請";
        btn.onclick = () => { if (input.value.trim()) this.room.send("partyInvite", { target: input.value.trim() }); };
        inviteRow.appendChild(input);
        inviteRow.appendChild(btn);
        body.appendChild(inviteRow);

        // 隊伍資訊
        const listDiv = document.createElement("div");
        listDiv.innerHTML = `<hr style="border-color:#444;">`;
        if (this.partyInfo) {
            listDiv.innerHTML += `<b>隊伍成員（${this.partyInfo.members.length}/5）</b>　擊殺經驗全隊共享（範圍內全額）`;
            this.partyInfo.members.forEach((m) => {
                const isLeader = m.sessionId === this.partyInfo!.leaderSessionId;
                const memberRow = document.createElement("div");
                memberRow.style.cssText = "padding:2px 0;";
                memberRow.textContent = `${isLeader ? "👑 " : ""}${m.name}（Lv${m.level}）`;
                listDiv.appendChild(memberRow);
            });
            const leaveBtn = document.createElement("button");
            leaveBtn.style.cssText = BTN_DARK_STYLE + "color:#f66;border-color:#f66;margin-top:6px;";
            leaveBtn.textContent = "離開隊伍";
            leaveBtn.onclick = () => this.room.send("partyLeave");
            listDiv.appendChild(leaveBtn);
        } else {
            listDiv.innerHTML += `<div style="color:#888;">尚未組隊</div>`;
        }
        body.appendChild(listDiv);
    }

    // ==================== 地盤 ====================

    private renderTerritories(list: ITerritoryStatus[], currentId: string): void {
        const body = this.body("territory");
        body.innerHTML = "";
        const me = this.me();

        if (list.length === 0) {
            body.innerHTML = `<div style="color:#888;">目前沒有任何地盤（請先在 Dashboard 的地盤設置模組繪製地盤）</div>`;
            return;
        }

        list.forEach((t) => {
            const isCurrent = t.id === currentId;
            const isMine = me && me.guildId && t.ownerGuildId === me.guildId;
            const protectedNow = t.protectionUntil > Date.now();
            const box = document.createElement("div");
            box.style.cssText = `border:1px solid ${isCurrent ? "#FFD700" : "#444"};border-radius:6px;padding:8px;margin-bottom:8px;`;
            box.innerHTML = `
                <b style="color:#FFD700;">${esc(t.name)}</b>${isCurrent ? "（你在此地盤內）" : ""}<br>
                持有：${esc(t.ownerGuildName || "無主")}${isMine ? "（我的社團）" : ""}<br>
                守衛：${Number(t.guardCount)} 存活 / ${Number(t.hiredGuardCount)} 已招聘 / ${Number(t.maxGuardSlots)} 位<br>
                ${protectedNow ? `🛡️ 保護期剩 ${Math.ceil((t.protectionUntil - Date.now()) / 60000)} 分鐘<br>` :
                    (!isMine && t.guardCount > 0 ? `擊敗全部守衛即可換旗（需有社團才能佔領）<br>` : "")}
            `;

            // 換旗全自動：擊敗地盤內全部守衛，若擊殺者有社團即自動成為新持有者
            // （無需手動宣告佔領，見 box 上方文字說明守衛數）

            // 招聘守衛（自家地盤）
            if (isMine && t.hiredGuardCount < t.maxGuardSlots) {
                const lvInput = document.createElement("input");
                lvInput.type = "number"; lvInput.min = "1"; lvInput.max = "10"; lvInput.value = "1";
                lvInput.style.cssText = "width:50px;margin:0 4px;background:#222;color:#fff;border:1px solid #555;padding:2px;";
                const hireBtn = document.createElement("button");
                hireBtn.style.cssText = BTN_STYLE;
                hireBtn.textContent = "招聘守衛";
                hireBtn.onclick = () => {
                    this.room.send("territoryHireGuard", {
                        territoryId: t.id,
                        slot: t.hiredGuardCount, // 下一個空位
                        level: parseInt(lvInput.value, 10) || 1,
                    });
                    setTimeout(() => this.room.send("territoryList"), 600);
                };
                const label = document.createElement("span");
                label.textContent = "守衛等級：";
                box.appendChild(label);
                box.appendChild(lvInput);
                box.appendChild(hireBtn);
            }

            body.appendChild(box);
        });

        const refreshBtn = document.createElement("button");
        refreshBtn.style.cssText = BTN_DARK_STYLE;
        refreshBtn.textContent = "🔄 重新整理";
        refreshBtn.onclick = () => this.room.send("territoryList");
        body.appendChild(refreshBtn);
    }
}
