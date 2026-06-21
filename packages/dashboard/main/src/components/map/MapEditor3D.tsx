'use client';

/**
 * MapEditor3D — Babylon.js 3D 地圖檢視器（Map Editor P1，唯讀）
 *
 * 職責：
 *  1. 從靜態來源 fetch 並渲染底圖 GLB chunk
 *  2. 依名稱前綴分類 mesh（B=大廈、I=props、T=地形）
 *  3. 射線點選大廈/props → 高亮 + 透過 onSelect 回傳物件資訊
 *
 * 注意：此元件僅能在瀏覽器執行，請以 next/dynamic ssr:false 載入。
 */

import { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { MAP_BASE_URL } from '@/lib/map/map-loader';
import {
  buildObjectKey,
  classifyMeshName,
  type MapObjectInfo,
} from '@/types/map';

interface MapEditor3DProps {
  chunkId: string;
  chunkFile: string;
  selectedKey: string | null;
  onSelect: (obj: MapObjectInfo | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string | null) => void;
}

export default function MapEditor3D({
  chunkId,
  chunkFile,
  selectedKey,
  onSelect,
  onLoadingChange,
  onError,
}: MapEditor3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const highlightRef = useRef<BABYLON.HighlightLayer | null>(null);
  const meshByKeyRef = useRef<Map<string, BABYLON.AbstractMesh>>(new Map());
  const selectedMeshRef = useRef<BABYLON.Mesh | null>(null);

  // 用 ref 保存最新 callback，避免重建場景 / 重新載入 chunk
  const onSelectRef = useRef(onSelect);
  const onLoadingRef = useRef(onLoadingChange);
  const onErrorRef = useRef(onError);
  onSelectRef.current = onSelect;
  onLoadingRef.current = onLoadingChange;
  onErrorRef.current = onError;

  // 建立引擎與場景（只做一次）
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
    engineRef.current = engine;
    sceneRef.current = scene;

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);

    // 點選（POINTERTAP：避免拖曳旋轉時誤選）
    scene.onPointerObservable.add((pi) => {
      if (pi.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
      const picked = pi.pickInfo?.pickedMesh as BABYLON.AbstractMesh | undefined;
      const info = picked
        ? ((picked.metadata as Record<string, unknown> | undefined)
            ?.mapObject as MapObjectInfo | undefined)
        : undefined;
      onSelectRef.current(info ?? null);
    });

    return () => {
      window.removeEventListener('resize', onResize);
      scene.dispose();
      engine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
      highlightRef.current = null;
      meshByKeyRef.current.clear();
      selectedMeshRef.current = null;
    };
  }, []);

  // 載入 / 切換 chunk
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !chunkFile) return;
    let cancelled = false;

    // 清掉前一個 chunk
    meshByKeyRef.current.clear();
    selectedMeshRef.current = null;
    highlightRef.current?.removeAllMeshes();
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
            const ext = bi.boundingBox.extendSizeWorld;
            const abs = mesh.getAbsolutePosition();
            const rot = mesh.rotationQuaternion
              ? mesh.rotationQuaternion.toEulerAngles()
              : mesh.rotation;
            const info: MapObjectInfo = {
              meshName: mesh.name,
              chunkId,
              type,
              key: buildObjectKey(chunkId, mesh.name),
              position: { x: abs.x, y: abs.y, z: abs.z },
              rotation: { x: rot.x, y: rot.y, z: rot.z },
              scale: { x: mesh.scaling.x, y: mesh.scaling.y, z: mesh.scaling.z },
              boundingSize: { x: ext.x * 2, y: ext.y * 2, z: ext.z * 2 },
            };
            mesh.metadata = { ...(mesh.metadata as object), mapObject: info };
            meshByKeyRef.current.set(info.key, mesh);
          }
        }

        // 將攝影機對準地圖中心
        if (Number.isFinite(min.x)) {
          const center = BABYLON.Vector3.Center(min, max);
          const radius = Math.max(max.subtract(min).length() * 0.8, 10);
          const cam = scene.activeCamera as BABYLON.ArcRotateCamera;
          cam.setTarget(center);
          cam.radius = radius;
          cam.maxZ = radius * 20;
        }

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
  }, [chunkFile, chunkId]);

  // 反映外部選取狀態（高亮）
  useEffect(() => {
    const hl = highlightRef.current;
    if (!hl) return;

    if (selectedMeshRef.current) {
      hl.removeMesh(selectedMeshRef.current);
      selectedMeshRef.current = null;
    }
    if (selectedKey) {
      const mesh = meshByKeyRef.current.get(selectedKey);
      if (mesh instanceof BABYLON.Mesh) {
        hl.addMesh(mesh, BABYLON.Color3.Yellow());
        selectedMeshRef.current = mesh;
      }
    }
  }, [selectedKey]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-lg outline-none"
      style={{ touchAction: 'none' }}
    />
  );
}
