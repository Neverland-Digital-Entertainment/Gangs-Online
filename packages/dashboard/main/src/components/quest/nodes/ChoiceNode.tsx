'use client';

import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { ListOrdered, Plus, X } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { IChoiceNodeData } from '@/types/quest';

function ChoiceNode({ id, data }: NodeProps) {
  const { t } = useI18n();
  const { setNodes } = useReactFlow();
  const nodeData = data as unknown as IChoiceNodeData;
  const options = nodeData.options || [];

  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [handlePositions, setHandlePositions] = useState<number[]>([]);

  useEffect(() => {
    const positions: number[] = [];
    optionRefs.current.forEach((el) => {
      if (el && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        positions.push(elRect.top - containerRect.top + elRect.height / 2);
      }
    });
    setHandlePositions(positions);
  }, [options.length]);

  const updateOptions = useCallback((newOptions: IChoiceNodeData['options']) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, options: newOptions } } : n
      )
    );
  }, [id, setNodes]);

  const addOption = () => {
    const idx = options.length;
    updateOptions([...options, { textZh: '', textEn: '', targetHandleId: `option_${idx}` }]);
  };

  const removeOption = (idx: number) => {
    updateOptions(options.filter((_: any, i: number) => i !== idx));
  };

  const updateOption = (idx: number, field: string, value: string) => {
    const updated = options.map((opt: any, i: number) =>
      i === idx ? { ...opt, [field]: value } : opt
    );
    updateOptions(updated);
  };

  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-800 border-2 border-purple-500 rounded-xl shadow-lg min-w-[280px] relative">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="bg-purple-500 text-white px-3 py-2 rounded-t-lg flex items-center gap-2">
        <ListOrdered className="w-4 h-4" />
        <span className="text-sm font-semibold">{t('quest.node.choice')}</span>
      </div>
      <div className="p-3 space-y-2">
        {options.map((opt: any, idx: number) => (
          <div
            key={idx}
            ref={(el) => { optionRefs.current[idx] = el; }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 relative"
          >
            <button
              onClick={() => removeOption(idx)}
              className="absolute top-1 right-1 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-3 h-3 text-red-500" />
            </button>
            <div className="text-xs text-purple-500 font-medium mb-1">
              {t('quest.node.option')} {idx + 1}
            </div>
            <input
              type="text"
              className="input text-xs w-full mb-1"
              placeholder={t('quest.node.optionTextZh')}
              value={opt.textZh}
              onChange={(e) => updateOption(idx, 'textZh', e.target.value)}
            />
            <input
              type="text"
              className="input text-xs w-full"
              placeholder={t('quest.node.optionTextEn')}
              value={opt.textEn}
              onChange={(e) => updateOption(idx, 'textEn', e.target.value)}
            />
          </div>
        ))}
        <button
          onClick={addOption}
          className="w-full py-1.5 text-xs text-purple-500 border border-dashed border-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950 flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" />
          {t('quest.node.addOption')}
        </button>
      </div>
      {/* Source handles positioned on right edge */}
      {options.map((_: any, idx: number) => (
        <Handle
          key={`option_${idx}`}
          type="source"
          position={Position.Right}
          id={`option_${idx}`}
          className="!bg-purple-500 !w-3 !h-3"
          style={{ top: handlePositions[idx] != null ? `${handlePositions[idx]}px` : `${80 + idx * 90}px` }}
        />
      ))}
    </div>
  );
}

export default memo(ChoiceNode);
