'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import TemplateForm from '@/components/npc/TemplateForm';
import { npcTemplateService } from '@/lib/npc/template-service';
import type { NpcTemplate } from '@/types/npc';

export default function EditTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [template, setTemplate] = useState<NpcTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('缺少 NPC 模板 ID');
      setLoading(false);
      return;
    }
    loadTemplate();
  }, [id]);

  async function loadTemplate() {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await npcTemplateService.getTemplateById(id);
      if (!data) {
        setError('找不到指定的 NPC 模板');
      } else {
        setTemplate(data);
      }
    } catch (err) {
      console.error('載入 NPC 模板失敗:', err);
      setError('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container-fixed">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-[var(--muted-foreground)]">載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !template || !id) {
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
        </div>

        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="card-body">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  載入失敗
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button
                  onClick={loadTemplate}
                  className="btn btn-sm btn-outline mt-3"
                >
                  重新載入
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          編輯 NPC 模板
        </h1>
        <p className="text-[var(--muted-foreground)]">
          修改 NPC 模板設定：{template.name}
        </p>
      </div>

      <TemplateForm template={template} />
    </div>
  );
}
