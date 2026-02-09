'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IActionNodeData } from '@/types/quest';

function ActionNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IActionNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-red-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" />
      <div className="bg-red-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Zap className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.action')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.actionType')}
          </label>
          <select
            className="input text-xs w-full"
            value={nodeData.actionType || 'remove_item'}
            onChange={(e) => updateData('actionType', e.target.value)}
          >
            <option value="remove_item">{t('quest.actionType.removeItem')}</option>
            <option value="remove_money">{t('quest.actionType.removeMoney')}</option>
            <option value="spawn_npc">{t('quest.actionType.spawnNpc')}</option>
            <option value="set_variable">{t('quest.actionType.setVariable')}</option>
          </select>
        </div>
        {nodeData.actionType !== 'remove_money' && (
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.targetId')}
            </label>
            <input
              type="text"
              className="input text-xs w-full"
              value={nodeData.targetId || ''}
              onChange={(e) => updateData('targetId', e.target.value)}
            />
          </div>
        )}
        {(nodeData.actionType === 'remove_item' || nodeData.actionType === 'remove_money') && (
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.amount')}
            </label>
            <input
              type="number"
              className="input text-xs w-full"
              value={nodeData.amount || 0}
              onChange={(e) => updateData('amount', Number(e.target.value))}
            />
          </div>
        )}
        {nodeData.actionType === 'set_variable' && (
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.value')}
            </label>
            <input
              type="text"
              className="input text-xs w-full"
              value={nodeData.value || ''}
              onChange={(e) => updateData('value', e.target.value)}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-red-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(ActionNode);
