'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import InstanceForm from '@/components/npc/InstanceForm';

export default function NewInstancePage() {
  return (
    <div className="container-fixed">
      <div className="mb-8">
        <Link
          href="/npc/instances"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回實例列表
        </Link>
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          新增 NPC 實例
        </h1>
        <p className="text-[var(--muted-foreground)]">
          在地圖上放置新的 NPC 實例
        </p>
      </div>

      <InstanceForm />
    </div>
  );
}
