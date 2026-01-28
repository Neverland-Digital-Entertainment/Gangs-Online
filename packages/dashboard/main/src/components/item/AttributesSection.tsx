'use client';

import { useI18n } from '@/contexts/i18n-context';
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
  const { t } = useI18n();

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{t('item.dynamicAttributes')}</h3>
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
        {category === 'equipment' && (
          <EquipmentAttributes
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
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t('item.attributes.hpRestore')}</label>
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
        <span className="form-hint">{t('item.attributes.hpRestoreHint')}</span>
      </div>

      <div>
        <label className="form-label">{t('item.attributes.vpRestore')}</label>
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
        <span className="form-hint">{t('item.attributes.vpRestoreHint')}</span>
      </div>

      <div>
        <label className="form-label">{t('item.attributes.cooldown')}</label>
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
        <span className="form-hint">{t('item.attributes.cooldownHint')}</span>
      </div>
    </div>
  );
}

function SpecialAttributes({ attributes, updateAttributes }: any) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t('item.attributes.faithCost')}</label>
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
        <span className="form-hint">{t('item.attributes.faithCostHint')}</span>
      </div>

      <div>
        <label className="form-label">{t('item.attributes.deityId')}</label>
        <input
          type="text"
          value={attributes.deityId || ''}
          onChange={(e) => updateAttributes({ deityId: e.target.value })}
          className="input"
          placeholder={t('item.attributes.deityIdPlaceholder')}
        />
        <span className="form-hint">{t('item.attributes.deityIdHint')}</span>
      </div>
    </div>
  );
}

function EquipmentAttributes({ attributes, updateAttributes }: any) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t('item.attributes.crimeValue')}</label>
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
        <span className="form-hint">{t('item.attributes.crimeValueHint')}</span>
      </div>

      <div>
        <label className="form-label">{t('item.attributes.policeDetection')}</label>
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
        <span className="form-hint">{t('item.attributes.policeDetectionHint')}</span>
      </div>
    </div>
  );
}

function MaterialAttributes({ attributes, updateAttributes }: any) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="form-label">{t('item.attributes.stackLimit')}</label>
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
        <span className="form-hint">{t('item.attributes.stackLimitHint')}</span>
      </div>
    </div>
  );
}
