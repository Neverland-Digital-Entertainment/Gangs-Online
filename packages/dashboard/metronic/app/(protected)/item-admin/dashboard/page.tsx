/**
 * Item Admin Dashboard Page
 * Phase 16 - Item Module
 */

import { Metadata } from 'next';
import { DashboardContent } from './content';

export const metadata: Metadata = {
  title: 'Item Management Dashboard',
  description: 'Manage game items for Gangs Online',
};

export default function ItemAdminDashboardPage() {
  return <DashboardContent />;
}
