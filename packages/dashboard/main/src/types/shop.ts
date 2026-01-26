/**
 * Shop Management Types for Gangs Online
 * Phase 16.3 - Shop & Economy System
 */

import type { ItemCategory } from './item';

/**
 * Shop item configuration
 * Each shop has a list of items with their stock and limit settings
 */
export interface ShopItemConfig {
  itemId: string;                // Item ID from items collection
  globalStock: number;           // -1 = unlimited, 0+ = limited stock
  currentStock?: number;         // Current remaining stock (only when globalStock > 0)
  personalLimit: number;         // 0 = no limit, 1+ = limit per player
  priceMultiplier?: number;      // Price multiplier (default 1.0)
}

/**
 * Operating hours configuration
 */
export interface OperatingHours {
  start: number;                 // 0-23, start hour
  end: number;                   // 0-23, end hour (supports cross-midnight like 22-04)
}

/**
 * Shop data structure (from Firestore)
 */
export interface Shop {
  id: string;
  name: string;
  description?: string;
  operatingHours?: OperatingHours;
  itemList: ShopItemConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shop form data (for create/edit)
 */
export interface ShopFormData {
  name: string;
  description?: string;
  operatingHours?: OperatingHours;
  itemList: ShopItemConfig[];
  isActive: boolean;
}

/**
 * Shop filter options
 */
export interface ShopFilter {
  search?: string;               // Search by name
  isActive?: boolean;            // Filter by active status
}

/**
 * Item data for shop item selector
 */
export interface ItemForShop {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ItemCategory;
  imageUrl: string;
  isActive: boolean;
}
