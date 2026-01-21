'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, AlertCircle } from 'lucide-react';
import type {
  NpcTemplate,
  NpcTemplateFormData,
  NpcType,
  CombatType,
} from '@/types/npc';
import {
  NPC_TYPE_LABELS,
  COMBAT_TYPE_LABELS,
} from '@/types/npc';
import { npcTemplateService } from '@/lib/npc/template-service';

interface TemplateFormProps {
  template?: NpcTemplate;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function TemplateForm({
  template,
  onSuccess,
  onCancel,
}: TemplateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<NpcTemplateFormData>({
    name: template?.name || '',
    type: template?.type || 'CITIZEN',
    modelId: template?.modelId || '',
    description: template?.description || '',
    baseHp: template?.baseHp || 100,
    baseAttack: template?.baseAttack || 10,
    baseDefense: template?.baseDefense || 5,
    baseSpeed: template?.baseSpeed || 5,
    combatType: template?.combatType || undefined,
    attackRange: template?.attackRange || undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '請輸入模板名稱';
    }

    if (!formData.modelId.trim()) {
      newErrors.modelId = '請輸入模型 ID';
    }

    if (formData.baseHp <= 0) {
      newErrors.baseHp = 'HP 必須大於 0';
    }

    if (formData.baseAttack < 0) {
      newErrors.baseAttack = '攻擊力不能為負數';
    }

    if (formData.baseDefense < 0) {
      newErrors.baseDefense = '防禦力不能為負數';
    }

    if (formData.baseSpeed <= 0) {
      newErrors.baseSpeed = '速度必須大於 0';
    }

    if (formData.combatType && formData.attackRange !== undefined && formData.attackRange <= 0) {
      newErrors.attackRange = '攻擊範圍必須大於 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (template) {
        await npcTemplateService.updateTemplate(template.id, formData);
      } else {
        await npcTemplateService.createTemplate(formData);
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/npc/templates');
      }
    } catch (err) {
      console.error('儲存 NPC 模板失敗:', err);
      setError('儲存失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/npc/templates');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  錯誤
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">基本資訊</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="label">
                模板名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例如：友善市民、巡邏警察"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="label">
                NPC 類型 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as NpcType })
                }
              >
                {Object.entries(NPC_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Model ID */}
            <div>
              <label className="label">
                模型 ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.modelId ? 'border-red-500' : ''}`}
                value={formData.modelId}
                onChange={(e) =>
                  setFormData({ ...formData, modelId: e.target.value })
                }
                placeholder="例如：citizen_01, police_patrol"
              />
              {errors.modelId && (
                <p className="text-sm text-red-600 mt-1">{errors.modelId}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="label">描述</label>
              <textarea
                className="input min-h-[100px]"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="描述這個 NPC 模板的用途和特性..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Base Stats */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">基礎屬性</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* HP */}
            <div>
              <label className="label">
                生命值 (HP) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.baseHp ? 'border-red-500' : ''}`}
                value={formData.baseHp}
                onChange={(e) =>
                  setFormData({ ...formData, baseHp: parseInt(e.target.value) || 0 })
                }
                min="1"
              />
              {errors.baseHp && (
                <p className="text-sm text-red-600 mt-1">{errors.baseHp}</p>
              )}
            </div>

            {/* Attack */}
            <div>
              <label className="label">
                攻擊力 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.baseAttack ? 'border-red-500' : ''}`}
                value={formData.baseAttack}
                onChange={(e) =>
                  setFormData({ ...formData, baseAttack: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
              {errors.baseAttack && (
                <p className="text-sm text-red-600 mt-1">{errors.baseAttack}</p>
              )}
            </div>

            {/* Defense */}
            <div>
              <label className="label">
                防禦力 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.baseDefense ? 'border-red-500' : ''}`}
                value={formData.baseDefense}
                onChange={(e) =>
                  setFormData({ ...formData, baseDefense: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
              {errors.baseDefense && (
                <p className="text-sm text-red-600 mt-1">{errors.baseDefense}</p>
              )}
            </div>

            {/* Speed */}
            <div>
              <label className="label">
                速度 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.baseSpeed ? 'border-red-500' : ''}`}
                value={formData.baseSpeed}
                onChange={(e) =>
                  setFormData({ ...formData, baseSpeed: parseFloat(e.target.value) || 0 })
                }
                min="0.1"
                step="0.1"
              />
              {errors.baseSpeed && (
                <p className="text-sm text-red-600 mt-1">{errors.baseSpeed}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Combat Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">戰鬥設定</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Combat Type */}
            <div>
              <label className="label">戰鬥類型</label>
              <select
                className="input"
                value={formData.combatType || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    combatType: e.target.value ? (e.target.value as CombatType) : undefined,
                  })
                }
              >
                <option value="">無戰鬥能力</option>
                {Object.entries(COMBAT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Attack Range */}
            <div>
              <label className="label">攻擊範圍</label>
              <input
                type="number"
                className={`input ${errors.attackRange ? 'border-red-500' : ''}`}
                value={formData.attackRange || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attackRange: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                min="0.1"
                step="0.1"
                placeholder="留空表示使用預設值"
                disabled={!formData.combatType}
              />
              {errors.attackRange && (
                <p className="text-sm text-red-600 mt-1">{errors.attackRange}</p>
              )}
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                需要先選擇戰鬥類型
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-outline"
          disabled={loading}
        >
          <X className="w-4 h-4 mr-2" />
          取消
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? '儲存中...' : template ? '更新模板' : '建立模板'}
        </button>
      </div>
    </form>
  );
}
