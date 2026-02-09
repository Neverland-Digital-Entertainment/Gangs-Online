'use client';

import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useI18n } from '@/contexts/i18n-context';
import StartNode from './nodes/StartNode';
import DialogueNode from './nodes/DialogueNode';
import ChoiceNode from './nodes/ChoiceNode';
import TaskNode from './nodes/TaskNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import EndNode from './nodes/EndNode';

import type { QuestBlueprintNode, QuestBlueprintEdge } from '@/types/quest';

interface QuestFlowEditorProps {
  initialNodes: QuestBlueprintNode[];
  initialEdges: QuestBlueprintEdge[];
  onNodesChange: (nodes: QuestBlueprintNode[]) => void;
  onEdgesChange: (edges: QuestBlueprintEdge[]) => void;
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  dialogue: DialogueNode,
  choice: ChoiceNode,
  task: TaskNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};

let nodeIdCounter = 0;
function getNextNodeId(): string {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

export default function QuestFlowEditor({
  initialNodes,
  initialEdges,
  onNodesChange: onNodesExternal,
  onEdgesChange: onEdgesExternal,
}: QuestFlowEditorProps) {
  const { t } = useI18n();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const rfNodes: Node[] = useMemo(() =>
    initialNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
    })), [initialNodes]);

  const rfEdges: Edge[] = useMemo(() =>
    initialEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    })), [initialEdges]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(rfEdges);

  const syncNodes = useCallback((updatedNodes: Node[]) => {
    onNodesExternal(
      updatedNodes.map((n) => ({
        id: n.id,
        type: n.type as any,
        position: n.position,
        data: n.data as any,
      }))
    );
  }, [onNodesExternal]);

  const syncEdges = useCallback((updatedEdges: Edge[]) => {
    onEdgesExternal(
      updatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        label: typeof e.label === 'string' ? e.label : undefined,
      }))
    );
  }, [onEdgesExternal]);

  const onNodesChangeInternal = useCallback((changes: any) => {
    handleNodesChange(changes);
    // Sync after state update via setTimeout
    setTimeout(() => {
      setNodes((nds) => {
        syncNodes(nds);
        return nds;
      });
    }, 0);
  }, [handleNodesChange, setNodes, syncNodes]);

  const onEdgesChangeInternal = useCallback((changes: any) => {
    handleEdgesChange(changes);
    setTimeout(() => {
      setEdges((eds) => {
        syncEdges(eds);
        return eds;
      });
    }, 0);
  }, [handleEdgesChange, setEdges, syncEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(
          {
            ...params,
            id: `edge_${Date.now()}`,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
          },
          eds
        );
        syncEdges(newEdges);
        return newEdges;
      });
    },
    [setEdges, syncEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      const newNode = {
        id: getNextNodeId(),
        type,
        position: { x: 250, y: 250 },
        data: getDefaultDataForType(type),
      };

      setNodes((nds) => {
        const updated = [...nds, newNode] as typeof nds;
        syncNodes(updated);
        return updated;
      });
    },
    [setNodes, syncNodes]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-gray-50 dark:bg-gray-900"
      >
        <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap
          className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          nodeColor={(node) => getNodeColor(node.type || 'default')}
        />

        {/* Add Node Panel */}
        <Panel position="top-left" className="flex flex-wrap gap-2">
          <button
            onClick={() => addNode('start')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 shadow-md"
          >
            + {t('quest.node.start')}
          </button>
          <button
            onClick={() => addNode('dialogue')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 shadow-md"
          >
            + {t('quest.node.dialogue')}
          </button>
          <button
            onClick={() => addNode('choice')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 shadow-md"
          >
            + {t('quest.node.choice')}
          </button>
          <button
            onClick={() => addNode('task')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 shadow-md"
          >
            + {t('quest.node.task')}
          </button>
          <button
            onClick={() => addNode('condition')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 shadow-md"
          >
            + {t('quest.node.condition')}
          </button>
          <button
            onClick={() => addNode('action')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 shadow-md"
          >
            + {t('quest.node.action')}
          </button>
          <button
            onClick={() => addNode('end')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-500 text-white hover:bg-gray-600 shadow-md"
          >
            + {t('quest.node.end')}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function getDefaultDataForType(type: string): any {
  switch (type) {
    case 'start':
      return { npcTemplateId: '', minLevel: 1, maxLevel: undefined, prerequisiteQuestId: '' };
    case 'dialogue':
      return { speakerId: '', expression: '', textZh: '', textEn: '' };
    case 'choice':
      return { options: [{ textZh: '', textEn: '', targetHandleId: 'option_0' }] };
    case 'task':
      return { taskType: 'kill', targetId: '', requiredCount: 1, description: '' };
    case 'condition':
      return { conditionType: 'money', targetId: '', requiredAmount: 0 };
    case 'action':
      return { actionType: 'remove_item', targetId: '', amount: 0 };
    case 'end':
      return { rewardXp: 0, rewardMoney: 0, rewardItems: [] };
    default:
      return {};
  }
}

function getNodeColor(type: string): string {
  switch (type) {
    case 'start': return '#22c55e';
    case 'dialogue': return '#3b82f6';
    case 'choice': return '#a855f7';
    case 'task': return '#f97316';
    case 'condition': return '#eab308';
    case 'action': return '#ef4444';
    case 'end': return '#6b7280';
    default: return '#9ca3af';
  }
}
