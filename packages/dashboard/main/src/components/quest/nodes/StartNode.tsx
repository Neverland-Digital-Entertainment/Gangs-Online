'use client';

import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Play, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useQuestData } from '../QuestDataProvider';
import SearchSelect from '../SearchSelect';

interface StartNodeData {
  npcTemplateId: string;
  minLevel?: number;
  maxLevel?: number;
  prerequisiteQuestId?: string;
  positionX?: number;
  positionZ?: number;
}

function StartNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const { npcTemplates, quests } = useQuestData();
  const nodeData = data as unknown as StartNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  const deleteNode = useCallback(() => {
    if (confirm(t('quest.deleteNodeConfirm'))) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
    }
  }, [id, setNodes, t]);

  const npcOptions = useMemo(() =>
    npcTemplates.map((tpl) => ({
      value: tpl.id,
      label: tpl.name,
      subtitle: `${tpl.type} | ${tpl.id}`,
    })), [npcTemplates]);

  const questOptions = useMemo(() =>
    quests.map((q) => ({
      value: q.id,
      label: q.name,
      subtitle: q.id,
    })), [quests]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-green-500 rounded-xl shadow-lg min-w-[280px]">
      <div className="bg-green-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Play className="w-4 h-4" />
        <span className="text-sm font-semibold flex-1">{t('quest.node.start')}</span>
        <button onClick={deleteNode} className="p-0.5 hover:bg-green-600 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.npcTemplateId')}
          </label>
          <SearchSelect
            options={npcOptions}
            value={nodeData.npcTemplateId || ''}
            onChange={(v) => updateData('npcTemplateId', v)}
            placeholder={t('quest.node.npcTemplateIdPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.minLevel')}
            </label>
            <input
              type="number"
              className="input text-xs w-full"
              value={nodeData.minLevel || ''}
              onChange={(e) => updateData('minLevel', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.maxLevel')}
            </label>
            <input
              type="number"
              className="input text-xs w-full"
              value={nodeData.maxLevel || ''}
              onChange={(e) => updateData('maxLevel', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">X</label>
            <input
              type="number"
              className="input text-xs w-full"
              value={nodeData.positionX || 0}
              onChange={(e) => updateData('positionX', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">Z</label>
            <input
              type="number"
              className="input text-xs w-full"
              value={nodeData.positionZ || 0}
              onChange={(e) => updateData('positionZ', Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.prerequisiteQuestId')}
          </label>
          <SearchSelect
            options={questOptions}
            value={nodeData.prerequisiteQuestId || ''}
            onChange={(v) => updateData('prerequisiteQuestId', v)}
            placeholder={t('quest.node.prerequisiteQuestIdPlaceholder')}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(StartNode);
