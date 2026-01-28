'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, AlertCircle, MessageSquare } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type {
  NpcTemplate,
  NpcTemplateFormData,
  NpcType,
  CombatType,
  DialogueTree,
} from '@/types/npc';
import { npcTemplateService } from '@/lib/npc/template-service';
import DialogueEditor from './DialogueEditor';

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
  const { t } = useI18n();
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
    dialogueTree: template?.dialogueTree || undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDialogueEditor, setShowDialogueEditor] = useState(false);

  // Update formData when template prop changes (for edit mode)
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        type: template.type || 'CITIZEN',
        modelId: template.modelId || '',
        description: template.description || '',
        baseHp: template.baseHp || 100,
        baseAttack: template.baseAttack || 10,
        baseDefense: template.baseDefense || 5,
        baseSpeed: template.baseSpeed || 5,
        combatType: template.combatType || undefined,
        attackRange: template.attackRange || undefined,
        dialogueTree: template.dialogueTree || undefined,
      });
    }
  }, [template]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('validation.required').replace('{field}', t('npc.template.name'));
    }

    // modelId is now optional, will use default if not provided

    if (formData.baseHp <= 0) {
      newErrors.baseHp = t('validation.mustBePositive').replace('{field}', t('npc.template.hp'));
    }

    if (formData.baseAttack < 0) {
      newErrors.baseAttack = t('error.mustBeNonNegative');
    }

    if (formData.baseDefense < 0) {
      newErrors.baseDefense = t('error.mustBeNonNegative');
    }

    if (formData.baseSpeed <= 0) {
      newErrors.baseSpeed = t('validation.mustBePositive').replace('{field}', t('npc.template.speed'));
    }

    if (formData.combatType && formData.attackRange !== undefined && formData.attackRange <= 0) {
      newErrors.attackRange = t('validation.mustBePositive').replace('{field}', t('npc.template.attackRange'));
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
      console.error('Failed to save NPC template:', err);
      setError(t('error.saveFailed'));
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
                  {t('common.error')}
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
          <h3 className="text-lg font-semibold">{t('npc.template.basicInfo')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="label">
                {t('npc.template.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t('npc.template.namePlaceholder')}
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="label">
                {t('npc.template.type')} <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as NpcType })
                }
              >
                {(['CITIZEN', 'POLICE', 'GANGS', 'SHOP', 'QUEST'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`npc.type.${type}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Model ID */}
            <div>
              <label className="label">
                {t('npc.template.modelId')}
              </label>
              <input
                type="text"
                className={`input ${errors.modelId ? 'border-red-500' : ''}`}
                value={formData.modelId}
                onChange={(e) =>
                  setFormData({ ...formData, modelId: e.target.value })
                }
                placeholder={t('npc.template.modelIdPlaceholder')}
              />
              {errors.modelId && (
                <p className="text-sm text-red-600 mt-1">{errors.modelId}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="label">{t('npc.template.description')}</label>
              <textarea
                className="input min-h-[100px]"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t('npc.template.descriptionPlaceholder')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Base Stats */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.template.baseStats')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* HP */}
            <div>
              <label className="label">
                {t('npc.template.hp')} <span className="text-red-500">*</span>
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
                {t('npc.template.attack')} <span className="text-red-500">*</span>
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
                {t('npc.template.defense')} <span className="text-red-500">*</span>
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
                {t('npc.template.speed')} <span className="text-red-500">*</span>
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
          <h3 className="text-lg font-semibold">{t('npc.template.combatSettings')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Combat Type */}
            <div>
              <label className="label">{t('npc.template.combatType')}</label>
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
                <option value="">{t('npc.template.noCombat')}</option>
                {(['MELEE', 'RANGED'] as const).map((combatType) => (
                  <option key={combatType} value={combatType}>
                    {t(`npc.combatType.${combatType}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Attack Range */}
            <div>
              <label className="label">{t('npc.template.attackRange')}</label>
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
                placeholder={t('npc.template.attackRangePlaceholder')}
                disabled={!formData.combatType}
              />
              {errors.attackRange && (
                <p className="text-sm text-red-600 mt-1">{errors.attackRange}</p>
              )}
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {t('npc.template.attackRangeHint')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogue Tree */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('npc.template.dialogueSettings')}</h3>
            {formData.dialogueTree && !showDialogueEditor && (
              <span className="badge badge-primary">
                {formData.dialogueTree.nodes.length} {t('npc.template.nodes')}
              </span>
            )}
          </div>
        </div>
        <div className="card-body">
          {!showDialogueEditor ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              {formData.dialogueTree ? (
                <>
                  <p className="text-[var(--muted-foreground)] mb-4">
                    {t('npc.template.dialogueTreeSet')} {formData.dialogueTree.nodes.length} {t('npc.template.nodes')}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDialogueEditor(true)}
                      className="btn btn-outline"
                    >
                      {t('npc.template.editDialogueTree')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dialogueTree: undefined })}
                      className="btn btn-outline text-red-600"
                    >
                      {t('npc.template.removeDialogueTree')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[var(--muted-foreground)] mb-4">
                    {t('npc.template.noDialogueTree')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDialogueEditor(true)}
                    className="btn btn-primary"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {t('npc.template.createDialogueTree')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <DialogueEditor
              initialTree={formData.dialogueTree}
              onSave={(tree: DialogueTree) => {
                setFormData({ ...formData, dialogueTree: tree });
                setShowDialogueEditor(false);
              }}
              onCancel={() => setShowDialogueEditor(false)}
            />
          )}
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
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? t('common.saving') : template ? t('npc.template.updateTemplate') : t('npc.template.createTemplate')}
        </button>
      </div>
    </form>
  );
}
