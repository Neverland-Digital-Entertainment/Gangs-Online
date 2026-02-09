'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/contexts/i18n-context';
import { QuestBlueprintService } from '@/lib/quest/quest-service';
import type { QuestBlueprintNode, QuestBlueprintEdge } from '@/types/quest';

const QuestFlowEditor = dynamic(
  () => import('@/components/quest/QuestFlowEditor'),
  { ssr: false }
);

function QuestEditContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState<QuestBlueprintNode[]>([]);
  const [edges, setEdges] = useState<QuestBlueprintEdge[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;

    const loadBlueprint = async () => {
      try {
        setLoading(true);
        const service = QuestBlueprintService.getInstance();
        const blueprint = await service.getBlueprintById(editId);
        if (blueprint) {
          setName(blueprint.name);
          setDescription(blueprint.description || '');
          setNodes(blueprint.nodes);
          setEdges(blueprint.edges);
        } else {
          setError(t('quest.notFound'));
        }
      } catch (err) {
        console.error('Failed to load quest blueprint:', err);
        setError(t('error.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadBlueprint();
  }, [editId, t]);

  const handleNodesChange = useCallback((updatedNodes: QuestBlueprintNode[]) => {
    setNodes(updatedNodes);
  }, []);

  const handleEdgesChange = useCallback((updatedEdges: QuestBlueprintEdge[]) => {
    setEdges(updatedEdges);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      alert(t('quest.nameRequired'));
      return;
    }

    try {
      setSaving(true);
      const service = QuestBlueprintService.getInstance();
      const formData = { name, description, nodes, edges };

      if (editId) {
        await service.updateBlueprint(editId, formData);
      } else {
        await service.createBlueprint(formData);
      }

      router.push('/quest');
    } catch (err) {
      console.error('Failed to save quest blueprint:', err);
      alert(t('error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--muted)]">{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-500">{error}</p>
        <Link href="/quest" className="btn btn-light">
          {t('quest.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <Link
            href="/quest"
            className="btn btn-light p-2"
            title={t('quest.backToList')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <input
              type="text"
              className="input text-lg font-semibold w-full max-w-xs"
              placeholder={t('quest.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="text"
              className="input text-sm w-full max-w-sm hidden sm:block"
              placeholder={t('quest.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          {saving
            ? t('quest.saving')
            : editId
              ? t('quest.updateBlueprint')
              : t('quest.createBlueprint')}
        </button>
      </div>

      {/* Flow Editor */}
      <div className="flex-1 relative">
        <QuestFlowEditor
          initialNodes={nodes}
          initialEdges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
        />
      </div>
    </div>
  );
}

export default function QuestEditPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <QuestEditContent />
    </Suspense>
  );
}
