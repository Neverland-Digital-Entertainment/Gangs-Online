/**
 * 資產 GLB 嘅命名約定（與遊戲客戶端 MapOverrideSystem 一致）
 *
 *   COL_ 開頭嘅 mesh：隱形碰撞方塊，唔渲染、唔可選取
 *   `shared:` 開頭嘅貼圖名：多份資產共用嘅 atlas，同名只保留一份 GPU 貼圖
 *
 * 只用型別 import Babylon，避免喺 SSR 階段載入 Babylon。
 */
import type { AssetContainer, BaseTexture } from '@babylonjs/core';

export const COLLIDER_PREFIX = 'COL_';
export const SHARED_TEXTURE_PREFIX = 'shared:';

export function isColliderMeshName(name: string): boolean {
  return name.startsWith(COLLIDER_PREFIX);
}

/**
 * 將 container 入面同名（shared:…）嘅 base color 貼圖換成 cache 入面第一份，
 * 每棟大廈都嵌住同一張 atlas，唔共用的話擺幾多棟就有幾多份。
 */
export function shareAtlasTextures(
  container: AssetContainer,
  cache: Map<string, BaseTexture>
): void {
  for (const mat of container.materials) {
    const pbr = mat as { albedoTexture?: BaseTexture | null };
    const tex = pbr.albedoTexture;
    const label = tex?.getInternalTexture()?.label;
    if (!tex || !label || !label.startsWith(SHARED_TEXTURE_PREFIX)) continue;
    const shared = cache.get(label);
    if (!shared) {
      cache.set(label, tex);
    } else if (shared !== tex) {
      pbr.albedoTexture = shared;
      tex.dispose();
    }
  }
}
