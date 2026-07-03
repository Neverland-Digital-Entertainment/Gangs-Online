/**
 * Territory Service (Phase 21: 地盤設置模組)
 *
 * Firebase territories collection CRUD。
 * 注意（依 GDD 3.4a）：
 * - Dashboard 不設定「擁有者」欄位：新建地盤一律中立無主（ownerGuildId = ""），
 *   歸屬完全由伺服器的佔領機制在運行時決定
 * - 守衛上限固定 10（非可調欄位）
 */
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
} from 'firebase/firestore';
import { getFirebaseServices } from "@/lib/firebase/config";
import type { Vec2 } from './geometry';

const COLLECTION = 'territories';
export const MAX_GUARD_SLOTS = 10; // 全域固定值（GDD 3.3）

export interface TerritoryDoc {
    id: string;
    name: string;
    vertices: Vec2[];
    maxGuardSlots: number;
    ownerGuildId: string;
    ownerGuildName: string;
    protectionUntil: number;
    guards: any[];
    capturedAt: number;
    createdAt: number;
    updatedAt: number;
}

export class TerritoryService {
    private static instance: TerritoryService;

    static getInstance(): TerritoryService {
        if (!this.instance) this.instance = new TerritoryService();
        return this.instance;
    }

    async getAll(): Promise<TerritoryDoc[]> {
        const { db } = getFirebaseServices();
        const snapshot = await getDocs(collection(db, COLLECTION));
        return snapshot.docs.map((d) => ({ ...(d.data() as any), id: d.id })) as TerritoryDoc[];
    }

    async create(name: string, vertices: Vec2[]): Promise<string> {
        const { db } = getFirebaseServices();
        const now = Date.now();
        const ref = await addDoc(collection(db, COLLECTION), {
            name,
            vertices,
            maxGuardSlots: MAX_GUARD_SLOTS,
            // 初始一律中立無主，不由 GM 指定擁有者
            ownerGuildId: '',
            ownerGuildName: '',
            protectionUntil: 0,
            guards: [],
            capturedAt: 0,
            createdAt: now,
            updatedAt: now,
        });
        return ref.id;
    }

    /** 只允許更新頂點位置（數量固定）與名稱 */
    async updateVertices(id: string, vertices: Vec2[]): Promise<void> {
        const { db } = getFirebaseServices();
        await updateDoc(doc(db, COLLECTION, id), { vertices, updatedAt: Date.now() });
    }

    async rename(id: string, name: string): Promise<void> {
        const { db } = getFirebaseServices();
        await updateDoc(doc(db, COLLECTION, id), { name, updatedAt: Date.now() });
    }

    async remove(id: string): Promise<void> {
        const { db } = getFirebaseServices();
        await deleteDoc(doc(db, COLLECTION, id));
    }
}
