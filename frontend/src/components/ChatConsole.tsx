import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types/metadata';

interface ChatConsoleProps {
  chatHistory: ChatMessage[];
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSendMessage: (message: string, model: string) => Promise<void>;
  onClearHistory: () => void;
  isGenerating: boolean;
  onScrapeUrl: (url: string) => Promise<string>;
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  chatHistory,
  projectName,
  onProjectNameChange,
  onSendMessage,
  onClearHistory,
  isGenerating,
  onScrapeUrl
}) => {
  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim(), selectedModel);
    setInput('');
  };

  const handleScrape = async () => {
    if (!urlInput.trim() || isScraping) return;
    setIsScraping(true);
    setScrapeError(null);
    try {
      const textContent = await onScrapeUrl(urlInput.trim());
      // 取得したテキストをチャットのプロンプトに差し込む
      setInput(prev => {
        const prefix = prev ? prev + '\n\n' : '';
        return `${prefix}以下のURLから取得した制度情報に基づいて、計算ロジックと一問一答フローを生成・修正してください。\n\n【取得テキスト】\n${textContent.slice(0, 3000)}`;
      });
      setUrlInput('');
    } catch (err: any) {
      setScrapeError(err.message || 'URLの読み込みに失敗しました。CORS制限またはサーバーエラーの可能性があります。');
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* ヘッダーエリア */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex-1 min-w-0 mr-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="無題のカスタムアプリ"
            className="w-full bg-transparent text-sm font-semibold text-slate-100 placeholder-slate-500 border-0 focus:ring-0 focus:outline-none p-0"
          />
          <div className="text-[10px] text-indigo-400 font-medium">YADOKARI PLATFORM CONSOLE</div>
        </div>

        <div className="flex items-center space-x-2">
          {/* モデル選択 */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-800 text-slate-300 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="openai/gpt-oss-120b">GPT OSS 120B (高性能)</option>
            <option value="google/gemma-4-31b-it:free">Gemma 4 31B IT (無料)</option>
            <option value="google/gemini-1.5-flash">Gemini 1.5 Flash (高速)</option>
            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (高精度)</option>
            <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
          </select>

          <button
            onClick={onClearHistory}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            title="チャット履歴をクリア"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* URLスクレイパーバー */}
      <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-900 flex flex-col space-y-1.5 shrink-0">
        <div className="flex items-center space-x-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="制度説明が記載されているURLを入力して読み込み..."
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
          />
          <button
            onClick={handleScrape}
            disabled={isScraping || !urlInput.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center shrink-0"
          >
            {isScraping ? (
              <>
                <svg className="animate-spin h-3 w-3 mr-1.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                読込中...
              </>
            ) : (
              'URL読込'
            )}
          </button>
        </div>
        {scrapeError && (
          <div className="text-[10px] text-red-400 font-medium">{scrapeError}</div>
        )}
      </div>

      {/* メッセージ表示エリア */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-900/30">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs space-y-3 text-center px-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-900/30 flex items-center justify-center text-indigo-400">
              💡
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-300">ヤドカリプラットフォームへようこそ！</p>
              <p className="text-slate-400">上のバーから制度のURLをインポートするか、<br/>下記のようにAIへ直接話しかけて作成を開始してください。</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left space-y-2 text-slate-400 w-full max-w-[340px]">
              <button 
                onClick={() => setInput('子育て世代向けに、3歳未満なら月額15,000円、それ以上なら月額10,000円が支給される「子育て支援手当」を作ってください。所得制限は世帯合計年収で960万円です。')} 
                className="w-full text-left text-[11px] hover:text-indigo-300 transition-colors truncate"
              >
                📝 「子育て支援手当のロジックを作って...」
              </button>
              <button 
                onClick={() => setInput('現在作っている手当に、子どもが3人以上いる世帯には1人あたり月額5,000円の加算を設けるよう、条件分岐を追加して。')}
                className="w-full text-left text-[11px] hover:text-indigo-300 transition-colors truncate"
              >
                🔧 「子どもが3人以上の多子加算を追加して...」
              </button>
            </div>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-md ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-850 border border-slate-850 text-slate-200 rounded-tl-none font-sans'
                }`}
              >
                {/* メッセージ内にJSONが含まれている場合、コードブロックを除外して表示するか、折りたたむようにする */}
                <MessageContent content={msg.content} />
              </div>
            </div>
          ))
        )}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-slate-850 border border-slate-800 text-slate-400 rounded-2xl rounded-tl-none px-4 py-3 text-xs shadow-md flex items-center space-x-2">
              <svg className="animate-spin h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>AIが制度・GUIマニフェストを設計中...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-900 shrink-0">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="AIに制度の設計・追加や、GUIの修正指示を送る..."
            rows={1}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-600 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none max-h-24 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs rounded-xl shadow-lg transition-all duration-200 shrink-0 flex items-center justify-center self-end"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
};

// メッセージ内の巨大なJSONブロックを美しく非表示/折りたたむための内部コンポーネント
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const jsonRegex = /```json\s*([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = jsonRegex.exec(content)) !== null) {
    // マッチ前のテキストを追加
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex} className="whitespace-pre-wrap">{content.substring(lastIndex, match.index)}</span>);
    }

    // JSONブロックを折りたたみ式UIとして追加
    const jsonStr = match[1];
    const key = match.index;
    parts.push(
      <details key={key} className="my-2 bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden text-[11px] font-mono">
        <summary className="px-3 py-2 bg-slate-950 text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer select-none">
          ⚙ 生成された定義データ (JSON) を見る
        </summary>
        <div className="p-3 overflow-x-auto text-slate-300 border-t border-slate-800 max-h-60">
          <pre>{jsonStr}</pre>
        </div>
      </details>
    );

    lastIndex = jsonRegex.lastIndex;
  }

  // 残りのテキストを追加
  if (lastIndex < content.length) {
    parts.push(<span key={lastIndex} className="whitespace-pre-wrap">{content.substring(lastIndex)}</span>);
  }

  return <div className="space-y-1">{parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{content}</span>}</div>;
};
