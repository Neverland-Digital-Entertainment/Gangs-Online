'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IStartNodeData } from '@/types/quest';

function StartNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IStartNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-green-500 rounded-xl shadow-lg min-w-[260px]">
      <div className="bg-green-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Play className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.start')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.npcTemplateId')}
          </label>
          <input
            type="text"
            className="input text-xs w-full"
            placeholder={t('quest.node.npcTemplateIdPlaceholder')}
            value={nodeData.npcTemplateId || ''}
            onChange={(e) => updateData('npcTemplateId', e.target.value)}
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
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.prerequisiteQuestId')}
          </label>
          <input
            type="text"
            className="input text-xs w-full"
            placeholder={t('quest.node.prerequisiteQuestIdPlaceholder')}
            value={nodeData.prerequisiteQuestId || ''}
            onChange={(e) => updateData('prerequisiteQuestId', e.target.value)}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(StartNode);
