'use client';

import { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  Save,
  ChevronDown,
  ChevronRight,
  Store,
  ScrollText,
  XCircle,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import type { DialogueTree, DialogueNode, DialogueOption } from '@/types/npc';

interface DialogueEditorProps {
  initialTree?: DialogueTree;
  onSave: (tree: DialogueTree) => void;
  onCancel?: () => void;
}

export default function DialogueEditor({
  initialTree,
  onSave,
  onCancel,
}: DialogueEditorProps) {
  const { t } = useI18n();

  const [tree, setTree] = useState<DialogueTree>(
    initialTree || {
      nodes: [
        {
          nodeId: 'start',
          speaker: 'NPC',
          content: t('npc.dialogueEditor.defaultGreeting'),
          options: [],
        },
      ],
      startNodeId: 'start',
    }
  );

  // Expanded row for inline editing
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // Drag and drop state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function addNode() {
    const newNodeId = generateNodeId();
    const newNode: DialogueNode = {
      nodeId: newNodeId,
      speaker: 'NPC',
      content: t('npc.dialogueEditor.newDialogueContent'),
      options: [],
    };

    setTree({
      ...tree,
      nodes: [...tree.nodes, newNode],
    });

    // Auto expand the new node for editing
    setExpandedNodeId(newNodeId);
  }

  function deleteNode(nodeId: string) {
    if (nodeId === tree.startNodeId) {
      alert(t('npc.dialogueEditor.cannotDeleteStart'));
      return;
    }

    // Also remove any options pointing to this node
    const updatedNodes = tree.nodes
      .filter((node) => node.nodeId !== nodeId)
      .map((node) => ({
        ...node,
        options: node.options?.filter((opt) => opt.nextNodeId !== nodeId),
      }));

    setTree({
      ...tree,
      nodes: updatedNodes,
    });

    if (expandedNodeId === nodeId) {
      setExpandedNodeId(null);
    }
  }

  function updateNode(nodeId: string, updates: Partial<DialogueNode>) {
    setTree({
      ...tree,
      nodes: tree.nodes.map((node) =>
        node.nodeId === nodeId ? { ...node, ...updates } : node
      ),
    });
  }

  function addOption(nodeId: string) {
    const node = tree.nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;

    // Find the next node in sequence, or use the first node
    const currentIndex = tree.nodes.findIndex((n) => n.nodeId === nodeId);
    const nextNode = tree.nodes[currentIndex + 1] || tree.nodes[0];

    const newOption: DialogueOption = {
      text: t('npc.dialogueEditor.newOption'),
      nextNodeId: nextNode.nodeId,
    };

    updateNode(nodeId, {
      options: [...(node.options || []), newOption],
    });
  }

  function updateOption(
    nodeId: string,
    optionIndex: number,
    field: keyof DialogueOption,
    value: string
  ) {
    const node = tree.nodes.find((n) => n.nodeId === nodeId);
    if (!node || !node.options) return;

    const newOptions = [...node.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };

    updateNode(nodeId, { options: newOptions });
  }

  function deleteOption(nodeId: string, optionIndex: number) {
    const node = tree.nodes.find((n) => n.nodeId === nodeId);
    if (!node || !node.options) return;

    updateNode(nodeId, {
      options: node.options.filter((_, i) => i !== optionIndex),
    });
  }

  // Drag and drop handlers
  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const newNodes = [...tree.nodes];
    const draggedNode = newNodes[dragItem.current];
    newNodes.splice(dragItem.current, 1);
    newNodes.splice(dragOverItem.current, 0, draggedNode);

    setTree({ ...tree, nodes: newNodes });

    dragItem.current = null;
    dragOverItem.current = null;
  }

  function handleSave() {
    onSave(tree);
  }

  function toggleExpand(nodeId: string) {
    setExpandedNodeId(expandedNodeId === nodeId ? null : nodeId);
  }

  function getActionIcon(actionType?: string) {
    switch (actionType) {
      case 'open_shop':
        return <Store className="w-4 h-4 text-green-500" />;
      case 'accept_quest':
        return <ScrollText className="w-4 h-4 text-blue-500" />;
      case 'end_dialogue':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="text-lg font-semibold">{t('npc.dialogueEditor.title')}</h3>
          <span className="text-sm text-[var(--muted-foreground)]">
            ({tree.nodes.length} {t('npc.dialogueEditor.nodes')})
          </span>
        </div>
        <button
          type="button"
          onClick={addNode}
          className="btn btn-sm btn-primary"
        >
          <Plus className="w-4 h-4 mr-1" />
          {t('npc.dialogueEditor.addNode')}
        </button>
      </div>

      {/* Start Node Selector */}
      <div className="flex items-center gap-3 p-3 bg-[var(--card)] border rounded-lg">
        <label className="text-sm font-medium whitespace-nowrap">
          {t('npc.dialogueEditor.startNode')}:
        </label>
        <select
          className="input input-sm flex-1"
          value={tree.startNodeId}
          onChange={(e) => setTree({ ...tree, startNodeId: e.target.value })}
        >
          {tree.nodes.map((node, index) => (
            <option key={node.nodeId} value={node.nodeId}>
              #{index + 1} - {node.content.substring(0, 40)}
              {node.content.length > 40 ? '...' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--muted)] text-sm">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="w-12 p-2 text-left">#</th>
              <th className="w-24 p-2 text-left">{t('npc.dialogueEditor.speaker')}</th>
              <th className="p-2 text-left">{t('npc.dialogueEditor.content')}</th>
              <th className="w-20 p-2 text-center">{t('npc.dialogueEditor.options')}</th>
              <th className="w-20 p-2 text-center">{t('npc.dialogueEditor.action')}</th>
              <th className="w-20 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {tree.nodes.map((node, index) => (
              <>
                {/* Main Row */}
                <tr
                  key={node.nodeId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-t hover:bg-[var(--muted)]/50 cursor-move ${
                    node.nodeId === tree.startNodeId ? 'bg-primary/5' : ''
                  } ${expandedNodeId === node.nodeId ? 'bg-[var(--muted)]/30' : ''}`}
                >
                  {/* Drag Handle */}
                  <td className="p-2 text-center">
                    <GripVertical className="w-4 h-4 text-[var(--muted-foreground)] mx-auto" />
                  </td>

                  {/* Order Number */}
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(node.nodeId)}
                        className="p-0.5 hover:bg-[var(--muted)] rounded"
                      >
                        {expandedNodeId === node.nodeId ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <span className="font-mono text-sm">
                        {index + 1}
                        {node.nodeId === tree.startNodeId && (
                          <span className="ml-1 text-primary text-xs">★</span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Speaker - Inline Editable */}
                  <td className="p-2">
                    <input
                      type="text"
                      className="input input-sm w-full bg-transparent border-transparent hover:border-[var(--border)] focus:border-primary"
                      value={node.speaker}
                      onChange={(e) =>
                        updateNode(node.nodeId, { speaker: e.target.value })
                      }
                    />
                  </td>

                  {/* Content Preview - Inline Editable */}
                  <td className="p-2">
                    <input
                      type="text"
                      className="input input-sm w-full bg-transparent border-transparent hover:border-[var(--border)] focus:border-primary"
                      value={node.content}
                      onChange={(e) =>
                        updateNode(node.nodeId, { content: e.target.value })
                      }
                    />
                  </td>

                  {/* Options Count */}
                  <td className="p-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        (node.options?.length || 0) > 0
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {node.options?.length || 0}
                    </span>
                  </td>

                  {/* Action Type */}
                  <td className="p-2 text-center">
                    {getActionIcon(node.actionType)}
                  </td>

                  {/* Actions */}
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      onClick={() => deleteNode(node.nodeId)}
                      className="btn btn-xs btn-ghost text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                      disabled={node.nodeId === tree.startNodeId}
                      title={
                        node.nodeId === tree.startNodeId
                          ? t('npc.dialogueEditor.cannotDeleteStart')
                          : t('npc.dialogueEditor.delete')
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>

                {/* Expanded Row for Options and Action Settings */}
                {expandedNodeId === node.nodeId && (
                  <tr key={`${node.nodeId}-expanded`}>
                    <td colSpan={7} className="p-0 bg-[var(--muted)]/20">
                      <div className="p-4 space-y-4 border-l-4 border-primary">
                        {/* Action Type Selector */}
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-medium w-24">
                            {t('npc.dialogueEditor.actionType')}:
                          </label>
                          <select
                            className="input input-sm w-48"
                            value={node.actionType || ''}
                            onChange={(e) =>
                              updateNode(node.nodeId, {
                                actionType: e.target.value
                                  ? (e.target.value as 'open_shop' | 'accept_quest' | 'end_dialogue')
                                  : undefined,
                              })
                            }
                          >
                            <option value="">{t('npc.dialogueEditor.noAction')}</option>
                            <option value="open_shop">{t('npc.actionType.open_shop')}</option>
                            <option value="accept_quest">{t('npc.actionType.accept_quest')}</option>
                            <option value="end_dialogue">{t('npc.actionType.end_dialogue')}</option>
                          </select>

                          {node.actionType === 'open_shop' && (
                            <input
                              type="text"
                              className="input input-sm flex-1"
                              placeholder="Shop ID (optional - uses NPC's linkedShopId if empty)"
                              value={node.actionData?.shopId || ''}
                              onChange={(e) =>
                                updateNode(node.nodeId, {
                                  actionData: e.target.value
                                    ? { shopId: e.target.value }
                                    : undefined,
                                })
                              }
                            />
                          )}
                        </div>

                        {/* Options Section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">
                              {t('npc.dialogueEditor.playerOptions')}
                            </label>
                            <button
                              type="button"
                              onClick={() => addOption(node.nodeId)}
                              className="btn btn-xs btn-outline"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {t('npc.dialogueEditor.addOption')}
                            </button>
                          </div>

                          {(node.options?.length || 0) === 0 ? (
                            <p className="text-sm text-[var(--muted-foreground)] italic py-2">
                              {t('npc.dialogueEditor.noOptions')}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {node.options?.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center gap-2 p-2 bg-[var(--card)] rounded border"
                                >
                                  <span className="text-xs text-[var(--muted-foreground)] w-6">
                                    {optIndex + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    className="input input-sm flex-1"
                                    placeholder={t('npc.dialogueEditor.optionText')}
                                    value={option.text}
                                    onChange={(e) =>
                                      updateOption(
                                        node.nodeId,
                                        optIndex,
                                        'text',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span className="text-xs text-[var(--muted-foreground)]">→</span>
                                  <select
                                    className="input input-sm w-48"
                                    value={option.nextNodeId}
                                    onChange={(e) =>
                                      updateOption(
                                        node.nodeId,
                                        optIndex,
                                        'nextNodeId',
                                        e.target.value
                                      )
                                    }
                                  >
                                    {tree.nodes.map((n, nIndex) => (
                                      <option key={n.nodeId} value={n.nodeId}>
                                        #{nIndex + 1} - {n.content.substring(0, 20)}...
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => deleteOption(node.nodeId, optIndex)}
                                    className="btn btn-xs btn-ghost text-red-500"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-[var(--muted-foreground)]">
        💡 {t('npc.dialogueEditor.hint')}
      </p>

      {/* Save & Cancel Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-outline">
            {t('npc.dialogueEditor.cancel')}
          </button>
        )}
        <button type="button" onClick={handleSave} className="btn btn-primary">
          <Save className="w-4 h-4 mr-2" />
          {t('npc.dialogueEditor.saveTree')}
        </button>
      </div>
    </div>
  );
}
