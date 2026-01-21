import { z } from 'zod';
import { NpcType, CombatType } from '../constants/types';

export const templateSchema = z.object({
  name: z.string().min(1, '名稱為必填項').max(100, '名稱不能超過 100 字'),
  type: z.nativeEnum(NpcType, {
    required_error: '請選擇 NPC 類型',
  }),
  modelId: z.string().min(1, '模型 ID 為必填項'),
  description: z.string().optional(),
  baseHp: z.number().min(1, 'HP 必須大於 0').default(100),
  baseAttack: z.number().min(0, '攻擊力不能為負數').default(10),
  baseDefense: z.number().min(0, '防禦力不能為負數').default(5),
  baseSpeed: z.number().min(0, '速度不能為負數').default(1.0),
  combatType: z.nativeEnum(CombatType).optional().nullable(),
  attackRange: z.number().min(0, '攻擊範圍不能為負數').optional().nullable(),
  dialogueTree: z.any().optional(),
});

export type TemplateFormData = z.infer<typeof templateSchema>;
