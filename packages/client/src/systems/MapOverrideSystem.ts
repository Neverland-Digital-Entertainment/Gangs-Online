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
}

const OVERRIDES_COLLECTION = "map_overrides";
const ASSETS_COLLECTION = "building_assets";
const CHUNKS_SUB = "chunks";

export class MapOverrideSystem {
    private scene: BABYLON.Scene;
    private db: Firestore | null = null;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
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
                        ov.targetBuildingKey
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
                        ov.targetBuildingKey
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
        key: string
    ): Promise<void> {
        const url = await this.loadAssetObjectUrl(db, assetId);
        if (!url) return;

        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "",
                url,
                this.scene,
                undefined,
                ".glb"
            );

            const container = new BABYLON.TransformNode(`override_${key}`, this.scene);
            container.rotationQuaternion = BABYLON.Quaternion.Identity();
            if (root) container.parent = root;

            // 把資產 __root__ 的直接子節點整棵子樹掛到 container，再 dispose 空 __root__
            const assetRoot: BABYLON.Node | undefined =
                (result.meshes.find((m) => m.name === "__root__") as BABYLON.Node | undefined) ??
                (result.transformNodes?.find((n) => n.name === "__root__") as BABYLON.Node | undefined);
            const topNodes = assetRoot
                ? [...assetRoot.getChildren()]
                : result.meshes.filter((m) => !m.parent && m.name !== "__root__");
            for (const n of topNodes) n.parent = container;
            if (assetRoot) assetRoot.dispose();

            this.applyTransform(container, transform);

            // 設定建築 mesh 屬性（比照 ChunkLoaderSystem.setupBuildingMesh）並註冊遮擋
            const occlusion = sceneManager.getOcclusionSystem();
            for (const mesh of result.meshes) {
                if (mesh.name === "__root__") continue;
                mesh.isPickable = true;
                mesh.checkCollisions = true;
                mesh.metadata = { ...mesh.metadata, type: "building", chunkId, overrideKey: key };

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
                    }
                }
                occlusion.addBuildingMesh(mesh);
            }
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /** 從 Firestore 讀回資產 GLB，重組成 object URL */
    private async loadAssetObjectUrl(db: Firestore, assetId: string): Promise<string | null> {
        const assetSnap = await getDoc(doc(db, ASSETS_COLLECTION, assetId));
        if (!assetSnap.exists()) {
            console.warn(`[MapOverride] asset ${assetId} not found`);
            return null;
        }
        const mimeType =
            ((assetSnap.data() as Record<string, unknown>).mimeType as string) ||
            "model/gltf-binary";

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
        const blob = new Blob([bytes], { type: mimeType });
        return URL.createObjectURL(blob);
    }
}
