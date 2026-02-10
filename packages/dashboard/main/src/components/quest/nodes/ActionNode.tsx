'use client';

import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { Zap, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useQuestData } from '../QuestDataProvider';
import SearchSelect from '../SearchSelect';
import type { IActionNodeData } from '@/types/quest';

function ActionNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const { npcTemplates, items } = useQuestData();
  const nodeData = data as unknown as IActionNodeData;

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

  const targetOptions = useMemo(() => {
    if (nodeData.actionType === 'remove_item') {
      return items.map((item) => ({
        value: item.id,
        label: item.name,
        subtitle: `${item.category} | ${item.id}`,
      }));
    }
    if (nodeData.actionType === 'spawn_npc') {
      return npcTemplates.map((tpl) => ({
        value: tpl.id,
        label: tpl.name,
        subtitle: `${tpl.type} | ${tpl.id}`,
      }));
    }
    return [];
  }, [nodeData.actionType, npcTemplates, items]);

  const showDropdown = nodeData.actionType === 'remove_item' || nodeData.actionType === 'spawn_npc';
  const showTextInput = nodeData.actionType === 'set_variable';

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-red-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" />
      <div className="bg-red-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <Zap className="w-4 h-4" />
        <span className="text-sm font-semibold flex-1">{t('quest.node.action')}</span>
        <button onClick={deleteNode} className="p-0.5 hover:bg-red-600 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.actionType')}
          </label>
          <select
            className="input text-xs w-full"
            value={nodeData.actionType || 'remove_item'}
            onChange={(e) => {
              updateData('actionType', e.target.value);
              updateData('targetId', '');
            }}
          >
            <option value="remove_item">{t('quest.actionType.removeItem')}</option>
            <option value="remove_money">{t('quest.actionType.removeMoney')}</option>
            <option value="spawn_npc">{t('quest.actionType.spawnNpc')}</option>
            <option value="set_variable">{t('quest.actionType.setVariable')}</option>
          </select>
        </div>
        {showDropdown && (
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.targetId')}
            </label>
            <SearchSelect
              options={targetOptions}
              value={nodeData.targetId || ''}
              onChange={(v) => updateData('targetId', v)}
              placeholder={t('quest.node.targetIdPlaceholder')}
            />
          </div>
        )}
        {showTextInput && (
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
