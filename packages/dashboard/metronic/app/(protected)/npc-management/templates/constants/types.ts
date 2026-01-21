export enum NpcType {
  CITIZEN = 'CITIZEN',
  POLICE = 'POLICE',
  GANGS = 'GANGS',
  SHOP = 'SHOP',
  QUEST = 'QUEST',
}

export enum CombatType {
  MELEE = 'MELEE',
  RANGED = 'RANGED',
}

export const NPC_TYPE_LABELS: Record<NpcType, string> = {
  [NpcType.CITIZEN]: '平民',
  [NpcType.POLICE]: '警察',
  [NpcType.GANGS]: '爛仔',
  [NpcType.SHOP]: '商店',
  [NpcType.QUEST]: '任務',
};

export const COMBAT_TYPE_LABELS: Record<CombatType, string> = {
  [CombatType.MELEE]: '近戰',
  [CombatType.RANGED]: '遠攻',
};

export interface NpcTemplate {
  id: string;
  name: string;
  type: NpcType;
  modelId: string;
  description: string | null;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  combatType: CombatType | null;
  attackRange: number | null;
  dialogueTree: any;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  isTrashed: boolean;
}

export interface DialogueNode {
  nodeId: string;
  speaker: string;
  content: string;
  options?: {
    text: string;
    nextNodeId: string;
  }[];
  actionType?: 'open_shop' | 'accept_quest' | 'end_dialogue';
  actionData?: any;
}
