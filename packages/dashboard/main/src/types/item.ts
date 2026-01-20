/**
 * Item Management Types for Gangs Online
 * Version 0.16.1
 */

export enum ItemCategory {
  CONSUMABLE = 'consumable',
  SPECIAL = 'special',
  CONTRABAND = 'contraband',
  MATERIAL = 'material',
}

export interface ItemBase {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  imageUrl: string;
  price: number;
  sellPrice: number;
  isTradeable: boolean;
  isDroppable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Category-specific attributes
export interface ConsumableAttributes {
  hpRestore: number;
  vpRestore: number;
  cooldown: number;
}

export interface SpecialAttributes {
  faithCost: number;
  deityId?: string;
}

export interface ContrabandAttributes {
  crimeValue: number;
  policeDetectionMultiplier: number;
}

export interface MaterialAttributes {
  stackLimit: number;
}

export type ItemAttributes =
  | ConsumableAttributes
  | SpecialAttributes
  | ContrabandAttributes
  | MaterialAttributes;

export interface Item extends ItemBase {
  attributes: ItemAttributes;
}

export interface ItemFormData {
  name: string;
  description: string;
  category: ItemCategory;
  imageFile?: File;
  imageUrl?: string;
  price: number;
  sellPrice: number;
  isTradeable: boolean;
  isDroppable: boolean;
  isActive: boolean;
  attributes: Partial<ItemAttributes>;
}

export interface ItemFilter {
  search?: string;
  category?: ItemCategory;
  isActive?: boolean;
}
