'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TemplateForm from '@/components/npc/TemplateForm';

export default function NewTemplatePage() {
  return (
    <div className="container-fixed">
      <div className="mb-8">
        <Link
          href="/npc/templates"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回模板列表
        </Link>
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          新增 NPC 模板
        </h1>
        <p className="text-[var(--muted-foreground)]">
          建立新的 NPC 模板定義
        </p>
      </div>

      <TemplateForm />
    </div>
  );
}
