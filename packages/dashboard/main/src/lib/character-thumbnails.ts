/**
 * Generates 3D preview thumbnails for character equipment items.
 * Uses an offscreen Babylon.js engine to render each GLB item one at a time,
 * captures the frame as a data URL, then disposes.
 */

interface ThumbnailItem {
  folder: string;
  file: string;
}

const ALL_THUMBNAIL_ITEMS: ThumbnailItem[] = [
  { folder: 'hair', file: 'short' },
  { folder: 'hair', file: 'buzzed' },
  { folder: 'hair', file: 'buzzed-female' },
  { folder: 'hair', file: 'long' },
  { folder: 'hair', file: 'bun' },
  { folder: 'beard', file: 'beard' },
  { folder: 'head', file: 'cap' },
  { folder: 'top', file: 'shirt01' },
  { folder: 'bottom', file: 'pants01' },
  { folder: 'shoe', file: 'shoe01' },
];

export type ThumbnailMap = Record<string, string>;

/**
 * Generate thumbnails for all equipment items.
 * Calls onProgress after each item is rendered, so the UI can update progressively.
 */
export async function generateAllThumbnails(
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

  for (const item of ALL_THUMBNAIL_ITEMS) {
    const key = `${item.folder}/${item.file}`;
    try {
      const loadResult = await BABYLON.SceneLoader.ImportMeshAsync(
        '', `/characters/${item.folder}/`, `${item.file}.glb`, scene,
      );

      // Auto-frame the model
      let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
      let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
      loadResult.meshes.forEach((mesh: any) => {
        if (mesh.getBoundingInfo) {
          const bi = mesh.getBoundingInfo();
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
        }
      });

      const center = BABYLON.Vector3.Center(min, max);
      const extent = max.subtract(min);
      const maxDim = Math.max(extent.x, extent.y, extent.z);

      camera.target = center;
      camera.radius = maxDim * 1.6;

      scene.render();
      const dataUrl = canvas.toDataURL('image/webp', 0.8);
      result[key] = dataUrl;
      onProgress?.(key, dataUrl);

      // Cleanup this item's meshes and skeletons
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
