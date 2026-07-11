import React, { useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import type {
  Node as FlowNode,
  Edge as FlowEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import type { BackendMetadata, Parameter, FormulaDependencyParameter } from '../types/metadata';

interface LogicFlowProps {
  metadata: BackendMetadata | null;
}

// 接続用ハンドルを備えたカスタムロジックノード
const LogicNode = ({ data, style, id }: any) => {
  const isReturn = id.startsWith('return') || data.label.includes('結果返却') || data.label.includes('✅');
  const cardStyle = getNodeStyle(data.nType, data.isStart);
  return (
    <div style={style} className="relative font-mono">
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: '-4px',
          background: '#818cf8',
          borderRadius: '50%',
          width: '8px',
          height: '8px',
          border: '1px solid #0f172a',
          zIndex: 10
        }}
      />
      
      {/* 装飾されたカード本体 */}
      <div style={cardStyle} className="nodrag whitespace-pre-wrap">
        {data.label}
      </div>
      
      {!isReturn && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            bottom: '-4px',
            background: '#818cf8',
            borderRadius: '50%',
            width: '8px',
            height: '8px',
            border: '1px solid #0f172a',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
};

const nodeTypes = {
  logic: LogicNode,
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

const getNodeStyle = (type: string, isStart: boolean) => {
  const baseStyle: React.CSSProperties = {
    padding: '16px',
    borderRadius: '12px',
    fontSize: '11px',
    color: '#e2e8f0',
    width: 220,
    border: '2px solid #334155',
    background: '#0f172a',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    fontWeight: 500,
    lineHeight: 1.5,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  };

  if (isStart) {
    baseStyle.borderColor = '#818cf8';
    baseStyle.boxShadow = '0 0 15px rgba(99, 102, 241, 0.35)';
  }

  if (type === 'conditional') {
    baseStyle.borderColor = '#4f46e5';
    baseStyle.background = '#1e1b4b';
  } else if (type === 'assignment') {
    baseStyle.borderColor = '#475569';
    baseStyle.background = '#0f172a';
  } else if (type === 'return') {
    baseStyle.borderColor = '#059669';
    baseStyle.background = '#064e3b';
    baseStyle.fontWeight = 700;
  }

  return baseStyle;
};

export const LogicFlow: React.FC<LogicFlowProps> = ({ metadata }) => {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedVariableIndex, setSelectedVariableIndex] = useState<number>(0);

  useEffect(() => {
    if (!metadata || !metadata.variables || metadata.variables.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const variable = metadata.variables[selectedVariableIndex];
    if (!variable || !variable.formulas || variable.formulas.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const sortedFormulas = [...variable.formulas].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const formula = sortedFormulas[0];
    if (!formula || !formula.nodes || formula.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // パラメータ辞書の構築
    const paramMap: Record<string, { value: number; unit?: string }> = {};
    if (metadata.parameters) {
      metadata.parameters.forEach((p: Parameter) => {
        const pathParts = p.path.split('/');
        const keyFromPath = pathParts[pathParts.length - 1];
        if (p.values && p.values.length > 0) {
          const sortedValues = [...p.values].sort((a, b) => b.date.localeCompare(a.date));
          const latestValue = sortedValues[0].value;
          paramMap[keyFromPath] = { value: latestValue, unit: p.unit };
          paramMap[p.path] = { value: latestValue, unit: p.unit };
        }
      });
    }

    if (formula.dependencies && formula.dependencies.parameters) {
      formula.dependencies.parameters.forEach((dp: FormulaDependencyParameter) => {
        const pathParts = dp.path.split('/');
        const keyFromPath = pathParts[pathParts.length - 1];
        const sourceData = paramMap[dp.path] || paramMap[keyFromPath];
        if (sourceData) {
          paramMap[dp.as] = sourceData;
        }
      });
    }

    const formatParameterValue = (value: number, unit?: string): string => {
      if (unit === 'currency-JPY') {
        return `${value.toLocaleString('ja-JP')}円`;
      }
      if (unit === 'year') {
        return `${value}歳`;
      }
      if (unit === 'person') {
        return `${value}人`;
      }
      return String(value);
    };

    const replaceParametersInText = (text: string): string => {
      let result = text;
      const keys = Object.keys(paramMap).sort((a, b) => b.length - a.length);
      const isWordChar = (c: string) => {
        if (!c) return false;
        return /[a-zA-Z0-9_]/.test(c) || c.charCodeAt(0) > 127;
      };

      keys.forEach(key => {
        if (!key) return;
        
        let searchIdx = 0;
        while (true) {
          const idx = result.indexOf(key, searchIdx);
          if (idx === -1) break;
          
          const prevChar = idx > 0 ? result[idx - 1] : '';
          const nextChar = idx + key.length < result.length ? result[idx + key.length] : '';
          
          const isBeforeWord = isWordChar(prevChar);
          const isAfterWord = isWordChar(nextChar);
          
          if (!isBeforeWord && !isAfterWord) {
            const data = paramMap[key];
            const formatted = formatParameterValue(data.value, data.unit);
            const replacement = `${key}(${formatted})`;
            result = result.substring(0, idx) + replacement + result.substring(idx + key.length);
            searchIdx = idx + replacement.length;
          } else {
            searchIdx = idx + key.length;
          }
        }
      });
      return result;
    };

    const rawNodes: FlowNode[] = [];
    const rawEdges: FlowEdge[] = [];
    const startNodeId = formula.start_node;

    formula.nodes.forEach((node) => {
      let label = '';
      if (node.type === 'conditional') {
        const condText = node.condition || '';
        const replaced = replaceParametersInText(condText);
        label = `🔷 ${replaced}`;
      } else if (node.type === 'assignment') {
        const exprText = node.expression || '';
        const replaced = replaceParametersInText(exprText);
        label = `📝 ${node.target} = ${replaced}`;
      } else if (node.type === 'return') {
        const exprText = node.expression || '';
        const replaced = replaceParametersInText(exprText);
        label = `✅ ${replaced}`;
      }

      rawNodes.push({
        id: node.id,
        type: 'logic',
        data: { label, nType: node.type, isStart: node.id === startNodeId },
        style: { width: 220 }, // 外殻はサイズのみ指定して二重装飾を回避
        position: { x: 0, y: 0 },
      });

      if (node.type === 'conditional') {
        if (node.true_node) {
          rawEdges.push({
            id: `${node.id}-${node.true_node}-true`,
            source: node.id,
            target: node.true_node,
            label: 'はい',
            labelStyle: { fill: '#34d399', fontSize: 10, fontWeight: 700 },
            style: { stroke: '#34d399', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#34d399', width: 20, height: 20 },
          });
        }
        if (node.false_node) {
          rawEdges.push({
            id: `${node.id}-${node.false_node}-false`,
            source: node.id,
            target: node.false_node,
            label: 'いいえ',
            labelStyle: { fill: '#f87171', fontSize: 10, fontWeight: 700 },
            style: { stroke: '#f87171', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171', width: 20, height: 20 },
          });
        }
      } else if (node.type === 'assignment' && node.next_node) {
        rawEdges.push({
          id: `${node.id}-${node.next_node}`,
          source: node.id,
          target: node.next_node,
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 20, height: 20 },
        });
      }
    });

    const layoutedNodes = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(rawEdges);
  }, [metadata, selectedVariableIndex]);

  if (!metadata || !metadata.variables || metadata.variables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-xs">
        ロジック定義データがありません
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[450px] bg-slate-950 flex flex-col">
      {/* 変数切り替えコントロールパネル */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">表示変数:</label>
        <select
          value={selectedVariableIndex}
          onChange={(e) => setSelectedVariableIndex(Number(e.target.value))}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-400 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          {metadata.variables.map((v, idx) => (
            <option key={v.name} value={idx}>
              {v.label || v.name} ({v.name})
            </option>
          ))}
        </select>
      </div>

      {/* React Flow グラフレンダラー */}
      <div className="flex-1 w-full h-full min-h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          colorMode="dark"
        >
          <Controls className="bg-slate-900 border border-slate-800 text-slate-300 rounded-lg" />
           <MiniMap
            className="bg-slate-900 border border-slate-700/50 rounded-xl"
            style={{
              background: '#1e293b',
            }}
            nodeColor={(node) => {
              if (node.style?.borderColor) return node.style.borderColor as string;
              return '#6366f1';
            }}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={4}
            maskColor="rgba(15, 23, 42, 0.75)"
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#334155" />
        </ReactFlow>
      </div>
    </div>
  );
};
