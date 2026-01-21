'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { instanceSchema, InstanceFormData } from '../../forms/instance-schema';
import {
  NpcInstance,
  MovementPattern,
  MOVEMENT_PATTERN_LABELS,
} from '../../constants/types';
import MapPositionPicker from '../../components/map-position-picker';

interface InstanceDetailProps {
  instanceId: string;
}

const InstanceDetail = ({ instanceId }: InstanceDetailProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: instance, isLoading } = useQuery({
    queryKey: ['npc-instance', instanceId],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/npc-management/instances/${instanceId}`,
      );
      if (!response.ok) {
        throw new Error('無法載入實例資料');
      }
      return response.json() as Promise<NpcInstance>;
    },
  });

  const form = useForm<InstanceFormData>({
    resolver: zodResolver(instanceSchema),
    values: instance
      ? {
          templateId: instance.templateId,
          positionX: instance.positionX,
          positionZ: instance.positionZ,
          rotation: instance.rotation,
          level: instance.level,
          interactionRadius: instance.interactionRadius,
          movementPattern: instance.movementPattern,
          wanderRadius: instance.wanderRadius,
          wanderCenter: instance.wanderCenter,
          patrolWaypoints: instance.patrolWaypoints,
          aggroRange: instance.aggroRange,
          chaseDistance: instance.chaseDistance,
          shopId: instance.shopId,
          isAttackable: instance.isAttackable,
          mapId: instance.mapId,
          territoryId: instance.territoryId,
          isActive: instance.isActive,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InstanceFormData) => {
      const response = await apiFetch(
        `/api/npc-management/instances/${instanceId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '更新實例失敗');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: 'NPC 實例已成功更新',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-instance', instanceId] });
      queryClient.invalidateQueries({ queryKey: ['npc-instances'] });
    },
    onError: (error: Error) => {
      toast({
        title: '錯誤',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/api/npc-management/instances/${instanceId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '刪除實例失敗');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: 'NPC 實例已成功刪除',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-instances'] });
      router.push('/npc-management/instances');
    },
    onError: (error: Error) => {
      toast({
        title: '錯誤',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: InstanceFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('確定要刪除此 NPC 實例嗎？此操作無法復原。')) {
      await deleteMutation.mutateAsync();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!instance) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">找不到實例資料</p>
        </CardContent>
      </Card>
    );
  }

  const movementPattern = form.watch('movementPattern');

  return (
    <div className="space-y-6">
      {instance.template && (
        <Card>
          <CardHeader>
            <CardTitle>模板資訊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">
                    {instance.template.name}
                  </h3>
                  <Badge>{instance.template.type}</Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  模型: {instance.template.modelId} | HP:{' '}
                  {instance.template.baseHp} | 攻擊:{' '}
                  {instance.template.baseAttack} | 防禦:{' '}
                  {instance.template.baseDefense}
                </p>
              </div>
              <Link href={`/npc-management/templates/${instance.templateId}`}>
                <Button variant="outline" size="sm">
                  查看模板
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>實例設定</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">位置設定</h3>
                <MapPositionPicker
                  value={{
                    x: form.watch('positionX'),
                    z: form.watch('positionZ'),
                  }}
                  onChange={(position) => {
                    form.setValue('positionX', position.x);
                    form.setValue('positionZ', position.z);
                  }}
                />
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="positionX"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>X 座標 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="positionZ"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Z 座標 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rotation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>旋轉角度</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="360"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>等級 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interactionRadius"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>互動半徑</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-4">移動設定</h3>
                <FormField
                  control={form.control}
                  name="movementPattern"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>移動模式 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇移動模式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(MOVEMENT_PATTERN_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {movementPattern === MovementPattern.WANDERING && (
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="wanderRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>徘徊半徑</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="例如：5.0"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            NPC 會在此半徑範圍內隨機移動
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-4">戰鬥設定</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="aggroRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>仇恨範圍</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="例如：10.0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="chaseDistance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>追擊距離</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="例如：15.0"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isAttackable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">可攻擊</FormLabel>
                        <FormDescription>允許玩家攻擊此 NPC</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">啟用</FormLabel>
                        <FormDescription>
                          NPC 是否在遊戲中顯示
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  刪除實例
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  儲存變更
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstanceDetail;
