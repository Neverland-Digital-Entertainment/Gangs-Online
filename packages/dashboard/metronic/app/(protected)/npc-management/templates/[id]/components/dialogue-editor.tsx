'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, MessageSquare, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DialogueNode } from '../../constants/types';

interface DialogueEditorProps {
  templateId: string;
  dialogueTree: any;
}

const DialogueEditor = ({ templateId, dialogueTree }: DialogueEditorProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<DialogueNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (dialogueTree && Array.isArray(dialogueTree.nodes)) {
      setNodes(dialogueTree.nodes);
      if (dialogueTree.nodes.length > 0 && !selectedNodeId) {
        setSelectedNodeId(dialogueTree.nodes[0].nodeId);
      }
    } else {
      // Initialize with a default node
      const defaultNode: DialogueNode = {
        nodeId: 'node_1',
        speaker: 'NPC',
        content: '你好！',
        options: [],
      };
      setNodes([defaultNode]);
      setSelectedNodeId('node_1');
    }
  }, [dialogueTree]);

  const selectedNode = nodes.find((n) => n.nodeId === selectedNodeId);

  const saveMutation = useMutation({
    mutationFn: async (dialogueTree: any) => {
      const response = await apiFetch(
        `/api/npc-management/templates/${templateId}/dialogue`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dialogueTree }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '儲存對話樹失敗');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '成功',
        description: '對話樹已成功儲存',
      });
      queryClient.invalidateQueries({ queryKey: ['npc-template', templateId] });
    },
    onError: (error: Error) => {
      toast({
        title: '錯誤',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddNode = () => {
    const newNodeId = `node_${nodes.length + 1}`;
    const newNode: DialogueNode = {
      nodeId: newNodeId,
      speaker: 'NPC',
      content: '',
      options: [],
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(newNodeId);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodes.length <= 1) {
      toast({
        title: '錯誤',
        description: '至少需要保留一個對話節點',
        variant: 'destructive',
      });
      return;
    }

    const updatedNodes = nodes.filter((n) => n.nodeId !== nodeId);
    setNodes(updatedNodes);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(updatedNodes[0]?.nodeId || null);
    }
  };

  const handleUpdateNode = (
    nodeId: string,
    updates: Partial<DialogueNode>,
  ) => {
    setNodes(
      nodes.map((n) => (n.nodeId === nodeId ? { ...n, ...updates } : n)),
    );
  };

  const handleAddOption = (nodeId: string) => {
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;

    const newOption = {
      text: '',
      nextNodeId: '',
    };

    handleUpdateNode(nodeId, {
      options: [...(node.options || []), newOption],
    });
  };

  const handleUpdateOption = (
    nodeId: string,
    optionIndex: number,
    updates: { text?: string; nextNodeId?: string },
  ) => {
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!node || !node.options) return;

    const updatedOptions = [...node.options];
    updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], ...updates };

    handleUpdateNode(nodeId, { options: updatedOptions });
  };

  const handleDeleteOption = (nodeId: string, optionIndex: number) => {
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!node || !node.options) return;

    const updatedOptions = node.options.filter((_, i) => i !== optionIndex);
    handleUpdateNode(nodeId, { options: updatedOptions });
  };

  const handleSave = () => {
    const dialogueTree = {
      nodes,
      startNodeId: nodes[0]?.nodeId || null,
    };
    saveMutation.mutate(dialogueTree);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={handleAddNode} variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            新增節點
          </Button>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          儲存對話樹
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Node List */}
        <div className="col-span-4 space-y-2">
          <h3 className="text-sm font-medium mb-3">對話節點列表</h3>
          <div className="space-y-2">
            {nodes.map((node) => (
              <Card
                key={node.nodeId}
                className={`cursor-pointer transition-colors ${
                  selectedNodeId === node.nodeId
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                    : ''
                }`}
                onClick={() => setSelectedNodeId(node.nodeId)}
              >
                <CardHeader className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">
                          {node.nodeId}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {node.content || '(空白)'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.nodeId);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Node Editor */}
        <div className="col-span-8">
          {selectedNode ? (
            <Card>
              <CardHeader>
                <CardTitle>編輯節點：{selectedNode.nodeId}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    說話者
                  </label>
                  <Input
                    value={selectedNode.speaker}
                    onChange={(e) =>
                      handleUpdateNode(selectedNode.nodeId, {
                        speaker: e.target.value,
                      })
                    }
                    placeholder="例如：NPC 名稱"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    對話內容
                  </label>
                  <Textarea
                    value={selectedNode.content}
                    onChange={(e) =>
                      handleUpdateNode(selectedNode.nodeId, {
                        content: e.target.value,
                      })
                    }
                    placeholder="輸入對話內容..."
                    rows={4}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium">玩家選項</label>
                    <Button
                      onClick={() => handleAddOption(selectedNode.nodeId)}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      新增選項
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(selectedNode.options || []).map((option, index) => (
                      <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <ArrowRight className="h-4 w-4 mt-2.5 text-gray-400" />
                            <div className="flex-1 space-y-2">
                              <Input
                                value={option.text}
                                onChange={(e) =>
                                  handleUpdateOption(
                                    selectedNode.nodeId,
                                    index,
                                    { text: e.target.value },
                                  )
                                }
                                placeholder="選項文字"
                              />
                              <Select
                                value={option.nextNodeId}
                                onValueChange={(value) =>
                                  handleUpdateOption(
                                    selectedNode.nodeId,
                                    index,
                                    { nextNodeId: value },
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="選擇下一個節點" />
                                </SelectTrigger>
                                <SelectContent>
                                  {nodes.map((node) => (
                                    <SelectItem
                                      key={node.nodeId}
                                      value={node.nodeId}
                                    >
                                      {node.nodeId} -{' '}
                                      {node.content.substring(0, 30)}...
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                handleDeleteOption(selectedNode.nodeId, index)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium mb-2 block">
                    動作觸發 (Hook)
                  </label>
                  <Select
                    value={selectedNode.actionType || 'none'}
                    onValueChange={(value) =>
                      handleUpdateNode(selectedNode.nodeId, {
                        actionType:
                          value === 'none'
                            ? undefined
                            : (value as any),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選擇動作" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">無</SelectItem>
                      <SelectItem value="open_shop">開啟商店</SelectItem>
                      <SelectItem value="accept_quest">接受任務</SelectItem>
                      <SelectItem value="end_dialogue">結束對話</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  請從左側選擇一個節點進行編輯
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DialogueEditor;
