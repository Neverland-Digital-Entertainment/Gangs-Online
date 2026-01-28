'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  ArrowRight,
  Save,
  X,
} from 'lucide-react';
import type { DialogueTree, DialogueNode, DialogueOption } from '@/types/npc';

interface DialogueEditorProps {
  initialTree?: DialogueTree;
  onSave: (tree: DialogueTree) => void;
  onCancel?: () => void;
}

const ACTION_TYPE_LABELS = {
  open_shop: '開啟商店',
  accept_quest: '接受任務',
  end_dialogue: '結束對話',
};

export default function DialogueEditor({
  initialTree,
  onSave,
  onCancel,
}: DialogueEditorProps) {
  const [tree, setTree] = useState<DialogueTree>(
    initialTree || {
      nodes: [
        {
          nodeId: 'start',
          speaker: 'NPC',
          content: '你好！',
          options: [],
        },
      ],
      startNodeId: 'start',
    }
  );

  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DialogueNode | null>(null);

  function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function addNode() {
    const newNodeId = generateNodeId();
    const newNode: DialogueNode = {
      nodeId: newNodeId,
      speaker: 'NPC',
      content: '新對話內容',
      options: [],
    };

    setTree({
      ...tree,
      nodes: [...tree.nodes, newNode],
    });
  }

  function deleteNode(nodeId: string) {
    if (nodeId === tree.startNodeId) {
      alert('無法刪除起始節點');
      return;
    }

    setTree({
      ...tree,
      nodes: tree.nodes.filter((node) => node.nodeId !== nodeId),
    });
  }

  function startEditNode(node: DialogueNode) {
    setEditingNode(node.nodeId);
    setEditForm({ ...node });
  }

  function cancelEditNode() {
    setEditingNode(null);
    setEditForm(null);
  }

  function saveEditNode() {
    if (!editForm) return;

    setTree({
      ...tree,
      nodes: tree.nodes.map((node) =>
        node.nodeId === editForm.nodeId ? editForm : node
      ),
    });

    setEditingNode(null);
    setEditForm(null);
  }

  function addOption() {
    if (!editForm) return;

    const newOption: DialogueOption = {
      text: '新選項',
      nextNodeId: tree.startNodeId,
    };

    setEditForm({
      ...editForm,
      options: [...(editForm.options || []), newOption],
    });
  }

  function updateOption(index: number, field: keyof DialogueOption, value: string) {
    if (!editForm) return;

    const options = [...(editForm.options || [])];
    options[index] = { ...options[index], [field]: value };

    setEditForm({
      ...editForm,
      options,
    });
  }

  function deleteOption(index: number) {
    if (!editForm) return;

    setEditForm({
      ...editForm,
      options: editForm.options?.filter((_, i) => i !== index),
    });
  }

  function handleSave() {
    onSave(tree);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h3 className="text-lg font-semibold">對話樹編輯器</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addNode}
            className="btn btn-sm btn-outline"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增節點
          </button>
        </div>
      </div>

      {/* Start Node Selector */}
      <div className="card">
        <div className="card-body">
          <label className="label">起始節點</label>
          <select
            className="input"
            value={tree.startNodeId}
            onChange={(e) => setTree({ ...tree, startNodeId: e.target.value })}
          >
            {tree.nodes.map((node) => (
              <option key={node.nodeId} value={node.nodeId}>
                {node.nodeId} - {node.content.substring(0, 30)}
                {node.content.length > 30 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nodes List */}
      <div className="space-y-3">
        {tree.nodes.map((node) => (
          <div
            key={node.nodeId}
            className={`card ${
              node.nodeId === tree.startNodeId
                ? 'border-2 border-primary'
                : ''
            }`}
          >
            <div className="card-body">
              {editingNode === node.nodeId && editForm ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">編輯節點: {node.nodeId}</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveEditNode}
                        className="btn btn-sm btn-primary"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        儲存
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditNode}
                        className="btn btn-sm btn-outline"
                      >
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </button>
                    </div>
                  </div>

                  {/* Speaker */}
                  <div>
                    <label className="label">發言者</label>
                    <input
                      type="text"
                      className="input"
                      value={editForm.speaker}
                      onChange={(e) =>
                        setEditForm({ ...editForm, speaker: e.target.value })
                      }
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="label">對話內容</label>
                    <textarea
                      className="input min-h-[100px]"
                      value={editForm.content}
                      onChange={(e) =>
                        setEditForm({ ...editForm, content: e.target.value })
                      }
                    />
                  </div>

                  {/* Action Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">動作類型</label>
                      <select
                        className="input"
                        value={editForm.actionType || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            actionType: e.target.value
                              ? (e.target.value as any)
                              : undefined,
                          })
                        }
                      >
                        <option value="">無動作</option>
                        {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">動作資料 (JSON)</label>
                      <input
                        type="text"
                        className="input"
                        value={
                          editForm.actionData
                            ? JSON.stringify(editForm.actionData)
                            : ''
                        }
                        onChange={(e) => {
                          try {
                            const data = e.target.value
                              ? JSON.parse(e.target.value)
                              : undefined;
                            setEditForm({ ...editForm, actionData: data });
                          } catch {
                            // Invalid JSON, ignore
                          }
                        }}
                        placeholder='{"shopId": "shop_001"}'
                      />
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label mb-0">玩家選項</label>
                      <button
                        type="button"
                        onClick={addOption}
                        className="btn btn-sm btn-outline"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        新增選項
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(editForm.options || []).map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded"
                        >
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              className="input input-sm"
                              placeholder="選項文字"
                              value={option.text}
                              onChange={(e) =>
                                updateOption(index, 'text', e.target.value)
                              }
                            />
                            <select
                              className="input input-sm"
                              value={option.nextNodeId}
                              onChange={(e) =>
                                updateOption(index, 'nextNodeId', e.target.value)
                              }
                            >
                              {tree.nodes.map((n) => (
                                <option key={n.nodeId} value={n.nodeId}>
                                  → {n.nodeId}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteOption(index)}
                            className="btn btn-sm btn-outline text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{node.nodeId}</h4>
                        {node.nodeId === tree.startNodeId && (
                          <span className="badge badge-primary text-xs">起始</span>
                        )}
                        {node.actionType && ACTION_TYPE_LABELS[node.actionType as keyof typeof ACTION_TYPE_LABELS] && (
                          <span className="badge badge-gray text-xs">
                            {ACTION_TYPE_LABELS[node.actionType as keyof typeof ACTION_TYPE_LABELS]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--muted-foreground)] mb-2">
                        <strong>{node.speaker}:</strong> {node.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditNode(node)}
                        className="btn btn-sm btn-outline"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNode(node.nodeId)}
                        className="btn btn-sm btn-outline text-red-600"
                        disabled={node.nodeId === tree.startNodeId}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {node.options && node.options.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--muted-foreground)] mb-1">
                        玩家選項:
                      </p>
                      {node.options.map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] pl-4"
                        >
                          <ArrowRight className="w-3 h-3" />
                          <span>{option.text}</span>
                          <span className="text-xs">→ {option.nextNodeId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save & Cancel Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-outline"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-primary"
        >
          <Save className="w-4 h-4 mr-2" />
          儲存對話樹
        </button>
      </div>
    </div>
  );
}
