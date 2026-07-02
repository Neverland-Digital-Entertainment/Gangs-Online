/**
 * Territory polygon geometry helpers (Phase 21)
 *
 * 地盤多邊形的防呆檢查：
 * - 頂點重疊檢查（任兩個頂點距離過近）
 * - 自我相交檢查（任兩條邊線交叉）
 * - 領地間重疊檢查（polygon intersection：邊相交或互相包含）
 */

export interface Vec2 {
    x: number;
    z: number;
}

/** 兩頂點視為「重疊」的最小距離 */
export const MIN_VERTEX_DISTANCE = 1.0;

/** 點擊「回到起始點」判定封閉的距離 */
export const CLOSE_POLYGON_DISTANCE = 3.0;

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** 線段方向叉積 */
const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const onSegment = (p: Vec2, q: Vec2, r: Vec2): boolean =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.z, r.z) <= q.z && q.z <= Math.max(p.z, r.z);

/** 標準線段相交判定（含共線重疊） */
export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    if (d1 === 0 && onSegment(p3, p1, p4)) return true;
    if (d2 === 0 && onSegment(p3, p2, p4)) return true;
    if (d3 === 0 && onSegment(p1, p3, p2)) return true;
    if (d4 === 0 && onSegment(p1, p4, p2)) return true;
    return false;
}

/** 任兩個頂點是否重疊（距離 < MIN_VERTEX_DISTANCE） */
export function hasOverlappingVertices(vertices: Vec2[]): boolean {
    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            if (dist(vertices[i], vertices[j]) < MIN_VERTEX_DISTANCE) return true;
        }
    }
    return false;
}

/**
 * 封閉多邊形是否自我相交（任兩條「非相鄰」邊交叉）
 */
export function polygonSelfIntersects(vertices: Vec2[]): boolean {
    const n = vertices.length;
    if (n < 4) return false; // 三角形不可能自交（頂點重疊另行檢查）
    for (let i = 0; i < n; i++) {
        const a1 = vertices[i];
        const a2 = vertices[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            // 跳過相鄰邊（共用頂點）
            if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
            const b1 = vertices[j];
            const b2 = vertices[(j + 1) % n];
            if (segmentsIntersect(a1, a2, b1, b2)) return true;
        }
    }
    return false;
}

/**
 * 繪製中檢查：新落點形成的新邊，是否與既有邊（未封閉的折線）交叉
 * @param points 既有點（依序）
 * @param newPoint 準備落下的新點
 */
export function newEdgeCrossesExisting(points: Vec2[], newPoint: Vec2): boolean {
    if (points.length < 2) return false;
    const last = points[points.length - 1];
    // 與除最後一條邊以外的所有既有邊比較（相鄰邊共用頂點必然「相交」，排除）
    for (let i = 0; i < points.length - 2; i++) {
        if (segmentsIntersect(last, newPoint, points[i], points[i + 1])) return true;
    }
    return false;
}

/** 射線法：點是否在多邊形內 */
export function pointInPolygon(p: Vec2, vertices: Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, zi = vertices[i].z;
        const xj = vertices[j].x, zj = vertices[j].z;
        if ((zi > p.z) !== (zj > p.z) && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * 兩個多邊形是否重疊（邊相交、或其中一個包含另一個）
 */
export function polygonsIntersect(a: Vec2[], b: Vec2[]): boolean {
    for (let i = 0; i < a.length; i++) {
        const a1 = a[i], a2 = a[(i + 1) % a.length];
        for (let j = 0; j < b.length; j++) {
            if (segmentsIntersect(a1, a2, b[j], b[(j + 1) % b.length])) return true;
        }
    }
    if (pointInPolygon(a[0], b)) return true;
    if (pointInPolygon(b[0], a)) return true;
    return false;
}

/**
 * 完整驗證一個多邊形（含與其他領地的重疊檢查）
 * @returns null = 合法；否則回傳錯誤訊息
 */
export function validatePolygon(vertices: Vec2[], others: { name: string; vertices: Vec2[] }[]): string | null {
    if (vertices.length < 3) return "至少需要 3 個頂點";
    if (hasOverlappingVertices(vertices)) return "有頂點重疊";
    if (polygonSelfIntersects(vertices)) return "邊線交叉（多邊形自我相交）";
    for (const o of others) {
        if (o.vertices?.length >= 3 && polygonsIntersect(vertices, o.vertices)) {
            return `與領地「${o.name}」範圍重疊`;
        }
    }
    return null;
}
