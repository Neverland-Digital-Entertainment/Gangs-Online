'use client';

import { useI18n } from '@/contexts/i18n-context';
import type { OperatingHours } from '@/types/shop';

interface OperatingHoursEditorProps {
  value?: OperatingHours;
  onChange: (value?: OperatingHours) => void;
}

export function OperatingHoursEditor({ value, onChange }: OperatingHoursEditorProps) {
  const { t } = useI18n();
  const enabled = !!value;

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      onChange(undefined); // 24-hour operation
    } else {
      onChange({ start: 0, end: 23 }); // Default hours
    }
  };

  const handleStartChange = (start: number) => {
    onChange({ ...value!, start });
  };

  const handleEndChange = (end: number) => {
    onChange({ ...value!, end });
  };

  const isCrossMidnight = value && value.start > value.end;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{t('shop.operatingHours')}</h3>
      </div>
      <div className="card-body flex flex-col gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="checkbox"
          />
          <span>{t('shop.enableOperatingHours')}</span>
        </label>

        {enabled && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">{t('shop.startTime')}</label>
                <select
                  value={value?.start ?? 0}
                  onChange={(e) => handleStartChange(Number(e.target.value))}
                  className="select w-full"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">{t('shop.endTime')}</label>
                <select
                  value={value?.end ?? 23}
                  onChange={(e) => handleEndChange(Number(e.target.value))}
                  className="select w-full"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isCrossMidnight && (
              <div className="alert alert-warning">
                <span>{t('shop.crossMidnight')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
