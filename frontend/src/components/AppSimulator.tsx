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

const estimateNodeHeight = (label: string): number => {
  if (!label) return 60;
  const lines = label.split('\n');
  let totalLines = 0;
  for (const line of lines) {
    let lineLength = 0;
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code >= 0x00 && code <= 0x7f) {
        lineLength += 0.5; // 半角文字
      } else {
        lineLength += 1.0; // 全角文字
      }
    }
    // 幅220px (実質描画幅188px) に対して、フォントサイズ11pxなので1行約17文字
    const wrappedLines = Math.max(1, Math.ceil(lineLength / 17));
    totalLines += wrappedLines;
  }
  // padding (32px) + border (4px) = 36px
  // 1行の高さ 16.5px (fontSize 11px * lineHeight 1.5)
  // バッファとして + 12px
  return 36 + (totalLines * 16.5) + 12;
};

// dagre 自動レイアウト関数
const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: 60, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 240;

  const nodesWithHeight = nodes.map((node) => {
    const label = (node.data?.label as string) || '';
    const height = estimateNodeHeight(label);
    return { ...node, height };
  });

  nodesWithHeight.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: node.height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodesWithHeight.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - node.height / 2,
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
  } else if (type === 'member_transition') {
    baseStyle.borderColor = 'var(--color-amber-500)';
    baseStyle.background = 'var(--color-amber-950)';
  } else if (type === 'transition') {
    baseStyle.borderColor = 'var(--color-slate-500)';
    baseStyle.background = 'var(--color-slate-800)';
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
    const startStateId = metadata.flow.start_state || (metadata.questions[0]?.id);

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

    // 2. 状態遷移 (Flow) の中の「メンバー遷移」や、その他のフロー定義上のノードを追加
    const nodeIds = new Set(rawNodes.map(n => n.id));

    metadata.flow.states.forEach((state) => {
      if (state.type === 'member_transition') {
        const actionLabel = state.action === 'start' ? 'ループ開始' : '次の世帯員へ';
        const label = `🔄 世帯員定義: ${state.relation || ''}\n(${actionLabel})`;
        
        rawNodes.push({
          id: state.id,
          type: 'question',
          data: { label, qType: 'member_transition', isStart: state.id === startStateId },
          style: { width: 220 },
          position: { x: 0, y: 0 },
        });
        nodeIds.add(state.id);
      } else if (!nodeIds.has(state.id)) {
        // それ以外のカスタム状態ノードがあれば追加
        const label = `⚙️ 状態遷移: ${state.id}`;
        rawNodes.push({
          id: state.id,
          type: 'question',
          data: { label, qType: 'transition', isStart: state.id === startStateId },
          style: { width: 220 },
          position: { x: 0, y: 0 },
        });
        nodeIds.add(state.id);
      }
    });

    // 特別な「結果判定・完了」ノードを追加
    if (!nodeIds.has('COMPLETED_STATE')) {
      rawNodes.push({
        id: 'COMPLETED_STATE',
        type: 'question',
        data: { label: '🏁 シミュレーション終了\n(判定結果出力)', qType: 'completed', isStart: false },
        style: { width: 220 },
        position: { x: 0, y: 0 },
      });
      nodeIds.add('COMPLETED_STATE');
    }

    const isDarkMode = resolvedTheme === 'dark';
    const edgeColorNext = isDarkMode ? '#a78bfa' : '#7c3aed';
    const edgeColorCond = isDarkMode ? '#38bdf8' : '#0284c7';
    const edgeColorEnd = isDarkMode ? '#10b981' : '#059669';

    // 接続の追跡用マップ
    const outEdgesCount = new Map<string, number>();
    rawNodes.forEach(n => outEdgesCount.set(n.id, 0));

    const addEdgeWithTracking = (source: string, edgeObj: FlowEdge) => {
      rawEdges.push(edgeObj);
      outEdgesCount.set(source, (outEdgesCount.get(source) || 0) + 1);
    };

    // 3. 状態遷移 (Flow) からエッジを構築
    metadata.flow.states.forEach((state) => {
      // A. 固定の次遷移
      if (state.nextQuestionKey) {
        const targetId = nodeIds.has(state.nextQuestionKey) ? state.nextQuestionKey : 'COMPLETED_STATE';
        addEdgeWithTracking(state.id, {
          id: `${state.id}-${targetId}-next`,
          source: state.id,
          target: targetId,
          reconnectable: true,
          style: { stroke: edgeColorNext, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorNext, width: 20, height: 20 },
        });
      }

      // B. 条件付き遷移
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
            } else if (cond.guard.type === 'value_check') {
              label = `値: ${cond.guard.value || ''}`;
            } else {
              label = cond.guard.type;
            }
          }

          const targetId = nodeIds.has(cond.target) ? cond.target : 'COMPLETED_STATE';
          addEdgeWithTracking(state.id, {
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
    });

    // 4. 遷移先も条件遷移もないノードは、完了状態に繋ぐ
    rawNodes.forEach((node) => {
      if (node.id === 'COMPLETED_STATE') return;
      const count = outEdgesCount.get(node.id) || 0;
      if (count === 0) {
        addEdgeWithTracking(node.id, {
          id: `${node.id}-COMPLETED_STATE-end`,
          source: node.id,
          target: 'COMPLETED_STATE',
          reconnectable: true,
          style: { stroke: edgeColorEnd, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorEnd, width: 20, height: 20 },
        });
      }
    });

    // 5. 孤立ノードを自動修復して接続する (BFS到達性チェックと修復)
    let repaired = true;
    while (repaired) {
      repaired = false;

      // 現在のエッジ状況を基に、開始状態からの到達性をチェック
      const reachable = new Set<string>();
      const queue = [startStateId];
      reachable.add(startStateId);

      const forwardAdj = new Map<string, Set<string>>();
      rawNodes.forEach(node => forwardAdj.set(node.id, new Set()));
      rawEdges.forEach(edge => {
        forwardAdj.get(edge.source)?.add(edge.target);
      });

      let head = 0;
      while (head < queue.length) {
        const u = queue[head++];
        const neighbors = forwardAdj.get(u);
        if (neighbors) {
          for (const v of neighbors) {
            if (!reachable.has(v)) {
              reachable.add(v);
              queue.push(v);
            }
          }
        }
      }

      // 到達不能なノードを探す
      for (const node of rawNodes) {
        if (node.id === 'COMPLETED_STATE') continue;
        if (!reachable.has(node.id)) {
          // 修復対象：このノードへエッジを張る
          let sourceId = startStateId;

          const qIdx = metadata.questions.findIndex(q => q.id === node.id);
          if (qIdx > 0) {
            // 定義順で1つ前の質問から繋ぐ
            sourceId = metadata.questions[qIdx - 1].id;
          } else if (qIdx === 0) {
            sourceId = startStateId;
          } else {
            // 質問ではない（メンバー遷移などの）孤立ノードは、最終質問から繋ぐ
            if (metadata.questions.length > 0) {
              sourceId = metadata.questions[metadata.questions.length - 1].id;
            }
          }

          // デフォルトのエッジを追加して到達可能にする
          addEdgeWithTracking(sourceId, {
            id: `${sourceId}-${node.id}-fallback-repair`,
            source: sourceId,
            target: node.id,
            reconnectable: true,
            style: { stroke: edgeColorNext, strokeWidth: 1.5, strokeDasharray: '2 2' },
            markerEnd: { type: MarkerType.ArrowClosed, color: edgeColorNext, width: 15, height: 15 },
          });

          repaired = true;
          break; // BFSとチェックを再実行するためにループを抜ける
        }
      }
    }

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
    let state = newMetadata.flow.states.find(s => s.id === sourceId);
    if (!state) {
      state = {
        id: sourceId,
        nextQuestionKey: null,
        nextConditions: [],
        type: null,
        relation: null,
        action: null
      };
      newMetadata.flow.states.push(state);
    }

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
    let state = newMetadata.flow.states.find(s => s.id === sourceId);
    if (!state) {
      state = {
        id: sourceId,
        nextQuestionKey: null,
        nextConditions: [],
        type: null,
        relation: null,
        action: null
      };
      newMetadata.flow.states.push(state);
    }

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
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">一問一答フロー (編集可)</span>
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
