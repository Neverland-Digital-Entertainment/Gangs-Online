'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IDialogueNodeData } from '@/types/quest';

function DialogueNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IDialogueNodeData;

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-xl shadow-lg min-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="bg-blue-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.dialogue')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.speakerId')}
            </label>
            <input
              type="text"
              className="input text-xs w-full"
              placeholder="NPC ID"
              value={nodeData.speakerId || ''}
              onChange={(e) => updateData('speakerId', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              {t('quest.node.expression')}
            </label>
            <input
              type="text"
              className="input text-xs w-full"
              placeholder={t('quest.node.expressionPlaceholder')}
              value={nodeData.expression || ''}
              onChange={(e) => updateData('expression', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.textZh')}
          </label>
          <textarea
            className="input text-xs w-full resize-none"
            rows={2}
            placeholder={t('quest.node.textZhPlaceholder')}
            value={nodeData.textZh || ''}
            onChange={(e) => updateData('textZh', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.textEn')}
          </label>
          <textarea
            className="input text-xs w-full resize-none"
            rows={2}
            placeholder={t('quest.node.textEnPlaceholder')}
            value={nodeData.textEn || ''}
            onChange={(e) => updateData('textEn', e.target.value)}
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(DialogueNode);
