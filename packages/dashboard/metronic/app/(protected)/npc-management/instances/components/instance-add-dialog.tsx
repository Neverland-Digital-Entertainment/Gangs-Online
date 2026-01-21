'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import { instanceSchema, InstanceFormData } from '../forms/instance-schema';
import { MovementPattern, MOVEMENT_PATTERN_LABELS } from '../constants/types';
import MapPositionPicker from './map-position-picker';

interface InstanceAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InstanceAddDialog = ({ open, onOpenChange }: InstanceAddDialogProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch templates for selection
  const { data: templates } = useQuery({
    queryKey: ['npc-templates-all'],
    queryFn: async () => {
      const response = await apiFetch(
        '/api/npc-management/templates?limit=1000',
      );
      if (!response.ok) throw new Error('無法載入模板列表');
      const data = await response.json();
      return data.items || [];
    },
  });

  const form = useForm<InstanceFormData>({
    resolver: zodResolver(instanceSchema),
    defaultValues: {
      templateId: '',
      positionX: 0,
      positionZ: 0,
      rotation: 0,
      level: 1,
      interactionRadius: 2.0,
      movementPattern: MovementPattern.STATIC,
      wanderRadius: null,
      wanderCenter: null,
      patrolWaypoints: null,
      aggroRange: null,
      chaseDistance: null,
      shopId: null,
      isAttackable: true,
      mapId: null,
      territoryId: null,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InstanceFormData) => {
      const response = await apiFetch('/api/npc-management/instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '建立實例失敗');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: '成功',
        description: 'NPC 實例已成功建立',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-instances'] });
      onOpenChange(false);
      form.reset();
      router.push(`/npc-management/instances/${data.id}`);
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
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const movementPattern = form.watch('movementPattern');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增 NPC 實例</DialogTitle>
          <DialogDescription>
            在地圖上放置一個新的 NPC 實例
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NPC 模板 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇模板" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates?.map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                                e.target.value ? Number(e.target.value) : null,
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
                      <FormDescription>NPC 是否在遊戲中顯示</FormDescription>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                建立實例
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InstanceAddDialog;
