'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertCircle,
  Edit,
  Folder,
  FolderPlus,
  Info,
  ListTree,
  Loader2,
  Map as MapIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useAuth } from '@/contexts/auth-context';
import { loadMapManifest } from '@/lib/map/map-loader';
import { mapOverrideService } from '@/lib/map/override-service';
import { buildingAssetService } from '@/lib/map/asset-service';
import type {
  BuildingAsset,
  GizmoMode,
  InstanceStatus,
  MapManifest,
  MapObjectInfo,
  MapOverride,
  Transform,
} from '@/types/map';
import BuildingInspector from '@/components/map/BuildingInspector';
import MapOutliner from '@/components/map/MapOutliner';
import AssetPicker from '@/components/map/AssetPicker';

// Babylon 只能在瀏覽器執行
const MapEditor3D = dynamic(() => import('@/components/map/MapEditor3D'), {
  ssr: false,
});

export default function MapEditorPage() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('map.edit');
  const [manifest, setManifest] = useState<MapManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [chunkId, setChunkId] = useState('');

  const [selected, setSelected] = useState<MapObjectInfo | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('move');
  const [draftTransform, setDraftTransform] = useState<Transform | null>(null);
  // null = 未編輯（沿用 override 上的值）；字串 = 使用者輸入的草稿
  const [draftGroupId, setDraftGroupId] = useState<string | null>(null);
  const [objects, setObjects] = useState<MapObjectInfo[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);
  const [applyNonce, setApplyNonce] = useState(0);

  // 列表多選（用於一次過把多件物件編成同一個遮擋群組）
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [instanceStatus, setInstanceStatus] = useState<InstanceStatus>({
    loading: [],
    failed: {},
  });

  const [overrides, setOverrides] = useState<MapOverride[]>([]);
  const [assets, setAssets] = useState<BuildingAsset[]>([]);
  // 未載完資產清單前唔可以判定孤兒 override，否則會全部誤報
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [picker, setPicker] = useState<'replace' | 'add' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest();
    buildingAssetService
      .getAll()
      .then((list) => {
        setAssets(list);
        setAssetsLoaded(true);
      })
      .catch((err) => console.error('載入建築資產失敗:', err));
  }, []);

  async function loadManifest() {
    try {
      setManifestLoading(true);
      setManifestError(null);
      const data = await loadMapManifest();
      setManifest(data);
      setChunkId(data.startChunk || data.chunks[0]?.id || '');
    } catch (err) {
      console.error('載入地圖清單失敗:', err);
      setManifestError(t('map.editor.manifestError'));
    } finally {
      setManifestLoading(false);
    }
  }

  const loadOverrides = useCallback(async (cid: string) => {
    try {
      const data = await mapOverrideService.getByChunk(cid);
      setOverrides(data);
    } catch (err) {
      console.error('載入地圖編輯資料失敗:', err);
    }
  }, []);

  // 切換 chunk 時載入該 chunk 的 overrides
  useEffect(() => {
    if (chunkId) loadOverrides(chunkId);
  }, [chunkId, loadOverrides]);

  const chunkFile = useMemo(
    () => manifest?.chunks.find((c) => c.id === chunkId)?.file ?? '',
    [manifest, chunkId]
  );
  const mapName = manifest?.mapName ?? '';

  const selectedOverride = useMemo(
    () =>
      selected
        ? overrides.find((o) => o.targetBuildingKey === selected.key) ?? null
        : null,
    [overrides, selected]
  );

  const assetsById = useMemo(() => {
    const map: Record<string, BuildingAsset> = {};
    for (const a of assets) map[a.id] = a;
    return map;
  }, [assets]);

  // 全部 override（含停用）依 key 索引，供列表/狀態判斷
  const overrideByKey = useMemo(() => {
    const map: Record<string, MapOverride> = {};
    for (const o of overrides) map[o.targetBuildingKey] = o;
    return map;
  }, [overrides]);
  /**
   * 真正載入失敗的資產實例。
   *
   * 之前是以「override 存在但不在 objects 裡」判斷，但 objects 要等全部實例
   * 載完先一次過回報，所以載入期間所有實例都會被誤報為失敗 —— 資產由
   * Firestore 逐塊取回本身就慢，這個警告幾乎一定會閃出嚟。現時改為只列出
   * 編輯器明確回報失敗的 key。
   */
  /**
   * 孤兒 override：引用的資產已經喺資產庫被刪除。
   *
   * 刪除資產只會清走 `building_assets` 文件同 chunks，唔會掂 `map_overrides`，
   * 所以引用它的編輯會留低。編輯器載入時取到空的 GLB → 解析失敗 → 該物件
   * 永遠唔會出現喺場景，並持續報「已儲存但未顯示」。遊戲端則係
   * `assetSnap.exists()` 為 false，直接略過，該位置變空白。
   *
   * 這裡直接以資產清單比對，唔使等載入失敗先知，訊息亦準確得多。
   */
  const orphanInstances = useMemo(() => {
    if (!assetsLoaded) return [];
    return overrides.filter(
      (o) =>
        o.isActive &&
        (o.action === 'add' || o.action === 'replace') &&
        !!o.assetId &&
        !assetsById[o.assetId]
    );
  }, [assetsLoaded, overrides, assetsById]);

  const orphanKeys = useMemo(
    () => new Set(orphanInstances.map((o) => o.targetBuildingKey)),
    [orphanInstances]
  );

  const failedInstances = useMemo(
    () =>
      overrides.filter(
        (o) =>
          o.isActive &&
          (o.action === 'add' || o.action === 'replace') &&
          instanceStatus.failed[o.targetBuildingKey] !== undefined &&
          // 孤兒另有更準確的訊息，唔重複報
          !orphanKeys.has(o.targetBuildingKey)
      ),
    [overrides, instanceStatus, orphanKeys]
  );

  const loadingInstanceCount = instanceStatus.loading.length;

  /** 可編組的物件：只有資產實例有遮擋群組概念 */
  const groupableKeys = useMemo(
    () =>
      new Set(
        overrides
          .filter(
            (o) => o.isActive && (o.action === 'add' || o.action === 'replace')
          )
          .map((o) => o.targetBuildingKey)
      ),
    [overrides]
  );

  /** groupId → 成員 override */
  const groups = useMemo(() => {
    const map = new Map<string, MapOverride[]>();
    for (const o of overrides) {
      if (!o.groupId) continue;
      if (!map.has(o.groupId)) map.set(o.groupId, []);
      map.get(o.groupId)!.push(o);
    }
    return map;
  }, [overrides]);

  const selectedGroupable = useMemo(
    () => Array.from(selectedKeys).filter((k) => groupableKeys.has(k)),
    [selectedKeys, groupableKeys]
  );

  const currentGroupId = draftGroupId ?? selectedOverride?.groupId ?? '';

  const groupIdDirty =
    draftGroupId !== null &&
    draftGroupId.trim() !== (selectedOverride?.groupId ?? '');

  // 是否有未儲存的 transform 變更
  const transformDirty = useMemo(() => {
    if (!selected || !draftTransform) return false;
    const base = selectedOverride?.transform ?? {
      position: selected.position,
      rotation: selected.rotation,
      scale: selected.scale,
    };
    const eps = 1e-4;
    const close = (a: number, b: number) => Math.abs(a - b) < eps;
    return !(
      close(draftTransform.position.x, base.position.x) &&
      close(draftTransform.position.y, base.position.y) &&
      close(draftTransform.position.z, base.position.z) &&
      close(draftTransform.rotation.x, base.rotation.x) &&
      close(draftTransform.rotation.y, base.rotation.y) &&
      close(draftTransform.rotation.z, base.rotation.z) &&
      close(draftTransform.scale.x, base.scale.x) &&
      close(draftTransform.scale.y, base.scale.y) &&
      close(draftTransform.scale.z, base.scale.z)
    );
  }, [selected, draftTransform, selectedOverride]);

  const dirty = transformDirty || groupIdDirty;

  // 供 gizmo 拖曳回呼比對目前選取（避免在 setState updater 內做副作用）
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selected?.key ?? null;

  /** 由 3D 場景點選（射線選取）觸發：同步 outliner 的選取狀態 */
  const handleSelect = useCallback((obj: MapObjectInfo | null) => {
    setSelected(obj);
    setDraftTransform(null);
    setDraftGroupId(null);
    setSaveError(null);
    setSelectedKeys(obj ? new Set([obj.key]) : new Set());
  }, []);

  // 狀態判斷小工具

  const handleTransformChange = useCallback((key: string, tr: Transform) => {
    if (selectedKeyRef.current === key) setDraftTransform(tr);
  }, []);

  // 手動輸入數值 → 更新草稿並推送到 3D（applyNonce 觸發編輯器套用）
  function handleTransformInput(tr: Transform) {
    setDraftTransform(tr);
    setApplyNonce((n) => n + 1);
  }

  /** 刪除引用已失效資產的 override（資產已被移除，留住只會一直報錯） */
  async function handleCleanOrphans() {
    if (orphanInstances.length === 0) return;
    try {
      setSaving(true);
      setSaveError(null);
      for (const o of orphanInstances) {
        await mapOverrideService.delete(o.id);
      }
      await loadOverrides(chunkId);
      setSelected(null);
    } catch (err) {
      console.error('清理失效編輯失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }


  /** 把一批 override 的遮擋群組設為 groupId（空字串 = 解除群組） */
  async function setGroupFor(keys: string[], groupId: string) {
    const targets = overrides.filter((o) => keys.includes(o.targetBuildingKey));
    if (targets.length === 0) return;
    try {
      setSaving(true);
      setSaveError(null);
      for (const o of targets) {
        await mapOverrideService.update(o.id, { groupId });
      }
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('設定遮擋群組失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateGroup() {
    if (selectedGroupable.length === 0) return;
    // 產生不與現有群組重複的預設名稱，之後可改名
    let n = 1;
    let name = `${t('map.group.defaultName')} ${n}`;
    while (groups.has(name)) {
      n += 1;
      name = `${t('map.group.defaultName')} ${n}`;
    }
    await setGroupFor(selectedGroupable, name);
    setSelectedKeys(new Set());
  }

  async function handleUngroupSelected() {
    if (selectedGroupable.length === 0) return;
    await setGroupFor(selectedGroupable, '');
    setSelectedKeys(new Set());
  }

  async function handleRenameGroup(oldName: string) {
    const next = renameDraft.trim();
    setRenamingGroup(null);
    if (!next || next === oldName) return;
    const members = groups.get(oldName) ?? [];
    await setGroupFor(
      members.map((o) => o.targetBuildingKey),
      next
    );
  }

  async function handleToggleActive() {
    if (!selectedOverride) return;
    try {
      setSaving(true);
      setSaveError(null);
      await mapOverrideService.setActive(selectedOverride.id, !selectedOverride.isActive);
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('切換啟用狀態失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const handleObjectsChange = useCallback((objs: MapObjectInfo[]) => {
    setObjects(objs);
  }, []);

  // 新增/替換的實例首次自動擺放後，把 transform 寫回 override（持久化位置/縮放）
  async function handleInstancePlaced(key: string, transform: Transform) {
    if (!canEdit) return;
    const ov = overrides.find(
      (o) => o.targetBuildingKey === key && o.isActive
    );
    if (!ov || ov.transform) return;
    try {
      await mapOverrideService.update(ov.id, { transform });
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('儲存自動擺放失敗:', err);
    }
  }

  /** Outliner 已算好新的選取；這裡只負責記錄並把 active 交畀 Inspector */
  function handleOutlinerSelection(keys: string[], activeKey: string) {
    setSelectedKeys(new Set(keys));
    const obj = objects.find((o) => o.key === activeKey) ?? null;
    setSelected(obj);
    setDraftTransform(null);
    setDraftGroupId(null);
    setSaveError(null);
  }

  function focusFromList(key: string) {
    const obj = objects.find((o) => o.key === key);
    if (!obj) return;
    setSelected(obj);
    setDraftTransform(null);
    setSaveError(null);
    setFocusNonce((n) => n + 1);
  }

  /**
   * 眼睛：顯示 / 隱藏。
   * 底圖物件用 delete override 表達；資產實例則切換 isActive
   * （實例本身就係 override，刪除 override 等於整件物件消失）。
   */
  async function handleToggleVisible(key: string) {
    const obj = objects.find((o) => o.key === key);
    if (!obj) return;
    const ov = overrideByKey[key];
    try {
      setSaving(true);
      setSaveError(null);
      if (ov && (ov.action === 'add' || ov.action === 'replace')) {
        await mapOverrideService.setActive(ov.id, !ov.isActive);
      } else if (ov && ov.action === 'delete' && ov.isActive) {
        await mapOverrideService.delete(ov.id);
      } else if (ov) {
        await mapOverrideService.update(ov.id, { action: 'delete', isActive: true });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: key,
          action: 'delete',
        });
      }
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('切換顯示狀態失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function changeChunk(id: string) {
    setChunkId(id);
    setSelected(null);
    setDraftTransform(null);
    setSaveError(null);
    setObjects([]);
  }

  async function handleSave() {
    if (!selected) return;
    const transform =
      draftTransform ?? {
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
      };
    // 替換/新增的物件保留其 action，僅更新 transform
    const action =
      selectedOverride?.action === 'replace' ||
      selectedOverride?.action === 'add'
        ? selectedOverride.action
        : 'transform';
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action,
          transform,
          isActive: true,
          // 存空字串而非 undefined：undefined 會被過濾掉，
          // 令使用者清空欄位時無法真正解除群組
          groupId: currentGroupId.trim(),
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'transform',
          transform,
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
      setDraftGroupId(null);
    } catch (err) {
      console.error('儲存地圖編輯失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  // 替換選中物件 / 更換資產
  async function handlePickAsset(assetId: string) {
    setPicker(null);
    if (picker === 'add') {
      await handleAdd(assetId);
      return;
    }
    if (!selected) return;
    const transform = draftTransform ??
      selectedOverride?.transform ?? {
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
      };
    // 既有 add 物件換資產時保留 add；否則為 replace
    const action = selectedOverride?.action === 'add' ? 'add' : 'replace';
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action,
          assetId,
          transform,
          isActive: true,
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'replace',
          assetId,
          transform,
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('替換建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  // 從資產庫新增一棟建築到地圖
  async function handleAdd(assetId: string) {
    try {
      setSaving(true);
      setSaveError(null);
      const key = `add:${crypto.randomUUID()}`;
      await mapOverrideService.create({
        mapName,
        chunkId,
        targetBuildingKey: key,
        action: 'add',
        assetId,
      });
      await loadOverrides(chunkId);
    } catch (err) {
      console.error('新增建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!selected) return;
    try {
      setSaving(true);
      setSaveError(null);
      if (selectedOverride) {
        await mapOverrideService.update(selectedOverride.id, {
          action: 'delete',
          transform: undefined,
          isActive: true,
        });
      } else {
        await mapOverrideService.create({
          mapName,
          chunkId,
          targetBuildingKey: selected.key,
          action: 'delete',
        });
      }
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('移走建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selected || !selectedOverride) return;
    try {
      setSaving(true);
      setSaveError(null);
      await mapOverrideService.delete(selectedOverride.id);
      await loadOverrides(chunkId);
      setDraftTransform(null);
    } catch (err) {
      console.error('還原建築失敗:', err);
      setSaveError(t('map.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-fixed">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <MapIcon className="w-7 h-7" />
            {t('map.editor.title')}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {t('map.editor.subtitle')}
          </p>
        </div>

        {manifest && (
          <div className="flex items-end gap-3">
            <div>
              <label className="label">{t('map.editor.selectChunk')}</label>
              <select
                className="input min-w-[200px]"
                value={chunkId}
                onChange={(e) => changeChunk(e.target.value)}
              >
                {manifest.chunks.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                    {c.description ? ` — ${c.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setPicker('add')}
              disabled={saving || !canEdit}
              hidden={!canEdit}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('map.editor.addBuilding')}
            </button>
          </div>
        )}
      </div>

      {/* Manifest 載入失敗 */}
      {manifestError && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 mb-6">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  {manifestError}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  {t('map.editor.checkSource')}
                </p>
                <button onClick={loadManifest} className="btn btn-sm btn-outline">
                  {t('error.reload')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manifestLoading ? (
        <div className="card">
          <div className="card-body flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[var(--muted-foreground)]" />
              <p className="text-[var(--muted-foreground)]">
                {t('map.editor.loadingManifest')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        manifest && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* 3D 檢視器 */}
            <div className="card overflow-hidden">
              <div className="relative h-[70vh] min-h-[420px] bg-[#11161d]">
                {chunkFile && (
                  <MapEditor3D
                    chunkId={chunkId}
                    chunkFile={chunkFile}
                    selectedKey={selected?.key ?? null}
                    gizmoMode={canEdit ? gizmoMode : 'none'}
                    overrides={overrides}
                    assets={assets}
                    focusNonce={focusNonce}
                    inputTransform={draftTransform}
                    inputNonce={applyNonce}
                    onSelect={handleSelect}
                    onTransformChange={handleTransformChange}
                    onInstancePlaced={handleInstancePlaced}
                    onObjectsChange={handleObjectsChange}
                    onInstanceStatusChange={setInstanceStatus}
                    onLoadingChange={setViewerLoading}
                    onError={setViewerError}
                  />
                )}

                {viewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-center text-white">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                      <p>{t('map.editor.loadingMap')}</p>
                    </div>
                  </div>
                )}

                {viewerError && !viewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6">
                    <div className="text-center text-white max-w-md">
                      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
                      <p className="font-semibold mb-1">
                        {t('map.editor.mapError')}
                      </p>
                      <p className="text-sm text-gray-300">
                        {t('map.editor.checkSource')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-xs text-gray-300/90 bg-black/40 rounded px-3 py-2 pointer-events-none">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{t('map.editor.help')}</span>
                </div>
              </div>
            </div>

            {/* 右側面板：上為 Outliner、下為 Inspector（不再分頁） */}
            <div className="flex flex-col h-[70vh] min-h-[420px] gap-3">
              <div className="card flex-1 min-h-0 flex flex-col">
                  <div className="card-body flex flex-col min-h-0">
                      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                        <ListTree className="w-5 h-5 text-[var(--muted-foreground)]" />
                        <h2 className="text-base font-semibold text-[var(--foreground)]">
                          {t('map.list.title')}
                        </h2>
                        <span className="text-xs text-[var(--muted-foreground)] ml-auto">
                          {t('map.list.selectHint')}
                        </span>
                      </div>

                      {loadingInstanceCount > 0 && (
                        <p className="text-xs text-[var(--muted-foreground)] mb-3 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                          {t('map.list.loadingInstances').replace(
                            '{count}',
                            String(loadingInstanceCount)
                          )}
                        </p>
                      )}

                      {orphanInstances.length > 0 && (
                        <div className="card bg-red-50 dark:bg-red-900/20 mb-3">
                          <div className="card-body py-2 text-sm text-red-700 dark:text-red-300">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {t('map.list.orphanAsset')}
                                </p>
                                <ul className="list-disc list-inside">
                                  {orphanInstances.map((o) => (
                                    <li key={o.id} className="break-words font-mono text-xs">
                                      {o.targetBuildingKey}
                                    </li>
                                  ))}
                                </ul>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger mt-2"
                                    onClick={handleCleanOrphans}
                                    disabled={saving}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    {t('map.list.cleanOrphans').replace(
                                      '{count}',
                                      String(orphanInstances.length)
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {failedInstances.length > 0 && (
                        <div className="card bg-amber-50 dark:bg-amber-900/20 mb-3">
                          <div className="card-body py-2 text-sm text-amber-700 dark:text-amber-300">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-medium">{t('map.list.loadFailed')}</p>
                                <ul className="list-disc list-inside">
                                  {failedInstances.map((o) => (
                                    <li key={o.id} className="break-words">
                                      {(o.assetId && assetsById[o.assetId]?.name) ||
                                        o.targetBuildingKey}
                                      {': '}
                                      <span className="font-mono text-xs">
                                        {instanceStatus.failed[o.targetBuildingKey]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 遮擋群組 */}
                      {(groups.size > 0 || selectedGroupable.length > 0) && (
                        <div className="mb-3 space-y-2">
                          {selectedGroupable.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-[var(--muted-foreground)]">
                                {t('map.group.selected').replace(
                                  '{count}',
                                  String(selectedGroupable.length)
                                )}
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={handleCreateGroup}
                                disabled={saving || !canEdit}
                              >
                                <FolderPlus className="w-4 h-4 mr-1" />
                                {t('map.group.create')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={handleUngroupSelected}
                                disabled={saving || !canEdit}
                              >
                                {t('map.group.ungroup')}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-light"
                                onClick={() => setSelectedKeys(new Set())}
                              >
                                {t('map.group.clearSelection')}
                              </button>
                            </div>
                          )}

                          {Array.from(groups.entries()).map(([name, members]) => (
                            <div
                              key={name}
                              className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-[var(--sidebar-hover)]"
                            >
                              {renamingGroup === name ? (
                                <>
                                  <input
                                    autoFocus
                                    className="input input-sm flex-1"
                                    value={renameDraft}
                                    onChange={(e) => setRenameDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void handleRenameGroup(name);
                                      if (e.key === 'Escape') setRenamingGroup(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => void handleRenameGroup(name)}
                                    disabled={saving}
                                  >
                                    {t('map.assets.save')}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Folder className="w-4 h-4 flex-shrink-0 text-blue-500" />
                                  <span className="truncate flex-1">{name}</span>
                                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                                    {members.length}
                                  </span>
                                  {canEdit && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-light"
                                        title={t('map.group.rename')}
                                        onClick={() => {
                                          setRenamingGroup(name);
                                          setRenameDraft(name);
                                        }}
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-light text-red-500"
                                        title={t('map.group.dissolve')}
                                        onClick={() =>
                                          void setGroupFor(
                                            members.map((m) => m.targetBuildingKey),
                                            ''
                                          )
                                        }
                                        disabled={saving}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex-1 min-h-0 overflow-y-auto -mx-2">
                        <MapOutliner
                          chunkId={chunkId}
                          objects={objects}
                          overrideByKey={overrideByKey}
                          assetsById={assetsById}
                          activeKey={selected?.key ?? null}
                          selectedKeys={selectedKeys}
                          canEdit={canEdit}
                          onSelectionChange={handleOutlinerSelection}
                          onFocus={focusFromList}
                          onToggleVisible={handleToggleVisible}
                        />
                      </div>
                  </div>
              </div>

              {/* Inspector 直接接喺樹下面，選中即見，唔使切分頁 */}
              <div className="flex-shrink-0 max-h-[45%] overflow-y-auto">
                <BuildingInspector
                  object={selected}
                  readOnly={!canEdit}
                  gizmoMode={gizmoMode}
                  onGizmoModeChange={setGizmoMode}
                  draftTransform={draftTransform}
                  appliedTransform={selectedOverride?.transform ?? null}
                  overrideAction={selectedOverride?.action ?? null}
                  overrideActive={selectedOverride?.isActive ?? true}
                  hasOverride={!!selectedOverride}
                  canToggleActive={
                    !!selectedOverride && selectedOverride.action !== 'add'
                  }
                  dirty={dirty}
                  saving={saving}
                  error={saveError}
                  groupId={currentGroupId}
                  onGroupIdChange={setDraftGroupId}
                  onSave={handleSave}
                  onRemove={handleRemove}
                  onReset={handleReset}
                  onRequestReplace={() => setPicker('replace')}
                  onTransformInput={handleTransformInput}
                  onToggleActive={handleToggleActive}
                />
              </div>
            </div>
          </div>
        )
      )}

      {picker && (
        <AssetPicker
          assets={assets}
          title={
            picker === 'add'
              ? t('map.editor.addBuilding')
              : t('map.editor.replace')
          }
          onPick={handlePickAsset}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
