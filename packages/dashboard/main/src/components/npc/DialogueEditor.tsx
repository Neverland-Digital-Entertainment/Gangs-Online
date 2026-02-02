'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Store,
  ListOrdered,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context';
import { shopService } from '@/lib/shop/shop-service';
import type { Shop } from '@/types/shop';
import type { DialogueTree, DialogueNode, DialogueOption } from '@/types/npc';

// 動作類型
type ActionMode = 'next_dialogue' | 'player_options' | 'open_shop' | 'end_dialogue';

interface DialogueEditorProps {
  initialTree?: DialogueTree;
  onChange: (tree: DialogueTree) => void;
  onClearTree?: () => void;
}

export default function DialogueEditor({
  initialTree,
  onChange,
  onClearTree,
}: DialogueEditorProps) {
  const { t } = useI18n();

  const [tree, setTree] = useState<DialogueTree>(
    initialTree || {
      nodes: [
        {
          nodeId: 'start',
          speaker: '',
          content: t('npc.dialogueEditor.defaultGreeting'),
          options: [],
          actionType: 'end_dialogue', // Default single node to end_dialogue
        },
      ],
      startNodeId: 'start',
    }
  );

  // Expanded row for inline editing
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // Shops for dropdown
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  // Drag and drop state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    try {
      setLoadingShops(true);
      const data = await shopService.getAllShops();
      setShops(data);
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoadingShops(false);
    }
  }

  // Update tree and notify parent
  function updateTree(newTree: DialogueTree) {
    setTree(newTree);
    onChange(newTree);
  }

  // Determine action mode from node data
  function getActionMode(node: DialogueNode): ActionMode {
    if (node.actionType === 'end_dialogue') return 'end_dialogue';
    if (node.actionType === 'open_shop') return 'open_shop';
    if (node.options && node.options.length > 1) return 'player_options';
    if (node.options && node.options.length === 1) return 'next_dialogue';
    return 'end_dialogue';
  }

  // Get next node ID for "下一句對話" mode
  function getNextNodeId(node: DialogueNode): string {
    if (node.options && node.options.length === 1) {
      return node.options[0].nextNodeId;
    }
    // Default to next node in sequence
    const currentIndex = tree.nodes.findIndex(n => n.nodeId === node.nodeId);
    const nextNode = tree.nodes[currentIndex + 1];
    return nextNode?.nodeId || tree.nodes[0].nodeId;
  }

  // Get shop ID for "開啟商店" mode
  function getShopId(node: DialogueNode): string {
    return node.actionData?.shopId || '';
  }

  function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function addNode() {
    const newNodeId = generateNodeId();
    const newNode: DialogueNode = {
      nodeId: newNodeId,
      speaker: '',
      content: t('npc.dialogueEditor.newDialogueContent'),
      options: [],
      actionType: 'end_dialogue',
    };

    // Update the previous last node to point to this new node
    const updatedNodes = [...tree.nodes];
    const lastNode = updatedNodes[updatedNodes.length - 1];
    if (lastNode && getActionMode(lastNode) === 'end_dialogue') {
      // Change last node to "next_dialogue" pointing to new node
      lastNode.options = [{ text: '繼續', nextNodeId: newNodeId }];
      lastNode.actionType = undefined;
    }

    updateTree({
      ...tree,
      nodes: [...updatedNodes, newNode],
      startNodeId: tree.nodes[0].nodeId, // Always first node
    });

    setExpandedNodeId(newNodeId);
  }

  function deleteNode(nodeId: string) {
    const nodeIndex = tree.nodes.findIndex(n => n.nodeId === nodeId);

    // If deleting the first node (start node), clear the entire dialogue tree
    if (nodeIndex === 0) {
      if (onClearTree) {
        const confirmed = window.confirm(t('npc.dialogueEditor.confirmClearTree'));
        if (confirmed) {
          onClearTree();
        }
      }
      return;
    }

    if (tree.nodes.length === 1) {
      alert(t('npc.dialogueEditor.cannotDeleteLast'));
      return;
    }

    // Update any nodes pointing to this node
    const updatedNodes = tree.nodes
      .filter((node) => node.nodeId !== nodeId)
      .map((node) => {
        const updatedOptions = node.options?.map(opt => {
          if (opt.nextNodeId === nodeId) {
            // Point to the node after the deleted one, or the first node
            const nextIndex = nodeIndex < tree.nodes.length - 1 ? nodeIndex : 0;
            const newTarget = tree.nodes.filter(n => n.nodeId !== nodeId)[nextIndex];
            return { ...opt, nextNodeId: newTarget?.nodeId || tree.nodes[0].nodeId };
          }
          return opt;
        });
        return { ...node, options: updatedOptions };
      });

    updateTree({
      ...tree,
      nodes: updatedNodes,
      startNodeId: updatedNodes[0].nodeId, // Always first node
    });

    if (expandedNodeId === nodeId) {
      setExpandedNodeId(null);
    }
  }

  function updateNode(nodeId: string, updates: Partial<DialogueNode>) {
    updateTree({
      ...tree,
      nodes: tree.nodes.map((node) =>
        node.nodeId === nodeId ? { ...node, ...updates } : node
      ),
    });
  }

  function setActionMode(nodeId: string, mode: ActionMode) {
    const node = tree.nodes.find(n => n.nodeId === nodeId);
    if (!node) return;

    const currentIndex = tree.nodes.findIndex(n => n.nodeId === nodeId);
    const nextNode = tree.nodes[currentIndex + 1] || tree.nodes[0];

    switch (mode) {
      case 'next_dialogue':
        updateNode(nodeId, {
          options: [{ text: '繼續', nextNodeId: nextNode.nodeId }],
          actionType: undefined,
          actionData: undefined,
        });
        break;
      case 'player_options':
        updateNode(nodeId, {
          options: node.options?.length ? node.options : [
            { text: t('npc.dialogueEditor.newOption'), nextNodeId: nextNode.nodeId }
          ],
          actionType: undefined,
          actionData: undefined,
        });
        break;
      case 'open_shop':
        updateNode(nodeId, {
          options: [],
          actionType: 'open_shop',
          actionData: node.actionData || undefined,
        });
        break;
      case 'end_dialogue':
        updateNode(nodeId, {
          options: [],
          actionType: 'end_dialogue',
          actionData: undefined,
        });
        break;
    }
  }

  function setNextNodeId(nodeId: string, nextNodeId: string) {
    updateNode(nodeId, {
      options: [{ text: '繼續', nextNodeId }],
    });
  }

  function setShopIdForNode(nodeId: string, shopId: string) {
    updateNode(nodeId, {
      actionData: shopId ? { shopId } : undefined,
    });
  }

  function addOption(nodeId: string) {
    const node = tree.nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;

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

    const newOptions = node.options.filter((_, i) => i !== optionIndex);

    // If no options left, switch to end_dialogue
    if (newOptions.length === 0) {
      updateNode(nodeId, {
        options: [],
        actionType: 'end_dialogue',
      });
    } else {
      updateNode(nodeId, { options: newOptions });
    }
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

    updateTree({
      ...tree,
      nodes: newNodes,
      startNodeId: newNodes[0].nodeId, // Always first node is start
    });

    dragItem.current = null;
    dragOverItem.current = null;
  }

  function toggleExpand(nodeId: string) {
    setExpandedNodeId(expandedNodeId === nodeId ? null : nodeId);
  }

  function getActionLabel(mode: ActionMode): string {
    switch (mode) {
      case 'next_dialogue': return t('npc.dialogueEditor.actionNextDialogue');
      case 'player_options': return t('npc.dialogueEditor.actionPlayerOptions');
      case 'open_shop': return t('npc.dialogueEditor.actionOpenShop');
      case 'end_dialogue': return t('npc.dialogueEditor.actionEndDialogue');
    }
  }

  function getActionIcon(mode: ActionMode) {
    switch (mode) {
      case 'next_dialogue':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'player_options':
        return <ListOrdered className="w-4 h-4 text-purple-500" />;
      case 'open_shop':
        return <Store className="w-4 h-4 text-green-500" />;
      case 'end_dialogue':
        return <XCircle className="w-4 h-4 text-gray-500" />;
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-800 text-sm">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="w-16 p-2 text-left text-gray-700 dark:text-gray-300">#</th>
              <th className="p-2 text-left text-gray-700 dark:text-gray-300">{t('npc.dialogueEditor.content')}</th>
              <th className="w-40 p-2 text-center text-gray-700 dark:text-gray-300">{t('npc.dialogueEditor.actionType')}</th>
              <th className="w-16 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {tree.nodes.map((node, index) => {
              const actionMode = getActionMode(node);
              return (
                <>
                  {/* Main Row */}
                  <tr
                    key={node.nodeId}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-move ${
                      index === 0 ? 'bg-primary/5' : ''
                    } ${expandedNodeId === node.nodeId ? 'bg-gray-50 dark:bg-gray-800/30' : ''}`}
                  >
                    {/* Drag Handle */}
                    <td className="p-2 text-center">
                      <GripVertical className="w-4 h-4 text-gray-400 mx-auto" />
                    </td>

                    {/* Order Number */}
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleExpand(node.nodeId)}
                          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {expandedNodeId === node.nodeId ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-mono text-sm">
                          {index + 1}
                          {index === 0 && (
                            <span className="ml-1 text-primary text-xs" title={t('npc.dialogueEditor.startNodeHint')}>★</span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Content - Inline Editable */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="input input-sm w-full bg-transparent border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary"
                        value={node.content}
                        onChange={(e) =>
                          updateNode(node.nodeId, { content: e.target.value })
                        }
                        placeholder={t('npc.dialogueEditor.contentPlaceholder')}
                      />
                    </td>

                    {/* Action Type Display */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getActionIcon(actionMode)}
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {getActionLabel(actionMode)}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => deleteNode(node.nodeId)}
                        className="btn btn-xs btn-ghost text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                        title={index === 0 ? t('npc.dialogueEditor.deleteFirstNodeHint') : t('npc.dialogueEditor.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {expandedNodeId === node.nodeId && (
                    <tr key={`${node.nodeId}-expanded`}>
                      <td colSpan={5} className="p-0 bg-gray-50 dark:bg-gray-800/20">
                        <div className="p-4 space-y-4 border-l-4 border-primary ml-2">
                          {/* Action Type Selector */}
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="text-sm font-medium w-20">
                              {t('npc.dialogueEditor.actionType')}:
                            </label>
                            <select
                              className="input input-sm w-48"
                              value={actionMode}
                              onChange={(e) => setActionMode(node.nodeId, e.target.value as ActionMode)}
                            >
                              <option value="next_dialogue">{t('npc.dialogueEditor.actionNextDialogue')}</option>
                              <option value="player_options">{t('npc.dialogueEditor.actionPlayerOptions')}</option>
                              <option value="open_shop">{t('npc.dialogueEditor.actionOpenShop')}</option>
                              <option value="end_dialogue">{t('npc.dialogueEditor.actionEndDialogue')}</option>
                            </select>

                            {/* Next Dialogue Selector */}
                            {actionMode === 'next_dialogue' && (
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <select
                                  className="input input-sm w-48"
                                  value={getNextNodeId(node)}
                                  onChange={(e) => setNextNodeId(node.nodeId, e.target.value)}
                                >
                                  {tree.nodes.filter(n => n.nodeId !== node.nodeId).map((n, nIndex) => {
                                    const actualIndex = tree.nodes.findIndex(tn => tn.nodeId === n.nodeId);
                                    return (
                                      <option key={n.nodeId} value={n.nodeId}>
                                        #{actualIndex + 1} - {n.content.substring(0, 20)}...
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            )}

                            {/* Shop Selector */}
                            {actionMode === 'open_shop' && (
                              <div className="flex items-center gap-2">
                                <Store className="w-4 h-4 text-gray-400" />
                                <select
                                  className="input input-sm w-64"
                                  value={getShopId(node)}
                                  onChange={(e) => setShopIdForNode(node.nodeId, e.target.value)}
                                  disabled={loadingShops}
                                >
                                  <option value="">{t('npc.dialogueEditor.useLinkedShop')}</option>
                                  {shops.map((shop) => (
                                    <option key={shop.id} value={shop.id}>
                                      {shop.name} {!shop.isActive ? ' [停用]' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Player Options Section */}
                          {actionMode === 'player_options' && (
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

                              <div className="space-y-2">
                                {node.options?.map((option, optIndex) => (
                                  <div
                                    key={optIndex}
                                    className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                                  >
                                    <span className="text-xs text-gray-500 w-6">
                                      {optIndex + 1}.
                                    </span>
                                    <input
                                      type="text"
                                      className="input input-sm flex-1"
                                      placeholder={t('npc.dialogueEditor.optionText')}
                                      value={option.text}
                                      onChange={(e) =>
                                        updateOption(node.nodeId, optIndex, 'text', e.target.value)
                                      }
                                    />
                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                    <select
                                      className="input input-sm w-48"
                                      value={option.nextNodeId}
                                      onChange={(e) =>
                                        updateOption(node.nodeId, optIndex, 'nextNodeId', e.target.value)
                                      }
                                    >
                                      {tree.nodes.map((n, nIndex) => (
                                        <option key={n.nodeId} value={n.nodeId}>
                                          #{nIndex + 1} - {n.content.substring(0, 15)}...
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => deleteOption(node.nodeId, optIndex)}
                                      className="btn btn-xs btn-ghost text-red-500"
                                      disabled={node.options?.length === 1}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        💡 {t('npc.dialogueEditor.hint')} <span className="text-primary">★</span> = {t('npc.dialogueEditor.startNodeHint')}
      </p>
    </div>
  );
}
