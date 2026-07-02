'use client';

/**
 * 系統資料檢視（Phase 21）
 *
 * 供測試與正式運作時檢查各新系統的即時資料，加快 debug：
 * - 武器強化紀錄（weapon_enhance_logs）
 * - 社團資料（guilds + society 擴展欄位）
 * - 地盤狀態（territories：歸屬/守衛/保護期）
 * - 組隊快照（runtime_parties）
 * - 玩家資料（players：金錢/等級/裝備/背包）
 */
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase/config';
import { RefreshCw } from 'lucide-react';

type Tab = 'enhance' | 'society' | 'territory' | 'party' | 'player';

const TABS: { key: Tab; label: string }[] = [
    { key: 'enhance', label: '🗡️ 武器強化紀錄' },
    { key: 'society', label: '🏮 社團' },
    { key: 'territory', label: '🚩 地盤' },
    { key: 'party', label: '👥 組隊' },
    { key: 'player', label: '🧍 玩家' },
];

const fmtTime = (ts: any): string => {
    if (!ts) return '-';
    const ms = typeof ts === 'number' ? ts : ts.seconds ? ts.seconds * 1000 : 0;
    return ms ? new Date(ms).toLocaleString('zh-TW') : '-';
};

export default function SystemsDataPage() {
    const [tab, setTab] = useState<Tab>('enhance');
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async (t: Tab) => {
        setLoading(true);
        setError('');
        try {
            const { db } = getFirebaseServices();
            let data: any[] = [];
            switch (t) {
                case 'enhance': {
                    const snap = await getDocs(query(collection(db, 'weapon_enhance_logs'), orderBy('timestamp', 'desc'), limit(100)));
                    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    break;
                }
                case 'society': {
                    const snap = await getDocs(collection(db, 'guilds'));
                    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    break;
                }
                case 'territory': {
                    const snap = await getDocs(collection(db, 'territories'));
                    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    break;
                }
                case 'party': {
                    const snap = await getDocs(collection(db, 'runtime_parties'));
                    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    break;
                }
                case 'player': {
                    const snap = await getDocs(query(collection(db, 'players'), limit(100)));
                    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                    break;
                }
            }
            setRows(data);
        } catch (e: any) {
            console.error(e);
            setError(`讀取失敗：${e?.message || e}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(tab); }, [tab, load]);

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold">📊 系統資料檢視</h1>
                <button onClick={() => load(tab)} className="btn-light flex items-center gap-1 px-3 py-1">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
                </button>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-3 py-1 rounded ${tab === t.key ? 'bg-yellow-500 text-black font-bold' : 'btn-light'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && <div className="text-red-500 mb-3">{error}</div>}
            {loading && <div className="text-[var(--muted)]">載入中...</div>}

            {!loading && tab === 'enhance' && (
                <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-left border-b border-[var(--border)]">
                            <th className="p-2">時間</th><th className="p-2">玩家</th><th className="p-2">武器</th>
                            <th className="p-2">強化</th><th className="p-2">結果</th><th className="p-2">保底</th>
                            <th className="p-2">消耗</th>
                        </tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-b border-[var(--border)]">
                                    <td className="p-2">{fmtTime(r.timestamp)}</td>
                                    <td className="p-2">{r.playerName}</td>
                                    <td className="p-2">{r.weaponName}</td>
                                    <td className="p-2">+{r.fromLevel} → +{r.toLevel}</td>
                                    <td className={`p-2 font-bold ${r.success ? 'text-green-500' : 'text-red-500'}`}>{r.success ? '成功' : '失敗'}</td>
                                    <td className="p-2">{r.pityTriggered ? '✅' : ''}</td>
                                    <td className="p-2">${r.goldCost} + 石x{r.stoneCost}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && <div className="p-4 text-[var(--muted)]">尚無強化紀錄</div>}
                </div>
            )}

            {!loading && tab === 'society' && rows.map((g) => (
                <div key={g.id} className="card p-4 mb-3">
                    <div className="font-bold text-lg">{g.name} <span className="text-sm text-[var(--muted)]">({g.id})</span></div>
                    <div className="text-sm mt-1">
                        社團等級：Lv{g.society?.level ?? 1}　經驗：{g.society?.exp ?? 0}　資金：${g.society?.funds ?? 0}　成員：{g.memberCount}
                    </div>
                    <div className="text-sm mt-2 font-bold">成員與職級：</div>
                    <table className="w-full text-sm mt-1">
                        <thead><tr className="text-left border-b border-[var(--border)]">
                            <th className="p-1">UserId</th><th className="p-1">職級</th><th className="p-1">可用貢獻</th><th className="p-1">總貢獻</th><th className="p-1">加入時間</th>
                        </tr></thead>
                        <tbody>
                            {Object.entries(g.members || {}).map(([uid, m]: [string, any]) => (
                                <tr key={uid} className="border-b border-[var(--border)]">
                                    <td className="p-1 font-mono text-xs">{uid}</td>
                                    <td className="p-1">{m.role}</td>
                                    <td className="p-1">{g.society?.contributions?.[uid] ?? 0}</td>
                                    <td className="p-1">{g.society?.totalContributions?.[uid] ?? 0}</td>
                                    <td className="p-1">{fmtTime(m.joinTime)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="text-sm mt-2">
                        <b>倉庫（{(g.society?.warehouse || []).length} 件）：</b>
                        {(g.society?.warehouse || []).map((w: any, i: number) => (
                            <span key={i} className="inline-block bg-[var(--sidebar-hover)] rounded px-2 py-0.5 m-0.5 text-xs">{w.name}</span>
                        ))}
                    </div>
                </div>
            ))}
            {!loading && tab === 'society' && rows.length === 0 && <div className="text-[var(--muted)]">尚無社團</div>}

            {!loading && tab === 'territory' && rows.map((t) => (
                <div key={t.id} className="card p-4 mb-3">
                    <div className="font-bold">{t.name} <span className="text-sm text-[var(--muted)]">({t.id})</span></div>
                    <div className="text-sm mt-1">
                        持有：<b>{t.ownerGuildName || '中立無主'}</b>
                        {t.protectionUntil > Date.now() && <span className="text-yellow-500">　🛡️ 保護期至 {fmtTime(t.protectionUntil)}</span>}
                        <br />
                        頂點數：{t.vertices?.length || 0}　守衛：{(t.guards || []).filter((g: any) => g.alive).length} 存活 / {(t.guards || []).length} 已招聘 / {t.maxGuardSlots} 位
                        <br />佔領時間：{fmtTime(t.capturedAt)}　更新：{fmtTime(t.updatedAt)}
                    </div>
                    {(t.guards || []).length > 0 && (
                        <div className="text-xs mt-1">
                            {(t.guards || []).map((g: any) => (
                                <span key={g.slot} className={`inline-block rounded px-2 py-0.5 m-0.5 ${g.alive ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
                                    位{g.slot + 1} Lv{g.level} {g.alive ? `HP ${g.hp}/${g.maxHp}` : (g.respawnAt ? '重生中' : '陣亡')}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {!loading && tab === 'territory' && rows.length === 0 && <div className="text-[var(--muted)]">尚無地盤（請先在「地盤設置」繪製）</div>}

            {!loading && tab === 'party' && rows.map((p) => (
                <div key={p.id} className="card p-4 mb-3">
                    <div className="font-bold">{p.partyId} <span className="text-xs text-[var(--muted)]">更新：{fmtTime(p.updatedAt)}</span></div>
                    <div className="text-sm">
                        {(p.members || []).map((m: any) => (
                            <span key={m.sessionId} className="inline-block bg-[var(--sidebar-hover)] rounded px-2 py-0.5 m-0.5">
                                {m.sessionId === p.leaderSessionId ? '👑 ' : ''}{m.name}（Lv{m.level}）
                            </span>
                        ))}
                    </div>
                </div>
            ))}
            {!loading && tab === 'party' && rows.length === 0 && <div className="text-[var(--muted)]">目前沒有進行中的隊伍快照</div>}

            {!loading && tab === 'player' && (
                <div className="card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-left border-b border-[var(--border)]">
                            <th className="p-2">名稱</th><th className="p-2">等級</th><th className="p-2">金錢</th>
                            <th className="p-2">裝備武器</th><th className="p-2">攻擊加成</th><th className="p-2">背包</th><th className="p-2">最後上線</th>
                        </tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-b border-[var(--border)]">
                                    <td className="p-2">{r.name}</td>
                                    <td className="p-2">Lv{r.level}</td>
                                    <td className="p-2">${r.money}</td>
                                    <td className="p-2">{r.equippedWeaponName || '-'}</td>
                                    <td className="p-2">+{r.attackBonus || 0}</td>
                                    <td className="p-2 text-xs">
                                        {(r.inventory || []).slice(0, 8).map((it: any, i: number) => (
                                            <span key={i} className="inline-block bg-[var(--sidebar-hover)] rounded px-1 m-0.5">{it.name}</span>
                                        ))}
                                        {(r.inventory || []).length > 8 && ` +${(r.inventory || []).length - 8}`}
                                    </td>
                                    <td className="p-2">{fmtTime(r.lastOnline)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && <div className="p-4 text-[var(--muted)]">尚無玩家資料</div>}
                </div>
            )}
        </div>
    );
}
