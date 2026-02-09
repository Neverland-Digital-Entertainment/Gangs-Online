'use client';

import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { useQuestData } from '../QuestDataProvider';
import SearchSelect from '../SearchSelect';

const COMMON_EMOJIS = [
  '😊', '😃', '😢', '😡', '😱', '🤔', '😎', '🥺',
  '😏', '😤', '😭', '🤣', '😲', '🙄', '😴', '🤩',
  '👋', '👍', '👎', '💪', '🙏', '❤️', '💀', '🔥',
  '⚔️', '🛡️', '💰', '🗝️', '📜', '⭐', '❗', '❓',
];

interface DialogueNodeData {
  speakerId: string;
  expression?: string;
  textZh: string;
  textEn: string;
}

function DialogueNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const { npcTemplates } = useQuestData();
  const nodeData = data as unknown as DialogueNodeData;

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as HTMLElement)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateData = useCallback((field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n
      )
    );
  }, [id, setNodes]);

  const npcOptions = useMemo(() =>
    npcTemplates.map((tpl) => ({
      value: tpl.id,
      label: tpl.name,
      subtitle: `${tpl.type} | ${tpl.id}`,
    })), [npcTemplates]);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-xl shadow-lg min-w-[280px]">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="bg-blue-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.dialogue')}</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.speakerId')}
          </label>
          <SearchSelect
            options={npcOptions}
            value={nodeData.speakerId || ''}
            onChange={(v) => updateData('speakerId', v)}
            placeholder="NPC..."
          />
        </div>
        <div ref={emojiRef} className="relative">
          <label className="text-xs text-[var(--muted)] block mb-1">
            {t('quest.node.expression')}
          </label>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="input text-xs w-full text-left flex items-center gap-2"
          >
            {nodeData.expression ? (
              <span className="text-base">{nodeData.expression}</span>
            ) : (
              <span className="text-[var(--muted)]">{t('quest.node.expressionPlaceholder')}</span>
            )}
          </button>
          {showEmojiPicker && (
            <div className="absolute z-50 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl p-2 w-[240px]">
              <div className="grid grid-cols-8 gap-1">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      updateData('expression', emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-lg hover:bg-[var(--sidebar-hover)] rounded p-0.5 text-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {nodeData.expression && (
                <button
                  type="button"
                  onClick={() => {
                    updateData('expression', '');
                    setShowEmojiPicker(false);
                  }}
                  className="w-full mt-1 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>
          )}
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
