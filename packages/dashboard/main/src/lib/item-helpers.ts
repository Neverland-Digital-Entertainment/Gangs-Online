import type { ItemCategory } from '@/types/item';

/**
 * Get the translation key for an item category
 * @param category - The item category
 * @returns The translation key
 */
export function getCategoryTranslationKey(category: ItemCategory): string {
  return `item.category.${category}`;
}

/**
 * Get all available item categories
 * @returns Array of all item categories
 */
export function getAllCategories(): ItemCategory[] {
  return ['consumable', 'special', 'equipment', 'material'] as ItemCategory[];
}
