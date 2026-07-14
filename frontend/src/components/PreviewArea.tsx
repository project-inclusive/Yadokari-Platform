import React from 'react';
import type { BackendMetadata, FrontendMetadata } from '../types/metadata';
import { LogicFlow } from './LogicFlow';
import { AppSimulator } from './AppSimulator';

interface PreviewAreaProps {
  backendMetadata: BackendMetadata | null;
  frontendMetadata: FrontendMetadata | null;
  jsonParseError?: string | null;
  rawJsonString?: string | null;
  activeTab: 'flow' | 'preview' | 'json';
  setActiveTab: (tab: 'flow' | 'preview' | 'json') => void;
  onFrontendMetadataChange?: (newMetadata: FrontendMetadata) => void;
  resolvedTheme: 'light' | 'dark';
}

export const PreviewArea: React.FC<PreviewAreaProps> = ({
  backendMetadata,
  frontendMetadata,
  jsonParseError,
  rawJsonString,
  activeTab,
  setActiveTab,
  onFrontendMetadataChange,
  resolvedTheme
}) => {
  const hasData = backendMetadata || frontendMetadata || !!rawJsonString;

  return (
    <div id="preview-area" className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* タブヘッダー */}
      <div id="preview-tab-header" className="px-5 bg-slate-900/60 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex space-x-6">
          <button
            id="tab-btn-flow"
            onClick={() => setActiveTab('flow')}
            className={`py-3.5 text-xs font-semibold border-b-2 transition-all relative ${
              activeTab === 'flow'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ロジック可視化
            {activeTab === 'flow' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
            )}
          </button>

          <button
            id="tab-btn-preview"
            onClick={() => setActiveTab('preview')}
            className={`py-3.5 text-xs font-semibold border-b-2 transition-all relative ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            一問一答フロー
            {activeTab === 'preview' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
            )}
          </button>

          <button
            id="tab-btn-json"
            onClick={() => setActiveTab('json')}
            className={`py-3.5 text-xs font-semibold border-b-2 transition-all relative ${
              activeTab === 'json'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            定義データ (JSON)
            {activeTab === 'json' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
            )}
          </button>
        </div>

        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${
            jsonParseError ? 'bg-red-500' : hasData ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'
          }`}></div>
          <span className="text-[10px] text-slate-500 font-mono tracking-wider">
            {jsonParseError ? 'PARSE_ERROR' : hasData ? 'SYNCED' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* エラーアラート領域 */}
      {jsonParseError && (
        <div className="mx-5 mt-4 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 flex flex-col space-y-1 animate-fade-in shrink-0">
          <div className="font-bold flex items-center">
            <span className="mr-1.5">⚠️</span> AIが生成した定義データにエラーがあります
          </div>
          <p className="font-mono text-[10px] bg-red-950/80 p-2 rounded-md border border-red-900/40 mt-1">{jsonParseError}</p>
          <p className="text-[10px] text-red-400 mt-1">※チャットで「JSONの文法エラーを修正して」と指示するか、右側の「定義データ (JSON)」タブで生データを確認してください。</p>
        </div>
      )}

      {/* コンテンツ領域 */}
      <div id="preview-content-area" className={`flex-1 ${activeTab === 'flow' || activeTab === 'preview' ? 'overflow-hidden' : 'p-5 overflow-y-auto'} bg-slate-900/30`}>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-24 text-center">
            <svg className="w-12 h-12 mb-3 stroke-current text-slate-600" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <p className="font-semibold text-slate-400">プレビューする定義データがありません</p>
            <p className="text-slate-600 mt-1 max-w-[280px]">
              左側のコンソールでAIに話しかけて、制度設計（メタデータ）の生成を開始してください。
            </p>
          </div>
        ) : (
          <div className="h-full">
            {activeTab === 'flow' && (
              <LogicFlow metadata={backendMetadata} resolvedTheme={resolvedTheme} />
            )}

            {activeTab === 'preview' && (
              <AppSimulator metadata={frontendMetadata} onMetadataChange={onFrontendMetadataChange} resolvedTheme={resolvedTheme} />
            )}

            {activeTab === 'json' && (
              <div className="space-y-6 h-full flex flex-col">
                {jsonParseError && rawJsonString && (
                  <div className="flex-1 flex flex-col min-h-[200px]">
                    <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>
                      構文エラーが発生した生のJSONデータ
                    </h4>
                    <pre className="flex-1 bg-red-950/15 border border-red-900/40 rounded-xl p-3 text-[10px] font-mono text-red-200 overflow-auto select-all max-h-[450px]">
                      {rawJsonString}
                    </pre>
                  </div>
                )}

                {!jsonParseError && (
                  <>
                    {/* バックエンドメタデータ表示 */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2"></span>
                        バックエンド設計メタデータ (OpenFisca)
                      </h4>
                      <pre className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-mono text-indigo-300 overflow-auto select-all max-h-[200px]">
                        {backendMetadata ? JSON.stringify(backendMetadata, null, 2) : '// データなし'}
                      </pre>
                    </div>

                    {/* フロントエンドメタデータ表示 */}
                    <div className="flex-1 flex flex-col min-h-[200px]">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2"></span>
                        フロントエンド質問マニフェスト (GUI)
                      </h4>
                      <pre className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-mono text-purple-300 overflow-auto select-all max-h-[200px]">
                        {frontendMetadata ? JSON.stringify(frontendMetadata, null, 2) : '// データなし'}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
