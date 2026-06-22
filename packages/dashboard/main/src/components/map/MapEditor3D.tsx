'use client';

/**
 * MapEditor3D — Babylon.js 3D 地圖編輯器（Map Editor P1 + P2 + P4）
 *
 * 重要：glTF 載入後一個物件 = 「節點(帶真實座標) + 其下的 primitive mesh(本身 0,0,0)」。
 * 因此本元件以「物件節點」（底圖 __root__ 的直接子節點）為操作單位：
 *   - 讀寫 transform、掛 gizmo 都對節點進行（顯示真實座標、移動整棟）
 *   - primitive mesh 只負責被射線點選（metadata 指回節點 key）
 *
 * P4：replace/add 的資產實例同樣掛在「容器節點」下、parent 到 __root__，
 *     與既有大廈共用座標空間。
 *
 * 僅能在瀏覽器執行（next/dynamic ssr:false）。
 */

import { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { MAP_BASE_URL } from '@/lib/map/map-loader';
import { buildingAssetService } from '@/lib/map/asset-service';
import {
  buildObjectKey,
  classifyMeshName,
  type BuildingAsset,
  type GizmoMode,
  type MapObjectInfo,
  type MapOverride,
  type Transform,
} from '@/types/map';

interface MapEditor3DProps {
  chunkId: string;
  chunkFile: string;
  selectedKey: string | null;
  gizmoMode: GizmoMode;
  overrides: MapOverride[];
  assets: BuildingAsset[];
  focusNonce: number;
  onSelect: (obj: MapObjectInfo | null) => void;
  onTransformChange: (key: string, transform: Transform) => void;
  onObjectsChange?: (objects: MapObjectInfo[]) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string | null) => void;
}

interface InstanceRec {
  container: BABYLON.TransformNode;
  meshes: BABYLON.AbstractMesh[];
  assetId: string;
}

function readTransform(node: BABYLON.TransformNode): Transform {
  const q = node.rotationQuaternion ?? BABYLON.Quaternion.Identity();
  const e = q.toEulerAngles();
  return {
    position: { x: node.position.x, y: node.position.y, z: node.position.z },
    rotation: { x: e.x, y: e.y, z: e.z },
    scale: { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z },
  };
}

function applyTransform(node: BABYLON.TransformNode, t: Transform): void {
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

function transformsEqual(a: Transform | null, b: Transform | null): boolean {
  if (!a || !b) return a === b;
  const eps = 1e-5;
  const c = (x: number, y: number) => Math.abs(x - y) < eps;
  return (
    c(a.position.x, b.position.x) && c(a.position.y, b.position.y) && c(a.position.z, b.position.z) &&
    c(a.rotation.x, b.rotation.x) && c(a.rotation.y, b.rotation.y) && c(a.rotation.z, b.rotation.z) &&
    c(a.scale.x, b.scale.x) && c(a.scale.y, b.scale.y) && c(a.scale.z, b.scale.z)
  );
}

/** 取得節點階層的可高亮 mesh（含自身） */
function meshesOf(node: BABYLON.TransformNode): BABYLON.Mesh[] {
  const list: BABYLON.Mesh[] = [];
  if (node instanceof BABYLON.Mesh && node.getTotalVertices() > 0) list.push(node);
  for (const m of node.getChildMeshes(false)) {
    if (m instanceof BABYLON.Mesh && m.getTotalVertices() > 0) list.push(m);
  }
  return list;
}

export default function MapEditor3D({
  chunkId,
  chunkFile,
  selectedKey,
  gizmoMode,
  overrides,
  assets,
  focusNonce,
  onSelect,
  onTransformChange,
  onObjectsChange,
  onLoadingChange,
  onError,
}: MapEditor3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const highlightRef = useRef<BABYLON.HighlightLayer | null>(null);
  const gizmoRef = useRef<BABYLON.GizmoManager | null>(null);
  const chunkRootRef = useRef<BABYLON.TransformNode | null>(null);

  const nodeByKeyRef = useRef<Map<string, BABYLON.TransformNode>>(new Map());
  const originalByKeyRef = useRef<Map<string, Transform>>(new Map());
  const instanceByKeyRef = useRef<Map<string, InstanceRec>>(new Map());
  const objectsRef = useRef<Map<string, MapObjectInfo>>(new Map());
  const loadingKeysRef = useRef<Set<string>>(new Set());
  const highlightedRef = useRef<BABYLON.Mesh[]>([]);

  const draggingRef = useRef(false);
  const attachedKeyRef = useRef<string | null>(null);
  const lastEmitRef = useRef<Transform | null>(null);

  const [instancesVersion, setInstancesVersion] = useState(0);

  const onSelectRef = useRef(onSelect);
  const onTransformRef = useRef(onTransformChange);
  const onObjectsRef = useRef(onObjectsChange);
  const onLoadingRef = useRef(onLoadingChange);
  const onErrorRef = useRef(onError);
  const overridesRef = useRef(overrides);
  const assetsRef = useRef(assets);
  onSelectRef.current = onSelect;
  onTransformRef.current = onTransformChange;
  onObjectsRef.current = onObjectsChange;
  onLoadingRef.current = onLoadingChange;
  onErrorRef.current = onError;
  overridesRef.current = overrides;
  assetsRef.current = assets;

  function nodeForKey(key: string | null): BABYLON.TransformNode | null {
    if (!key) return null;
    return instanceByKeyRef.current.get(key)?.container ?? nodeByKeyRef.current.get(key) ?? null;
  }

  function emitObjects() {
    onObjectsRef.current?.(Array.from(objectsRef.current.values()));
  }

  function frameNode(node: BABYLON.TransformNode) {
    const scene = sceneRef.current;
    if (!scene) return;
    node.computeWorldMatrix(true);
    const { min, max } = node.getHierarchyBoundingVectors(true);
    if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) return;
    const center = BABYLON.Vector3.Center(min, max);
    const size = max.subtract(min).length();
    const cam = scene.activeCamera as BABYLON.ArcRotateCamera;
    cam.setTarget(center.clone());
    cam.radius = Number.isFinite(size) && size > 0.01 ? size * 1.3 : 10;
  }

  function emitTransform() {
    const key = attachedKeyRef.current;
    const node = nodeForKey(key);
    if (!key || !node) return;
    const t = readTransform(node);
    if (transformsEqual(t, lastEmitRef.current)) return;
    lastEmitRef.current = t;
    onTransformRef.current(key, t);
  }

  // ---- 建立引擎與場景（只做一次） ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.07, 0.09, 0.12, 1);

    const camera = new BABYLON.ArcRotateCamera(
      'editorCamera', -Math.PI / 2, Math.PI / 3, 200, BABYLON.Vector3.Zero(), scene
    );
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 0.5;
    camera.minZ = 0.05;
    camera.maxZ = 200000;
    camera.panningSensibility = 10;
    camera.allowUpsideDown = false;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0.3, 1, 0.4), scene);
    hemi.intensity = 1.1;
    const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5, -1, -0.5), scene);
    dir.intensity = 0.6;

    highlightRef.current = new BABYLON.HighlightLayer('hl', scene);

    const gizmo = new BABYLON.GizmoManager(scene);
    gizmo.usePointerToAttachGizmos = false;
    gizmo.positionGizmoEnabled = false;
    gizmo.rotationGizmoEnabled = false;
    gizmo.scaleGizmoEnabled = false;
    gizmoRef.current = gizmo;

    engineRef.current = engine;
    sceneRef.current = scene;

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);

    scene.onBeforeRenderObservable.add(() => {
      if (draggingRef.current) emitTransform();
    });

    scene.onPointerObservable.add((pi) => {
      if (pi.type === BABYLON.PointerEventTypes.POINTERTAP) {
        if (draggingRef.current) return;
        const picked = pi.pickInfo?.pickedMesh as BABYLON.AbstractMesh | undefined;
        const base = picked
          ? ((picked.metadata as Record<string, unknown> | undefined)?.mapObject as MapObjectInfo | undefined)
          : undefined;
        if (base) {
          const node = nodeForKey(base.key);
          onSelectRef.current(node ? { ...base, ...readTransform(node) } : base);
        } else {
          onSelectRef.current(null);
        }
      } else if (pi.type === BABYLON.PointerEventTypes.POINTERDOUBLETAP) {
        const picked = pi.pickInfo?.pickedMesh as BABYLON.AbstractMesh | undefined;
        const base = picked
          ? ((picked.metadata as Record<string, unknown> | undefined)?.mapObject as MapObjectInfo | undefined)
          : undefined;
        const node = base ? nodeForKey(base.key) : null;
        if (node) frameNode(node);
      }
    });

    return () => {
      window.removeEventListener('resize', onResize);
      gizmo.dispose();
      scene.dispose();
      engine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
      highlightRef.current = null;
      gizmoRef.current = null;
      chunkRootRef.current = null;
      nodeByKeyRef.current.clear();
      originalByKeyRef.current.clear();
      instanceByKeyRef.current.clear();
      objectsRef.current.clear();
    };
  }, []);

  // ---- 載入 / 切換 chunk ----
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !chunkFile) return;
    let cancelled = false;

    nodeByKeyRef.current.clear();
    originalByKeyRef.current.clear();
    objectsRef.current.clear();
    for (const [, rec] of instanceByKeyRef.current) {
      rec.meshes.forEach((m) => m.dispose());
      rec.container.dispose();
    }
    instanceByKeyRef.current.clear();
    highlightedRef.current = [];
    highlightRef.current?.removeAllMeshes();
    gizmoRef.current?.attachToNode(null);
    scene.meshes
      .filter((m) => (m.metadata as Record<string, unknown> | undefined)?.imported)
      .slice()
      .forEach((m) => m.dispose());

    onErrorRef.current?.(null);
    onLoadingRef.current?.(true);

    BABYLON.SceneLoader.ImportMeshAsync('', `${MAP_BASE_URL}/`, chunkFile, scene)
      .then((result) => {
        if (cancelled) return;

        const root = (result.meshes.find((m) => m.name === '__root__') as BABYLON.TransformNode) ?? null;
        chunkRootRef.current = root;

        // 初始框景：所有 mesh 的世界包圍盒
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        for (const mesh of result.meshes) {
          mesh.metadata = { ...(mesh.metadata as object), imported: true };
          if (mesh.name === '__root__') continue;
          mesh.computeWorldMatrix(true);
          const bi = mesh.getBoundingInfo();
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
        }

        // 以「物件節點」（__root__ 直接子節點）為操作單位
        const children = root ? root.getChildren() : [];
        for (const child of children) {
          const node = child as BABYLON.TransformNode;
          const type = classifyMeshName(node.name);
          const selectable = type === 'building' || type === 'prop';
          const childMeshes = meshesOf(node);

          if (!selectable) {
            for (const m of childMeshes) m.isPickable = false;
            continue;
          }

          if (!node.rotationQuaternion) {
            node.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(node.rotation);
          }
          const key = buildObjectKey(chunkId, node.name);
          const original = readTransform(node);
          node.computeWorldMatrix(true);
          const hb = node.getHierarchyBoundingVectors(true);
          const size = hb.max.subtract(hb.min);
          const info: MapObjectInfo = {
            meshName: node.name,
            chunkId,
            type,
            key,
            ...original,
            boundingSize: { x: Math.abs(size.x), y: Math.abs(size.y), z: Math.abs(size.z) },
          };
          for (const m of childMeshes) {
            m.isPickable = true;
            m.metadata = { ...(m.metadata as object), mapObject: info };
          }
          nodeByKeyRef.current.set(key, node);
          originalByKeyRef.current.set(key, original);
          objectsRef.current.set(key, info);
        }

        if (Number.isFinite(min.x)) {
          const center = BABYLON.Vector3.Center(min, max);
          const radius = Math.max(max.subtract(min).length() * 0.8, 10);
          const cam = scene.activeCamera as BABYLON.ArcRotateCamera;
          cam.setTarget(center);
          cam.radius = radius;
          cam.maxZ = radius * 20;
        }

        emitObjects();
        reconcile();
        void reconcileInstances();
        onLoadingRef.current?.(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[MapEditor3D] failed to load chunk', err);
        onErrorRef.current?.(err instanceof Error ? err.message : 'Failed to load map');
        onLoadingRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkFile, chunkId]);

  // ---- 既有節點調和（delete/replace 隱藏、transform 套用、否則還原） ----
  function reconcile() {
    if (nodeByKeyRef.current.size === 0) return;
    const activeByKey = new Map<string, MapOverride>();
    for (const o of overridesRef.current) {
      if (o.isActive) activeByKey.set(o.targetBuildingKey, o);
    }
    for (const [key, node] of nodeByKeyRef.current) {
      const ov = activeByKey.get(key);
      if (ov?.action === 'delete' || ov?.action === 'replace') {
        node.setEnabled(false);
      } else if (ov?.action === 'transform' && ov.transform) {
        node.setEnabled(true);
        applyTransform(node, ov.transform);
      } else {
        node.setEnabled(true);
        const orig = originalByKeyRef.current.get(key);
        if (orig) applyTransform(node, orig);
      }
    }
  }

  // ---- replace / add 資產實例調和（async） ----
  function defaultTransformFor(key: string, ov: MapOverride): Transform {
    if (ov.action === 'replace') {
      const orig = originalByKeyRef.current.get(key);
      if (orig) return orig;
    }
    // add：放到目前鏡頭焦點（轉成底圖 __root__ 的 local 座標）
    const scene = sceneRef.current!;
    const cam = scene.activeCamera as BABYLON.ArcRotateCamera;
    let pos = cam.target.clone();
    const root = chunkRootRef.current;
    if (root) {
      root.computeWorldMatrix(true);
      pos = BABYLON.Vector3.TransformCoordinates(pos, BABYLON.Matrix.Invert(root.getWorldMatrix()));
    }
    const s = assetsRef.current.find((a) => a.id === ov.assetId)?.defaultScale || 1;
    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: s, y: s, z: s },
    };
  }

  function disposeInstance(key: string) {
    const rec = instanceByKeyRef.current.get(key);
    if (!rec) return;
    rec.meshes.forEach((m) => m.dispose());
    rec.container.dispose();
    instanceByKeyRef.current.delete(key);
    objectsRef.current.delete(key);
  }

  async function reconcileInstances() {
    const scene = sceneRef.current;
    if (!scene) return;

    const desired = new Map<string, MapOverride>();
    for (const o of overridesRef.current) {
      if (o.isActive && (o.action === 'replace' || o.action === 'add') && o.assetId) {
        desired.set(o.targetBuildingKey, o);
      }
    }

    for (const [key, rec] of [...instanceByKeyRef.current]) {
      const o = desired.get(key);
      if (!o || o.assetId !== rec.assetId) disposeInstance(key);
    }

    for (const [key, ov] of desired) {
      const assetId = ov.assetId;
      if (!assetId) continue;
      const existing = instanceByKeyRef.current.get(key);
      if (existing && existing.assetId === assetId) {
        applyTransform(existing.container, ov.transform ?? defaultTransformFor(key, ov));
        const prev = objectsRef.current.get(key);
        if (prev) objectsRef.current.set(key, { ...prev, ...readTransform(existing.container) });
        continue;
      }
      if (loadingKeysRef.current.has(key)) continue;
      loadingKeysRef.current.add(key);

      let url: string | null = null;
      try {
        url = await buildingAssetService.loadGlbObjectUrl(assetId);
        if (!sceneRef.current) break;
        const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', url, scene, undefined, '.glb');
        if (!sceneRef.current) break;

        const container = new BABYLON.TransformNode(`inst_${key}`, scene);
        container.rotationQuaternion = BABYLON.Quaternion.Identity();
        if (chunkRootRef.current) container.parent = chunkRootRef.current;

        const info: MapObjectInfo = {
          meshName: ov.action === 'add' ? key : key.split(':').slice(1).join(':') || key,
          chunkId,
          type: 'building',
          key,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          boundingSize: { x: 0, y: 0, z: 0 },
        };

        // 捨棄資產自身 __root__，把內容直接掛到 container（避免重複座標轉換）
        const assetRoot = result.meshes.find((m) => m.name === '__root__');
        for (const m of result.meshes) {
          m.metadata = { ...(m.metadata as object), imported: true, instanceKey: key };
          if (m.name === '__root__') continue;
          m.isPickable = true;
          m.metadata = { ...(m.metadata as object), mapObject: info };
          if (m.parent === assetRoot) m.parent = container;
        }
        if (assetRoot) assetRoot.dispose();

        applyTransform(container, ov.transform ?? defaultTransformFor(key, ov));
        container.computeWorldMatrix(true);
        const hb = container.getHierarchyBoundingVectors(true);
        const size = hb.max.subtract(hb.min);
        const finalInfo: MapObjectInfo = {
          ...info,
          ...readTransform(container),
          boundingSize: { x: Math.abs(size.x), y: Math.abs(size.y), z: Math.abs(size.z) },
        };

        instanceByKeyRef.current.set(key, {
          container,
          meshes: result.meshes.filter((m) => m.name !== '__root__'),
          assetId,
        });
        objectsRef.current.set(key, finalInfo);
        setInstancesVersion((v) => v + 1);
      } catch (err) {
        console.error('[MapEditor3D] failed to load asset instance', key, err);
      } finally {
        if (url) URL.revokeObjectURL(url);
        loadingKeysRef.current.delete(key);
      }
    }

    emitObjects();
  }

  useEffect(() => {
    reconcile();
    void reconcileInstances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  // ---- 選取 + gizmo 模式 + 高亮 ----
  useEffect(() => {
    const gizmo = gizmoRef.current;
    const hl = highlightRef.current;
    if (!gizmo || !hl) return;

    gizmo.positionGizmoEnabled = gizmoMode === 'move';
    gizmo.rotationGizmoEnabled = gizmoMode === 'rotate';
    gizmo.scaleGizmoEnabled = gizmoMode === 'scale';

    const hook = (
      g:
        | {
            onDragStartObservable: BABYLON.Observable<unknown>;
            onDragEndObservable: BABYLON.Observable<unknown>;
            __hooked?: boolean;
          }
        | null
        | undefined
    ) => {
      if (!g || g.__hooked) return;
      g.onDragStartObservable.add(() => {
        draggingRef.current = true;
      });
      g.onDragEndObservable.add(() => {
        draggingRef.current = false;
        emitTransform();
      });
      g.__hooked = true;
    };
    hook(gizmo.gizmos.positionGizmo as never);
    hook(gizmo.gizmos.rotationGizmo as never);
    hook(gizmo.gizmos.scaleGizmo as never);

    for (const m of highlightedRef.current) hl.removeMesh(m);
    highlightedRef.current = [];

    const node = nodeForKey(selectedKey);
    const visible = !!node && node.isEnabled();
    if (node && visible) {
      for (const m of meshesOf(node)) {
        hl.addMesh(m, BABYLON.Color3.Yellow());
        highlightedRef.current.push(m);
      }
    }

    attachedKeyRef.current = selectedKey;
    lastEmitRef.current = null;
    gizmo.attachToNode(node && visible && gizmoMode !== 'none' ? node : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, gizmoMode, overrides, instancesVersion]);

  // ---- 鏡頭聚焦到選取的物件（由列表 / double-click 觸發） ----
  useEffect(() => {
    if (focusNonce <= 0) return;
    const node = nodeForKey(selectedKey);
    if (node) frameNode(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg outline-none"
      style={{ touchAction: 'none' }}
    />
  );
}
