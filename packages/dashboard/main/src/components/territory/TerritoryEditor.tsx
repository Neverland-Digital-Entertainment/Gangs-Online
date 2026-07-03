'use client';

/**
 * Territory Editor (Phase 21: Dashboard 地盤設置模組)
 *
 * 依 GDD 3.4a：
 * - 領地 = 完全貼合地面的 2D 多邊形（半透明色塊），只儲存頂點 (x, z)
 * - 新增模式：逐點 click 連線；點回起始點附近自動封閉完成
 * - 落點防呆：與既有點重疊、或新邊與既有邊交叉 → 直接擋掉該次 click
 * - 修改模式：只能拖曳既有頂點（不可增刪頂點）；拖曳造成頂點重疊 /
 *   邊線交叉 / 與其他領地重疊 → 擋掉，頂點回彈
 * - 回溯：進入編輯時記錄快照，可一鍵回溯
 * - 領地範圍不可互相重疊（新增與修改時即時檢查）
 * - Dashboard 不設定擁有者：新領地一律中立無主
 * - 鏡頭：Space+左鍵拖曳 = 平移；右鍵拖曳 = 旋轉；滾輪 = 縮放
 * - 建築顯示/隱藏開關（方便看清街道邊界）
 *
 * 地圖載入：讀取 NEXT_PUBLIC_MAP_BASE_URL（預設 /maps）的 manifest.json 與 glb，
 * 與遊戲 client 同一份地圖檔（把 packages/client/public/maps 複製到 dashboard 的
 * public/maps 即可）。載入失敗時退回平面網格，仍可正常繪製。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import earcut from 'earcut';
import {
    Vec2,
    dist,
    validatePolygon,
    hasOverlappingVertices,
    polygonSelfIntersects,
    polygonsIntersect,
    newEdgeCrossesExisting,
    MIN_VERTEX_DISTANCE,
    CLOSE_POLYGON_DISTANCE,
} from '@/lib/territory/geometry';
import { TerritoryService, TerritoryDoc, MAX_GUARD_SLOTS } from '@/lib/territory/territory-service';
import { MAP_BASE_URL } from '@/lib/map/map-loader';

// 遊戲地圖（旺角）的大致中心（玩家出生點附近），地圖載入失敗時的後備視角
const MAP_CENTER = { x: -835575, z: -819659 };

type EditorMode = 'view' | 'draw' | 'edit';

interface TerritoryMeshes {
    fill: BABYLON.Mesh | null;
    outline: BABYLON.LinesMesh | null;
    vertexSpheres: BABYLON.Mesh[];
}

export default function TerritoryEditor({ canEdit = true }: { canEdit?: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Babylon refs
    const sceneRef = useRef<BABYLON.Scene | null>(null);
    const cameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
    const groundMeshesRef = useRef<BABYLON.AbstractMesh[]>([]);
    const buildingMeshesRef = useRef<BABYLON.AbstractMesh[]>([]);
    const territoryMeshesRef = useRef<Map<string, TerritoryMeshes>>(new Map());
    const drawMeshesRef = useRef<{ spheres: BABYLON.Mesh[]; line: BABYLON.LinesMesh | null }>({ spheres: [], line: null });

    // 編輯器狀態（Babylon 事件用 ref，UI 用 state）
    const modeRef = useRef<EditorMode>('view');
    const drawPointsRef = useRef<Vec2[]>([]);
    const territoriesRef = useRef<TerritoryDoc[]>([]);
    const selectedIdRef = useRef<string>('');
    const editSnapshotRef = useRef<Vec2[] | null>(null);
    const dragRef = useRef<{ vertexIndex: number; startPos: Vec2 } | null>(null);
    const spaceDownRef = useRef(false);

    // React 狀態
    const [mode, setMode] = useState<EditorMode>('view');
    const [territories, setTerritories] = useState<TerritoryDoc[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [drawCount, setDrawCount] = useState(0);
    const [showBuildings, setShowBuildings] = useState(true);
    const [mapStatus, setMapStatus] = useState('載入地圖中...');
    const [message, setMessage] = useState('');
    const [dirty, setDirty] = useState(false);

    const service = TerritoryService.getInstance();

    const toast = useCallback((text: string) => {
        setMessage(text);
        setTimeout(() => setMessage((m) => (m === text ? '' : m)), 4000);
    }, []);

    // ==================== 地形高度 ====================

    /** 以射線取得地形高度（無地形時回 0） */
    const groundY = useCallback((x: number, z: number): number => {
        const scene = sceneRef.current;
        if (!scene) return 0;
        const ray = new BABYLON.Ray(new BABYLON.Vector3(x, 10000, z), BABYLON.Vector3.Down(), 20000);
        const hit = scene.pickWithRay(ray, (m) => groundMeshesRef.current.includes(m));
        return hit?.pickedPoint ? hit.pickedPoint.y : 0;
    }, []);

    // ==================== 領地渲染 ====================

    const disposeTerritoryMeshes = useCallback((id: string) => {
        const meshes = territoryMeshesRef.current.get(id);
        if (!meshes) return;
        // 連同材質一起釋放（編輯拖曳時每次 POINTERMOVE 都會重建，否則材質會累積洩漏）
        meshes.fill?.dispose(false, true);
        meshes.outline?.dispose(false, true);
        meshes.vertexSpheres.forEach((s) => s.dispose(false, true));
        territoryMeshesRef.current.delete(id);
    }, []);

    const renderTerritory = useCallback((t: TerritoryDoc) => {
        const scene = sceneRef.current;
        if (!scene || !t.vertices || t.vertices.length < 3) return;
        disposeTerritoryMeshes(t.id);

        const selected = selectedIdRef.current === t.id;
        const editing = selected && modeRef.current === 'edit';
        const color = selected ? new BABYLON.Color3(1, 0.85, 0) : new BABYLON.Color3(0.2, 0.7, 0.9);

        // 半透明色塊（貼地平面多邊形）
        const y = Math.max(...t.vertices.map((v) => groundY(v.x, v.z))) + 0.4;
        let fill: BABYLON.Mesh | null = null;
        try {
            const shape = t.vertices.map((v) => new BABYLON.Vector2(v.x, v.z));
            const builder = new BABYLON.PolygonMeshBuilder(`territory_fill_${t.id}`, shape, scene, earcut as any);
            fill = builder.build(false, 0.01);
            fill.position.y = y;
            const mat = new BABYLON.StandardMaterial(`territory_mat_${t.id}`, scene);
            mat.diffuseColor = color;
            mat.emissiveColor = color.scale(0.6);
            mat.alpha = 0.28;
            mat.backFaceCulling = false;
            fill.material = mat;
            fill.isPickable = false;
        } catch (e) {
            console.warn('Polygon fill build failed:', e);
        }

        // 外框線
        const pts = [...t.vertices, t.vertices[0]].map(
            (v) => new BABYLON.Vector3(v.x, groundY(v.x, v.z) + 0.6, v.z)
        );
        const outline = BABYLON.MeshBuilder.CreateLines(`territory_line_${t.id}`, { points: pts }, scene);
        outline.color = color;
        outline.isPickable = false;

        // 編輯模式下的頂點球（可拖曳）
        const vertexSpheres: BABYLON.Mesh[] = [];
        if (editing) {
            t.vertices.forEach((v, i) => {
                const s = BABYLON.MeshBuilder.CreateSphere(`territory_vertex_${t.id}_${i}`, { diameter: 2.4 }, scene);
                s.position.set(v.x, groundY(v.x, v.z) + 1.2, v.z);
                const mat = new BABYLON.StandardMaterial(`vertex_mat_${t.id}_${i}`, scene);
                mat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
                s.material = mat;
                s.metadata = { territoryVertex: { territoryId: t.id, index: i } };
                vertexSpheres.push(s);
            });
        }

        territoryMeshesRef.current.set(t.id, { fill, outline, vertexSpheres });
    }, [disposeTerritoryMeshes, groundY]);

    const renderAll = useCallback(() => {
        territoriesRef.current.forEach((t) => renderTerritory(t));
    }, [renderTerritory]);

    // ==================== 繪製中的預覽 ====================

    const renderDrawPreview = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        drawMeshesRef.current.spheres.forEach((s) => s.dispose(false, true));
        drawMeshesRef.current.line?.dispose(false, true);
        drawMeshesRef.current = { spheres: [], line: null };

        const pts = drawPointsRef.current;
        pts.forEach((p, i) => {
            const s = BABYLON.MeshBuilder.CreateSphere(`draw_pt_${i}`, { diameter: 2.4 }, scene);
            s.position.set(p.x, groundY(p.x, p.z) + 1.2, p.z);
            const mat = new BABYLON.StandardMaterial(`draw_mat_${i}`, scene);
            mat.emissiveColor = i === 0 ? new BABYLON.Color3(0.2, 1, 0.2) : new BABYLON.Color3(1, 0.2, 0.2);
            s.material = mat;
            s.isPickable = false;
            drawMeshesRef.current.spheres.push(s);
        });
        if (pts.length >= 2) {
            const linePts = pts.map((p) => new BABYLON.Vector3(p.x, groundY(p.x, p.z) + 0.8, p.z));
            const line = BABYLON.MeshBuilder.CreateLines('draw_line', { points: linePts }, scene);
            line.color = new BABYLON.Color3(1, 0.3, 0.3);
            line.isPickable = false;
            drawMeshesRef.current.line = line;
        }
        setDrawCount(pts.length);
    }, [groundY]);

    // ==================== 資料載入 ====================

    const loadTerritories = useCallback(async () => {
        try {
            const list = await service.getAll();
            territoriesRef.current = list;
            setTerritories([...list]);
            // 場景就緒後渲染
            if (sceneRef.current) {
                territoryMeshesRef.current.forEach((_, id) => disposeTerritoryMeshes(id));
                renderAll();
            }
        } catch (e) {
            console.error(e);
            toast('讀取領地列表失敗（請確認 Firebase 設定）');
        }
    }, [service, disposeTerritoryMeshes, renderAll, toast]);

    // ==================== 操作 ====================

    const changeMode = useCallback((next: EditorMode) => {
        // 離開繪製模式時清空未完成的點
        if (modeRef.current === 'draw' && next !== 'draw') {
            drawPointsRef.current = [];
            renderDrawPreview();
        }
        // 進入編輯模式時記錄快照（回溯用）
        if (next === 'edit') {
            const t = territoriesRef.current.find((x) => x.id === selectedIdRef.current);
            if (!t) { toast('請先在列表選取一塊領地'); return; }
            editSnapshotRef.current = JSON.parse(JSON.stringify(t.vertices));
            setDirty(false);
        } else {
            editSnapshotRef.current = null;
        }
        modeRef.current = next;
        setMode(next);
        renderAll();
    }, [renderAll, renderDrawPreview, toast]);

    const selectTerritory = useCallback((id: string) => {
        if (modeRef.current === 'edit') changeMode('view');
        selectedIdRef.current = id;
        setSelectedId(id);
        renderAll();
        // 鏡頭移到領地中心
        const t = territoriesRef.current.find((x) => x.id === id);
        if (t && cameraRef.current && t.vertices.length > 0) {
            const cx = t.vertices.reduce((s, v) => s + v.x, 0) / t.vertices.length;
            const cz = t.vertices.reduce((s, v) => s + v.z, 0) / t.vertices.length;
            cameraRef.current.target = new BABYLON.Vector3(cx, groundY(cx, cz), cz);
        }
    }, [changeMode, renderAll, groundY]);

    const deleteSelected = useCallback(async () => {
        const id = selectedIdRef.current;
        const t = territoriesRef.current.find((x) => x.id === id);
        if (!t) { toast('請先選取要刪除的領地'); return; }
        if (!confirm(`確定刪除領地「${t.name}」？`)) return;
        try {
            await service.remove(id);
            disposeTerritoryMeshes(id);
            territoriesRef.current = territoriesRef.current.filter((x) => x.id !== id);
            setTerritories([...territoriesRef.current]);
            selectedIdRef.current = '';
            setSelectedId('');
            toast(`已刪除領地「${t.name}」`);
        } catch (e) {
            console.error(e);
            toast('刪除失敗');
        }
    }, [service, disposeTerritoryMeshes, toast]);

    /** 回溯到進入編輯前的版本 */
    const revertEdit = useCallback(() => {
        const t = territoriesRef.current.find((x) => x.id === selectedIdRef.current);
        if (!t || !editSnapshotRef.current) return;
        t.vertices = JSON.parse(JSON.stringify(editSnapshotRef.current));
        setDirty(false);
        renderAll();
        toast('已回溯到編輯前的版本');
    }, [renderAll, toast]);

    const saveEdit = useCallback(async () => {
        const t = territoriesRef.current.find((x) => x.id === selectedIdRef.current);
        if (!t) return;
        try {
            await service.updateVertices(t.id, t.vertices);
            editSnapshotRef.current = JSON.parse(JSON.stringify(t.vertices));
            setDirty(false);
            toast(`已儲存領地「${t.name}」的修改`);
        } catch (e) {
            console.error(e);
            toast('儲存失敗');
        }
    }, [service, toast]);

    const renameSelected = useCallback(async () => {
        const t = territoriesRef.current.find((x) => x.id === selectedIdRef.current);
        if (!t) { toast('請先選取領地'); return; }
        const name = prompt('輸入新的領地名稱：', t.name);
        if (!name || name.trim() === '' || name === t.name) return;
        try {
            await service.rename(t.id, name.trim());
            t.name = name.trim();
            setTerritories([...territoriesRef.current]);
            toast('已更名');
        } catch (e) {
            console.error(e);
            toast('更名失敗');
        }
    }, [service, toast]);

    const toggleBuildings = useCallback(() => {
        setShowBuildings((prev) => {
            const next = !prev;
            buildingMeshesRef.current.forEach((m) => m.setEnabled(next));
            return next;
        });
    }, []);

    // ==================== 落點 / 封閉 / 拖曳邏輯 ====================

    const isCreatingRef = useRef(false);

    const handleDrawClick = useCallback(async (pick: BABYLON.Vector3) => {
        if (isCreatingRef.current) return; // 建立中，避免重複 create
        const p: Vec2 = { x: pick.x, z: pick.z };
        const pts = drawPointsRef.current;

        // 點回起始點 → 封閉
        if (pts.length >= 3 && dist(p, pts[0]) < CLOSE_POLYGON_DISTANCE) {
            const others = territoriesRef.current.map((t) => ({ name: t.name, vertices: t.vertices }));
            const err = validatePolygon(pts, others);
            if (err) { toast(`無法完成領地：${err}`); return; }
            const name = prompt('領地已封閉！輸入領地名稱：', `領地 ${territoriesRef.current.length + 1}`);
            if (!name) return;
            isCreatingRef.current = true;
            try {
                const id = await service.create(name.trim(), pts);
                const newDoc: TerritoryDoc = {
                    id, name: name.trim(), vertices: [...pts], maxGuardSlots: MAX_GUARD_SLOTS,
                    ownerGuildId: '', ownerGuildName: '', protectionUntil: 0,
                    guards: [], capturedAt: 0, createdAt: Date.now(), updatedAt: Date.now(),
                };
                territoriesRef.current.push(newDoc);
                setTerritories([...territoriesRef.current]);
                drawPointsRef.current = [];
                renderDrawPreview();
                renderTerritory(newDoc);
                toast(`領地「${name}」已建立（初始為中立無主）`);
                changeMode('view');
            } catch (e) {
                console.error(e);
                toast('建立領地失敗');
            } finally {
                isCreatingRef.current = false;
            }
            return;
        }

        // 落點防呆：與既有點重疊 → 擋掉
        for (const q of pts) {
            if (dist(p, q) < MIN_VERTEX_DISTANCE) { toast('落點與既有點重疊，已擋掉'); return; }
        }
        // 新邊與既有邊交叉 → 擋掉
        if (newEdgeCrossesExisting(pts, p)) { toast('新邊與既有邊交叉，已擋掉'); return; }

        pts.push(p);
        renderDrawPreview();
    }, [service, renderDrawPreview, renderTerritory, changeMode, toast]);

    /** 拖曳頂點（僅移動，數量固定）：非法位置直接不套用（放開時即等於回彈） */
    const handleVertexDrag = useCallback((pick: BABYLON.Vector3) => {
        const drag = dragRef.current;
        const t = territoriesRef.current.find((x) => x.id === selectedIdRef.current);
        if (!drag || !t) return;

        const tentative: Vec2[] = t.vertices.map((v, i) =>
            i === drag.vertexIndex ? { x: pick.x, z: pick.z } : { x: v.x, z: v.z }
        );
        // 防呆：頂點重疊 / 自我相交 / 與其他領地重疊 → 不套用
        if (hasOverlappingVertices(tentative)) return;
        if (polygonSelfIntersects(tentative)) return;
        for (const o of territoriesRef.current) {
            if (o.id === t.id || !o.vertices || o.vertices.length < 3) continue;
            if (polygonsIntersect(tentative, o.vertices)) return;
        }

        t.vertices[drag.vertexIndex] = { x: pick.x, z: pick.z };
        setDirty(true);
        renderTerritory(t);
    }, [renderTerritory]);

    // ==================== Babylon 初始化 ====================

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const engine = new BABYLON.Engine(canvas, true);
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(0.05, 0.06, 0.1, 1);
        sceneRef.current = scene;

        const camera = new BABYLON.ArcRotateCamera(
            'cam', -Math.PI / 2, Math.PI / 3.2, 400,
            new BABYLON.Vector3(MAP_CENTER.x, 0, MAP_CENTER.z), scene
        );
        camera.minZ = 0.5;
        camera.maxZ = 50000;
        camera.lowerRadiusLimit = 20;
        camera.upperRadiusLimit = 5000;
        // 完全自訂輸入（不 attachControl），依 GDD 的操作規格實作
        cameraRef.current = camera;

        new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0.3, 1, 0.2), scene).intensity = 1.1;

        // ---------- 地圖載入 ----------
        const base = MAP_BASE_URL; // 與 Map Editor 同一來源（copy-maps 腳本自動複製 client 地圖）
        (async () => {
            let loaded = false;
            try {
                const res = await fetch(`${base}/manifest.json`);
                if (res.ok) {
                    const manifest = await res.json();
                    for (const chunk of manifest.chunks || []) {
                        const result = await BABYLON.SceneLoader.ImportMeshAsync('', `${base}/`, chunk.file, scene);
                        result.meshes.forEach((mesh) => {
                            if (mesh.name === '__root__') return;
                            const c = mesh.name.charAt(0).toUpperCase();
                            if (c === 'T') {
                                groundMeshesRef.current.push(mesh);
                            } else if (c === 'B') {
                                buildingMeshesRef.current.push(mesh);
                                mesh.isPickable = false;
                            } else {
                                mesh.isPickable = false;
                            }
                        });
                        loaded = true;
                    }
                }
            } catch (e) {
                console.warn('地圖載入失敗，使用平面網格:', e);
            }

            if (loaded && groundMeshesRef.current.length > 0) {
                // 鏡頭對準地形中心
                let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                groundMeshesRef.current.forEach((m) => {
                    m.computeWorldMatrix(true);
                    const b = m.getBoundingInfo();
                    minX = Math.min(minX, b.boundingBox.minimumWorld.x);
                    maxX = Math.max(maxX, b.boundingBox.maximumWorld.x);
                    minZ = Math.min(minZ, b.boundingBox.minimumWorld.z);
                    maxZ = Math.max(maxZ, b.boundingBox.maximumWorld.z);
                });
                camera.target = new BABYLON.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
                setMapStatus(`地圖已載入（地形 ${groundMeshesRef.current.length}、建築 ${buildingMeshesRef.current.length} mesh）`);
            } else {
                // 後備：平面網格
                const ground = BABYLON.MeshBuilder.CreateGround('fallback_ground', { width: 6000, height: 6000, subdivisions: 60 }, scene);
                ground.position.set(MAP_CENTER.x, 0, MAP_CENTER.z);
                const mat = new BABYLON.StandardMaterial('ground_mat', scene);
                mat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.18);
                mat.wireframe = true;
                ground.material = mat;
                groundMeshesRef.current.push(ground);
                setMapStatus('⚠️ 地圖 glb 未載入（把 packages/client/public/maps 複製到 dashboard 的 public/maps 即可顯示實際地圖）。目前使用平面網格，仍可繪製領地。');
            }

            renderAll();
        })();

        // ---------- 鍵盤（Space） ----------
        const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { spaceDownRef.current = true; e.preventDefault(); } };
        const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDownRef.current = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // ---------- 滑鼠操作 ----------
        let panState: { x: number; y: number } | null = null;
        let rotateState: { x: number; y: number } | null = null;
        let downPos: { x: number; y: number } | null = null;

        const pickGround = (): BABYLON.Vector3 | null => {
            const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => groundMeshesRef.current.includes(m));
            return pick?.pickedPoint || null;
        };

        scene.onPointerObservable.add((info) => {
            const evt = info.event as PointerEvent;

            if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                downPos = { x: scene.pointerX, y: scene.pointerY };
                if (evt.button === 2) {
                    rotateState = { x: scene.pointerX, y: scene.pointerY };
                } else if (evt.button === 0) {
                    if (spaceDownRef.current) {
                        // Space + 左鍵 = 平移
                        panState = { x: scene.pointerX, y: scene.pointerY };
                    } else if (modeRef.current === 'edit') {
                        // 嘗試抓取頂點球
                        const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.territoryVertex);
                        if (pick?.hit && pick.pickedMesh?.metadata?.territoryVertex) {
                            const { territoryId, index } = pick.pickedMesh.metadata.territoryVertex;
                            if (territoryId === selectedIdRef.current) {
                                const t = territoriesRef.current.find((x) => x.id === territoryId);
                                if (t) dragRef.current = { vertexIndex: index, startPos: { ...t.vertices[index] } };
                            }
                        }
                    }
                }
            }

            if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (rotateState) {
                    const dx = scene.pointerX - rotateState.x;
                    const dy = scene.pointerY - rotateState.y;
                    camera.alpha -= dx * 0.006;
                    camera.beta = Math.min(Math.max(camera.beta - dy * 0.006, 0.05), Math.PI / 2.05);
                    rotateState = { x: scene.pointerX, y: scene.pointerY };
                } else if (panState) {
                    const dx = scene.pointerX - panState.x;
                    const dy = scene.pointerY - panState.y;
                    const panSpeed = camera.radius * 0.0015;
                    const forward = new BABYLON.Vector3(Math.cos(camera.alpha), 0, Math.sin(camera.alpha));
                    const right = new BABYLON.Vector3(-forward.z, 0, forward.x);
                    camera.target.addInPlace(right.scale(dx * panSpeed));
                    camera.target.addInPlace(forward.scale(dy * panSpeed));
                    panState = { x: scene.pointerX, y: scene.pointerY };
                } else if (dragRef.current) {
                    const pick = pickGround();
                    if (pick) handleVertexDrag(pick);
                }
            }

            if (info.type === BABYLON.PointerEventTypes.POINTERUP) {
                const wasPanOrRotate = !!panState || !!rotateState;
                const wasDrag = !!dragRef.current;
                panState = null;
                rotateState = null;
                dragRef.current = null;

                if (evt.button === 0 && !wasPanOrRotate && !wasDrag && !spaceDownRef.current && modeRef.current === 'draw') {
                    // 一般 click（非拖曳）→ 落點
                    const moved = downPos && (Math.abs(scene.pointerX - downPos.x) + Math.abs(scene.pointerY - downPos.y)) > 4;
                    if (!moved) {
                        const pick = pickGround();
                        if (pick) handleDrawClick(pick);
                    }
                }
                downPos = null;
            }

            if (info.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
                const wheel = (info.event as WheelEvent).deltaY;
                camera.radius = Math.min(Math.max(camera.radius * (wheel > 0 ? 1.12 : 0.89), 20), 5000);
            }
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        engine.runRenderLoop(() => scene.render());
        const onResize = () => engine.resize();
        window.addEventListener('resize', onResize);

        loadTerritories();

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('resize', onResize);
            engine.dispose();
            sceneRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==================== UI ====================

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-4">
            {/* 左側：3D 編輯畫布 */}
            <div className="flex-1 relative rounded-lg overflow-hidden border border-[var(--border)]">
                <canvas ref={canvasRef} className="w-full h-full outline-none" />

                {/* 工具列 */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2 items-center bg-black/70 rounded-lg p-2 text-white text-sm">
                    {canEdit && (
                    <button
                        onClick={() => changeMode(mode === 'draw' ? 'view' : 'draw')}
                        className={`px-3 py-1 rounded ${mode === 'draw' ? 'bg-yellow-500 text-black' : 'bg-gray-700'}`}
                    >
                        ➕ 新增領地{mode === 'draw' ? `（已落 ${drawCount} 點，點回綠色起點封閉）` : ''}
                    </button>
                    )}
                    {canEdit && (
                    <button
                        onClick={() => changeMode(mode === 'edit' ? 'view' : 'edit')}
                        className={`px-3 py-1 rounded ${mode === 'edit' ? 'bg-yellow-500 text-black' : 'bg-gray-700'}`}
                        disabled={!selectedId && mode !== 'edit'}
                    >
                        ✏️ 編輯頂點{mode === 'edit' ? '中（拖曳橘色頂點）' : ''}
                    </button>
                    )}
                    {mode === 'edit' && (
                        <>
                            <button onClick={revertEdit} className="px-3 py-1 rounded bg-gray-700">↩️ 回溯</button>
                            <button onClick={saveEdit} disabled={!dirty} className={`px-3 py-1 rounded ${dirty ? 'bg-green-600' : 'bg-gray-800 opacity-50'}`}>💾 儲存修改</button>
                        </>
                    )}
                    <button onClick={toggleBuildings} className="px-3 py-1 rounded bg-gray-700">
                        {showBuildings ? '🙈 隱藏大廈' : '🏢 顯示大廈'}
                    </button>
                </div>

                {/* 操作提示 */}
                <div className="absolute bottom-3 left-3 bg-black/70 rounded-lg p-2 text-gray-300 text-xs leading-5">
                    Space + 左鍵拖曳：平移鏡頭　│　右鍵拖曳：旋轉視角　│　滾輪：縮放<br />
                    新增模式：一般 click 落點連線，點回起點（綠色）封閉；重疊/交叉的落點會被自動擋掉
                </div>

                {/* 狀態訊息 */}
                <div className="absolute top-3 right-3 max-w-sm text-right">
                    <div className="bg-black/70 rounded-lg p-2 text-gray-300 text-xs">{mapStatus}</div>
                    {message && <div className="mt-2 bg-yellow-600/90 rounded-lg p-2 text-black text-sm font-bold">{message}</div>}
                </div>
            </div>

            {/* 右側：領地列表 */}
            <div className="w-80 card p-4 overflow-y-auto">
                <h2 className="font-bold text-lg mb-2">領地列表（{territories.length}）</h2>
                <p className="text-xs text-[var(--muted)] mb-3">
                    地圖上點位太密集時，可從此列表選取。新領地一律中立無主，歸屬由遊戲內佔領機制決定。
                </p>
                <div className="flex gap-2 mb-3">
                    {canEdit && <button onClick={renameSelected} disabled={!selectedId} className="btn-light text-sm px-2 py-1">更名</button>}
                    {canEdit && <button onClick={deleteSelected} disabled={!selectedId} className="btn-light text-sm px-2 py-1 text-red-500">刪除</button>}
                    <button onClick={loadTerritories} className="btn-light text-sm px-2 py-1">重新整理</button>
                </div>
                {territories.map((t) => (
                    <div
                        key={t.id}
                        onClick={() => selectTerritory(t.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTerritory(t.id); } }}
                        className={`p-2 mb-2 rounded cursor-pointer border ${
                            selectedId === t.id
                                ? 'border-yellow-500 bg-yellow-500/10'
                                : 'border-[var(--border)] hover:bg-[var(--sidebar-hover)]'
                        }`}
                    >
                        <div className="font-bold">{t.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                            ID: {t.id}<br />
                            頂點：{t.vertices?.length || 0}　守衛位：{t.maxGuardSlots}（固定）<br />
                            持有：{t.ownerGuildName || '中立無主'}
                            {t.protectionUntil > Date.now() && <span className="text-yellow-500">　🛡️ 保護期中</span>}
                        </div>
                    </div>
                ))}
                {territories.length === 0 && (
                    <div className="text-sm text-[var(--muted)]">尚無領地。點「新增領地」開始在地圖上繪製。</div>
                )}
            </div>
        </div>
    );
}
