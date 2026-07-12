import React, { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  reconnectEdge,
  addEdge,
} from '@xyflow/react';
import type {
  Node as FlowNode,
  Edge as FlowEdge,
  OnReconnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { FrontendMetadata } from '../types/metadata';

interface AppSimulatorProps {
  metadata: FrontendMetadata | null;
  onMetadataChange?: (newMetadata: FrontendMetadata) => void;
  resolvedTheme: 'light' | 'dark';
}

// 接続用ハンドルを備えたカスタム質問ノード
const QuestionNode = ({ data, style, id }: any) => {
  const isEnd = id === 'COMPLETED_STATE';
  const cardStyle = getQuestionNodeStyle(data.qType, data.isStart);
  return (
    <div style={style} className="relative">
      {/* ターゲットハンドル（入力矢印を受ける：すべてのノードに配置） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: '-4px',
          background: 'var(--color-purple-400)',
          borderRadius: '50%',
          width: '8px',
          height: '8px',
          border: '1px solid var(--color-slate-900)',
          zIndex: 10
        }}
      />
      
      {/* 装飾されたカード本体 */}
      <div style={cardStyle} className="nodrag whitespace-pre-wrap">
        {data.label}
      </div>
      
      {/* ソースハンドル（出力矢印を出す：終了ノード以外に配置） */}
      {!isEnd && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            bottom: '-4px',
            background: 'var(--color-purple-400)',
            borderRadius: '50%',
            width: '8px',
            height: '8px',
            border: '1px solid var(--color-slate-900)',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
};

const nodeTypes = {
  question: QuestionNode,
};

// dagre 自動レイアウト関数
const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 240;
  const nodeHeight = 100;

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
};

const getQuestionNodeStyle = (type: string, isStart: boolean) => {
  const baseStyle: React.CSSProperties = {
    padding: '16px',
    borderRadius: '12px',
    fontSize: '11px',
    color: 'var(--color-slate-100)',
    width: 220,
    border: '2px solid var(--color-slate-750)',
    background: 'var(--color-slate-900)',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -4px rgba(0, 0, 0, 0.15)',
    textAlign: 'center',
    fontWeight: 500,
    lineHeight: 1.5,
    fontFamily: 'sans-serif',
  };

  if (isStart) {
    baseStyle.borderColor = 'var(--color-purple-400)';
    baseStyle.boxShadow = '0 0 15px rgba(168, 85, 247, 0.35)';
  }

  if (type === 'Selection' || type === 'MultipleSelection') {
    baseStyle.borderColor = 'var(--color-purple-400)';
    baseStyle.background = 'var(--color-purple-950)';
  } else if (type === 'Age' || type === 'PersonNum') {
    baseStyle.borderColor = 'var(--color-sky-500)';
    baseStyle.background = 'var(--color-sky-950)';
  } else if (type === 'completed') {
    baseStyle.borderColor = 'var(--color-emerald-400)';
    baseStyle.background = 'var(--color-emerald-950)';
    baseStyle.fontWeight = 700;
  }

  return baseStyle;
};

export const AppSimulator: React.FC<AppSimulatorProps> = ({ metadata, onMetadataChange, resolvedTheme }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // グラフ変更の履歴（Undo/Redo）管理用 state
  const [undoStack, setUndoStack] = useState<FrontendMetadata[]>([]);
  const [redoStack, setRedoStack] = useState<FrontendMetadata[]>([]);
  const [lastSelfChangedMetadata, setLastSelfChangedMetadata] = useState<string | null>(null);

  useEffect(() => {
    if (!metadata || !metadata.questions || metadata.questions.length === 0 || !metadata.flow) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes: FlowNode[] = [];
    const rawEdges: FlowEdge[] = [];
    const startStateId = metadata.flow.start_state;

    // 1. 全質問をノードとして追加
    metadata.questions.forEach((q) => {
      const typeLabel = q.type === 'Selection' ? '択一選択'
        : q.type === 'MultipleSelection' ? '複数選択'
        : q.type === 'Age' ? '年齢数値入力'
        : q.type === 'PersonNum' ? '世帯人数入力'
        : q.type;

      const optText = q.options && q.options.length > 0 ? `\n選択肢: [ ${q.options.join(', ')} ]` : '';
      const label = `❓ ${q.title}\n(${typeLabel})${optText}`;

      rawNodes.push({
        id: q.id,
        type: 'question',
        data: { label, qType: q.type, isStart: q.id === startStateId },
        style: { width: 220 }, // 外殻はサイズのみ指定して二重装飾を回避
        position: { x: 0, y: 0 },
      });
    });

    // 特別な「結果判定・完了」ノードを追加
    rawNodes.push({
      id: 'COMPLETED_STATE',
      type: 'question',
      data: { label: '🏁 シミュレーション終了\n(判定結果出力)', qType: 'completed', isStart: false },
      style: { width: 220 },
      position: { x: 0, y: 0 },
    });

    const isDarkMode = resolvedTheme === 'dark';
    const edgeColorNext = isDarkMode ? '#a78bfa' : '#7c3aed';
    const edgeColorCond = isDarkMode ? '#38bdf8' : '#0284c7';
    const edgeColorEnd = isDarkMode ? '#10b981' : '#059669';

    // 2. 状態遷移 (Flow) からエッジを構築
    metadata.flow.states.forEach((state) => {
      // 固定の次遷移
      if (state.nextQuestionKey) {
        rawEdges.push({
          id: `${state.id}-${state.nextQuestionKey}-next`,
          source: state.id,
          target: state.nextQuestionKey,
          reconnectable: true,
          style: { stroke: edgeColorNext, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorNext, width: 20, height: 20 },
        });
      }

      // 条件付き遷移
      if (state.nextConditions && state.nextConditions.length > 0) {
        state.nextConditions.forEach((cond, idx) => {
          let label = '';
          if (cond.guard) {
            if (cond.guard.type === 'mode_check') {
              label = `モード: ${cond.guard.mode || ''}`;
            } else if (cond.guard.type === 'loop_check') {
              label = `ループ完了`;
            } else if (cond.guard.type === 'has_members') {
              label = `${cond.guard.relation || ''}あり`;
            } else {
              label = cond.guard.type;
            }
          }

          const isTargetQuestion = metadata.questions.some(q => q.id === cond.target);
          const targetId = isTargetQuestion ? cond.target : 'COMPLETED_STATE';

          rawEdges.push({
            id: `${state.id}-${targetId}-${idx}`,
            source: state.id,
            target: targetId,
            label: label,
            reconnectable: true,
            labelStyle: { fill: edgeColorCond, fontSize: 9, fontWeight: 600 },
            style: { stroke: edgeColorCond, strokeWidth: 1.5, strokeDasharray: '4 4' },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorCond, width: 15, height: 15 },
          });
        });
      }

      // 遷移先も固定次遷移もなく、終了条件もないノードは、完了状態に繋ぐ
      const hasNext = state.nextQuestionKey || (state.nextConditions && state.nextConditions.length > 0);
      if (!hasNext) {
        rawEdges.push({
          id: `${state.id}-COMPLETED_STATE-end`,
          source: state.id,
          target: 'COMPLETED_STATE',
          reconnectable: true,
          style: { stroke: edgeColorEnd, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorEnd, width: 20, height: 20 },
        });
      }
    });

    const layoutedNodes = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(rawEdges);
  }, [metadata, setNodes, setEdges, resolvedTheme]);

  // 外部からのメタデータ更新を監視し、履歴をクリアする
  useEffect(() => {
    if (!metadata) return;
    const metadataStr = JSON.stringify(metadata);
    if (metadataStr !== lastSelfChangedMetadata) {
      setUndoStack([]);
      setRedoStack([]);
      setLastSelfChangedMetadata(null);
    }
  }, [metadata, lastSelfChangedMetadata]);

  // 元に戻す (Undo) 処理
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !metadata || !onMetadataChange) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack(prev => [...prev, metadata]);
    setUndoStack(newUndoStack);

    const prevStr = JSON.stringify(previous);
    setLastSelfChangedMetadata(prevStr);

    onMetadataChange(previous);
  }, [undoStack, metadata, onMetadataChange]);

  // やり直す (Redo) 処理
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !metadata || !onMetadataChange) return;

    const next = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack(prev => [...prev, metadata]);
    setRedoStack(newRedoStack);

    const nextStr = JSON.stringify(next);
    setLastSelfChangedMetadata(nextStr);

    onMetadataChange(next);
  }, [redoStack, metadata, onMetadataChange]);

  // エッジの繋ぎ替えを検出した際に、親のメタデータに書き戻すロジック
  const updateMetadataTransition = useCallback((sourceId: string, oldTargetId: string, newTargetId: string) => {
    if (!metadata || !onMetadataChange) return;

    // ディープコピーの作成
    const newMetadata = JSON.parse(JSON.stringify(metadata)) as FrontendMetadata;
    const state = newMetadata.flow.states.find(s => s.id === sourceId);
    if (!state) return;

    const targetVal = newTargetId === 'COMPLETED_STATE' ? '' : newTargetId;

    // A. 固定次遷移 (nextQuestionKey) の更新
    if (state.nextQuestionKey === oldTargetId || (!state.nextQuestionKey && oldTargetId === 'COMPLETED_STATE')) {
      state.nextQuestionKey = targetVal;
    } 
    // B. 条件付き遷移 (nextConditions) の更新
    else if (state.nextConditions && state.nextConditions.length > 0) {
      const cond = state.nextConditions.find(c => {
        // questions にないID（COMPLETED_STATEなど）は完了（空文字）と同一視
        const isTargetCompleted = !newMetadata.questions.some(q => q.id === c.target);
        return c.target === oldTargetId || (oldTargetId === 'COMPLETED_STATE' && isTargetCompleted);
      });
      if (cond) {
        cond.target = targetVal;
      }
    }

    // 履歴を保存
    setUndoStack(prev => [...prev, metadata]);
    setRedoStack([]);
    setLastSelfChangedMetadata(JSON.stringify(newMetadata));

    onMetadataChange(newMetadata);
  }, [metadata, onMetadataChange, setUndoStack, setRedoStack, setLastSelfChangedMetadata]);

  // エッジ再接続ハンドラ
  const onReconnect: OnReconnect = useCallback((oldEdge, newConnection) => {
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
    if (oldEdge.target && newConnection.target) {
      updateMetadataTransition(oldEdge.source, oldEdge.target, newConnection.target);
    }
  }, [setEdges, updateMetadataTransition]);

  // メタデータへの新規接続の書き戻しロジック
  const connectMetadataTransition = useCallback((sourceId: string, newTargetId: string) => {
    if (!metadata || !onMetadataChange) return;

    const newMetadata = JSON.parse(JSON.stringify(metadata)) as FrontendMetadata;
    const state = newMetadata.flow.states.find(s => s.id === sourceId);
    if (!state) return;

    const targetVal = newTargetId === 'COMPLETED_STATE' ? '' : newTargetId;
    
    // 新しい接続は固定の次遷移 (nextQuestionKey) を上書き設定する
    state.nextQuestionKey = targetVal;

    // 履歴を保存
    setUndoStack(prev => [...prev, metadata]);
    setRedoStack([]);
    setLastSelfChangedMetadata(JSON.stringify(newMetadata));

    onMetadataChange(newMetadata);
  }, [metadata, onMetadataChange, setUndoStack, setRedoStack, setLastSelfChangedMetadata]);

  // 新規エッジ接続ハンドラ（ドラッグして空のところからノードに新しくつなぐ場合）
  const onConnect = useCallback((connection: any) => {
    const newEdge = {
      ...connection,
      id: `${connection.source}-${connection.target}-next`,
      reconnectable: true,
      style: { stroke: '#a78bfa', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa', width: 20, height: 20 },
    };
    setEdges((eds) => addEdge(newEdge, eds));

    if (connection.source && connection.target) {
      connectMetadataTransition(connection.source, connection.target);
    }
  }, [setEdges, connectMetadataTransition]);

  if (!metadata || !metadata.questions || metadata.questions.length === 0 || !metadata.flow) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-xs py-12">
        一問一答質問マニフェスト定義がありません
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[450px] bg-slate-950 flex flex-col">
      {/* 情報ラベル */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg flex flex-col">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">アプリプレビュー (編集可)</span>
        <span className="text-[9px] text-slate-500 font-medium">ノードの端を結んで新規接続、または矢印をドラッグしてつなぎ替えられます</span>
      </div>

      {/* 履歴操作（Undo / Redo）ツールバー */}
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg">
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
            undoStack.length > 0
              ? 'bg-slate-850 border-slate-700 text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 active:scale-95'
              : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
          }`}
          title="元に戻す (Undo)"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
            redoStack.length > 0
              ? 'bg-slate-850 border-slate-700 text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 active:scale-95'
              : 'bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed opacity-40'
          }`}
          title="やり直す (Redo)"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* React Flow */}
      <div className="flex-1 w-full h-full min-h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onReconnect={onReconnect}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          colorMode={resolvedTheme}
        >
          <Controls className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg" />
          <MiniMap
            className="bg-slate-900 border border-slate-700/50 rounded-xl"
            style={{
              background: 'var(--color-slate-800)',
            }}
            nodeColor={(node) => {
              if (node.style?.borderColor) return node.style.borderColor as string;
              return 'var(--color-purple-400)';
            }}
            nodeStrokeColor={resolvedTheme === 'dark' ? '#ffffff' : '#000000'}
            nodeStrokeWidth={4}
            maskColor={resolvedTheme === 'dark' ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)'}
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="var(--bg-grid-dots)" />
        </ReactFlow>
      </div>
    </div>
  );
};
