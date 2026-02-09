'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Flag, Plus, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IEndNodeData } from '@/types/quest';

function EndNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IEndNodeData;
  const rewardItems = nodeData.rewardItems || [];

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  const addRewardItem = () => {
    updateData('rewardItems', [...rewardItems, { itemId: '', quantity: 1 }]);
  };

  const removeRewardItem = (idx: number) => {
    updateData('rewardItems', rewardItems.filter((_: any, i: number) => i !== idx));
  };

  const updateRewardItem = (idx: number, field: string, value: any) => {
    const updated = rewardItems.map((item: any, i: number) =>
      i === idx ? { ...item, [field]: value } : item
    );
    updateData('rewardItems', updated);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-gray-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3" />
      <div className="bg-gray-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Flag className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.end')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.rewardXp')}
            </label>
            <input
              type="number"
              className="input text-xs w-full"
              min={0}
              value={nodeData.rewardXp || 0}
              onChange={(e) => updateData('rewardXp', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.rewardMoney')}
            </label>
            <input
              type="number"
              className="input text-xs w-full"
              min={0}
              value={nodeData.rewardMoney || 0}
              onChange={(e) => updateData('rewardMoney', Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.rewardItems')}
          </label>
          {rewardItems.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center gap-1 mb-1">
              <input
                type="text"
                className="input text-xs flex-1"
                placeholder={t('quest.node.itemId')}
                value={item.itemId}
                onChange={(e) => updateRewardItem(idx, 'itemId', e.target.value)}
              />
              <input
                type="number"
                className="input text-xs w-16"
                min={1}
                value={item.quantity}
                onChange={(e) => updateRewardItem(idx, 'quantity', Number(e.target.value))}
              />
              <button
                onClick={() => removeRewardItem(idx)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
          <button
            onClick={addRewardItem}
            className="w-full py-1 text-xs text-gray-500 border border-dashed border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t('quest.node.addRewardItem')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(EndNode);
