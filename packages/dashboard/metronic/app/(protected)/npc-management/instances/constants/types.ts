export enum MovementPattern {
  STATIC = 'STATIC',
  WANDERING = 'WANDERING',
  PATROLLING = 'PATROLLING',
}

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  [MovementPattern.STATIC]: '靜止',
  [MovementPattern.WANDERING]: '徘徊',
  [MovementPattern.PATROLLING]: '巡邏',
};

export interface NpcInstance {
  id: string;
  templateId: string;
  positionX: number;
  positionZ: number;
  rotation: number;
  level: number;
  interactionRadius: number;
  movementPattern: MovementPattern;
  wanderRadius: number | null;
  wanderCenter: any;
  patrolWaypoints: any;
  aggroRange: number | null;
  chaseDistance: number | null;
  shopId: string | null;
  isAttackable: boolean;
  mapId: string | null;
  territoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  isTrashed: boolean;
  isActive: boolean;
  template?: {
    id: string;
    name: string;
    type: string;
    modelId: string;
    baseHp: number;
    baseAttack: number;
    baseDefense: number;
  };
}

export interface Position {
  x: number;
  z: number;
}
