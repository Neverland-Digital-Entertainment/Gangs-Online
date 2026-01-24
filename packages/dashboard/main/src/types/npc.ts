/**
 * NPC Types and Interfaces
 * Phase 16-2: NPC Management Module
 */

// Enums
export type NpcType = 'CITIZEN' | 'POLICE' | 'GANGS' | 'SHOP' | 'QUEST';
export type CombatType = 'MELEE' | 'RANGED';
export type MovementPattern = 'STATIC' | 'WANDERING' | 'PATROLLING';

// Labels
export const NPC_TYPE_LABELS: Record<NpcType, string> = {
  CITIZEN: '市民',
  POLICE: '警察',
  GANGS: '幫派成員',
  SHOP: '商店老闆',
  QUEST: '任務 NPC',
};

export const COMBAT_TYPE_LABELS: Record<CombatType, string> = {
  MELEE: '近戰',
  RANGED: '遠程',
};

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  STATIC: '靜止',
  WANDERING: '徘徊',
  PATROLLING: '巡邏',
};

// Dialogue Types
export interface DialogueOption {
  text: string;
  nextNodeId: string;
}

export interface DialogueNode {
  nodeId: string;
  speaker: string;
  content: string;
  options?: DialogueOption[];
  actionType?: 'open_shop' | 'accept_quest' | 'end_dialogue';
  actionData?: any;
}

export interface DialogueTree {
  nodes: DialogueNode[];
  startNodeId: string;
}

// Position Types
export interface Position {
  x: number;
  z: number;
}

// NPC Template
export interface NpcTemplate {
  id: string;
  name: string;
  type: NpcType;
  modelId?: string;
  description?: string;

  // Base stats
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;

  // Combat settings
  combatType?: CombatType;
  attackRange?: number;

  // Dialogue
  dialogueTree?: DialogueTree;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  isActive: boolean;
}

export interface NpcTemplateFormData {
  name: string;
  type: NpcType;
  modelId?: string;
  description?: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  combatType?: CombatType;
  attackRange?: number;
  dialogueTree?: DialogueTree;
}

// NPC Instance
export interface NpcInstance {
  id: string;
  templateId: string;

  // Position
  positionX: number;
  positionZ: number;
  rotation: number;

  // Level and stats
  level: number;
  interactionRadius: number;

  // Movement
  movementPattern: MovementPattern;
  wanderRadius?: number;
  wanderCenter?: Position;
  patrolWaypoints?: Position[];

  // Combat
  aggroRange?: number;
  chaseDistance?: number;

  // Special
  shopId?: string;
  isAttackable: boolean;

  // Map assignment
  mapId?: string;
  territoryId?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  isActive: boolean;

  // Populated fields
  template?: NpcTemplate;
}

export interface NpcInstanceFormData {
  templateId: string;
  positionX: number;
  positionZ: number;
  rotation: number;
  level: number;
  interactionRadius: number;
  movementPattern: MovementPattern;
  wanderRadius?: number;
  wanderCenter?: Position;
  patrolWaypoints?: Position[];
  aggroRange?: number;
  chaseDistance?: number;
  shopId?: string;
  isAttackable: boolean;
  mapId?: string;
  territoryId?: string;
}

// Filter Types
export interface NpcTemplateFilter {
  search?: string;
  type?: NpcType;
  isActive?: boolean;
}

export interface NpcInstanceFilter {
  search?: string;
  templateId?: string;
  mapId?: string;
  movementPattern?: MovementPattern;
  isActive?: boolean;
}
