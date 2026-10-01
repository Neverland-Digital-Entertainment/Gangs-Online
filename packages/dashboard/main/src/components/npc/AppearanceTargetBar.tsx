'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw, Users, MapPin } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { Can } from '@/components/auth/Can';
import { npcTemplateService } from '@/lib/npc/template-service';
import { npcInstanceService } from '@/lib/npc/instance-service';
import type { NpcAppearance, NpcInstance, NpcTemplate } from '@/types/npc';

interface AppearanceTargetBarProps {
  /** The look currently shown in the editor. */
  current: NpcAppearance;
  /** Put a saved look into the editor. */
  onLoad: (appearance: NpcAppearance) => void;
  /** Look used when a template has none saved yet. */
  fallback: NpcAppearance;
}

/** Fixed key order so a look read back from Firestore compares equal to the editor's. */
function canonical(a?: NpcAppearance) {
  if (!a) return null;
  const e = a.equipment ?? ({} as NpcAppearance['equipment']);
  return {
    gender: a.gender,
    bodyShape: Math.round((a.bodyShape ?? 0) * 100) / 100,
    equipment: {
      hair: e.hair ?? null, beard: e.beard ?? null, head: e.head ?? null,
      top: e.top ?? null, bottom: e.bottom ?? null, shoe: e.shoe ?? null,
    },
    colors: { hair: a.colors?.hair ?? '', beard: a.colors?.beard ?? '' },
  };
}

const same = (a?: NpcAppearance, b?: NpcAppearance) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

function instanceLabel(instance: NpcInstance): string {
  const where = instance.mapId ? `${instance.mapId} · ` : '';
  return `${where}(${Math.round(instance.positionX)}, ${Math.round(instance.positionZ)}) · #${instance.id.slice(0, 6)}`;
}

/**
 * Picks what the appearance editor is editing — a template's default look or
 * one instance's override — and loads / saves / clears it.
 * Reads ?template=<id>&instance=<id> on first load so other pages can link here.
 */
export default function AppearanceTargetBar({ current, onLoad, fallback }: AppearanceTargetBarProps) {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<NpcTemplate[]>([]);
  const [instances, setInstances] = useState<NpcInstance[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  /** What is stored for the current target (to detect unsaved changes). */
  const [saved, setSaved] = useState<NpcAppearance | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const template = useMemo(() => templates.find((x) => x.id === templateId), [templates, templateId]);
  const instance = useMemo(() => instances.find((x) => x.id === instanceId), [instances, instanceId]);
  const hasOverride = !!instance?.appearanceOverride;
  const dirty = !!templateId && !same(current, saved);

  const loadInto = useCallback((appearance: NpcAppearance) => {
    onLoad(appearance);
    setSaved(appearance);
  }, [onLoad]);

  const selectTemplate = useCallback(async (id: string, list: NpcTemplate[], preselectInstance = '') => {
    setTemplateId(id);
    setInstanceId('');
    setInstances([]);
    setMessage(null);
    if (!id) {
      setSaved(undefined);
      return;
    }
    const tpl = list.find((x) => x.id === id);
    const insts = await npcInstanceService.getInstancesByTemplateId(id);
    setInstances(insts);
    const inst = insts.find((x) => x.id === preselectInstance);
    if (inst) {
      setInstanceId(inst.id);
      loadInto(inst.appearanceOverride ?? tpl?.appearance ?? fallback);
    } else {
      loadInto(tpl?.appearance ?? fallback);
    }
  }, [fallback, loadInto]);

  // Load templates once, honouring ?template=&instance=
  useEffect(() => {
    let cancelled = false;
    npcTemplateService.getAllTemplates().then((list) => {
      if (cancelled) return;
      setTemplates(list);
      const params = new URLSearchParams(window.location.search);
      const tid = params.get('template');
      if (tid && list.some((x) => x.id === tid)) {
        selectTemplate(tid, list, params.get('instance') ?? '');
      }
    }).catch((err) => console.error('Failed to load NPC templates:', err));
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDiscard = () => !dirty || window.confirm(t('npc.appearances.discardChanges'));

  const onTemplateChange = (id: string) => {
    if (!confirmDiscard()) return;
    selectTemplate(id, templates);
  };

  const onInstanceChange = (id: string) => {
    if (!confirmDiscard()) return;
    setInstanceId(id);
    setMessage(null);
    const inst = instances.find((x) => x.id === id);
    loadInto(inst?.appearanceOverride ?? template?.appearance ?? fallback);
  };

  const save = async () => {
    if (!templateId) return;
    setBusy(true);
    setMessage(null);
    try {
      if (instance) {
        await npcInstanceService.setAppearanceOverride(instance.id, current);
        setInstances((list) => list.map((x) => (x.id === instance.id ? { ...x, appearanceOverride: current } : x)));
      } else {
        await npcTemplateService.updateTemplateAppearance(templateId, current);
        setTemplates((list) => list.map((x) => (x.id === templateId ? { ...x, appearance: current } : x)));
      }
      setSaved(current);
      setMessage(t('npc.appearances.saved'));
    } catch (err) {
      console.error('Failed to save appearance:', err);
      alert(t('error.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const clearOverride = async () => {
    if (!instance || !window.confirm(t('npc.appearances.clearOverrideConfirm'))) return;
    setBusy(true);
    try {
      await npcInstanceService.clearAppearanceOverride(instance.id);
      setInstances((list) => list.map((x) => (x.id === instance.id ? { ...x, appearanceOverride: undefined } : x)));
      loadInto(template?.appearance ?? fallback);
      setMessage(t('npc.appearances.overrideCleared'));
    } catch (err) {
      console.error('Failed to clear appearance override:', err);
      alert(t('error.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-6">
      <div className="card-body flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 min-w-[220px]">
          <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {t('npc.appearances.target.template')}
          </span>
          <select
            className="input"
            value={templateId}
            onChange={(e) => onTemplateChange(e.target.value)}
          >
            <option value="">{t('npc.appearances.target.previewOnly')}</option>
            {templates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}{x.appearance ? '' : ` (${t('npc.appearances.target.noLook')})`}
              </option>
            ))}
          </select>
        </label>

        {templateId && (
          <label className="flex flex-col gap-1 min-w-[260px]">
            <span className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {t('npc.appearances.target.instance')}
            </span>
            <select
              className="input"
              value={instanceId}
              onChange={(e) => onInstanceChange(e.target.value)}
            >
              <option value="">{t('npc.appearances.target.templateDefault')}</option>
              {instances.map((x) => (
                <option key={x.id} value={x.id}>
                  {instanceLabel(x)}{x.appearanceOverride ? ` · ${t('npc.appearances.target.overridden')}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {templateId && (
          <div className="flex items-center gap-2 flex-wrap">
            {instance && (
              <span className={`text-xs px-2 py-1 rounded ${hasOverride ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                {hasOverride ? t('npc.appearances.target.overridden') : t('npc.appearances.target.usesTemplate')}
              </span>
            )}
            {dirty && (
              <span className="text-xs px-2 py-1 rounded bg-blue-600 text-white">{t('npc.appearances.unsaved')}</span>
            )}
            {message && !dirty && <span className="text-xs text-green-600">{message}</span>}
          </div>
        )}

        {templateId && (
          <Can perm="npc.edit">
            <div className="flex items-center gap-2 ml-auto">
              {instance && hasOverride && (
                <button className="btn btn-sm btn-light" onClick={clearOverride} disabled={busy}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  {t('npc.appearances.clearOverride')}
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={save} disabled={busy || !dirty}>
                <Save className="w-4 h-4 mr-1" />
                {instance ? t('npc.appearances.saveOverride') : t('npc.appearances.saveTemplate')}
              </button>
            </div>
          </Can>
        )}
      </div>
    </div>
  );
}
