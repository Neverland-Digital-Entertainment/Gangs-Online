'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IConditionNodeData } from '@/types/quest';

function ConditionNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IConditionNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-yellow-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3" />
      <div className="bg-yellow-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.condition')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.conditionType')}
          </label>
          <select
            className="input text-xs w-full"
            value={nodeData.conditionType || 'money'}
            onChange={(e) => updateData('conditionType', e.target.value)}
          >
            <option value="money">{t('quest.conditionType.money')}</option>
            <option value="item">{t('quest.conditionType.item')}</option>
            <option value="variable">{t('quest.conditionType.variable')}</option>
          </select>
        </div>
        {nodeData.conditionType !== 'money' && (
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
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.requiredAmount')}
          </label>
          <input
            type="number"
            className="input text-xs w-full"
            value={nodeData.requiredAmount || 0}
            onChange={(e) => updateData('requiredAmount', Number(e.target.value))}
          />
        </div>
      </div>
      {/* Two outputs: success and fail */}
      <div className="flex justify-between px-3 pb-2">
        <span className="text-[10px] text-green-500">{t('quest.node.success')}</span>
        <span className="text-[10px] text-red-500">{t('quest.node.fail')}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="!bg-green-500 !w-3 !h-3"
        style={{ left: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="fail"
        className="!bg-red-500 !w-3 !h-3"
        style={{ left: '70%' }}
      />
    </div>
  );
}

export default memo(ConditionNode);
