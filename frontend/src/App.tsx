import { useState } from 'react';
import type { ProjectState, ChatMessage, BackendMetadata, FrontendMetadata } from './types/metadata';
import { ChatConsole } from './components/ChatConsole';
import { PreviewArea } from './components/PreviewArea';
import { ImportExport } from './components/ImportExport';

const SYSTEM_PROMPT = `
あなたは日本の社会保障・自治体独自の支援制度を定義する「OpenFisca」のバックエンド定義と、それに対応する一問一答フロントエンドGUI（マニフェスト）を同時設計するAIアシスタントです。

ユーザーは新規の制度概要や既存の変更希望を提示します。あなたの使命は次の通りです：
1. 制度の内容を正しく理解し、計算ロジック（フローチャート）を設計すること。
2. その計算に必要なユーザーの入力項目（一問一答フロー）と、OpenFisca変数へのマッピングを設計すること。
3. 自然言語での対話と解説を行い、さらに「必ず1つの \`\`\`json 」コードブロックを出力すること。

### JSON出力スキーマ
出力するJSONは、以下の統合フォーマットに完全に準拠する必要があります。一部の変更であっても、常に「最新の全量データ」を出力してください。

\`\`\`json
{
  "backend": {
    "variables": [
      {
        "name": "日本語の変数名",
        "label": "人間向けの短い説明",
        "documentation": "制度の詳細説明",
        "reference": "法的根拠URLなど",
        "value_type": "float" | "int" | "bool" | "str" | "Enum",
        "possible_values": {}, // Enum型の場合のみ値リスト。キーが英語/値が日本語説明
        "default_value": "デフォルト値",
        "entity": "人物" | "世帯",
        "definition_period": "DAY" | "MONTH" | "YEAR" | "ETERNITY",
        "formulas": {
          "2024-04-01": {
            "dependencies": {
              "variables": [
                { "name": "年齢", "entity": "person", "period": "current", "required": true }
              ],
              "parameters": [
                { "path": "パラメータ：三歳未満支給額", "as": "三歳未満支給額" }
              ]
            },
            "start_node": "開始ノード名",
            "nodes": {
              "ノード名": {
                "type": "conditional" | "assignment" | "return",
                "condition": "条件式（例: 年齢 < 15）",
                "true_node": "真の場合の遷移先ノード名",
                "false_node": "偽の場合の遷移先ノード名",
                "target": "代入先変数名 (assignmentの場合のみ)",
                "expression": "代入値や計算式、または返却値。集約関数(合計, 最大, 最小など)も使用可能 (例: 合計(所得))",
                "next_node": "代入後の遷移先ノード名 (assignmentの場合のみ)"
              }
            }
          }
        }
      }
    ],
    "parameters": [
      {
        "path": "仮の日本語パラメータ名",
        "description": "パラメータの説明",
        "unit": "currency-JPY" | "/1" | "year" | "person",
        "values": {
          "2024-04-01": 15000
        }
      }
    ],
    "tests": [
      {
        "file_path": "openfisca_japan/tests/カテゴリ/テスト名.yaml",
        "test_cases": [
          {
            "name": "テスト名",
            "period": "2024-05",
            "input": {
              "世帯": { "親一覧": ["親１"], "子一覧": ["子１"] },
              "世帯員": { "親１": { "所得": 5000000 }, "子１": { "年齢": 1 } }
            },
            "output": {
              "世帯員": { "子１": { "変数名": { "2024-05": 15000 } } }
            }
          }
        ]
      }
    ]
  },
  "frontend": {
    "app_metadata": {
      "app_title": "○○市 独自支援みつもりヤドカリくん",
      "theme": {
        "primary_color": "#4f46e5"
      }
    },
    "questions": [
      {
        "id": "質問ID（通常は変数名や条件名）",
        "title": "ユーザーに提示する質問テキスト",
        "type": "Selection" | "Address" | "Age" | "PersonNum" | "MultipleSelection",
        "options": ["選択肢1", "選択肢2"],
        "target_entities": ["あなた", "配偶者", "子ども", "親"]
      }
    ],
    "flow": {
      "start_state": "開始する質問ID",
      "states": {
        "質問ID": {
          "nextQuestionKey": "次の質問ID（固定遷移）",
          "nextConditions": [
            {
              "target": "遷移先質問IDまたはループアクション名",
              "guard": {
                "type": "mode_check" | "loop_check" | "has_members",
                "mode": "かんたん見積もり",
                "relation": "子ども",
                "limit_source": "子どもの人数",
                "source": "子どもの人数"
              }
            }
          ]
        },
        "changeToChild": {
          "type": "member_transition",
          "relation": "子ども",
          "action": "start",
          "nextQuestionKey": "年齢"
        },
        "changeToNextChild": {
          "type": "member_transition",
          "relation": "子ども",
          "action": "next",
          "nextQuestionKey": "年齢"
        }
      }
    },
    "openfisca_mapping": [
      {
        "question_id": "質問ID",
        "openfisca_variable": "対応するOpenFiscaの変数名",
        "level": "member" | "household",
        "transform": "age_to_birthdate",
        "scale": 10000,
        "multiple_selection_map": {}
      }
    ]
  }
}
\`\`\`

ユーザーから提供された修正指示に基づいて、backendの定義構造（必要に応じてfrontendも）をインテリジェントに編集・出力してください。「バックエンドのみ」を求められた場合は、backendオブジェクトのみを含むJSONを出力してください。自然言語での対話と説明は簡潔にまとめ、\`\`\`json コードブロックを必ず含めてください。
`;

const YADOKARI_JSON_SCHEMA = {
  type: "json_object"
};

function App() {
  const [projectState, setProjectState] = useState<ProjectState>({
    projectName: '子育て特別手当アプリ',
    chatHistory: [],
    backendMetadata: null,
    frontendMetadata: null,
    jsonParseError: null,
    rawJsonString: null
  });

  const [isGenerating, setIsGenerating] = useState(false);

  const handleProjectNameChange = (name: string) => {
    setProjectState(prev => ({ ...prev, projectName: name }));
  };

  const handleClearHistory = () => {
    if (window.confirm('これまでの対話履歴をリセットしますか？ (生成された定義データは維持されます)')) {
      setProjectState(prev => ({
        ...prev,
        chatHistory: []
      }));
    }
  };

  const handleImport = (importedState: ProjectState) => {
    setProjectState(importedState);
  };

  const handleScrapeUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch content');
      }

      const data = await response.json();
      return data.content;
    } catch (error: any) {
      console.error('Scraping request failed:', error);
      throw new Error(error.message || '接続エラーが発生しました。ローカルBFFサーバーが起動しているか確認してください。');
    }
  };

  interface ParseResult {
    success: boolean;
    backend?: BackendMetadata;
    frontend?: FrontendMetadata;
    rawJson?: string;
    error?: string;
  }

  const testParseMetadata = (fullText: string): ParseResult => {
    let rawJson = '';
    try {
      const jsonRegex = /```json\s*([\s\S]*?)```/;
      const match = fullText.match(jsonRegex);
      if (!match) {
        return { success: false, error: 'AIの応答に ```json で始まるコードブロックが見つかりませんでした。' };
      }

      rawJson = match[1].trim();
      const parsed = JSON.parse(rawJson);

      const backend = parsed.backend;
      const frontend = parsed.frontend;

      if (backend) {
        return { success: true, backend, frontend: frontend || null, rawJson };
      } else {
        return { success: false, error: 'JSONのルートに "backend" オブジェクトが見つかりません。', rawJson };
      }
    } catch (e: any) {
      return { success: false, error: e.message, rawJson };
    }
  };

  const handleSendMessage = async (
    userMessage: string, 
    model: string, 
    retryAttempt = 0, 
    lastErrorMsg?: string, 
    lastMalformedJson?: string
  ) => {
    if (isGenerating && retryAttempt === 0) return;

    setIsGenerating(true);
    let updatedHistory = [...projectState.chatHistory];

    if (retryAttempt === 0) {
      updatedHistory = [
        ...projectState.chatHistory,
        { role: 'user', content: userMessage }
      ];
      setProjectState(prev => ({
        ...prev,
        chatHistory: updatedHistory,
        jsonParseError: null
      }));
    }

    const aiInitialText = retryAttempt > 0 ? `[JSON自動修復中 (試行 ${retryAttempt}/3)...]\n` : '';
    
    if (retryAttempt === 0) {
      updatedHistory = [...updatedHistory, { role: 'assistant', content: aiInitialText }];
      setProjectState(prev => ({
        ...prev,
        chatHistory: updatedHistory
      }));
    } else {
      setProjectState(prev => {
        const nextHistory = [...prev.chatHistory];
        const lastMsg = nextHistory[nextHistory.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = aiInitialText;
        }
        return { ...prev, chatHistory: nextHistory };
      });
    }

    try {
      const systemMsg: ChatMessage = { role: 'user', content: SYSTEM_PROMPT };
      const currentMetaContext = `
現在の定義データ：
【backendMetadata】: ${JSON.stringify(projectState.backendMetadata)}
【frontendMetadata】: ${JSON.stringify(projectState.frontendMetadata)}
上記データを変更または引き継いで、回答を作成してください。
`;

      let messagesForApi: ChatMessage[] = [];
      
      if (retryAttempt === 0) {
        messagesForApi = [
          systemMsg,
          { role: 'user', content: currentMetaContext },
          ...updatedHistory.slice(0, -1)
        ];
      } else {
        messagesForApi = [
          systemMsg,
          { role: 'user', content: currentMetaContext },
          ...projectState.chatHistory.slice(0, -1),
          {
            role: 'user',
            content: `
生成されたJSONのパースに失敗しました。
エラー詳細: ${lastErrorMsg}

【壊れていたJSON】:
\`\`\`json
${lastMalformedJson || ''}
\`\`\`

【指示】:
上記JSONは文法エラー（余計な文字 "theit" や "olduastr" 等の混入、括弧の閉じ忘れなど）があります。
これらをすべて排除し、完全に正しいJSON形式に修正し、再び \`\`\`json コードブロックとして全量を再出力してください。解説は不要です。
`
          }
        ];
      }

      // ユーザーの選択したモデルが JSON Mode に対応しているか判定
      const isJSONModeSupported = 
        model.includes('gpt-oss') || 
        model.includes('gpt-4') || 
        model.includes('claude-3-5') || 
        model.includes('gemini-1.5') || 
        model.includes('gemini-2.0');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          model: model,
          response_format: isJSONModeSupported ? YADOKARI_JSON_SCHEMA : undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported on this browser.');
      }

      const decoder = new TextDecoder();
      let aiContentAccumulator = aiInitialText;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'data: [DONE]') break;
          
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.choices?.[0]?.delta?.content || '';
              aiContentAccumulator += text;

              setProjectState(prev => {
                const nextHistory = [...prev.chatHistory];
                const lastMsg = nextHistory[nextHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = aiContentAccumulator;
                }
                return { ...prev, chatHistory: nextHistory };
              });
            } catch (e) {}
          }
        }
      }

      const parseResult = testParseMetadata(aiContentAccumulator);

      if (parseResult.success) {
        setProjectState(prev => ({
          ...prev,
          backendMetadata: parseResult.backend || null,
          frontendMetadata: parseResult.frontend || null,
          jsonParseError: null,
          rawJsonString: parseResult.rawJson || null
        }));
        setIsGenerating(false);
      } else {
        if (retryAttempt < 2) {
          console.warn(`JSON parsing failed (attempt ${retryAttempt + 1}/2). Retrying auto-correction...`, parseResult.error);
          handleSendMessage(userMessage, model, retryAttempt + 1, parseResult.error, parseResult.rawJson);
        } else {
          setProjectState(prev => ({
            ...prev,
            jsonParseError: `JSON自動修復の制限回数(2回)を超えました。最終エラー: ${parseResult.error}`,
            rawJsonString: parseResult.rawJson || null
          }));
          setIsGenerating(false);
        }
      }

    } catch (error: any) {
      console.error('LLM connection error:', error);
      setProjectState(prev => {
        const nextHistory = [...prev.chatHistory];
        const lastMsg = nextHistory[nextHistory.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = `【エラー】接続に失敗しました。\n理由: ${error.message || '不明なエラー'}`;
        }
        return { ...prev, chatHistory: nextHistory };
      });
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#070a13] text-slate-100 font-sans overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#0b0f19]/80 border-b border-slate-800/60 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
            Y
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white m-0 leading-none">ヤドカリプラットフォーム</h1>
            <span className="text-[10px] text-slate-500 font-mono">v1.0.0 PROTOTYPE</span>
          </div>
        </div>
        <ImportExport state={projectState} onImport={handleImport} />
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <section className="flex-1 flex flex-col min-w-[320px] max-w-[50%] h-full">
          <ChatConsole
            chatHistory={projectState.chatHistory}
            projectName={projectState.projectName}
            onProjectNameChange={handleProjectNameChange}
            onSendMessage={handleSendMessage}
            onClearHistory={handleClearHistory}
            isGenerating={isGenerating}
            onScrapeUrl={handleScrapeUrl}
          />
        </section>

        <section className="flex-1 flex flex-col min-w-[320px] h-full">
          <PreviewArea
            backendMetadata={projectState.backendMetadata}
            frontendMetadata={projectState.frontendMetadata}
            jsonParseError={projectState.jsonParseError}
            rawJsonString={projectState.rawJsonString}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
