import { z } from 'zod';
import { MovementPattern } from '../constants/types';

export const instanceSchema = z.object({
  templateId: z.string().min(1, '請選擇 NPC 模板'),
  positionX: z.number(),
  positionZ: z.number(),
  rotation: z.number().min(0).max(360).default(0),
  level: z.number().min(1).max(100).default(1),
  interactionRadius: z.number().min(0).default(2.0),
  movementPattern: z.nativeEnum(MovementPattern).default(MovementPattern.STATIC),
  wanderRadius: z.number().min(0).optional().nullable(),
  wanderCenter: z
    .object({
      x: z.number(),
      z: z.number(),
    })
    .optional()
    .nullable(),
  patrolWaypoints: z
    .array(
      z.object({
        x: z.number(),
        z: z.number(),
      }),
    )
    .optional()
    .nullable(),
  aggroRange: z.number().min(0).optional().nullable(),
  chaseDistance: z.number().min(0).optional().nullable(),
  shopId: z.string().optional().nullable(),
  isAttackable: z.boolean().default(true),
  mapId: z.string().optional().nullable(),
  territoryId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type InstanceFormData = z.infer<typeof instanceSchema>;
