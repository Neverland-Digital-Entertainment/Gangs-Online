/**
 * Quest Blueprint Types and Interfaces
 * Phase 20: Quest Blueprint System
 */

/**
 * Quest Node Types
 */
export type QuestNodeType =
  | 'start'
  | 'dialogue'
  | 'choice'
  | 'task'
  | 'condition'
  | 'action'
  | 'end';

/**
 * Quest Task Types
 */
export type QuestTaskType = 'collect' | 'kill' | 'interact' | 'location';

/**
 * Start Node Data
 */
export interface IStartNodeData {
  npcTemplateId: string;
  minLevel?: number;
  maxLevel?: number;
  prerequisiteQuestId?: string;
}

/**
 * Dialogue Node Data
 */
export interface IDialogueNodeData {
  speakerId: string;
  expression?: string;
  textZh: string;
  textEn: string;
}

/**
 * Choice Node Data
 */
export interface IChoiceNodeData {
  options: {
    textZh: string;
    textEn: string;
    targetHandleId: string;
  }[];
}

/**
 * Task Node Data
 */
export interface ITaskNodeData {
  taskType: QuestTaskType;
  targetId: string;
  requiredCount: number;
  description?: string;
  timeLimit?: number;
  locationX?: number;
  locationZ?: number;
  locationRadius?: number;
}

/**
 * Condition Node Data
 */
export interface IConditionNodeData {
  conditionType: 'money' | 'item' | 'variable';
  targetId?: string;
  requiredAmount: number;
}

/**
 * Action Node Data
 */
export interface IActionNodeData {
  actionType: 'remove_item' | 'remove_money' | 'spawn_npc' | 'set_variable';
  targetId?: string;
  amount?: number;
  value?: string;
}

/**
 * End Node Data
 */
export interface IEndNodeData {
  rewardXp: number;
  rewardMoney: number;
  rewardItems?: {
    itemId: string;
    quantity: number;
  }[];
}

/**
 * Quest Blueprint (stored in Firebase)
 */
export interface QuestBlueprint {
  id: string;
  name: string;
  description?: string;
  nodes: QuestBlueprintNode[];
  edges: QuestBlueprintEdge[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quest Blueprint Form Data (for create/edit)
 */
export interface QuestBlueprintFormData {
  name: string;
  description?: string;
  nodes: QuestBlueprintNode[];
  edges: QuestBlueprintEdge[];
}

/**
 * Quest Blueprint Node (React Flow node)
 */
export interface QuestBlueprintNode {
  id: string;
  type: QuestNodeType;
  position: { x: number; y: number };
  data: IStartNodeData | IDialogueNodeData | IChoiceNodeData |
        ITaskNodeData | IConditionNodeData | IActionNodeData | IEndNodeData;
}

/**
 * Quest Blueprint Edge (React Flow edge)
 */
export interface QuestBlueprintEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

/**
 * Quest Blueprint Filter
 */
export interface QuestBlueprintFilter {
  search?: string;
  isActive?: boolean;
}
