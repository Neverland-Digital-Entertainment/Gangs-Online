/**
 * Item Editor Page
 * Phase 16 - Item Module
 */

import { Metadata } from 'next';
import { ItemEditorContent } from './content';

export const metadata: Metadata = {
  title: 'Edit Item',
  description: 'Edit game item properties',
};

export default function ItemEditorPage({
  params,
}: {
  params: { id: string };
}) {
  return <ItemEditorContent itemId={params.id} />;
}
