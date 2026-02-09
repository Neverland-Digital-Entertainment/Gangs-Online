'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Target } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { ITaskNodeData } from '@/types/quest';

function TaskNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as ITaskNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-orange-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="bg-orange-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Target className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.task')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.taskType')}
          </label>
          <select
            className="input text-xs w-full"
            value={nodeData.taskType || 'kill'}
            onChange={(e) => updateData('taskType', e.target.value)}
          >
            <option value="collect">{t('quest.taskType.collect')}</option>
            <option value="kill">{t('quest.taskType.kill')}</option>
            <option value="interact">{t('quest.taskType.interact')}</option>
            <option value="location">{t('quest.taskType.location')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.targetId')}
          </label>
          <input
            type="text"
            className="input text-xs w-full"
            placeholder={t('quest.node.targetIdPlaceholder')}
            value={nodeData.targetId || ''}
            onChange={(e) => updateData('targetId', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.requiredCount')}
          </label>
          <input
            type="number"
            className="input text-xs w-full"
            min={1}
            value={nodeData.requiredCount || 1}
            onChange={(e) => updateData('requiredCount', Number(e.target.value))}
          />
        </div>
        {nodeData.taskType === 'location' && (
          <div className="grid grid-cols-3 gap-1">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">X</label>
              <input
                type="number"
                className="input text-xs w-full"
                value={nodeData.locationX || 0}
                onChange={(e) => updateData('locationX', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Z</label>
              <input
                type="number"
                className="input text-xs w-full"
                value={nodeData.locationZ || 0}
                onChange={(e) => updateData('locationZ', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">{t('quest.node.radius')}</label>
              <input
                type="number"
                className="input text-xs w-full"
                value={nodeData.locationRadius || 5}
                onChange={(e) => updateData('locationRadius', Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(TaskNode);
