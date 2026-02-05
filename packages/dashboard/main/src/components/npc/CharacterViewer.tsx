'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '@/contexts/i18n-context';

type Gender = 'male' | 'female';

interface CharacterViewerProps {
  gender: Gender;
  onSceneReady?: () => void;
}

export default function CharacterViewer({ gender, onSceneReady }: CharacterViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const modelRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const cleanupModel = useCallback(() => {
    if (modelRef.current.length > 0) {
      modelRef.current.forEach((mesh: any) => {
        mesh.dispose();
      });
      modelRef.current = [];
    }
  }, []);

  const loadModel = useCallback(async (scene: any, currentGender: Gender) => {
    setLoading(true);
    setError(null);
    cleanupModel();

    try {
      const BABYLON = await import('@babylonjs/core');
      await import('@babylonjs/loaders/glTF');

      const modelPath = `/characters/body/`;
      const modelFile = `${currentGender}.glb`;

      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        modelPath,
        modelFile,
        scene
      );

      const meshes = result.meshes;
      modelRef.current = meshes;

      // Center the model and adjust scale
      const rootMesh = meshes[0];
      if (rootMesh) {
        // Compute bounding info to center the model
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        meshes.forEach((mesh: any) => {
          if (mesh.getBoundingInfo) {
            const boundingInfo = mesh.getBoundingInfo();
            const meshMin = boundingInfo.boundingBox.minimumWorld;
            const meshMax = boundingInfo.boundingBox.maximumWorld;
            min = BABYLON.Vector3.Minimize(min, meshMin);
            max = BABYLON.Vector3.Maximize(max, meshMax);
          }
        });

        const center = BABYLON.Vector3.Center(min, max);
        const height = max.y - min.y;

        // Adjust camera target to model center
        const camera = scene.activeCamera;
        if (camera) {
          camera.target = new BABYLON.Vector3(0, height / 2, 0);
          camera.radius = height * 1.8;
          camera.alpha = Math.PI / 2;
          camera.beta = Math.PI / 2.2;
        }

        // Adjust root mesh position to center at origin
        rootMesh.position.x = -center.x;
        rootMesh.position.z = -center.z;
      }

      setLoading(false);
      onSceneReady?.();
    } catch (err) {
      console.error('Failed to load character model:', err);
      setError(t('npc.appearances.loadError'));
      setLoading(false);
    }
  }, [cleanupModel, onSceneReady, t]);

  // Initialize Babylon.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const initScene = async () => {
      const BABYLON = await import('@babylonjs/core');
      // Import loaders side-effect
      await import('@babylonjs/loaders/glTF');

      if (disposed) return;

      // Create engine
      const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      engineRef.current = engine;

      // Create scene
      const scene = new BABYLON.Scene(engine);
      scene.clearColor = new BABYLON.Color4(0.15, 0.15, 0.18, 1);
      sceneRef.current = scene;

      // Camera - ArcRotateCamera for 360 rotation
      const camera = new BABYLON.ArcRotateCamera(
        'camera',
        Math.PI / 2,   // alpha - horizontal rotation
        Math.PI / 2.2, // beta - vertical rotation
        3,             // radius
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      camera.attachControl(canvas, true);
      camera.lowerRadiusLimit = 1.5;
      camera.upperRadiusLimit = 8;
      camera.lowerBetaLimit = 0.3;
      camera.upperBetaLimit = Math.PI / 1.5;
      camera.wheelDeltaPercentage = 0.01;
      camera.panningSensibility = 0; // Disable panning

      // Lighting - studio-style setup
      // Key light
      const keyLight = new BABYLON.DirectionalLight(
        'keyLight',
        new BABYLON.Vector3(-1, -1, 1),
        scene
      );
      keyLight.intensity = 1.2;

      // Fill light (softer, from opposite side)
      const fillLight = new BABYLON.DirectionalLight(
        'fillLight',
        new BABYLON.Vector3(1, -0.5, -1),
        scene
      );
      fillLight.intensity = 0.6;

      // Top/ambient light
      const hemisphericLight = new BABYLON.HemisphericLight(
        'ambientLight',
        new BABYLON.Vector3(0, 1, 0),
        scene
      );
      hemisphericLight.intensity = 0.4;
      hemisphericLight.groundColor = new BABYLON.Color3(0.2, 0.2, 0.25);

      // Ground plane (subtle)
      const ground = BABYLON.MeshBuilder.CreateGround(
        'ground',
        { width: 6, height: 6 },
        scene
      );
      const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
      groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
      ground.material = groundMat;
      ground.receiveShadows = true;

      // Render loop
      engine.runRenderLoop(() => {
        scene.render();
      });

      // Handle resize
      const resizeHandler = () => engine.resize();
      window.addEventListener('resize', resizeHandler);

      // Load initial model
      await loadModel(scene, gender);

      return () => {
        window.removeEventListener('resize', resizeHandler);
      };
    };

    initScene();

    return () => {
      disposed = true;
      cleanupModel();
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []); // Only init once

  // Handle gender change
  useEffect(() => {
    if (sceneRef.current && !loading) {
      loadModel(sceneRef.current, gender);
    }
  }, [gender]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <span className="text-white text-sm">
              {t('npc.appearances.loadingModel')}
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="text-red-400 text-sm text-center px-4">
            {error}
          </div>
        </div>
      )}
      {!loading && !error && (
        <div className="absolute bottom-3 left-0 right-0 text-center">
          <span className="text-white/50 text-xs">
            {t('npc.appearances.rotateHint')}
          </span>
        </div>
      )}
    </div>
  );
}
