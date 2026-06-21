/**
 * generateGlbThumbnail — 在離屏 canvas 用 Babylon 渲染 GLB 並擷取縮圖（Map Editor P3）
 *
 * Babylon 以動態 import 載入，避免在 SSR 階段執行瀏覽器專屬程式碼。
 * 失敗時回傳 null（資產仍可上載，只是沒有縮圖）。
 */

export async function generateGlbThumbnail(
  file: File,
  size = 256
): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;

  const BABYLON = await import('@babylonjs/core');
  await import('@babylonjs/loaders/glTF');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
  });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.1, 0.12, 0.15, 1);

  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      '',
      url,
      scene,
      undefined,
      '.glb'
    );

    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of result.meshes) {
      if (mesh.name === '__root__') continue;
      mesh.computeWorldMatrix(true);
      const bi = mesh.getBoundingInfo();
      min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
    }

    const center = Number.isFinite(min.x)
      ? BABYLON.Vector3.Center(min, max)
      : BABYLON.Vector3.Zero();
    const radius = Number.isFinite(min.x)
      ? Math.max(max.subtract(min).length() * 0.9, 1)
      : 10;

    const camera = new BABYLON.ArcRotateCamera(
      'thumbCam',
      Math.PI / 4,
      Math.PI / 3,
      radius,
      center,
      scene
    );
    camera.minZ = 0.01;
    camera.maxZ = radius * 50;

    new BABYLON.HemisphericLight(
      'thumbHemi',
      new BABYLON.Vector3(0.3, 1, 0.4),
      scene
    );
    const dir = new BABYLON.DirectionalLight(
      'thumbDir',
      new BABYLON.Vector3(-0.5, -1, -0.5),
      scene
    );
    dir.intensity = 0.7;

    // 渲染幾幀讓材質/貼圖就緒
    for (let i = 0; i < 4; i++) scene.render();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    return blob;
  } catch (err) {
    console.error('[thumbnail] generate failed', err);
    return null;
  } finally {
    if (url) URL.revokeObjectURL(url);
    scene.dispose();
    engine.dispose();
  }
}
