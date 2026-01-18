/**
 * Item List Page
 * Phase 16 - Item Module
 */

import { Metadata } from 'next';
import { ItemListContent } from './content';

export const metadata: Metadata = {
  title: 'All Items',
  description: 'Browse and manage all game items',
};

export default function ItemListPage() {
  return <ItemListContent />;
}
