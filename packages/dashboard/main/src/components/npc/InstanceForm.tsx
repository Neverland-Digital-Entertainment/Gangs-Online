'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, AlertCircle, Plus, Trash2, MapPin, Map } from 'lucide-react';
import type {
  NpcInstance,
  NpcInstanceFormData,
  NpcTemplate,
  MovementPattern,
  Position,
} from '@/types/npc';
import { MOVEMENT_PATTERN_LABELS } from '@/types/npc';
import { npcInstanceService } from '@/lib/npc/instance-service';
import { npcTemplateService } from '@/lib/npc/template-service';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NpcTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

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
    isAttackable: instance?.isAttackable ?? true,
    mapId: instance?.mapId,
    territoryId: instance?.territoryId,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoadingTemplates(true);
      const data = await npcTemplateService.getAllTemplates({ isActive: true });
      setTemplates(data);
    } catch (err) {
      console.error('載入模板失敗:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.templateId) {
      newErrors.templateId = '請選擇 NPC 模板';
    }

    if (formData.level <= 0) {
      newErrors.level = '等級必須大於 0';
    }

    if (formData.interactionRadius <= 0) {
      newErrors.interactionRadius = '互動半徑必須大於 0';
    }

    if (formData.movementPattern === 'WANDERING') {
      if (!formData.wanderRadius || formData.wanderRadius <= 0) {
        newErrors.wanderRadius = '徘徊模式需要設定徘徊半徑';
      }
    }

    if (formData.movementPattern === 'PATROLLING') {
      if (!formData.patrolWaypoints || formData.patrolWaypoints.length < 2) {
        newErrors.patrolWaypoints = '巡邏模式需要至少 2 個巡邏點';
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
      console.error('儲存 NPC 實例失敗:', err);
      setError('儲存失敗，請稍後再試');
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
                  錯誤
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
          <h3 className="text-lg font-semibold">NPC 模板</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                選擇模板 <span className="text-red-500">*</span>
              </label>
              <select
                className={`input ${errors.templateId ? 'border-red-500' : ''}`}
                value={formData.templateId}
                onChange={(e) =>
                  setFormData({ ...formData, templateId: e.target.value })
                }
                disabled={loadingTemplates}
              >
                <option value="">請選擇...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (Lv.{formData.level})
                  </option>
                ))}
              </select>
              {errors.templateId && (
                <p className="text-sm text-red-600 mt-1">{errors.templateId}</p>
              )}
            </div>

            <div>
              <label className="label">
                等級 <span className="text-red-500">*</span>
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
          <h3 className="text-lg font-semibold">位置與放置</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                X 座標 <span className="text-red-500">*</span>
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
                Z 座標 <span className="text-red-500">*</span>
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
                旋轉角度 <span className="text-red-500">*</span>
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
              <label className="label">地圖 ID</label>
              <input
                type="text"
                className="input"
                value={formData.mapId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, mapId: e.target.value || undefined })
                }
                placeholder="例如：city_center"
              />
            </div>

            <div>
              <label className="label">區域 ID</label>
              <input
                type="text"
                className="input"
                value={formData.territoryId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, territoryId: e.target.value || undefined })
                }
                placeholder="例如：downtown"
              />
            </div>

            <div>
              <label className="label">
                互動半徑 <span className="text-red-500">*</span>
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
                使用視覺化地圖選擇位置
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">視覺化地圖</h4>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(false)}
                    className="btn btn-sm btn-outline"
                  >
                    關閉地圖
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
          <h3 className="text-lg font-semibold">移動設定</h3>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label className="label">
              移動模式 <span className="text-red-500">*</span>
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
              {Object.entries(MOVEMENT_PATTERN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Wandering Settings */}
          {formData.movementPattern === 'WANDERING' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <label className="label">
                  徘徊半徑 <span className="text-red-500">*</span>
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
                <label className="label">徘徊中心 X</label>
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
                <label className="label">徘徊中心 Z</label>
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
                  巡邏路徑點 <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={addPatrolWaypoint}
                  className="btn btn-sm btn-outline"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新增路徑點
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

      {/* Combat & Special Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">戰鬥與特殊設定</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">仇恨範圍</label>
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
                placeholder="留空使用預設值"
              />
            </div>

            <div>
              <label className="label">追擊距離</label>
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
                placeholder="留空使用預設值"
              />
            </div>

            <div>
              <label className="label">商店 ID</label>
              <input
                type="text"
                className="input"
                value={formData.shopId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, shopId: e.target.value || undefined })
                }
                placeholder="如果是商店老闆"
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
              <span className="text-sm">可被攻擊</span>
            </label>
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
          {loading ? '儲存中...' : instance ? '更新實例' : '建立實例'}
        </button>
      </div>
    </form>
  );
}
