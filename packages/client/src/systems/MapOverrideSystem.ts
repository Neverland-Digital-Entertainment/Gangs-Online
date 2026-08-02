/**
 * MapOverrideSystem (Map Editor P5)
 *
 * 在底圖 chunks 載入完成後，從 Firestore 讀取 map_overrides 並套用：
 *   - delete    → 隱藏既有建築節點
 *   - transform → 套用新的 local transform 到既有節點
 *   - replace   → 隱藏原節點，載入資產 GLB 放到原位
 *   - add       → 載入資產 GLB 新增到地圖
 *
 * 資產 GLB 以 base64 分塊存在 Firestore building_assets/{id}/chunks，
 * 讀回重組成 object URL 再用 Babylon 載入（與後台一致）。
 * 同一份資產只會下載一次（見 `assetCache`）——量產大廈時同款資產會在地圖上
 * 重複出現數十至數百次，逐次重下會直接吃光 Firestore 讀取額度。
 *
 * 座標：override.transform 是「底圖 __root__ 之下的 local transform」，
 * 客戶端不平移地圖，故把資產容器掛在該 chunk 的 __root__ 下、套用 local
 * transform 即可對齊原始世界座標。
 */

import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    type Firestore,
} from "firebase/firestore";
import { firebaseService } from "../services/FirebaseService";
import { SceneManager } from "../world/SceneManager";
import { LoadedChunk } from "./ChunkLoaderSystem";

interface Vec3 {
    x: number;
    y: number;
    z: number;
}
interface OverrideTransform {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
}
interface MapOverride {
    id: string;
    chunkId: string;
    targetBuildingKey: string;
    action: "delete" | "transform" | "replace" | "add";
    assetId?: string;
    transform?: OverrideTransform;
    isActive: boolean;
    /** 遮擋群組。同一個值的實例會一齊淡出；省略則各自獨立 */
    groupId?: string;
}

/**
 * 資產用途。決定載入後的碰撞、可選取性與遮擋登記方式。
 *   building（預設）：實心建築，有碰撞體、參與遮擋淡出
 *   prop：街道物件，有碰撞體但不參與遮擋（不會令玩家身後的它變透明）
 *   decal：貼地平面（路面箭嘴、斑馬線、渠蓋等），無碰撞、不可選取、
 *          不參與遮擋，並套用 polygon offset 避免與路面 z-fighting
 */
type AssetKind = "building" | "prop" | "decal";

/** 已從 Firestore 取回並解析好的資產（Phase 1：快取 AssetContainer，唔再重複解析 GLB） */
interface CachedAsset {
    container: BABYLON.AssetContainer;
    kind: AssetKind;
}

const OVERRIDES_COLLECTION = "map_overrides";
const ASSETS_COLLECTION = "building_assets";
const CHUNKS_SUB = "chunks";

/** 貼地平面的深度偏移，負值把面拉向鏡頭以壓過路面 */
const DECAL_Z_OFFSET = -2;

export class MapOverrideSystem {
    private scene: BABYLON.Scene;
    private db: Firestore | null = null;

    /**
     * assetId → 資產內容。同一份資產在地圖上擺 N 次只會下載一次。
     *
     * 快取的是 Promise 而非結果，令並行的請求共用同一次下載。
     * 量產大廈時這是決定性的：每次擺放原本要讀 1 個 metadata 文件 +
     * N 個 base64 分塊文件，100 次擺放就是幾百個 Firestore read。
     */
    private assetCache = new Map<string, Promise<CachedAsset | null>>();

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /** 釋放資產快取（切換地圖時呼叫，避免長期佔住記憶體） */
    clearAssetCache(): void {
        for (const pending of this.assetCache.values()) {
            pending
                .then((asset) => asset?.container.dispose())
                .catch(() => {
                    /* 下載失敗的項目已無 container 需要 dispose */
                });
        }
        this.assetCache.clear();
    }

    private getDb(): Firestore | null {
        if (this.db) return this.db;
        const app = firebaseService.getApp();
        if (!app) return null;
        this.db = getFirestore(app);
        return this.db;
    }

    /** 對所有已載入 chunks 套用 overrides */
    async apply(sceneManager: SceneManager): Promise<void> {
        const db = this.getDb();
        if (!db) {
            console.warn("[MapOverride] Firestore unavailable, skipping overrides");
            return;
        }

        const loaded = sceneManager.getChunkLoader().getLoadedChunks();
        for (const [chunkId, chunk] of loaded) {
            let overrides: MapOverride[];
            try {
                overrides = await this.fetchOverrides(db, chunkId);
            } catch (err) {
                console.error(`[MapOverride] fetch failed for ${chunkId}:`, err);
                continue;
            }
            if (overrides.length === 0) continue;

            const root = this.findChunkRoot(chunk);
            let applied = 0;
            for (const ov of overrides) {
                try {
                    await this.applyOne(db, sceneManager, chunkId, root, ov);
                    applied++;
                } catch (err) {
                    console.error(`[MapOverride] apply failed`, ov, err);
                }
            }
            console.log(`[MapOverride] ${chunkId}: applied ${applied}/${overrides.length} override(s)`);
        }
    }

    private async fetchOverrides(db: Firestore, chunkId: string): Promise<MapOverride[]> {
        const q = query(collection(db, OVERRIDES_COLLECTION), where("chunkId", "==", chunkId));
        const snap = await getDocs(q);
        const out: MapOverride[] = [];
        snap.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            if (data.isActive === false) return;
            out.push({
                id: d.id,
                chunkId: data.chunkId as string,
                targetBuildingKey: data.targetBuildingKey as string,
                action: data.action as MapOverride["action"],
                assetId: data.assetId as string | undefined,
                transform: data.transform as OverrideTransform | undefined,
                isActive: (data.isActive as boolean) ?? true,
                groupId: (data.groupId as string | undefined) || undefined,
            });
        });
        return out;
    }

    /** 從 chunk 的任一 mesh 往上找到 __root__ */
    private findChunkRoot(chunk: LoadedChunk): BABYLON.TransformNode | null {
        const sample =
            chunk.meshes[0] || chunk.buildingMeshes[0] || chunk.terrainMeshes[0] || null;
        let node: BABYLON.Node | null = sample;
        while (node && node.name !== "__root__") {
            node = node.parent;
        }
        return (node as BABYLON.TransformNode) ?? null;
    }

    private findObjectNode(
        root: BABYLON.TransformNode | null,
        nodeName: string
    ): BABYLON.TransformNode | null {
        if (!root) return null;
        for (const child of root.getChildren()) {
            if (child.name === nodeName) return child as BABYLON.TransformNode;
        }
        return null;
    }

    private async applyOne(
        db: Firestore,
        sceneManager: SceneManager,
        chunkId: string,
        root: BABYLON.TransformNode | null,
        ov: MapOverride
    ): Promise<void> {
        const prefix = `${chunkId}:`;
        const nodeName = ov.targetBuildingKey.startsWith(prefix)
            ? ov.targetBuildingKey.slice(prefix.length)
            : ov.targetBuildingKey;

        switch (ov.action) {
            case "delete": {
                const node = this.findObjectNode(root, nodeName);
                if (node) node.setEnabled(false);
                break;
            }
            case "transform": {
                const node = this.findObjectNode(root, nodeName);
                if (node && ov.transform) this.applyTransform(node, ov.transform);
                break;
            }
            case "replace": {
                const node = this.findObjectNode(root, nodeName);
                if (node) node.setEnabled(false);
                if (ov.assetId && ov.transform) {
                    await this.spawnAsset(
                        db,
                        sceneManager,
                        chunkId,
                        root,
                        ov.assetId,
                        ov.transform,
                        ov.targetBuildingKey,
                        // 未指定群組時以 override key 自成一組：key 每筆唯一，
                        // 故同款資產的不同實例不會互相牽連
                        ov.groupId || ov.targetBuildingKey
                    );
                }
                break;
            }
            case "add": {
                if (ov.assetId && ov.transform) {
                    await this.spawnAsset(
                        db,
                        sceneManager,
                        chunkId,
                        root,
                        ov.assetId,
                        ov.transform,
                        ov.targetBuildingKey,
                        // 未指定群組時以 override key 自成一組：key 每筆唯一，
                        // 故同款資產的不同實例不會互相牽連
                        ov.groupId || ov.targetBuildingKey
                    );
                }
                break;
            }
        }
    }

    private applyTransform(node: BABYLON.TransformNode, t: OverrideTransform): void {
        node.position.set(t.position.x, t.position.y, t.position.z);
        if (!node.rotationQuaternion) node.rotationQuaternion = BABYLON.Quaternion.Identity();
        BABYLON.Quaternion.FromEulerAnglesToRef(
            t.rotation.x,
            t.rotation.y,
            t.rotation.z,
            node.rotationQuaternion
        );
        node.scaling.set(t.scale.x, t.scale.y, t.scale.z);
    }

    /** 載入資產 GLB 並掛到 chunk root 下，套用 transform + 建築屬性 */
    private async spawnAsset(
        db: Firestore,
        sceneManager: SceneManager,
        chunkId: string,
        root: BABYLON.TransformNode | null,
        assetId: string,
        transform: OverrideTransform,
        key: string,
        groupId: string
    ): Promise<void> {
        const asset = await this.loadAsset(db, assetId);
        if (!asset) return;

        const kind = asset.kind;

        // Phase 1：GLB 已在 loadAsset 階段解析成 AssetContainer 並快取，
        // 這裡只做「實例化」（instantiateModelsToScene 深度複製節點/mesh，
        // 不再重新解析 GLB／重新解碼貼圖）。
        const instantiated = asset.container.instantiateModelsToScene(
            (sourceName) => sourceName,
            false
        );

        const container = new BABYLON.TransformNode(`override_${key}`, this.scene);
        container.rotationQuaternion = BABYLON.Quaternion.Identity();
        if (root) container.parent = root;

        // 把資產 __root__ 的直接子節點整棵子樹掛到 container，再 dispose 空 __root__
        const assetRoot: BABYLON.Node | undefined = instantiated.rootNodes.find(
            (n) => n.name === "__root__"
        );
        const topNodes = assetRoot ? [...assetRoot.getChildren()] : instantiated.rootNodes;
        for (const n of topNodes) n.parent = container;
        if (assetRoot) assetRoot.dispose();

        this.applyTransform(container, transform);

        // 設定建築 mesh 屬性（比照 ChunkLoaderSystem.setupBuildingMesh）並註冊遮擋。
        // 注意：視覺 mesh 不直接當碰撞體（詳細三角面會讓玩家卡住），改用乾淨方塊。
        const occlusion = sceneManager.getOcclusionSystem();
        const isDecal = kind === "decal";
        const allMeshes = container.getChildMeshes(false);
        for (const mesh of allMeshes) {
            if (mesh.name === "__root__") continue;
            // 貼地平面不可選取，否則會擋住點擊地面的移動操作
            mesh.isPickable = !isDecal;
            mesh.checkCollisions = false;
            mesh.metadata = { ...mesh.metadata, type: kind, chunkId, overrideKey: key };

            if (mesh.material) {
                const cloned = mesh.material.clone(`${mesh.name}_mat`);
                if (cloned) {
                    mesh.material = cloned;
                    if (
                        cloned instanceof BABYLON.PBRMaterial ||
                        cloned instanceof BABYLON.StandardMaterial
                    ) {
                        cloned.alpha = 1.0;
                        cloned.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
                    }
                    // 貼地平面與路面共面，需要 polygon offset 才不會閃爍
                    if (isDecal) cloned.zOffset = DECAL_Z_OFFSET;
                }
            }

            // 只有建築參與遮擋淡出：props 與貼地平面不應該因為玩家走到
            // 它們「後面」而變透明
            if (kind === "building") occlusion.addBuildingMesh(mesh, groupId);
        }

        // 建立貼合外框的隱形方塊碰撞體（隨 container 旋轉/縮放，移動更順）。
        // 貼地平面是走得過的路面裝飾，不加碰撞。
        if (!isDecal) this.addBoxCollider(container, key, chunkId);
    }

    /** 依 container 的世界包圍盒建立貼合外框的方塊碰撞體（移動更順） */
    private addBoxCollider(
        container: BABYLON.TransformNode,
        key: string,
        chunkId: string
    ): void {
        container.computeWorldMatrix(true);
        // getHierarchyBoundingVectors 會強制更新世界矩陣，回傳可靠的世界 AABB
        const hb = container.getHierarchyBoundingVectors(true);
        if (
            !Number.isFinite(hb.min.x) ||
            !Number.isFinite(hb.max.x) ||
            !Number.isFinite(hb.min.y) ||
            !Number.isFinite(hb.max.y)
        ) {
            console.warn(`[MapOverride] collider skipped (no bounds): ${key}`);
            return;
        }

        const size = hb.max.subtract(hb.min);
        // 防呆：尺寸異常巨大代表算錯，寧可不放碰撞體也不要把玩家困住
        if (size.length() > 5000 || size.length() < 1e-3) {
            console.warn(`[MapOverride] collider skipped (bad size ${size.length().toFixed(1)}): ${key}`);
            return;
        }

        const center = hb.min.add(hb.max).scale(0.5);
        const box = BABYLON.MeshBuilder.CreateBox(
            `collider_${key}`,
            { width: Math.abs(size.x), height: Math.abs(size.y), depth: Math.abs(size.z) },
            this.scene
        );
        box.position.copyFrom(center); // 世界座標（頂層，不掛 container 以免重複套用變換）
        box.checkCollisions = true;
        box.isVisible = false;
        box.isPickable = false;
        box.metadata = { isOverrideCollider: true, chunkId, overrideKey: key };
    }

    /** 從 Firestore 讀回資產 GLB，重組成 object URL */
    /**
     * 取得資產內容，同一個 assetId 只會真正下載一次。
     *
     * 快取 Promise 本身，令同時發出的請求共用一次下載；失敗則移除快取項，
     * 讓下次呼叫可以重試，不會把一次網絡錯誤永久記住。
     */
    private loadAsset(db: Firestore, assetId: string): Promise<CachedAsset | null> {
        const cached = this.assetCache.get(assetId);
        if (cached) return cached;

        const pending = this.fetchAsset(db, assetId).catch((err) => {
            this.assetCache.delete(assetId);
            throw err;
        });
        this.assetCache.set(assetId, pending);
        return pending;
    }

    private async fetchAsset(db: Firestore, assetId: string): Promise<CachedAsset | null> {
        const assetSnap = await getDoc(doc(db, ASSETS_COLLECTION, assetId));
        if (!assetSnap.exists()) {
            console.warn(`[MapOverride] asset ${assetId} not found`);
            return null;
        }
        const data = assetSnap.data() as Record<string, unknown>;
        const mimeType = (data.mimeType as string) || "model/gltf-binary";
        const rawKind = data.kind as string | undefined;
        const kind: AssetKind =
            rawKind === "prop" || rawKind === "decal" ? rawKind : "building";

        const chunksSnap = await getDocs(
            query(collection(db, ASSETS_COLLECTION, assetId, CHUNKS_SUB), orderBy("index"))
        );
        let base64 = "";
        chunksSnap.forEach((d) => {
            base64 += (d.data() as Record<string, unknown>).data as string;
        });
        if (!base64) return null;

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // 只喺呢度解析一次 GLB → AssetContainer。之後每次擺放用
        // instantiateModelsToScene（Phase 1）或 createInstance（Phase 2）
        // 深度複製，唔再重新下載/重新解碼貼圖。
        const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: mimeType }));
        try {
            const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                "",
                url,
                this.scene,
                undefined,
                ".glb"
            );
            return { container, kind };
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}
