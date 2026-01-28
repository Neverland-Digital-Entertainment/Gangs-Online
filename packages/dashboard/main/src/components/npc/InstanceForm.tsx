'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, AlertCircle, Plus, Trash2, MapPin, Map } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type {
  NpcInstance,
  NpcInstanceFormData,
  NpcTemplate,
  MovementPattern,
  Position,
} from '@/types/npc';
import { npcInstanceService } from '@/lib/npc/instance-service';
import { npcTemplateService } from '@/lib/npc/template-service';
import { shopService } from '@/lib/shop/shop-service';
import type { Shop } from '@/types/shop';
import MapPositionPicker from './MapPositionPicker';

interface InstanceFormProps {
  instance?: NpcInstance;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function InstanceForm({
  instance,
  onSuccess,
  onCancel,
}: InstanceFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NpcTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  const [formData, setFormData] = useState<NpcInstanceFormData>({
    templateId: instance?.templateId || '',
    positionX: instance?.positionX || 0,
    positionZ: instance?.positionZ || 0,
    rotation: instance?.rotation || 0,
    level: instance?.level || 1,
    interactionRadius: instance?.interactionRadius || 2,
    movementPattern: instance?.movementPattern || 'STATIC',
    wanderRadius: instance?.wanderRadius,
    wanderCenter: instance?.wanderCenter,
    patrolWaypoints: instance?.patrolWaypoints || [],
    aggroRange: instance?.aggroRange,
    chaseDistance: instance?.chaseDistance,
    shopId: instance?.shopId,
    linkedShopId: instance?.linkedShopId,
    isGuildOnly: instance?.isGuildOnly ?? false,
    isAttackable: instance?.isAttackable ?? true,
    mapId: instance?.mapId,
    territoryId: instance?.territoryId,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadShops();
  }, []);

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      // Load all templates (including inactive ones) for selection
      const data = await npcTemplateService.getAllTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function loadShops() {
    try {
      setLoadingShops(true);
      // Load all shops (including inactive ones) for selection
      // Similar to item selector logic - allow pre-configuration
      const data = await shopService.getAllShops();
      setShops(data);
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoadingShops(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.templateId) {
      newErrors.templateId = t('validation.required').replace('{field}', t('npc.instance.template'));
    }

    if (formData.level <= 0) {
      newErrors.level = t('validation.mustBePositive').replace('{field}', t('npc.instance.level'));
    }

    if (formData.interactionRadius <= 0) {
      newErrors.interactionRadius = t('validation.mustBePositive').replace('{field}', t('npc.instance.interactionRadius'));
    }

    if (formData.movementPattern === 'WANDERING') {
      if (!formData.wanderRadius || formData.wanderRadius <= 0) {
        newErrors.wanderRadius = t('npc.instance.wanderRadiusRequired');
      }
    }

    if (formData.movementPattern === 'PATROLLING') {
      if (!formData.patrolWaypoints || formData.patrolWaypoints.length < 2) {
        newErrors.patrolWaypoints = t('npc.instance.patrolWaypointsRequired');
      }
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

      if (instance) {
        await npcInstanceService.updateInstance(instance.id, formData);
      } else {
        await npcInstanceService.createInstance(formData);
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/npc/instances');
      }
    } catch (err) {
      console.error('Failed to save NPC instance:', err);
      setError(t('error.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/npc/instances');
    }
  }

  function addPatrolWaypoint() {
    setFormData({
      ...formData,
      patrolWaypoints: [
        ...(formData.patrolWaypoints || []),
        { x: 0, z: 0 },
      ],
    });
  }

  function updatePatrolWaypoint(index: number, field: 'x' | 'z', value: number) {
    const waypoints = [...(formData.patrolWaypoints || [])];
    waypoints[index] = { ...waypoints[index], [field]: value };
    setFormData({ ...formData, patrolWaypoints: waypoints });
  }

  function removePatrolWaypoint(index: number) {
    setFormData({
      ...formData,
      patrolWaypoints: formData.patrolWaypoints?.filter((_, i) => i !== index),
    });
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

      {/* Template Selection */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.instance.templateSelection')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                {t('npc.instance.template')} <span className="text-red-500">*</span>
              </label>
              <select
                className={`input ${errors.templateId ? 'border-red-500' : ''}`}
                value={formData.templateId}
                onChange={(e) =>
                  setFormData({ ...formData, templateId: e.target.value })
                }
                disabled={loadingTemplates}
              >
                <option value="">{t('npc.instance.selectTemplate')}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}{!template.isActive ? ` (${t('common.inactive')})` : ''}
                  </option>
                ))}
              </select>
              {errors.templateId && (
                <p className="text-sm text-red-600 mt-1">{errors.templateId}</p>
              )}
            </div>

            <div>
              <label className="label">
                {t('npc.instance.level')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.level ? 'border-red-500' : ''}`}
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: parseInt(e.target.value) || 1 })
                }
                min="1"
              />
              {errors.level && (
                <p className="text-sm text-red-600 mt-1">{errors.level}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Position & Placement */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.instance.positionPlacement')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                {t('npc.instance.positionX')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input"
                value={formData.positionX}
                onChange={(e) =>
                  setFormData({ ...formData, positionX: parseFloat(e.target.value) || 0 })
                }
                step="0.1"
              />
            </div>

            <div>
              <label className="label">
                {t('npc.instance.positionZ')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input"
                value={formData.positionZ}
                onChange={(e) =>
                  setFormData({ ...formData, positionZ: parseFloat(e.target.value) || 0 })
                }
                step="0.1"
              />
            </div>

            <div>
              <label className="label">
                {t('npc.instance.rotation')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="input"
                value={formData.rotation}
                onChange={(e) =>
                  setFormData({ ...formData, rotation: parseInt(e.target.value) || 0 })
                }
                min="0"
                max="360"
              />
            </div>

            <div>
              <label className="label">{t('npc.instance.mapId')}</label>
              <input
                type="text"
                className="input"
                value={formData.mapId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, mapId: e.target.value || undefined })
                }
                placeholder={t('npc.instance.mapIdPlaceholder')}
              />
            </div>

            <div>
              <label className="label">{t('npc.instance.territoryId')}</label>
              <input
                type="text"
                className="input"
                value={formData.territoryId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, territoryId: e.target.value || undefined })
                }
                placeholder={t('npc.instance.territoryIdPlaceholder')}
              />
            </div>

            <div>
              <label className="label">
                {t('npc.instance.interactionRadius')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className={`input ${errors.interactionRadius ? 'border-red-500' : ''}`}
                value={formData.interactionRadius}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interactionRadius: parseFloat(e.target.value) || 2,
                  })
                }
                min="0.1"
                step="0.1"
              />
              {errors.interactionRadius && (
                <p className="text-sm text-red-600 mt-1">{errors.interactionRadius}</p>
              )}
            </div>
          </div>

          {/* Map Picker Toggle */}
          <div className="mt-4 pt-4 border-t">
            {!showMapPicker ? (
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="btn btn-outline w-full"
              >
                <Map className="w-4 h-4 mr-2" />
                {t('npc.instance.useMapPicker')}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{t('npc.instance.visualMap')}</h4>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(false)}
                    className="btn btn-sm btn-outline"
                  >
                    {t('npc.instance.closeMap')}
                  </button>
                </div>
                <MapPositionPicker
                  initialPosition={{ x: formData.positionX, z: formData.positionZ }}
                  initialRotation={formData.rotation}
                  onPositionChange={(position, rotation) => {
                    setFormData({
                      ...formData,
                      positionX: position.x,
                      positionZ: position.z,
                      rotation: rotation,
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Movement Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.instance.movementSettings')}</h3>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label className="label">
              {t('npc.instance.movementPattern')} <span className="text-red-500">*</span>
            </label>
            <select
              className="input"
              value={formData.movementPattern}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  movementPattern: e.target.value as MovementPattern,
                })
              }
            >
              {(['STATIC', 'WANDERING', 'PATROLLING'] as const).map((pattern) => (
                <option key={pattern} value={pattern}>
                  {t(`npc.movementPattern.${pattern}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Wandering Settings */}
          {formData.movementPattern === 'WANDERING' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <label className="label">
                  {t('npc.instance.wanderRadius')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className={`input ${errors.wanderRadius ? 'border-red-500' : ''}`}
                  value={formData.wanderRadius || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wanderRadius: parseFloat(e.target.value) || undefined,
                    })
                  }
                  min="0.1"
                  step="0.1"
                />
                {errors.wanderRadius && (
                  <p className="text-sm text-red-600 mt-1">{errors.wanderRadius}</p>
                )}
              </div>

              <div>
                <label className="label">{t('npc.instance.wanderCenterX')}</label>
                <input
                  type="number"
                  className="input"
                  value={formData.wanderCenter?.x || formData.positionX}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wanderCenter: {
                        x: parseFloat(e.target.value) || 0,
                        z: formData.wanderCenter?.z || formData.positionZ,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>

              <div>
                <label className="label">{t('npc.instance.wanderCenterZ')}</label>
                <input
                  type="number"
                  className="input"
                  value={formData.wanderCenter?.z || formData.positionZ}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wanderCenter: {
                        x: formData.wanderCenter?.x || formData.positionX,
                        z: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step="0.1"
                />
              </div>
            </div>
          )}

          {/* Patrol Settings */}
          {formData.movementPattern === 'PATROLLING' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">
                  {t('npc.instance.patrolWaypoints')} <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addPatrolWaypoint}
                  className="btn btn-sm btn-outline"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('npc.instance.addWaypoint')}
                </button>
              </div>

              {errors.patrolWaypoints && (
                <p className="text-sm text-red-600 mb-3">{errors.patrolWaypoints}</p>
              )}

              <div className="space-y-2">
                {(formData.patrolWaypoints || []).map((waypoint, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-[var(--muted-foreground)] w-8">
                      #{index + 1}
                    </span>
                    <input
                      type="number"
                      className="input input-sm flex-1"
                      placeholder="X"
                      value={waypoint.x}
                      onChange={(e) =>
                        updatePatrolWaypoint(index, 'x', parseFloat(e.target.value) || 0)
                      }
                      step="0.1"
                    />
                    <input
                      type="number"
                      className="input input-sm flex-1"
                      placeholder="Z"
                      value={waypoint.z}
                      onChange={(e) =>
                        updatePatrolWaypoint(index, 'z', parseFloat(e.target.value) || 0)
                      }
                      step="0.1"
                    />
                    <button
                      type="button"
                      onClick={() => removePatrolWaypoint(index)}
                      className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Combat Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.instance.combatSettings')}</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('npc.instance.aggroRange')}</label>
              <input
                type="number"
                className="input"
                value={formData.aggroRange || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    aggroRange: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                min="0"
                step="0.1"
                placeholder={t('npc.instance.useDefault')}
              />
            </div>

            <div>
              <label className="label">{t('npc.instance.chaseDistance')}</label>
              <input
                type="number"
                className="input"
                value={formData.chaseDistance || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    chaseDistance: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                min="0"
                step="0.1"
                placeholder={t('npc.instance.useDefault')}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={formData.isAttackable}
                onChange={(e) =>
                  setFormData({ ...formData, isAttackable: e.target.checked })
                }
              />
              <span className="text-sm">{t('npc.instance.isAttackable')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Shop Linking (Phase 16.3) */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">{t('npc.instance.linkedShopId')} (Phase 16.3)</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div>
              <label className="label">{t('npc.instance.linkedShopId')}</label>
              <select
                className="input"
                value={formData.linkedShopId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, linkedShopId: e.target.value || undefined })
                }
                disabled={loadingShops}
              >
                <option value="">{t('npc.instance.selectPlaceholder')}</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} {shop.operatingHours ? `(${shop.operatingHours.start}:00-${shop.operatingHours.end}:00)` : '(24h)'}{!shop.isActive ? ' [停用]' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('npc.instance.linkedShopIdPlaceholder')}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={formData.isGuildOnly || false}
                  onChange={(e) =>
                    setFormData({ ...formData, isGuildOnly: e.target.checked })
                  }
                />
                <span className="text-sm">{t('npc.instance.isGuildOnly')}</span>
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                {t('npc.instance.isGuildOnlyHint')}
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
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          <Save className="w-4 h-4 mr-2" />
          {loading ? t('common.saving') : instance ? t('npc.instance.updateInstance') : t('npc.instance.createInstance')}
        </button>
      </div>
    </form>
  );
}
