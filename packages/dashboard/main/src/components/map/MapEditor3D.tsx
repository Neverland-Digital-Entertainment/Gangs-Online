'use client';

/**
 * MapEditor3D — Babylon.js 3D 地圖編輯器（Map Editor P1 + P2）
 *
 * 職責：
 *  1. 從同源 /maps fetch 並渲染底圖 GLB chunk
 *  2. 依名稱前綴分類 mesh（B=大廈、I=props、T=地形）
 *  3. 射線點選大廈/props → 高亮 + 透過 onSelect 回傳物件資訊
 *  4. GizmoManager 移動 / 旋轉 / 縮放選中物件，拖曳時即時回報 transform
 *  5. 依傳入的 overrides 套用既有編輯（transform 套用、delete 隱藏），
 *     沒有 override 的物件則還原成原始 transform
 *
 * 資料寫入由父層負責（Firestore）；本元件不直接碰 Firestore。
 * 僅能在瀏覽器執行，請以 next/dynamic ssr:false 載入。
 */

import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { MAP_BASE_URL } from '@/lib/map/map-loader';
import {
  buildObjectKey,
  classifyMeshName,
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
  onSelect: (obj: MapObjectInfo | null) => void;
  onTransformChange: (key: string, transform: Transform) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string | null) => void;
}

function readTransform(mesh: BABYLON.AbstractMesh): Transform {
  const q = mesh.rotationQuaternion ?? BABYLON.Quaternion.Identity();
  const e = q.toEulerAngles();
  return {
    position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    rotation: { x: e.x, y: e.y, z: e.z },
    scale: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
  };
}

function applyTransform(mesh: BABYLON.AbstractMesh, t: Transform): void {
  mesh.position.set(t.position.x, t.position.y, t.position.z);
  if (!mesh.rotationQuaternion) mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
  BABYLON.Quaternion.FromEulerAnglesToRef(
    t.rotation.x,
    t.rotation.y,
    t.rotation.z,
    mesh.rotationQuaternion
  );
  mesh.scaling.set(t.scale.x, t.scale.y, t.scale.z);
}

function transformsEqual(a: Transform | null, b: Transform | null): boolean {
  if (!a || !b) return a === b;
  const eps = 1e-5;
  const close = (x: number, y: number) => Math.abs(x - y) < eps;
  return (
    close(a.position.x, b.position.x) &&
    close(a.position.y, b.position.y) &&
    close(a.position.z, b.position.z) &&
    close(a.rotation.x, b.rotation.x) &&
    close(a.rotation.y, b.rotation.y) &&
    close(a.rotation.z, b.rotation.z) &&
    close(a.scale.x, b.scale.x) &&
    close(a.scale.y, b.scale.y) &&
    close(a.scale.z, b.scale.z)
  );
}

export default function MapEditor3D({
  chunkId,
  chunkFile,
  selectedKey,
  gizmoMode,
  overrides,
  onSelect,
  onTransformChange,
  onLoadingChange,
  onError,
}: MapEditor3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const highlightRef = useRef<BABYLON.HighlightLayer | null>(null);
  const gizmoRef = useRef<BABYLON.GizmoManager | null>(null);

  const meshByKeyRef = useRef<Map<string, BABYLON.AbstractMesh>>(new Map());
  const originalByKeyRef = useRef<Map<string, Transform>>(new Map());
  const selectedMeshRef = useRef<BABYLON.Mesh | null>(null);

  // gizmo 拖曳狀態
  const draggingRef = useRef(false);
  const attachedKeyRef = useRef<string | null>(null);
  const lastEmitRef = useRef<Transform | null>(null);

  // 觸發 reconcile：每次載入完成後遞增
  const loadedVersionRef = useRef(0);

  // 用 ref 保存最新 callback，避免重建場景 / 重新載入
  const onSelectRef = useRef(onSelect);
  const onTransformRef = useRef(onTransformChange);
  const onLoadingRef = useRef(onLoadingChange);
  const onErrorRef = useRef(onError);
  onSelectRef.current = onSelect;
  onTransformRef.current = onTransformChange;
  onLoadingRef.current = onLoadingChange;
  onErrorRef.current = onError;

  function emitTransform() {
    const key = attachedKeyRef.current;
    const mesh = key ? meshByKeyRef.current.get(key) : null;
    if (!key || !mesh) return;
    const t = readTransform(mesh);
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
      'editorCamera',
      -Math.PI / 2,
      Math.PI / 3,
      200,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 0.5;
    camera.minZ = 0.1;
    camera.maxZ = 200000;
    camera.panningSensibility = 10;
    camera.allowUpsideDown = false;

    const hemi = new BABYLON.HemisphericLight(
      'hemi',
      new BABYLON.Vector3(0.3, 1, 0.4),
      scene
    );
    hemi.intensity = 1.1;
    const dir = new BABYLON.DirectionalLight(
      'dir',
      new BABYLON.Vector3(-0.5, -1, -0.5),
      scene
    );
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

    // 拖曳時即時回報 transform
    scene.onBeforeRenderObservable.add(() => {
      if (draggingRef.current) emitTransform();
    });

    // 點選（POINTERTAP：避免拖曳旋轉時誤選）
    scene.onPointerObservable.add((pi) => {
      if (pi.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
      if (draggingRef.current) return;
      const picked = pi.pickInfo?.pickedMesh as BABYLON.AbstractMesh | undefined;
      const base = picked
        ? ((picked.metadata as Record<string, unknown> | undefined)
            ?.mapObject as MapObjectInfo | undefined)
        : undefined;
      if (base && picked) {
        // 回報「目前」transform（可能已被 override 改過）
        onSelectRef.current({ ...base, ...readTransform(picked) });
      } else {
        onSelectRef.current(null);
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
      meshByKeyRef.current.clear();
      originalByKeyRef.current.clear();
      selectedMeshRef.current = null;
    };
  }, []);

  // ---- 載入 / 切換 chunk ----
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !chunkFile) return;
    let cancelled = false;

    meshByKeyRef.current.clear();
    originalByKeyRef.current.clear();
    selectedMeshRef.current = null;
    highlightRef.current?.removeAllMeshes();
    gizmoRef.current?.attachToMesh(null);
    scene.meshes
      .filter((m) => (m.metadata as Record<string, unknown> | undefined)?.imported)
      .slice()
      .forEach((m) => m.dispose());

    onErrorRef.current?.(null);
    onLoadingRef.current?.(true);

    BABYLON.SceneLoader.ImportMeshAsync('', `${MAP_BASE_URL}/`, chunkFile, scene)
      .then((result) => {
        if (cancelled) return;

        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        for (const mesh of result.meshes) {
          mesh.metadata = { ...(mesh.metadata as object), imported: true };
          if (mesh.name === '__root__') continue;

          mesh.computeWorldMatrix(true);
          const bi = mesh.getBoundingInfo();
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);

          const type = classifyMeshName(mesh.name);
          const selectable = type === 'building' || type === 'prop';
          mesh.isPickable = selectable;

          if (selectable) {
            // 確保有 rotationQuaternion，gizmo 旋轉與讀取才一致
            if (!mesh.rotationQuaternion) {
              mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(
                mesh.rotation
              );
            }
            const key = buildObjectKey(chunkId, mesh.name);
            const original = readTransform(mesh);
            const ext = bi.boundingBox.extendSizeWorld;
            const base: MapObjectInfo = {
              meshName: mesh.name,
              chunkId,
              type,
              key,
              ...original,
              boundingSize: { x: ext.x * 2, y: ext.y * 2, z: ext.z * 2 },
            };
            mesh.metadata = { ...(mesh.metadata as object), mapObject: base };
            meshByKeyRef.current.set(key, mesh);
            originalByKeyRef.current.set(key, original);
          }
        }

        if (Number.isFinite(min.x)) {
          const center = BABYLON.Vector3.Center(min, max);
          const radius = Math.max(max.subtract(min).length() * 0.8, 10);
          const cam = scene.activeCamera as BABYLON.ArcRotateCamera;
          cam.setTarget(center);
          cam.radius = radius;
          cam.maxZ = radius * 20;
        }

        loadedVersionRef.current += 1;
        reconcile();
        onLoadingRef.current?.(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[MapEditor3D] failed to load chunk', err);
        onErrorRef.current?.(
          err instanceof Error ? err.message : 'Failed to load map'
        );
        onLoadingRef.current?.(false);
      });

    return () => {
      cancelled = true;
    };
    // reconcile 透過 ref 取得 overrides，毋須列入相依
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkFile, chunkId]);

  // ---- 依 overrides 調和場景 ----
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  function reconcile() {
    if (meshByKeyRef.current.size === 0) return;
    const activeByKey = new Map<string, MapOverride>();
    for (const o of overridesRef.current) {
      if (o.isActive) activeByKey.set(o.targetBuildingKey, o);
    }

    for (const [key, mesh] of meshByKeyRef.current) {
      const ov = activeByKey.get(key);
      if (ov?.action === 'delete') {
        mesh.setEnabled(false);
      } else if (ov?.action === 'transform' && ov.transform) {
        mesh.setEnabled(true);
        applyTransform(mesh, ov.transform);
      } else {
        mesh.setEnabled(true);
        const orig = originalByKeyRef.current.get(key);
        if (orig) applyTransform(mesh, orig);
      }
    }

    // 若選中物件被隱藏，卸下 gizmo 與高亮
    const sel = selectedMeshRef.current;
    if (sel && !sel.isEnabled()) {
      gizmoRef.current?.attachToMesh(null);
      highlightRef.current?.removeMesh(sel);
    }
  }

  useEffect(() => {
    reconcile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  // ---- 選取 + gizmo 模式 ----
  useEffect(() => {
    const gizmo = gizmoRef.current;
    const hl = highlightRef.current;
    if (!gizmo || !hl) return;

    gizmo.positionGizmoEnabled = gizmoMode === 'move';
    gizmo.rotationGizmoEnabled = gizmoMode === 'rotate';
    gizmo.scaleGizmoEnabled = gizmoMode === 'scale';

    // 為剛建立的 gizmo 掛上拖曳事件（用旗標避免重複掛）
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

    // 高亮
    if (selectedMeshRef.current) {
      hl.removeMesh(selectedMeshRef.current);
      selectedMeshRef.current = null;
    }
    const mesh = selectedKey ? meshByKeyRef.current.get(selectedKey) ?? null : null;
    const visible = !!mesh && mesh.isEnabled();
    if (mesh instanceof BABYLON.Mesh && visible) {
      hl.addMesh(mesh, BABYLON.Color3.Yellow());
      selectedMeshRef.current = mesh;
    }

    // 掛 gizmo
    attachedKeyRef.current = selectedKey;
    lastEmitRef.current = null;
    gizmo.attachToMesh(visible && gizmoMode !== 'none' ? mesh : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, gizmoMode, overrides]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg outline-none"
      style={{ touchAction: 'none' }}
    />
  );
}
