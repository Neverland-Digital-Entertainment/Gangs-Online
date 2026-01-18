'use client';

import type { ItemCategory } from '@/types/item';

interface AttributesSectionProps {
  category: ItemCategory;
  attributes: any;
  updateAttributes: (attributes: any) => void;
}

export function AttributesSection({
  category,
  attributes,
  updateAttributes,
}: AttributesSectionProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">動態屬性</h3>
      </div>
      <div className="card-body">
        {category === 'consumable' && (
          <ConsumableAttributes
            attributes={attributes}
            updateAttributes={updateAttributes}
          />
        )}
        {category === 'special' && (
          <SpecialAttributes
            attributes={attributes}
            updateAttributes={updateAttributes}
          />
        )}
        {category === 'contraband' && (
          <ContrabandAttributes
            attributes={attributes}
            updateAttributes={updateAttributes}
          />
        )}
        {category === 'material' && (
          <MaterialAttributes
            attributes={attributes}
            updateAttributes={updateAttributes}
          />
        )}
      </div>
    </div>
  );
}

function ConsumableAttributes({ attributes, updateAttributes }: any) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">HP 恢復值</label>
        <input
          type="number"
          min="0"
          value={attributes.hpRestore || 0}
          onChange={(e) =>
            updateAttributes({ hpRestore: parseInt(e.target.value) || 0 })
          }
          className="input"
          placeholder="0"
        />
        <span className="form-hint">恢復的生命值</span>
      </div>

      <div>
        <label className="form-label">VP 恢復值</label>
        <input
          type="number"
          min="0"
          value={attributes.vpRestore || 0}
          onChange={(e) =>
            updateAttributes({ vpRestore: parseInt(e.target.value) || 0 })
          }
          className="input"
          placeholder="0"
        />
        <span className="form-hint">恢復的精力值</span>
      </div>

      <div>
        <label className="form-label">冷卻時間 (秒)</label>
        <input
          type="number"
          min="0"
          value={attributes.cooldown || 0}
          onChange={(e) =>
            updateAttributes({ cooldown: parseInt(e.target.value) || 0 })
          }
          className="input"
          placeholder="0"
        />
        <span className="form-hint">使用後需等待的時間</span>
      </div>
    </div>
  );
}

function SpecialAttributes({ attributes, updateAttributes }: any) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">信仰消耗量</label>
        <input
          type="number"
          min="0"
          value={attributes.faithCost || 0}
          onChange={(e) =>
            updateAttributes({ faithCost: parseInt(e.target.value) || 0 })
          }
          className="input"
          placeholder="0"
        />
        <span className="form-hint">使用時消耗的信仰值</span>
      </div>

      <div>
        <label className="form-label">神祇 ID</label>
        <input
          type="text"
          value={attributes.deityId || ''}
          onChange={(e) => updateAttributes({ deityId: e.target.value })}
          className="input"
          placeholder="留空表示通用"
        />
        <span className="form-hint">對應的神祇 ID（可選）</span>
      </div>
    </div>
  );
}

function ContrabandAttributes({ attributes, updateAttributes }: any) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">罪惡值</label>
        <input
          type="number"
          min="0"
          value={attributes.crimeValue || 0}
          onChange={(e) =>
            updateAttributes({ crimeValue: parseInt(e.target.value) || 0 })
          }
          className="input"
          placeholder="0"
        />
        <span className="form-hint">攜帶時增加的罪惡值</span>
      </div>

      <div>
        <label className="form-label">警察查獲機率倍率</label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={attributes.policeDetectionMultiplier || 1}
          onChange={(e) =>
            updateAttributes({
              policeDetectionMultiplier: parseFloat(e.target.value) || 1,
            })
          }
          className="input"
          placeholder="1.0"
        />
        <span className="form-hint">警察查獲機率的倍率 (1.0 = 正常)</span>
      </div>
    </div>
  );
}

function MaterialAttributes({ attributes, updateAttributes }: any) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">堆疊上限</label>
        <input
          type="number"
          min="1"
          value={attributes.stackLimit || 99}
          onChange={(e) =>
            updateAttributes({ stackLimit: parseInt(e.target.value) || 99 })
          }
          className="input"
          placeholder="99"
        />
        <span className="form-hint">單一物品欄位最多可堆疊數量</span>
      </div>
    </div>
  );
}
