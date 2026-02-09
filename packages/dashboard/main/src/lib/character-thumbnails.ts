/**
 * Generates 3D preview thumbnails for character equipment items.
 * Uses an offscreen Babylon.js engine to render each GLB item one at a time,
 * captures the frame as a data URL, then disposes.
 */

interface ThumbnailItem {
  folder: string;
  file: string;
}

export type ThumbnailMap = Record<string, string>;

/**
 * Generate thumbnails for all equipment items.
 * Calls onProgress after each item is rendered, so the UI can update progressively.
 */
export async function generateAllThumbnails(
  items: ThumbnailItem[],
  onProgress?: (key: string, dataUrl: string) => void,
): Promise<ThumbnailMap> {
  const BABYLON = await import('@babylonjs/core');
  await import('@babylonjs/loaders/glTF');

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;pointer-events:none;';
  document.body.appendChild(canvas);

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.22, 0.22, 0.26, 1);

  const camera = new BABYLON.ArcRotateCamera(
    'thumbCam', -Math.PI / 2, Math.PI / 2.5, 3,
    BABYLON.Vector3.Zero(), scene,
  );

  const hemi = new BABYLON.HemisphericLight('thumbHemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;
  const dir = new BABYLON.DirectionalLight('thumbDir', new BABYLON.Vector3(-1, -1, 1), scene);
  dir.intensity = 0.7;

  const result: ThumbnailMap = {};

  for (const item of items) {
    const key = `${item.folder}/${item.file}`;
    try {
      const loadResult = await BABYLON.SceneLoader.ImportMeshAsync(
        '', `/characters/${item.folder}/`, `${item.file}.glb`, scene,
      );

      // CRITICAL: wait for all shaders and textures to be compiled/loaded.
      // Without this, parallel shader compilation means the first render
      // draws nothing (materials not ready yet).
      await scene.whenReadyAsync();

      // Auto-frame: compute hierarchy bounds
      const rootMesh = loadResult.meshes[0];
      if (rootMesh) {
        rootMesh.computeWorldMatrix(true);
        const bounds = rootMesh.getHierarchyBoundingVectors(true);
        const center = BABYLON.Vector3.Center(bounds.min, bounds.max);
        const extent = bounds.max.subtract(bounds.min);
        const maxDim = Math.max(extent.x, extent.y, extent.z);

        if (maxDim > 0 && maxDim < 1000) {
          camera.target = center;
          camera.radius = maxDim * 1.5;
        }
      }

      // Render and capture
      scene.render();
      const dataUrl = canvas.toDataURL('image/webp', 0.8);
      result[key] = dataUrl;
      onProgress?.(key, dataUrl);

      // Cleanup
      loadResult.meshes.forEach((m: any) => m.dispose());
      loadResult.skeletons.forEach((s: any) => s.dispose());
    } catch (err) {
      console.warn(`Thumbnail failed for ${key}:`, err);
    }
  }

  engine.dispose();
  document.body.removeChild(canvas);

  return result;
}
