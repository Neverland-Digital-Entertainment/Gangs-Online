import * as BABYLON from "@babylonjs/core";
import { characterCollisionConfig } from "../config";

export interface NavPoint {
    x: number;
    z: number;
}

/** 障礙物喺地面（XZ 平面）嘅投影：一個有方向嘅長方形 */
interface Footprint {
    cx: number;
    cz: number;
    /** 第一條軸（單位向量）；第二條軸係 (-uz, ux) */
    ux: number;
    uz: number;
    /** 兩條軸方向嘅半長 */
    hu: number;
    hv: number;
}

/** 格仔大小（米）。要細過窄巷闊度先搵得到路穿過去 */
const CELL = 0.25;
/** 角色中心同障礙物最少隔幾遠：碰撞半徑再留少少位，路線唔會擦住牆角行 */
const CLEARANCE = characterCollisionConfig.radius + 0.05;
/** 障礙物空間索引的桶大小（米） */
const BUCKET = 8;
/** 搜尋範圍：起點同終點的外框再向外擴幾多米（要兜路時最多兜幾遠） */
const SEARCH_MARGIN = 60;
/** 路程長時搜尋範圍會收窄外擴，最少都擴咁多米 */
const MIN_SEARCH_MARGIN = 20;
/** 搜尋範圍最多幾多格（約 190m × 190m）；A* 陣列按呢個大小重用 */
const MAX_SEARCH_CELLS = 600000;
/** 直線距離超過呢個就唔搵路，照舊直線行（例如其他玩家瞬移咗去好遠） */
const MAX_PATH_DISTANCE = 200;
/** A* 最多展開幾多格。目標喺封閉地方（大廈入面）時會搜晒成個範圍，要有上限 */
const MAX_EXPANDED = 120000;
/**
 * 啟發值加權。>1 會少展開好多格（兜過成個街口時差幾倍），代價係路線未必最短；
 * 之後會拉直路線，實際差別睇唔出。
 */
const HEURISTIC_WEIGHT = 1.5;
/** 投影闊過呢個（米）嘅 mesh 當係成片合併幾何：用外框會封死成個範圍，唔放入導航 */
const MAX_FOOTPRINT = 300;
/** 起點被當成障礙（貼住牆企）時，最遠搵幾遠嘅空位做起點 */
const START_SNAP_RADIUS = 2;
/** 終點喺障礙入面（撳咗大廈）時，最遠搵幾遠嘅空位做終點 */
const GOAL_SNAP_RADIUS = 60;

/** A* 每格狀態 */
const FLAG_KNOWN = 1; // 已經計過係咪空位
const FLAG_FREE = 2;
const FLAG_CLOSED = 4;

const SQRT2 = Math.SQRT2;
const NEIGHBORS: [number, number, number][] = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** 桶座標轉成數字 key（地圖座標約 ±百萬米，桶編號唔會超過 2^20） */
function bucketKey(bx: number, bz: number): number {
    return bx * 2097152 + bz;
}

/** 座標所在格仔的中心 */
function cellCenter(v: number): number {
    return (Math.floor(v / CELL) + 0.5) * CELL;
}

/**
 * 角色搵路（客戶端）
 *
 * 以前角色係對住目標直線行，靠 moveWithCollisions 撞牆滑開：目標同角色之間隔住
 * 大廈（例如撳咗街口另一邊、或者撳大廈時改為行去大廈後面），角色就會頂住牆
 * 停低，明明兜個街口就行到。
 *
 * 做法：將有碰撞的靜態地圖幾何（大廈碰撞方塊、chunk 入面的 B/I mesh）投影到地面，
 * 喺起點同終點附近用格仔 A* 搵路，再拉直成幾個轉角點。地形本身唔當障礙
 * （行人路邊等矮級由碰撞橢球的 stepHeight 處理）。
 */
export class NavigationSystem {
    private scene: BABYLON.Scene;
    private isGround: (mesh: BABYLON.AbstractMesh) => boolean;
    private groundHeight: (x: number, z: number) => number;

    private buckets = new Map<number, Footprint[]>();
    private signature = "";
    private warnedHuge = new Set<number>();

    // A* 用的陣列（每格一個位），重用唔重新分配
    private searchId = 0;
    private stamp = new Uint32Array(0);
    private flags = new Uint8Array(0);
    private gScore = new Float32Array(0);
    private parentOf = new Int32Array(0);

    constructor(
        scene: BABYLON.Scene,
        isGround: (mesh: BABYLON.AbstractMesh) => boolean,
        groundHeight: (x: number, z: number) => number
    ) {
        this.scene = scene;
        this.isGround = isGround;
        this.groundHeight = groundHeight;
    }

    /**
     * 由 from 行去 to 要經過的點（唔包括起點，最後一點係終點）。
     * 終點行唔到（例如喺大廈入面）就改為行到最接近的行得到的位置。
     * 搵唔到路或者太遠就回傳 null，由呼叫端照舊直線行。
     */
    findPath(from: NavPoint, to: NavPoint): NavPoint[] | null {
        if (Math.hypot(to.x - from.x, to.z - from.z) > MAX_PATH_DISTANCE) return null;
        this.refreshObstacles();

        // 大部分情況直線已經通，唔使搵
        if (this.isFree(to.x, to.z) && this.lineIsFree(from.x, from.z, to.x, to.z)) {
            return [{ x: to.x, z: to.z }];
        }

        // A* 以格仔中心計，終點所在格企唔落就去唔到，會搜晒成個範圍。
        // 撳咗大廈：改為大廈外面最近的空位；貼住牆撳：改為隔籬最近的空格
        const toFree = this.isFree(to.x, to.z);
        const goal = toFree && this.isFree(cellCenter(to.x), cellCenter(to.z))
            ? to
            : this.nearestFreePoint(to, GOAL_SNAP_RADIUS, toFree ? CELL : CELL * 2);
        if (!goal) return null;
        if (goal !== to && this.lineIsFree(from.x, from.z, goal.x, goal.z)) return [goal];

        const cells = this.searchCells(from, goal);
        if (!cells) return null;

        const points: NavPoint[] = [{ x: from.x, z: from.z }];
        for (const [i, j] of cells) points.push({ x: (i + 0.5) * CELL, z: (j + 0.5) * CELL });
        const last = cells[cells.length - 1];
        const lastPoint = points[points.length - 1];
        // 去到終點格就準確停喺撳的位置，唔係停喺格仔中心
        if (last[0] === Math.floor(goal.x / CELL) && last[1] === Math.floor(goal.z / CELL)) {
            if (toFree && this.lineIsFree(lastPoint.x, lastPoint.z, to.x, to.z)) {
                points[points.length - 1] = { x: to.x, z: to.z };
            } else if (this.lineIsFree(lastPoint.x, lastPoint.z, goal.x, goal.z)) {
                points[points.length - 1] = { x: goal.x, z: goal.z };
            }
        }
        return this.smooth(points).slice(1);
    }

    /** 障礙物有冇變（chunk、地圖覆蓋層載入、監獄場景切換），有就重建索引 */
    private refreshObstacles(): void {
        const meshes: BABYLON.AbstractMesh[] = [];
        let idSum = 0;
        let flagSum = 0;
        for (const mesh of this.scene.meshes) {
            if (!this.isObstacleMesh(mesh)) continue;
            meshes.push(mesh);
            idSum += mesh.uniqueId;
            flagSum += mesh.computeWorldMatrix().updateFlag;
        }
        const signature = `${meshes.length}:${idSum}:${flagSum}`;
        if (signature === this.signature) return;
        this.signature = signature;

        this.buckets.clear();
        for (const mesh of meshes) {
            const fp = this.footprintOf(mesh);
            if (fp) this.addFootprint(fp);
        }
    }

    /** 只計靜態地圖幾何：角色、掉落物等等唔計 */
    private isObstacleMesh(mesh: BABYLON.AbstractMesh): boolean {
        if (!mesh.checkCollisions || !mesh.isEnabled() || mesh.getTotalVertices() === 0) return false;
        const md = mesh.metadata;
        if (!md || !(md.isOverrideCollider || md.chunkId || md.sceneId)) return false;
        return !this.isGround(mesh);
    }

    /** mesh 的有向外框投影到地面；擋唔到角色（太矮或者喺頭頂）就唔計 */
    private footprintOf(mesh: BABYLON.AbstractMesh): Footprint | null {
        const bb = mesh.getBoundingInfo().boundingBox;
        const center = bb.centerWorld;

        const ground = this.groundHeight(center.x, center.z);
        const { stepHeight, halfHeight } = characterCollisionConfig;
        if (bb.maximumWorld.y <= ground + stepHeight) return null;
        if (bb.minimumWorld.y >= ground + stepHeight + halfHeight * 2) return null;

        // directions 係世界矩陣的三條軸（連縮放），extendSize 係本地半長
        const axes = bb.directions.map((d) => d.length());
        if (axes.some((len) => len < 1e-6)) return null;
        const unit = bb.directions.map((d, i) => d.scale(1 / axes[i]));
        const half = [bb.extendSize.x * axes[0], bb.extendSize.y * axes[1], bb.extendSize.z * axes[2]];

        let up = 0;
        for (let i = 1; i < 3; i++) if (Math.abs(unit[i].y) > Math.abs(unit[up].y)) up = i;

        let fp: Footprint;
        const a = (up + 1) % 3;
        const ax = Math.hypot(unit[a].x, unit[a].z);
        if (Math.abs(unit[up].y) > 0.95 && ax > 1e-6) {
            // 企直的方塊：另外兩條軸就係地面長方形
            fp = {
                cx: center.x, cz: center.z,
                ux: unit[a].x / ax, uz: unit[a].z / ax,
                hu: half[a], hv: half[(up + 2) % 3],
            };
        } else {
            // 打斜的 mesh：用世界座標外框
            fp = {
                cx: center.x, cz: center.z, ux: 1, uz: 0,
                hu: bb.extendSizeWorld.x, hv: bb.extendSizeWorld.z,
            };
        }

        if (Math.max(fp.hu, fp.hv) * 2 > MAX_FOOTPRINT) {
            if (!this.warnedHuge.has(mesh.uniqueId)) {
                this.warnedHuge.add(mesh.uniqueId);
                console.warn(`[Navigation] ${mesh.name} 太大（${(Math.max(fp.hu, fp.hv) * 2).toFixed(0)}m），唔放入搵路`);
            }
            return null;
        }
        return fp;
    }

    private addFootprint(fp: Footprint): void {
        const ex = Math.abs(fp.ux) * fp.hu + Math.abs(fp.uz) * fp.hv + CLEARANCE;
        const ez = Math.abs(fp.uz) * fp.hu + Math.abs(fp.ux) * fp.hv + CLEARANCE;
        const x0 = Math.floor((fp.cx - ex) / BUCKET), x1 = Math.floor((fp.cx + ex) / BUCKET);
        const z0 = Math.floor((fp.cz - ez) / BUCKET), z1 = Math.floor((fp.cz + ez) / BUCKET);
        for (let bx = x0; bx <= x1; bx++) {
            for (let bz = z0; bz <= z1; bz++) {
                const key = bucketKey(bx, bz);
                const list = this.buckets.get(key);
                if (list) list.push(fp);
                else this.buckets.set(key, [fp]);
            }
        }
    }

    /** 角色中心企喺 (x, z) 會唔會撞到障礙物 */
    private isFree(x: number, z: number): boolean {
        const list = this.buckets.get(bucketKey(Math.floor(x / BUCKET), Math.floor(z / BUCKET)));
        if (!list) return true;
        for (const fp of list) {
            const dx = x - fp.cx;
            const dz = z - fp.cz;
            const a = Math.abs(dx * fp.ux + dz * fp.uz) - fp.hu;
            const b = Math.abs(dz * fp.ux - dx * fp.uz) - fp.hv;
            if (a >= CLEARANCE || b >= CLEARANCE) continue;
            if (a <= 0 || b <= 0 || a * a + b * b < CLEARANCE * CLEARANCE) return false;
        }
        return true;
    }

    private lineIsFree(x0: number, z0: number, x1: number, z1: number): boolean {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const steps = Math.ceil(len / (CELL * 0.5));
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            if (!this.isFree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
        }
        return true;
    }

    /**
     * 格仔 A*。回傳由起點格到終點格的格仔；終點去唔到就去最接近終點
     * 而又行得到的格仔。起點附近都搵唔到空位（例如困咗喺障礙入面）就回傳 null。
     */
    private searchCells(from: NavPoint, to: NavPoint): [number, number][] | null {
        // 搜尋範圍：起點同終點的外框再向外擴；太大就收窄外擴，免得佔用太多記憶體
        const spanX = Math.abs(to.x - from.x);
        const spanZ = Math.abs(to.z - from.z);
        let margin = SEARCH_MARGIN;
        while (margin > MIN_SEARCH_MARGIN &&
               ((spanX + margin * 2) / CELL) * ((spanZ + margin * 2) / CELL) > MAX_SEARCH_CELLS) {
            margin -= 10;
        }
        const minI = Math.floor((Math.min(from.x, to.x) - margin) / CELL);
        const minJ = Math.floor((Math.min(from.z, to.z) - margin) / CELL);
        const width = Math.floor((Math.max(from.x, to.x) + margin) / CELL) - minI + 1;
        const height = Math.floor((Math.max(from.z, to.z) + margin) / CELL) - minJ + 1;
        if (width * height > MAX_SEARCH_CELLS * 1.2) return null;
        this.beginSearch(width * height);

        const { stamp, flags, gScore, parentOf } = this;
        const searchId = this.searchId;
        const key = (i: number, j: number) => (i - minI) + (j - minJ) * width;
        // 每格第一次用到先初始化（用搜尋編號分辨，唔使每次清空成個陣列）
        const touch = (k: number) => {
            if (stamp[k] !== searchId) {
                stamp[k] = searchId;
                flags[k] = 0;
                gScore[k] = Infinity;
                parentOf[k] = -1;
            }
        };
        const cellFree = (i: number, j: number): boolean => {
            if (i < minI || j < minJ || i >= minI + width || j >= minJ + height) return false;
            const k = key(i, j);
            touch(k);
            if (!(flags[k] & FLAG_KNOWN)) {
                flags[k] |= FLAG_KNOWN | (this.isFree((i + 0.5) * CELL, (j + 0.5) * CELL) ? FLAG_FREE : 0);
            }
            return (flags[k] & FLAG_FREE) !== 0;
        };

        const startPoint = this.isFree(from.x, from.z) ? from : this.nearestFreePoint(from, START_SNAP_RADIUS, CELL);
        if (!startPoint) return null;
        const startI = Math.floor(startPoint.x / CELL);
        const startJ = Math.floor(startPoint.z / CELL);
        if (!cellFree(startI, startJ)) return null;
        const goalI = Math.floor(to.x / CELL);
        const goalJ = Math.floor(to.z / CELL);
        const heuristic = (i: number, j: number) => {
            const dx = Math.abs(i - goalI);
            const dz = Math.abs(j - goalJ);
            return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)) * HEURISTIC_WEIGHT;
        };

        const open = new MinHeap();
        const startKey = key(startI, startJ);
        gScore[startKey] = 0;
        open.push(startKey, heuristic(startI, startJ));
        let bestKey = startKey;
        let bestH = heuristic(startI, startJ);

        let expanded = 0;
        while (open.size > 0 && expanded < MAX_EXPANDED) {
            const current = open.pop();
            if (flags[current] & FLAG_CLOSED) continue;
            flags[current] |= FLAG_CLOSED;
            expanded++;

            const ci = (current % width) + minI;
            const cj = Math.floor(current / width) + minJ;
            const h = heuristic(ci, cj);
            if (h < bestH) {
                bestH = h;
                bestKey = current;
            }
            if (ci === goalI && cj === goalJ) break;

            const cg = gScore[current];
            for (const [di, dj, cost] of NEIGHBORS) {
                const ni = ci + di;
                const nj = cj + dj;
                if (!cellFree(ni, nj)) continue;
                // 斜行唔可以切牆角
                if (di !== 0 && dj !== 0 && (!cellFree(ci + di, cj) || !cellFree(ci, cj + dj))) continue;
                const nk = key(ni, nj);
                if (flags[nk] & FLAG_CLOSED) continue;
                const ng = cg + cost;
                if (gScore[nk] <= ng) continue;
                gScore[nk] = ng;
                parentOf[nk] = current;
                open.push(nk, ng + heuristic(ni, nj));
            }
        }

        const cells: [number, number][] = [];
        for (let k = bestKey; k !== -1; k = parentOf[k]) {
            cells.push([(k % width) + minI, Math.floor(k / width) + minJ]);
        }
        return cells.reverse();
    }

    /** 準備搜尋用的陣列：唔夠大先重新分配，之後一直重用 */
    private beginSearch(cells: number): void {
        if (this.stamp.length < cells) {
            this.stamp = new Uint32Array(cells);
            this.flags = new Uint8Array(cells);
            this.gScore = new Float32Array(cells);
            this.parentOf = new Int32Array(cells);
            this.searchId = 0;
        }
        this.searchId++;
    }

    /**
     * 附近最近的空位：一圈圈向外搵（step 係每圈間距），外圈唔會再近過已搵到的就停。
     * 回傳格仔中心，確保 A* 用得返同一格。
     */
    private nearestFreePoint(p: NavPoint, radius: number, step: number): NavPoint | null {
        const rings = Math.ceil(radius / step);
        let best: NavPoint | null = null;
        let bestDist = Infinity;
        for (let r = 1; r <= rings && (r - 1) * step < bestDist; r++) {
            for (let di = -r; di <= r; di++) {
                // 只行呢一圈的邊
                const edge = Math.abs(di) === r;
                for (let dj = -r; dj <= r; dj += edge ? 1 : 2 * r) {
                    const x = cellCenter(p.x + di * step);
                    const z = cellCenter(p.z + dj * step);
                    const d = Math.hypot(x - p.x, z - p.z);
                    if (d < bestDist && this.isFree(x, z)) {
                        bestDist = d;
                        best = { x, z };
                    }
                }
            }
        }
        return best;
    }

    /** 拉直：由每個轉角點盡量直線望到最遠嗰點，中間的點全部唔要 */
    private smooth(points: NavPoint[]): NavPoint[] {
        if (points.length <= 2) return points;
        const out: NavPoint[] = [points[0]];
        let anchor = 0;
        while (anchor < points.length - 1) {
            let next = anchor + 1;
            while (
                next + 1 < points.length &&
                this.lineIsFree(points[anchor].x, points[anchor].z, points[next + 1].x, points[next + 1].z)
            ) {
                next++;
            }
            out.push(points[next]);
            anchor = next;
        }
        return out;
    }
}

/** A* 用的最小堆（key 係格仔編號，priority 係 f 值） */
class MinHeap {
    private keys: number[] = [];
    private priorities: number[] = [];

    get size(): number {
        return this.keys.length;
    }

    push(key: number, priority: number): void {
        const keys = this.keys;
        const pr = this.priorities;
        let i = keys.length;
        keys.push(key);
        pr.push(priority);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (pr[p] <= priority) break;
            keys[i] = keys[p];
            pr[i] = pr[p];
            i = p;
        }
        keys[i] = key;
        pr[i] = priority;
    }

    pop(): number {
        const keys = this.keys;
        const pr = this.priorities;
        const top = keys[0];
        const lastKey = keys.pop()!;
        const lastPr = pr.pop()!;
        const n = keys.length;
        if (n > 0) {
            let i = 0;
            while (true) {
                const l = i * 2 + 1;
                if (l >= n) break;
                const r = l + 1;
                const c = r < n && pr[r] < pr[l] ? r : l;
                if (pr[c] >= lastPr) break;
                keys[i] = keys[c];
                pr[i] = pr[c];
                i = c;
            }
            keys[i] = lastKey;
            pr[i] = lastPr;
        }
        return top;
    }
}
