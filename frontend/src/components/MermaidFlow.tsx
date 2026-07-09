import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import type { BackendMetadata } from '../types/metadata';

// Mermaidの初期化
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  themeVariables: {
    background: '#0f172a',
    primaryColor: '#6366f1',
    primaryTextColor: '#f3f4f6',
    lineColor: '#475569',
  }
});

interface MermaidFlowProps {
  metadata: BackendMetadata | null;
}

export const MermaidFlow: React.FC<MermaidFlowProps> = ({ metadata }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedVariableIndex, setSelectedVariableIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // メタデータからMermaid記法のコードを生成する
  const generateMermaidCode = (): string | null => {
    if (!metadata || !metadata.variables || metadata.variables.length === 0) {
      return null;
    }

    const variable = metadata.variables[selectedVariableIndex];
    if (!variable || !variable.formulas) return null;

    // 最新の適用開始日のformulaを使用する
    const formulaDates = Object.keys(variable.formulas);
    if (formulaDates.length === 0) return null;
    
    // 日付順にソートして最新のものを選択
    formulaDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const formula = variable.formulas[formulaDates[0]];
    
    if (!formula || !formula.nodes) return null;

    let code = 'graph TD\n';
    
    // スタイル定義
    code += '  classDef conditional fill:#1e1b4b,stroke:#4f46e5,stroke-width:2px,color:#e0e7ff;\n';
    code += '  classDef assignment fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f1f5f9;\n';
    code += '  classDef returnNode fill:#064e3b,stroke:#059669,stroke-width:2px,color:#ecfdf5;\n';
    code += '  classDef startNode fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#e0e7ff;\n';

    const startNodeName = formula.start_node;

    // 各ノードをMermaid記法へ変換
    Object.entries(formula.nodes).forEach(([nodeName, node]) => {
      // Mermaidがパースできる形式にノード名やテキストをエスケープ
      const escapedNodeName = nodeName.replace(/"/g, '\\"');
      
      if (node.type === 'conditional') {
        const condText = node.condition ? node.condition.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        code += `  ${nodeName}{"${escapedNodeName}<br/>[条件: ${condText}]"}\n`;
        code += `  class ${nodeName} conditional;\n`;
        
        if (node.true_node) {
          code += `  ${nodeName} -->|はい| ${node.true_node}\n`;
        }
        if (node.false_node) {
          code += `  ${nodeName} -->|いいえ| ${node.false_node}\n`;
        }
      } else if (node.type === 'assignment') {
        const exprText = node.expression ? node.expression.replace(/"/g, '\\"') : '';
        code += `  ${nodeName}["${escapedNodeName}<br/>(代入: ${node.target} = ${exprText})"]\n`;
        code += `  class ${nodeName} assignment;\n`;
        
        if (node.next_node) {
          code += `  ${nodeName} --> ${node.next_node}\n`;
        }
      } else if (node.type === 'return') {
        const exprText = node.expression ? node.expression.replace(/"/g, '\\"') : '';
        code += `  ${nodeName}(["結果返却: ${exprText}"])\n`;
        code += `  class ${nodeName} returnNode;\n`;
      }

      // 開始ノードの追加スタイル
      if (nodeName === startNodeName) {
        code += `  class ${nodeName} startNode;\n`;
      }
    });

    return code;
  };

  useEffect(() => {
    const code = generateMermaidCode();
    if (!code) {
      setSvg('');
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);
        // 重複しない一意のID
        const id = `mermaid-svg-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
      } catch (err: any) {
        console.error('Failed to render Mermaid diagram:', err);
        setError('フローチャートの描画に失敗しました。ロジックの定義が不完全な可能性があります。');
        setSvg('');
      }
    };

    renderDiagram();
  }, [metadata, selectedVariableIndex]);

  if (!metadata || !metadata.variables || metadata.variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm py-12">
        <svg className="w-8 h-8 mb-2 stroke-current" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
        <span>バックエンドのロジックが生成されると、ここにフローチャートが表示されます。</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {metadata.variables.length > 0 && (
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-400 font-medium">可視化する変数:</label>
          <select
            value={selectedVariableIndex}
            onChange={(e) => setSelectedVariableIndex(Number(e.target.value))}
            className="bg-slate-800 text-xs border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {metadata.variables.map((v, index) => (
              <option key={v.name} value={index}>{v.name} ({v.label})</option>
            ))}
          </select>
        </div>
      )}

      {error ? (
        <div className="bg-red-950/50 border border-red-900 text-red-300 p-3 rounded-lg text-xs">
          {error}
        </div>
      ) : (
        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-auto flex items-center justify-center min-h-[300px]">
          <div 
            ref={containerRef}
            className="mermaid-wrapper text-slate-200" 
            dangerouslySetInnerHTML={{ __html: svg }} 
          />
        </div>
      )}
    </div>
  );
};
