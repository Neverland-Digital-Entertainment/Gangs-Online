'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { templateSchema, TemplateFormData } from '../../forms/template-schema';
import {
  NpcTemplate,
  NpcType,
  CombatType,
  NPC_TYPE_LABELS,
  COMBAT_TYPE_LABELS,
} from '../../constants/types';
import DialogueEditor from './dialogue-editor';

interface TemplateDetailProps {
  templateId: string;
}

const TemplateDetail = ({ templateId }: TemplateDetailProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ['npc-template', templateId],
    queryFn: async () => {
      const response = await apiFetch(
        `/api/npc-management/templates/${templateId}`,
      );
      if (!response.ok) {
        throw new Error('無法載入模板資料');
      }
      return response.json() as Promise<NpcTemplate>;
    },
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    values: template
      ? {
          name: template.name,
          type: template.type,
          modelId: template.modelId,
          description: template.description || '',
          baseHp: template.baseHp,
          baseAttack: template.baseAttack,
          baseDefense: template.baseDefense,
          baseSpeed: template.baseSpeed,
          combatType: template.combatType,
          attackRange: template.attackRange,
          dialogueTree: template.dialogueTree,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await apiFetch(
        `/api/npc-management/templates/${templateId}`,
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
        throw new Error(error.message || '更新模板失敗');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: 'NPC 模板已成功更新',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['npc-templates'] });
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
        `/api/npc-management/templates/${templateId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '刪除模板失敗');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: 'NPC 模板已成功刪除',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-templates'] });
      router.push('/npc-management/templates');
    },
    onError: (error: Error) => {
      toast({
        title: '錯誤',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: TemplateFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      confirm(
        '確定要刪除此模板嗎？此操作無法復原，且會影響使用此模板的所有 NPC 實例。',
      )
    ) {
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

  if (!template) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">找不到模板資料</p>
        </CardContent>
      </Card>
    );
  }

  const selectedType = form.watch('type');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名稱 *</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：巡邏警察" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>類型 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(NPC_TYPE_LABELS).map(
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
              </div>

              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模型 ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：npc_police_01" {...field} />
                    </FormControl>
                    <FormDescription>
                      在 Babylon.js 中使用的 3D 模型識別碼
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="描述這個 NPC 的特點和用途"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-4">基礎屬性</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="baseHp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>基礎 HP *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
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
                    name="baseAttack"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>基礎攻擊 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
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
                    name="baseDefense"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>基礎防禦 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
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
                    name="baseSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>基礎速度 *</FormLabel>
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
              </div>

              {(selectedType === NpcType.POLICE ||
                selectedType === NpcType.GANGS) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-4">戰鬥設定</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="combatType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>戰鬥類型</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="選擇戰鬥類型" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(COMBAT_TYPE_LABELS).map(
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

                    <FormField
                      control={form.control}
                      name="attackRange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>攻擊範圍</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="例如：2.0"
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
              )}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting || deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  刪除模板
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

      {(selectedType === NpcType.CITIZEN ||
        selectedType === NpcType.QUEST ||
        selectedType === NpcType.SHOP) && (
        <Card>
          <CardHeader>
            <CardTitle>對話編輯器</CardTitle>
          </CardHeader>
          <CardContent>
            <DialogueEditor
              templateId={templateId}
              dialogueTree={template.dialogueTree}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TemplateDetail;
