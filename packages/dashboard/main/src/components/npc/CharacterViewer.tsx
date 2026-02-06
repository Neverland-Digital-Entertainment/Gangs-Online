'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '@/contexts/i18n-context';

type Gender = 'male' | 'female';

export type EquipmentSlot = 'hair' | 'beard' | 'head' | 'top' | 'bottom' | 'shoe';

export interface EquipmentState {
  hair: string | null;
  beard: string | null;
  head: string | null;
  top: string | null;
  bottom: string | null;
  shoe: string | null;
}

interface CharacterViewerProps {
  gender: Gender;
  equipment: EquipmentState;
}

export default function CharacterViewer({ gender, equipment }: CharacterViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const bodyMeshesRef = useRef<any[]>([]);
  const equipmentMeshesRef = useRef<Record<EquipmentSlot, any[]>>({
    hair: [], beard: [], head: [], top: [], bottom: [], shoe: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const prevGenderRef = useRef<Gender>(gender);
  const prevEquipmentRef = useRef<EquipmentState>(equipment);
  const sceneReadyRef = useRef(false);

  // Folder mapping for each slot
  const slotFolders: Record<EquipmentSlot, string> = {
    hair: 'hair',
    beard: 'beard',
    head: 'head',
    top: 'top',
    bottom: 'bottom',
    shoe: 'shoe',
  };

  const disposeSlot = useCallback((slot: EquipmentSlot) => {
    const meshes = equipmentMeshesRef.current[slot];
    if (meshes.length > 0) {
      meshes.forEach((mesh: any) => mesh.dispose());
      equipmentMeshesRef.current[slot] = [];
    }
  }, []);

  const disposeBody = useCallback(() => {
    bodyMeshesRef.current.forEach((mesh: any) => mesh.dispose());
    bodyMeshesRef.current = [];
  }, []);

  const disposeAll = useCallback(() => {
    disposeBody();
    (Object.keys(equipmentMeshesRef.current) as EquipmentSlot[]).forEach(disposeSlot);
  }, [disposeBody, disposeSlot]);

  const loadEquipmentSlot = useCallback(async (
    scene: any,
    slot: EquipmentSlot,
    itemId: string | null,
  ) => {
    disposeSlot(slot);
    if (!itemId) return;

    try {
      const BABYLON = await import('@babylonjs/core');
      const folder = slotFolders[slot];
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        `/characters/${folder}/`,
        `${itemId}.glb`,
        scene,
      );
      equipmentMeshesRef.current[slot] = result.meshes;
    } catch (err) {
      console.warn(`Failed to load equipment ${slot}/${itemId}:`, err);
    }
  }, [disposeSlot, slotFolders]);

  const loadBody = useCallback(async (scene: any, currentGender: Gender) => {
    const BABYLON = await import('@babylonjs/core');
    await import('@babylonjs/loaders/glTF');

    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      '/characters/body/',
      `${currentGender}.glb`,
      scene,
    );

    bodyMeshesRef.current = result.meshes;

    // Compute model bounds for camera framing
    const rootMesh = result.meshes[0];
    if (rootMesh) {
      let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
      let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

      result.meshes.forEach((mesh: any) => {
        if (mesh.getBoundingInfo) {
          const bi = mesh.getBoundingInfo();
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
        }
      });

      const center = BABYLON.Vector3.Center(min, max);
      const height = max.y - min.y;

      const camera = scene.activeCamera;
      if (camera) {
        camera.target = new BABYLON.Vector3(0, height / 2, 0);
        camera.radius = height * 1.8;
        camera.alpha = -Math.PI / 2;
        camera.beta = Math.PI / 2.2;
      }

      rootMesh.position.x = -center.x;
      rootMesh.position.z = -center.z;
    }
  }, []);

  // Full reload: body + all equipment
  const loadAll = useCallback(async (scene: any, currentGender: Gender, equip: EquipmentState) => {
    setLoading(true);
    setError(null);
    disposeAll();

    try {
      await loadBody(scene, currentGender);

      // Load all equipment in parallel
      const slots = Object.keys(equip) as EquipmentSlot[];
      await Promise.all(
        slots.map((slot) => loadEquipmentSlot(scene, slot, equip[slot]))
      );

      setLoading(false);
    } catch (err) {
      console.error('Failed to load character:', err);
      setError(t('npc.appearances.loadError'));
      setLoading(false);
    }
  }, [disposeAll, loadBody, loadEquipmentSlot, t]);

  // Initialize scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const initScene = async () => {
      const BABYLON = await import('@babylonjs/core');
      await import('@babylonjs/loaders/glTF');
      if (disposed) return;

      const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      engineRef.current = engine;

      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0.15, 0.15, 0.18, 1);
      sceneRef.current = scene;

      // Camera
      const camera = new BABYLON.ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 2.2,
        3,
        new BABYLON.Vector3(0, 1, 0),
        scene,
      );
      camera.attachControl(canvas, true);
      camera.lowerRadiusLimit = 1.5;
      camera.upperRadiusLimit = 8;
      camera.lowerBetaLimit = 0.3;
      camera.upperBetaLimit = Math.PI / 1.5;
      camera.wheelDeltaPercentage = 0.01;
      camera.panningSensibility = 0;

      // Lighting
      const keyLight = new BABYLON.DirectionalLight('keyLight', new BABYLON.Vector3(-1, -1, 1), scene);
      keyLight.intensity = 1.2;
      const fillLight = new BABYLON.DirectionalLight('fillLight', new BABYLON.Vector3(1, -0.5, -1), scene);
      fillLight.intensity = 0.6;
      const ambient = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
      ambient.intensity = 0.4;
      ambient.groundColor = new BABYLON.Color3(0.2, 0.2, 0.25);

      // Ground
      const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene);
      const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
      groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
      ground.material = groundMat;

      engine.runRenderLoop(() => scene.render());
      const onResize = () => engine.resize();
      window.addEventListener('resize', onResize);

      // Load initial character
      await loadAll(scene, gender, equipment);
      sceneReadyRef.current = true;
      prevGenderRef.current = gender;
      prevEquipmentRef.current = equipment;

      return () => window.removeEventListener('resize', onResize);
    };

    initScene();

    return () => {
      disposed = true;
      disposeAll();
      sceneRef.current?.dispose();
      sceneRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      sceneReadyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // React to gender change → full reload
  useEffect(() => {
    if (!sceneReadyRef.current || !sceneRef.current) return;
    if (gender === prevGenderRef.current) return;
    prevGenderRef.current = gender;
    prevEquipmentRef.current = equipment;
    loadAll(sceneRef.current, gender, equipment);
  }, [gender]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to individual equipment slot changes → swap only the changed slot
  useEffect(() => {
    if (!sceneReadyRef.current || !sceneRef.current) return;
    const prev = prevEquipmentRef.current;
    const scene = sceneRef.current;

    (Object.keys(equipment) as EquipmentSlot[]).forEach((slot) => {
      if (equipment[slot] !== prev[slot]) {
        loadEquipmentSlot(scene, slot, equipment[slot]);
      }
    });

    prevEquipmentRef.current = equipment;
  }, [equipment]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg outline-none"
        style={{ touchAction: 'none' }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">{t('npc.appearances.loadingModel')}</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="text-red-400 text-sm text-center px-4">{error}</div>
        </div>
      )}
      {!loading && !error && (
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-white/50 text-xs">{t('npc.appearances.rotateHint')}</span>
        </div>
      )}
    </div>
  );
}
