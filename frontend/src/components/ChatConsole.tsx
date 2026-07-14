import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types/metadata';

interface ChatConsoleProps {
  chatHistory: ChatMessage[];
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onSendMessage: (
    message: string,
    model: string,
    overridePhase?: 'logic' | 'questions',
    displayMessage?: string
  ) => Promise<void>;
  onClearHistory: () => void;
  isGenerating: boolean;
  onScrapeUrl: (url: string) => Promise<string>;
  
  // ワークフローフェーズ用
  currentPhase: 'logic' | 'questions';
  logicConfirmed: boolean;
  questionsConfirmed: boolean;
  hasLogicData: boolean;
  hasQuestionsData: boolean;
  onConfirmLogic: () => void;
  onModifyLogic: () => void;
  onConfirmQuestions: () => void;
  onModifyQuestions: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  chatHistory,
  projectName,
  onProjectNameChange,
  onSendMessage,
  onClearHistory,
  isGenerating,
  onScrapeUrl,
  currentPhase,
  logicConfirmed,
  questionsConfirmed,
  hasLogicData,
  hasQuestionsData,
  onConfirmLogic,
  onModifyLogic,
  onConfirmQuestions,
  onModifyQuestions,
  selectedModel,
  setSelectedModel
}) => {
  const [input, setInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevScrollTopRef = useRef(0);

  useEffect(() => {
    if (isAtBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [chatHistory, isGenerating]);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    
    // ユーザーが上方向にスクロールしたか
    const isScrollingUp = scrollTop < prevScrollTopRef.current;
    
    // 最下部に到達したか（誤差15px）
    const isBottom = maxScroll - scrollTop < 15;

    if (isScrollingUp) {
      isAtBottomRef.current = false;
    } else if (isBottom) {
      isAtBottomRef.current = true;
    }

    prevScrollTopRef.current = scrollTop;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    isAtBottomRef.current = true;
    
    const container = chatContainerRef.current;
    if (container) {
      prevScrollTopRef.current = container.scrollHeight - container.clientHeight;
    }
    
    onSendMessage(input.trim(), selectedModel);
    setInput('');
  };

  const handleScrape = async () => {
    if (!urlInput.trim() || isScraping) return;
    
    const urls = urlInput.trim().split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return;

    const hasPdf = urls.some(u => u.toLowerCase().endsWith('.pdf'));
    if (hasPdf) {
      setScrapeError('PDFファイルからのテキスト自動読み込みには現在対応していません。お手数ですが、PDFのテキスト内容をコピーして、メッセージ欄に直接貼り付けて送信してください。');
      return;
    }

    setIsScraping(true);
    setScrapeError(null);
    try {
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const text = await onScrapeUrl(url);
            return { url, text, success: true, error: null };
          } catch (err: any) {
            return { url, text: '', success: false, error: err.message || '読み込み失敗' };
          }
        })
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        const errorMsg = failed.map(f => `${f.url}: ${f.error}`).join('\n');
        throw new Error(`以下のURLの読み込みに失敗しました：\n${errorMsg}`);
      }

      const combinedText = results.map(r => `■ URL: ${r.url}\n${r.text}`).join('\n\n');
      const userMessageText = `以下の制度情報に基づいて、計算ロジックを生成・修正してください。\n\n【制度情報（抽出済）】\n${combinedText}`;
      
      const displayMessageText = `制度説明HP (${urls.length}件のURL) から情報を読み込みました。\n${urls.map(u => `- ${u}`).join('\n')}`;
      
      await onSendMessage(userMessageText, selectedModel, 'logic', displayMessageText);
      setUrlInput('');
    } catch (err: any) {
      setScrapeError(err.message || 'URLの読み込みまたはメタデータ生成に失敗しました。');
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div id="chat-console" className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* ヘッダーエリア */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div id="project-name-input" className="flex-1 min-w-0 mr-3">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="制度名を入力（例：子育て特別手当、生活保護など）"
            className="w-full bg-transparent text-sm font-semibold text-slate-100 placeholder-slate-500 border-0 focus:ring-0 focus:outline-none p-0"
          />
          <div className="text-[10px] text-indigo-400 font-medium">YADOKARI PLATFORM CONSOLE</div>
        </div>

        <div className="flex items-center space-x-2">
          {/* モデル選択 */}
          <label htmlFor="model-selector" className="text-xs text-slate-400 font-medium whitespace-nowrap">AIモデル</label>
          <select
            id="model-selector"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-800 text-slate-300 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="z-ai/glm-5.2">GLM 5.2 (推奨)</option>
            <option value="openai/gpt-5.4-mini">GPT 5.4 Mini</option>
            <option value="deepseek/deepseek-v4-pro">DeepSeek V4 Pro</option>
            <option value="google/gemini-3.5-flash">Gemini 3.5 Flash</option>
            <option value="openai/gpt-oss-120b">GPT OSS 120B (高品質)</option>
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

      {/* ワークフローフェーズパネル */}
      <div id="workflow-phase-panel" className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 tracking-wider">フェーズ進捗</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* ロジックフェーズカード */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentPhase === 'logic' 
              ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
              : logicConfirmed 
                ? 'bg-slate-900 border-emerald-500/30 opacity-80' 
                : 'bg-slate-950/40 border-slate-800/80 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-bold ${
                currentPhase === 'logic' ? 'text-indigo-400' : logicConfirmed ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                1. 計算ロジック
              </span>
              {logicConfirmed && <span className="text-emerald-400 text-[10px] font-bold">✓ 確定</span>}
            </div>
            <p className="text-[9px] text-slate-500 mb-2 leading-relaxed">
              まずは制度の計算ロジック（バックエンド）を定義します。
            </p>
            <div className="flex space-x-2">
              <button
                type="button"
                disabled={!hasLogicData || isGenerating}
                onClick={onModifyLogic}
                className="flex-1 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                修正
              </button>
              <button
                type="button"
                disabled={!hasLogicData || currentPhase !== 'logic' || isGenerating}
                onClick={onConfirmLogic}
                className="flex-1 py-1 rounded-lg bg-indigo-600 text-[10px] font-bold text-white hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                確定
              </button>
            </div>
          </div>

          {/* 質問フェーズカード */}
          <div className={`p-3 rounded-xl border transition-all ${
            currentPhase === 'questions' 
              ? 'bg-purple-950/20 border-purple-500/50 shadow-md shadow-purple-500/5' 
              : questionsConfirmed 
                ? 'bg-slate-900 border-emerald-500/30 opacity-80' 
                : 'bg-slate-950/40 border-slate-800/80 opacity-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-bold ${
                currentPhase === 'questions' ? 'text-purple-400' : questionsConfirmed ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                2. ユーザーへの質問
              </span>
              {questionsConfirmed && <span className="text-emerald-400 text-[10px] font-bold">✓ 確定</span>}
            </div>
            <p className="text-[9px] text-slate-500 mb-2 leading-relaxed">
              一問一答画面（フロントマニフェスト）を定義します。
            </p>
            <div className="flex space-x-2">
              <button
                type="button"
                disabled={!hasQuestionsData || currentPhase !== 'questions' || isGenerating}
                onClick={onModifyQuestions}
                className="flex-1 py-1 rounded-lg border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                修正
              </button>
              <button
                type="button"
                disabled={!hasQuestionsData || currentPhase !== 'questions' || isGenerating}
                onClick={onConfirmQuestions}
                className="flex-1 py-1 rounded-lg bg-purple-600 text-[10px] font-bold text-white hover:bg-purple-500 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* メッセージ表示エリア */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-900/30"
      >
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs space-y-3 text-center px-4 py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/40 border border-indigo-900/30 flex items-center justify-center text-indigo-400">
              💡
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-300">ヤドカリプラットフォームへようこそ！</p>
              <p className="text-slate-400">メッセージ欄の上のフォームから制度のURLをインポートするか、<br/>下記のようにAIへ直接話しかけて作成を開始してください。</p>
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
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.displayContent || msg.content}</span>
                ) : (
                  <MessageContent
                    content={msg.content}
                    isLast={index === chatHistory.length - 1}
                    isGenerating={isGenerating}
                  />
                )}
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

      {/* URLスクレイパーバー */}
      <div id="url-scraper-bar" className="px-5 py-2.5 bg-slate-950 border-t border-slate-900 flex flex-col space-y-1.5 shrink-0">
        <div className="flex items-start space-x-2">
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="制度説明が記載されているURLを入力して読み込み...（複数ある場合は改行して入力）"
            rows={Math.min(Math.max(urlInput.split('\n').length, 1), 5)}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 resize-none max-h-32 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleScrape();
              }
            }}
          />
          <button
            onClick={handleScrape}
            disabled={isScraping || !urlInput.trim()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center shrink-0 self-end"
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
          <div className="text-[10px] text-red-400 font-medium whitespace-pre-wrap">{scrapeError}</div>
        )}
      </div>

      {/* 入力フォーム */}
      <form id="chat-input-form" onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-900 shrink-0">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="AIに制度の設計・追加や、GUIの修正指示を送る..."
            rows={Math.min(Math.max(input.split('\n').length, 1), 8)}
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-600 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none max-h-60 overflow-y-auto transition-all duration-150"
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

// メッセージ内の巨大なJSONブロックを非表示にするための内部コンポーネント
const MessageContent: React.FC<{ content: string; isLast: boolean; isGenerating: boolean }> = ({ content, isLast, isGenerating }) => {
  const cleanContent = (text: string): string => {
    let cleaned = text;

    // 1. ```json ... ``` のブロックを除去
    cleaned = cleaned.replace(/```json\s*([\s\S]*?)(?:```|$)/g, '');

    // 2. もし残ったテキストが `{` で始まっている場合（生JSON）、または元のテキストが `{` で始まっている場合、全体を除去
    if (cleaned.trim().startsWith('{') || text.trim().startsWith('{')) {
      cleaned = '';
    }

    return cleaned.trim();
  };

  const parseInlineMarkdown = (text: string) => {
    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldIndex = remaining.indexOf('**');
      const codeIndex = remaining.indexOf('`');

      if (boldIndex === -1 && codeIndex === -1) {
        parts.push(remaining);
        break;
      }

      const isBoldFirst = boldIndex !== -1 && (codeIndex === -1 || boldIndex < codeIndex);

      if (isBoldFirst) {
        if (boldIndex > 0) {
          parts.push(remaining.substring(0, boldIndex));
        }
        remaining = remaining.substring(boldIndex + 2);
        const closeBoldIndex = remaining.indexOf('**');
        if (closeBoldIndex !== -1) {
          parts.push(
            <strong key={key++} className="font-semibold text-slate-100">
              {remaining.substring(0, closeBoldIndex)}
            </strong>
          );
          remaining = remaining.substring(closeBoldIndex + 2);
        } else {
          parts.push('**' + remaining);
          break;
        }
      } else {
        if (codeIndex > 0) {
          parts.push(remaining.substring(0, codeIndex));
        }
        remaining = remaining.substring(codeIndex + 1);
        const closeCodeIndex = remaining.indexOf('`');
        if (closeCodeIndex !== -1) {
          parts.push(
            <code key={key++} className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded font-mono text-[10px]">
              {remaining.substring(0, closeCodeIndex)}
            </code>
          );
          remaining = remaining.substring(closeCodeIndex + 1);
        } else {
          parts.push('`' + remaining);
          break;
        }
      }
    }

    return parts.length === 0 ? text : parts;
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // 1. Horizontal Rule
      if (line.trim() === '---') {
        return <hr key={index} className="my-3 border-t border-slate-800" />;
      }

      // 2. Headings (e.g., ### Heading)
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const headingClass = 
          level === 1 ? "text-sm font-bold mt-2.5 mb-1.5 text-indigo-400" :
          level === 2 ? "text-xs font-bold mt-2 mb-1 text-slate-200" :
          "text-[11px] font-bold mt-1.5 mb-1 text-slate-300";
        return <div key={index} className={headingClass}>{parseInlineMarkdown(headingText)}</div>;
      }

      // 3. Unordered list items (e.g., - item or * item)
      const listMatch = line.match(/^[-*]\s+(.*)$/);
      if (listMatch) {
        const listText = listMatch[1];
        return (
          <li key={index} className="ml-4 list-disc my-0.5 text-slate-300">
            {parseInlineMarkdown(listText)}
          </li>
        );
      }

      // 4. Default paragraph line
      return (
        <p key={index} className="my-0.5 min-h-[1em] text-slate-250">
          {parseInlineMarkdown(line)}
        </p>
      );
    });
  };

  const cleaned = cleanContent(content);

  if (!cleaned) {
    if (isLast && isGenerating) {
      return (
        <div className="flex items-center space-x-1.5 text-slate-400 italic">
          <svg className="animate-spin h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>定義データを設計中...</span>
        </div>
      );
    }
    return <span className="text-slate-400 italic">⚙️ 定義データを生成・更新しました。詳細は右側の「定義データ」タブおよびプレビューを確認してください。</span>;
  }

  return <div className="space-y-0.5">{renderMarkdown(cleaned)}</div>;
};
