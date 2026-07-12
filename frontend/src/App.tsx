import { useState, useEffect } from 'react';
import type { ProjectState, ChatMessage, BackendMetadata, FrontendMetadata } from './types/metadata';
import { ChatConsole } from './components/ChatConsole';
import { PreviewArea } from './components/PreviewArea';
import { ImportExport } from './components/ImportExport';

const SYSTEM_PROMPT = `
あなたは日本の社会保障・自治体独自の支援制度を定義する「OpenFisca」のバックエンド定義と、それに対応する一問一答フロントエンドGUI（マニフェスト）を同時設計するAIアシスタントです。

ユーザーは新規の制度概要や既存の変更希望を提示します。あなたの使命は次の通りです：
1. 制度の内容を正しく理解し、計算ロジック（フローチャート）を設計すること。最終的な計算結果（支給額や可否）をゴールとして、すべての条件判定や中間代入処理が一本の有向グラフ（一連の流れ）で繋がるように \`calculation_flow\` にノードをまとめてください。
2. その計算に必要なユーザーの入力項目（一問一答フロー）と、OpenFisca変数へのマッピングを設計すること。
3. 自然言語での対話と解説を行い、さらに「必ず1つの \\\`\\\`\\\`json 」コードブロックを出力すること。

### JSON出力スキーマ
出力するJSONは、以下の統合フォーマットに完全に準拠する必要があります。一部の変更であっても、常に「最新の全量データ」を出力してください。
注意として、OpenRouterの strict: true モードの制約（追加プロパティの完全禁止・動的キーの禁止）に適合するため、日付マップやIDマップはすべてオブジェクト配列構造とし、動的オブジェクト（tests内のinput/output等）はすべてエスケープされた「JSON文字列」形式で格納してください。

\\\`\\\`\\\`json
{
  "backend": {
    "variables": [
      {
        "name": "日本語の変数名",
        "label": "人間向けの短い説明",
        "documentation": "制度の詳細説明",
        "reference": "法的根拠URLなど",
        "value_type": "float" | "int" | "bool" | "str" | "Enum",
        "possible_values": [
          { "value": "キー", "label": "説明" }
        ],
        "default_value": "デフォルト値",
        "entity": "人物" | "世帯",
        "definition_period": "DAY" | "MONTH" | "YEAR" | "ETERNITY"
      }
    ],
    "calculation_flow": {
      "goal_variable": "最終的な計算結果となる変数名（例：児童手当支給月額合計）",
      "dependencies": {
        "variables": [
          { "name": "年齢", "as": "年齢", "entity": "person", "period": "current", "required": true, "default": "" }
        ],
        "parameters": [
          { "path": "パラメータ：三歳未満支給額", "as": "三歳未満支給額" }
        ]
      },
      "start_node": "開始ノード名",
      "nodes": [
        {
          "id": "ノード名",
          "type": "conditional" | "assignment" | "return",
          "condition": "条件式（例: 年齢 < 15）",
          "true_node": "真の場合の遷移先ノード名",
          "false_node": "偽の場合の遷移先ノード名",
          "target": "代入先変数名 (assignmentの場合のみ)",
          "expression": "代入値や計算式、または返却値。集約関数も使用可能 (例: 合計(所得))",
          "next_node": "代入後の遷移先ノード名 (assignmentの場合のみ)"
        }
      ]
    },
    "parameters": [
      {
        "path": "仮の日本語パラメータ名",
        "description": "パラメータの説明",
        "unit": "currency-JPY" | "/1" | "year" | "person",
        "values": [
          { "date": "2024-04-01", "value": 15000 }
        ]
      }
    ],
    "tests": [
      {
        "file_path": "openfisca_japan/tests/カテゴリ/テスト名.yaml",
        "test_cases": [
          {
            "name": "テスト名",
            "period": "2024-05",
            "input": "{\\"世帯\\": {\\"親一覧\\": [\\"親１\\"], \\"子一覧\\": [\\"子１\\"]}, \\"世帯員\\": {\\"親１\\": {\\"所得\\": 5000000}, \\"子１\\": {\\"年齢\\": 1}}}",
            "output": "{\\"世帯員\\": {\\"子１\\": {\\"変数名\\": {\\"2024-05\\": 15000}}}}"
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
      "states": [
        {
          "id": "質問ID",
          "nextQuestionKey": "次の質問ID（固定遷移）" | null,
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
          ],
          "type": "member_transition",
          "relation": "子ども",
          "action": "start"
        }
      ]
    },
    "openfisca_mapping": [
      {
        "question_id": "質問ID",
        "openfisca_variable": "対応するOpenFiscaの変数名",
        "level": "member" | "household",
        "transform": "age_to_birthdate" | null,
        "scale": 10000,
        "multiple_selection_map": "{}"
      }
    ]
  }
}
\\\`\\\`\\\`

ユーザーから提供された修正指示に基づいて、backendの定義構造（必要に応じてfrontendも）をインテリジェントに編集・出力してください。「バックエンドのみ」を求められた場合は、backendオブジェクトのみを含むJSONを出力してください。自然言語での対話と説明は簡潔にまとめ、\\\`\\\`\\\`json コードブロックを必ず含めてください。
`;

const YADOKARI_JSON_SCHEMA_LOGIC = {
  type: "json_schema",
  json_schema: {
    name: "yadokari_backend_metadata",
    strict: true,
    schema: {
      type: "object",
      properties: {
        backend: {
          type: "object",
          properties: {
            variables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  label: { type: "string" },
                  documentation: { type: "string" },
                  reference: { type: "string" },
                  value_type: { type: "string", enum: ["float", "int", "bool", "str", "Enum"] },
                  possible_values: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        value: { type: "string" },
                        label: { type: "string" }
                      },
                      required: ["value", "label"],
                      additionalProperties: false
                    }
                  },
                  default_value: { type: "string" },
                  entity: { type: "string", enum: ["人物", "世帯"] },
                  definition_period: { type: "string", enum: ["DAY", "MONTH", "YEAR", "ETERNITY"] }
                },
                required: ["name", "label", "documentation", "reference", "value_type", "possible_values", "default_value", "entity", "definition_period"],
                additionalProperties: false
              }
            },
            calculation_flow: {
              type: "object",
              properties: {
                goal_variable: { type: "string" },
                dependencies: {
                  type: "object",
                  properties: {
                    variables: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          as: { type: "string" },
                          entity: { type: "string", enum: ["person", "household", "household_members"] },
                          period: { type: "string" },
                          required: { type: "boolean" },
                          default: { type: "string" }
                        },
                        required: ["name", "as", "entity", "period", "required", "default"],
                        additionalProperties: false
                      }
                    },
                    parameters: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          path: { type: "string" },
                          as: { type: "string" }
                        },
                        required: ["path", "as"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["variables", "parameters"],
                  additionalProperties: false
                },
                start_node: { type: "string" },
                nodes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string", enum: ["conditional", "assignment", "return"] },
                      condition: { type: "string" },
                      true_node: { type: "string" },
                      false_node: { type: "string" },
                      target: { type: "string" },
                      expression: { type: "string" },
                      next_node: { type: "string" }
                    },
                    required: ["id", "type", "condition", "true_node", "false_node", "target", "expression", "next_node"],
                    additionalProperties: false
                  }
                }
              },
              required: ["goal_variable", "dependencies", "start_node", "nodes"],
              additionalProperties: false
            },
            parameters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  description: { type: "string" },
                  unit: { type: "string", enum: ["currency-JPY", "/1", "year", "person"] },
                  values: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        value: { type: "number" }
                      },
                      required: ["date", "value"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["path", "description", "unit", "values"],
                additionalProperties: false
              }
            },
            tests: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  file_path: { type: "string" },
                  test_cases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        period: { type: "string" },
                        input: { type: "string" },
                        output: { type: "string" }
                      },
                      required: ["name", "period", "input", "output"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["file_path", "test_cases"],
                additionalProperties: false
              }
            }
          },
          required: ["variables", "calculation_flow", "parameters", "tests"],
          additionalProperties: false
        }
      },
      required: ["backend"],
      additionalProperties: false
    }
  }
};

const YADOKARI_JSON_SCHEMA_QUESTIONS = {
  type: "json_schema",
  json_schema: {
    name: "yadokari_frontend_metadata",
    strict: true,
    schema: {
      type: "object",
      properties: {
        frontend: {
          type: "object",
          properties: {
            app_metadata: {
              type: "object",
              properties: {
                app_title: { type: "string" },
                theme: {
                  type: "object",
                  properties: {
                    primary_color: { type: "string" }
                  },
                  required: ["primary_color"],
                  additionalProperties: false
                }
              },
              required: ["app_title", "theme"],
              additionalProperties: false
            },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  type: { type: "string", enum: ["Selection", "Address", "Age", "PersonNum", "MultipleSelection"] },
                  options: { type: "array", items: { type: "string" } },
                  target_entities: { type: "array", items: { type: "string" } }
                },
                required: ["id", "title", "type", "options", "target_entities"],
                additionalProperties: false
              }
            },
            flow: {
              type: "object",
              properties: {
                start_state: { type: "string" },
                states: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      nextQuestionKey: { type: ["string", "null"] },
                      nextConditions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            target: { type: "string" },
                            guard: {
                              type: "object",
                              properties: {
                                type: { type: "string", enum: ["mode_check", "loop_check", "has_members"] },
                                mode: { type: "string" },
                                relation: { type: "string" },
                                limit_source: { type: "string" },
                                source: { type: "string" }
                              },
                              required: ["type", "mode", "relation", "limit_source", "source"],
                              additionalProperties: false
                            }
                          },
                          required: ["target", "guard"],
                          additionalProperties: false
                        }
                      },
                      type: { type: "string", enum: ["member_transition"] },
                      relation: { type: "string" },
                      action: { type: "string", enum: ["start", "next"] }
                    },
                    required: ["id", "nextQuestionKey", "nextConditions", "type", "relation", "action"],
                    additionalProperties: false
                  }
                }
              },
              required: ["start_state", "states"],
              additionalProperties: false
            },
            openfisca_mapping: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question_id: { type: "string" },
                  openfisca_variable: { type: "string" },
                  level: { type: "string", enum: ["member", "household"] },
                  transform: { type: ["string", "null"] },
                  scale: { type: "number" },
                  multiple_selection_map: { type: "string" }
                },
                required: ["question_id", "openfisca_variable", "level", "transform", "scale", "multiple_selection_map"],
                additionalProperties: false
              }
            }
          },
          required: ["app_metadata", "questions", "flow", "openfisca_mapping"],
          additionalProperties: false
        }
      },
      required: ["frontend"],
      additionalProperties: false
    }
  }
};

function App() {
  const [projectState, setProjectState] = useState<ProjectState>({
    projectName: '',
    chatHistory: [],
    backendMetadata: null,
    frontendMetadata: null,
    jsonParseError: null,
    rawJsonString: null
  });

  // Theme management state
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'auto') || 'auto';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'auto') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    localStorage.setItem('theme', theme);
  }, [resolvedTheme, theme]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('z-ai/glm-5.2');

  // 二段階ワークフロー用状態
  const [currentPhase, setCurrentPhase] = useState<'logic' | 'questions'>('logic');
  const [logicConfirmed, setLogicConfirmed] = useState(false);
  const [questionsConfirmed, setQuestionsConfirmed] = useState(false);
  const [hasLogicData, setHasLogicData] = useState(false);
  const [hasQuestionsData, setHasQuestionsData] = useState(false);
  
  // 右ペインのタブ制御
  const [activeTab, setActiveTab] = useState<'flow' | 'preview' | 'json'>('flow');

  const handleConfirmLogic = () => {
    setLogicConfirmed(true);
    setCurrentPhase('questions');
    setProjectState(prev => ({
      ...prev,
      chatHistory: [
        ...prev.chatHistory,
        { role: 'assistant' as const, content: '計算ロジックが確定しました。続いて、ユーザーへの質問（一問一答フロー）を生成します。' }
      ]
    }));
    handleSendMessage(
      "確定した計算ロジックに基づいて、ユーザーへの一問一答フロー（frontend）を自動生成してください。",
      selectedModel,
      'questions'
    );
  };

  const handleModifyLogic = () => {
    setHasLogicData(false);
    setLogicConfirmed(false);
    setQuestionsConfirmed(false);
    setHasQuestionsData(false);
    setCurrentPhase('logic');
    setProjectState(prev => ({
      ...prev,
      chatHistory: [
        ...prev.chatHistory,
        { role: 'assistant' as const, content: 'ロジックの修正を受け付けます。修正したい点をご指示ください。' }
      ]
    }));
  };

  const handleConfirmQuestions = () => {
    setQuestionsConfirmed(true);
    setProjectState(prev => ({
      ...prev,
      chatHistory: [
        ...prev.chatHistory,
        { role: 'assistant' as const, content: 'ユーザーへの質問（フロントマニフェスト）が確定しました！すべての定義データが完成しました。右側のプレビューで動作を確認してください。' }
      ]
    }));
  };

  const handleModifyQuestions = () => {
    setHasQuestionsData(false);
    setProjectState(prev => ({
      ...prev,
      chatHistory: [
        ...prev.chatHistory,
        { role: 'assistant' as const, content: '質問マニフェストの修正を受け付けます。修正したい点をご指示ください。' }
      ]
    }));
  };

  const handleProjectNameChange = (name: string) => {
    setProjectState(prev => {
      const updatedState = { ...prev, projectName: name };
      if (updatedState.frontendMetadata) {
        updatedState.frontendMetadata = {
          ...updatedState.frontendMetadata,
          app_metadata: {
            ...updatedState.frontendMetadata.app_metadata,
            app_title: name
          }
        };

        const fullJsonObj: any = {};
        if (updatedState.backendMetadata) {
          fullJsonObj.backend = updatedState.backendMetadata;
        }
        fullJsonObj.frontend = updatedState.frontendMetadata;
        updatedState.rawJsonString = JSON.stringify(fullJsonObj, null, 2);
      }
      return updatedState;
    });
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
    // 古いJSONファイル等で projectName がない場合のフォールバック
    if (!importedState.projectName) {
      importedState.projectName = importedState.frontendMetadata?.app_metadata?.app_title || '';
    }

    setProjectState(importedState);

    // 関連する派生ステートを同期する
    const hasLogic = !!importedState.backendMetadata;
    const hasQuestions = !!importedState.frontendMetadata;

    setHasLogicData(hasLogic);
    setHasQuestionsData(hasQuestions);

    if (hasQuestions) {
      setLogicConfirmed(true);
      setQuestionsConfirmed(true);
      setCurrentPhase('questions');
      setActiveTab('preview');
    } else if (hasLogic) {
      setLogicConfirmed(true);
      setQuestionsConfirmed(false);
      setCurrentPhase('questions');
      setActiveTab('flow');
    } else {
      setLogicConfirmed(false);
      setQuestionsConfirmed(false);
      setCurrentPhase('logic');
      setActiveTab('flow');
    }
  };

  const callLlm = async (messages: ChatMessage[], model: string): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model,
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
    let resultText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done && !value) break;

      const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') break;
        
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              continue;
            }
            const text = parsed.choices?.[0]?.delta?.content || '';
            resultText += text;
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
      if (done) break;
    }
    return resultText;
  };

  const streamLlm = async (
    messages: ChatMessage[],
    model: string,
    onChunk: (text: string) => void,
    response_format?: any
  ): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model,
        response_format,
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
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done && !value) break;

      const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') break;
        
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) {
              console.error('API Stream Error:', parsed.error);
              continue;
            }
            const text = parsed.choices?.[0]?.delta?.content || '';
            accumulatedText += text;
            onChunk(text);
          } catch (e: any) {
            // Ignore parse errors for partial chunks
          }
        }
      }
      if (done) break;
    }
    return accumulatedText;
  };

  const handleScrapeUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch content');
      }

      const data = await response.json();
      const rawContent = data.content || '';

      const extractionPrompt = `あなたは入力されたWebページのテキストから、給付制度や各種制度の「計算ロジック（支給条件、所得制限、給付額等）」および「申請フローや質問事項」に関連する重要情報のみを抽出するアシスタントです。
ヘッダー、フッター、ナビゲーション、サイト紹介、プライバシーポリシーなどの無関係なテキストは一切除外し、制度設計に必要な情報のみを整理して抽出してください。
余計な解説や挨拶、導入文、結び文は一切含めず、抽出したテキストのみを出力してください。

【対象テキスト】
${rawContent}`;

      const extractedText = await callLlm([
        { role: 'user', content: extractionPrompt }
      ], 'z-ai/glm-5.2');

      if (!extractedText.trim()) {
        throw new Error('制度説明HPから有効な情報を抽出できませんでした。');
      }

      return extractedText;
    } catch (error: any) {
      console.error('Scraping or extraction failed:', error);
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

  const testParseMetadata = (fullText: string, phase: 'logic' | 'questions'): ParseResult => {
    let rawJson = '';
    const trimmedText = fullText.trim();
    
    if (trimmedText.startsWith('{')) {
      rawJson = trimmedText;
    } else {
      const jsonRegex = /```json\s*([\s\S]*?)```/;
      const match = trimmedText.match(jsonRegex);
      if (match) {
        rawJson = match[1].trim();
      } else {
        const firstBrace = trimmedText.indexOf('{');
        const lastBrace = trimmedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          rawJson = trimmedText.slice(firstBrace, lastBrace + 1);
        } else {
          return { success: false, error: 'AIの応答に有効なJSONオブジェクトが見つかりませんでした。' };
        }
      }
    }

    try {
      const parsed = JSON.parse(rawJson);
      const backend = parsed.backend;
      const frontend = parsed.frontend;

      if (phase === 'logic') {
        if (backend) {
          // strictモード適合のために文字列で格納された test_cases の input/output をオブジェクトに復元
          if (backend.tests) {
            backend.tests.forEach((testFile: any) => {
              if (testFile.test_cases) {
                testFile.test_cases.forEach((tc: any) => {
                  if (typeof tc.input === 'string') {
                    try {
                      tc.input = JSON.parse(tc.input);
                    } catch (e) {
                      console.warn('Failed to parse test case input string', e);
                    }
                  }
                  if (typeof tc.output === 'string') {
                    try {
                      tc.output = JSON.parse(tc.output);
                    } catch (e) {
                      console.warn('Failed to parse test case output string', e);
                    }
                  }
                });
              }
            });
          }
          return { success: true, backend, rawJson };
        } else {
          return { success: false, error: 'JSONのルートに "backend" オブジェクトが見つかりません。', rawJson };
        }
      } else {
        if (frontend) {
          return { success: true, frontend, rawJson };
        } else {
          return { success: false, error: 'JSONのルートに "frontend" オブジェクトが見つかりません。', rawJson };
        }
      }
    } catch (e: any) {
      let friendlyError = e.message;
      if (friendlyError.includes('Unexpected end of JSON') || friendlyError.includes('position') || friendlyError.includes('Expected')) {
        friendlyError = `${e.message}。AIの出力トークン数が上限に達し、JSONデータが途中で切れてしまった可能性があります。もう一度送信し直すか、プロンプト指示を簡潔にして再度試してください。`;
      }
      return { success: false, error: friendlyError, rawJson };
    }
  };

  const handleSendMessage = async (
    userMessage: string,
    model: string,
    overridePhase?: 'logic' | 'questions',
    displayMessage?: string
  ) => {
    if (isGenerating) return;

    setIsGenerating(true);
    let updatedHistory: ChatMessage[] = [
      ...projectState.chatHistory,
      { role: 'user', content: userMessage, displayContent: displayMessage }
    ];
    setProjectState(prev => ({
      ...prev,
      chatHistory: updatedHistory,
      jsonParseError: null
    }));

    const aiInitialText = '';
    updatedHistory = [...updatedHistory, { role: 'assistant', content: aiInitialText }];
    setProjectState(prev => ({
      ...prev,
      chatHistory: updatedHistory
    }));

    const activePhase = overridePhase || currentPhase;

    try {
      const systemMsg: ChatMessage = { role: 'user', content: SYSTEM_PROMPT };
      let phaseInstruction = '';
      if (activePhase === 'logic') {
        phaseInstruction = '【重要制約】今回は計算ロジック設計フェーズです。スキーマ定義に従い、"backend" オブジェクトのみを含むJSONを生成してください。"frontend" オブジェクトは絶対に含めないでください。';
      } else {
        phaseInstruction = '【重要制約】今回はユーザー質問設計フェーズです。スキーマ定義に従い、"frontend" オブジェクトのみを含むJSONを生成してください。"backend" オブジェクトは絶対に含めないでください。';
      }

      const currentMetaContext = `
現在の定義データ：
【backendMetadata】: ${JSON.stringify(projectState.backendMetadata)}
【frontendMetadata】: ${JSON.stringify(projectState.frontendMetadata)}
上記データを変更または引き継いで、回答を作成してください。
${phaseInstruction}
`;

      // ユーザーの選択したモデルが JSON Mode に対応しているか判定
      const isJSONModeSupported = 
        model.includes('gpt-oss') || 
        model.includes('gpt-4') || 
        model.includes('gpt-5') || 
        model.includes('claude-3-5') || 
        model.includes('gemini-1.5') || 
        model.includes('gemini-2.0') ||
        model.includes('gemini-3.5') || 
        model.includes('glm') ||
        model.includes('deepseek');

      const activeSchema = activePhase === 'logic' ? YADOKARI_JSON_SCHEMA_LOGIC : YADOKARI_JSON_SCHEMA_QUESTIONS;

      if (activePhase === 'logic') {
        // Step 1: Amount-related information extraction
        // Initialize the assistant message with extraction header
        setProjectState(prev => {
          const nextHistory = [...prev.chatHistory];
          const lastMsg = nextHistory[nextHistory.length - 1];
          if (lastMsg) lastMsg.content = '【金額に関わる情報の抽出結果】\n(抽出中...)';
          return { ...prev, chatHistory: nextHistory };
        });

        const extractionPrompt = `あなたは提供されたテキストから、給付金（支給）や貸付の「金額」に最終的に影響を与える条件や数値を抽出する専門のAIアシスタントです。

以下の【対象テキスト】から、支給や貸付の**金額に最終的に関わる情報**（支給額、貸付額、加算・減算ルール、所得制限、年齢制限、その他の分岐条件など）をすべて漏れなく抽出・整理して出力してください。
余計な解説や前置き、結びの挨拶などは一切含めず、抽出したテキストのみを簡潔に出力してください。

【対象テキスト】:
${userMessage}`;

        let extractedContent = '';
        await streamLlm(
          [{ role: 'user', content: extractionPrompt }],
          model,
          (chunk) => {
            extractedContent += chunk;
            setProjectState(prev => {
              const nextHistory = [...prev.chatHistory];
              const lastMsg = nextHistory[nextHistory.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}`;
              }
              return { ...prev, chatHistory: nextHistory };
            });
          }
        );

        // Step 2: Calculation logic metadata generation
        // Append separator and metadata generation header
        setProjectState(prev => {
          const nextHistory = [...prev.chatHistory];
          const lastMsg = nextHistory[nextHistory.length - 1];
          if (lastMsg) {
            lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\n(生成中...)`;
          }
          return { ...prev, chatHistory: nextHistory };
        });

        const userPromptWithExtraction = `以下の元の依頼と、そこから抽出した金額に関わる重要情報に基づき、計算ロジックメタデータを生成してください。

【元の依頼/コンテキスト】:
${userMessage}

【金額に関わる抽出情報】:
${extractedContent}

上記情報を満たす計算ロジックメタデータを設計し、必ず指定されたJSONスキーマに沿ったJSONを含むテキストを出力してください。`;

        const messagesForApi: ChatMessage[] = [
          systemMsg,
          { role: 'user' as const, content: currentMetaContext },
          ...updatedHistory.slice(0, -2), // excludes the assistant message AND the original user message
          { role: 'user' as const, content: userPromptWithExtraction }
        ];

        let accumulatedMetadataText = '';
        let fallbackTriggered = false;

        try {
          await streamLlm(
            messagesForApi,
            model,
            (chunk) => {
              accumulatedMetadataText += chunk;
              setProjectState(prev => {
                const nextHistory = [...prev.chatHistory];
                const lastMsg = nextHistory[nextHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\n(生成中...)`;
                }
                return { ...prev, chatHistory: nextHistory };
              });
            },
            isJSONModeSupported ? activeSchema : undefined
          );
        } catch (streamError: any) {
          console.error("Stream error in logic phase metadata generation:", streamError);
          if (model === 'z-ai/glm-5.2') {
            fallbackTriggered = true;
          } else {
            throw streamError;
          }
        }

        let parseResult = !fallbackTriggered
          ? testParseMetadata(accumulatedMetadataText, 'logic')
          : { success: false, error: 'Stream interrupted or timed out' };

        if (!parseResult.success && model === 'z-ai/glm-5.2') {
          fallbackTriggered = true;
        }

        if (fallbackTriggered) {
          console.log("GLM-5.2 generation failed or interrupted. Falling back to Gemini 3.5 Flash...");
          
          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg) {
              lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\n⚠️ GLM 5.2での生成中にタイムアウトまたは切断が発生したため、自動的に高速な Gemini 3.5 Flash へフォールバックして再生成を試みています...\n\n(再生成中...)`;
            }
            return { ...prev, chatHistory: nextHistory };
          });

          const fallbackModel = 'google/gemini-3.5-flash';
          accumulatedMetadataText = '';
          try {
            await streamLlm(
              messagesForApi,
              fallbackModel,
              (chunk) => {
                accumulatedMetadataText += chunk;
                setProjectState(prev => {
                  const nextHistory = [...prev.chatHistory];
                  const lastMsg = nextHistory[nextHistory.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\n⚠️ GLM 5.2での生成中にタイムアウトまたは切断が発生したため、自動的に高速な Gemini 3.5 Flash へフォールバックして再生成を試みています...\n\n(Gemini 3.5 Flash で生成中...)`;
                  }
                  return { ...prev, chatHistory: nextHistory };
                });
              },
              activeSchema
            );
            parseResult = testParseMetadata(accumulatedMetadataText, 'logic');
          } catch (fallbackError: any) {
            console.error("Fallback generation failed in logic phase:", fallbackError);
            parseResult = { success: false, error: `フォールバック先（Gemini 3.5 Flash）でのエラー: ${fallbackError.message}` };
          }
        }

        if (parseResult.success) {
          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\n${fallbackTriggered ? '⚠️ GLM 5.2のタイムアウトのためGemini 3.5 Flashに切り替えて再生成しました。\n\n' : ''}生成が完了しました。右側の「ロジック可視化」プレビューをご確認ください。`;
            }
            const newBackend = parseResult.backend ? parseResult.backend : prev.backendMetadata;
            return {
              ...prev,
              chatHistory: nextHistory,
              backendMetadata: newBackend,
              jsonParseError: null,
              rawJsonString: parseResult.rawJson || null
            };
          });
          setHasLogicData(true);
        } else {
          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = `【金額に関わる情報の抽出結果】\n${extractedContent}\n\n---\n\n【計算ロジックメタデータの生成】\nパースエラーが発生しました。`;
            }
            return {
              ...prev,
              chatHistory: nextHistory,
              jsonParseError: `JSONパースエラー: ${parseResult.error}`,
              rawJsonString: parseResult.rawJson || null
            };
          });
        }
      } else {
        // activePhase === 'questions'
        const messagesForApi: ChatMessage[] = [
          systemMsg,
          { role: 'user' as const, content: currentMetaContext },
          ...updatedHistory.slice(0, -1)
        ];

        let accumulatedMetadataText = '';
        let fallbackTriggered = false;

        try {
          await streamLlm(
            messagesForApi,
            model,
            (chunk) => {
              accumulatedMetadataText += chunk;
              setProjectState(prev => {
                const nextHistory = [...prev.chatHistory];
                const lastMsg = nextHistory[nextHistory.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content = accumulatedMetadataText;
                }
                return { ...prev, chatHistory: nextHistory };
              });
            },
            isJSONModeSupported ? activeSchema : undefined
          );
        } catch (streamError: any) {
          console.error("Stream error in questions phase metadata generation:", streamError);
          if (model === 'z-ai/glm-5.2') {
            fallbackTriggered = true;
          } else {
            throw streamError;
          }
        }

        let parseResult = !fallbackTriggered
          ? testParseMetadata(accumulatedMetadataText, 'questions')
          : { success: false, error: 'Stream interrupted or timed out' };

        if (!parseResult.success && model === 'z-ai/glm-5.2') {
          fallbackTriggered = true;
        }

        if (fallbackTriggered) {
          console.log("GLM-5.2 generation failed or interrupted in questions phase. Falling back to Gemini 3.5 Flash...");

          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg) {
              lastMsg.content = `⚠️ GLM 5.2での質問定義生成中にタイムアウトまたは切断が発生したため、自動的に高速な Gemini 3.5 Flash へフォールバックして再生成を試みています...\n\n(再生成中...)`;
            }
            return { ...prev, chatHistory: nextHistory };
          });

          const fallbackModel = 'google/gemini-3.5-flash';
          accumulatedMetadataText = '';
          try {
            await streamLlm(
              messagesForApi,
              fallbackModel,
              (chunk) => {
                accumulatedMetadataText += chunk;
                setProjectState(prev => {
                  const nextHistory = [...prev.chatHistory];
                  const lastMsg = nextHistory[nextHistory.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = `⚠️ GLM 5.2での質問定義生成中にタイムアウトまたは切断が発生したため、自動的に高速な Gemini 3.5 Flash へフォールバックして再生成を試みています...\n\n(Gemini 3.5 Flash で生成中...)\n\n${accumulatedMetadataText}`;
                  }
                  return { ...prev, chatHistory: nextHistory };
                });
              },
              activeSchema
            );
            parseResult = testParseMetadata(accumulatedMetadataText, 'questions');
          } catch (fallbackError: any) {
            console.error("Fallback generation failed in questions phase:", fallbackError);
            parseResult = { success: false, error: `フォールバック先（Gemini 3.5 Flash）でのエラー: ${fallbackError.message}` };
          }
        }

        if (parseResult.success) {
          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = `${fallbackTriggered ? '⚠️ GLM 5.2のタイムアウトのためGemini 3.5 Flashに切り替えて再生成しました。\n\n' : ''}${accumulatedMetadataText}`;
            }

            let newFrontend = parseResult.frontend ? { ...parseResult.frontend } : (prev.frontendMetadata ? { ...prev.frontendMetadata } : null);
            let updatedProjectName = prev.projectName;

            if (newFrontend) {
              if (prev.projectName) {
                newFrontend.app_metadata = {
                  ...newFrontend.app_metadata,
                  app_title: prev.projectName
                };
              } else if (newFrontend.app_metadata?.app_title) {
                updatedProjectName = newFrontend.app_metadata.app_title;
              }
            }

            const fullJsonObj: any = {};
            if (prev.backendMetadata) {
              fullJsonObj.backend = prev.backendMetadata;
            }
            if (newFrontend) {
              fullJsonObj.frontend = newFrontend;
            }
            const updatedRawJson = JSON.stringify(fullJsonObj, null, 2);

            return {
              ...prev,
              chatHistory: nextHistory,
              projectName: updatedProjectName,
              frontendMetadata: newFrontend,
              jsonParseError: null,
              rawJsonString: updatedRawJson
            };
          });
          setHasQuestionsData(true);
          setActiveTab('preview');
        } else {
          setProjectState(prev => {
            const nextHistory = [...prev.chatHistory];
            const lastMsg = nextHistory[nextHistory.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && fallbackTriggered) {
              lastMsg.content = `⚠️ GLM 5.2のタイムアウトのためGemini 3.5 Flashにフォールバックしましたが、パースエラーが発生しました。\n\n${accumulatedMetadataText}`;
            }
            return {
              ...prev,
              chatHistory: nextHistory,
              jsonParseError: `JSONパースエラー: ${parseResult.error}`,
              rawJsonString: parseResult.rawJson || null
            };
          });
        }
      }
      setIsGenerating(false);

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

  const handleFrontendMetadataChange = (newMetadata: FrontendMetadata) => {
    setProjectState(prev => {
      const updatedState = {
        ...prev,
        frontendMetadata: newMetadata,
      };

      const fullJsonObj: any = {};
      if (prev.backendMetadata) {
        fullJsonObj.backend = prev.backendMetadata;
      }
      if (newMetadata) {
        fullJsonObj.frontend = newMetadata;
      }

      updatedState.rawJsonString = JSON.stringify(fullJsonObj, null, 2);
      return updatedState;
    });
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-app-bg text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      <header className="flex items-center justify-between px-6 py-3.5 bg-header-bg/80 border-b border-slate-800/60 backdrop-blur-md shrink-0 z-10 transition-colors duration-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
            Y
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100 m-0 leading-none">ヤドカリプラットフォーム</h1>
            <span className="text-[10px] text-slate-500 font-mono">v1.0.0 PROTOTYPE</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* テーマセレクター (セグメントボタン) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 space-x-0.5 transition-colors duration-200">
            <button
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-850 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="ライトモード"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
              ライト
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-850 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="ダークモード"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              ダーク
            </button>
            <button
              onClick={() => setTheme('auto')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all flex items-center cursor-pointer ${
                theme === 'auto'
                  ? 'bg-slate-850 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="システム設定に従う"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              自動
            </button>
          </div>

          <ImportExport state={projectState} onImport={handleImport} />
        </div>
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
            currentPhase={currentPhase}
            logicConfirmed={logicConfirmed}
            questionsConfirmed={questionsConfirmed}
            hasLogicData={hasLogicData}
            hasQuestionsData={hasQuestionsData}
            onConfirmLogic={handleConfirmLogic}
            onModifyLogic={handleModifyLogic}
            onConfirmQuestions={handleConfirmQuestions}
            onModifyQuestions={handleModifyQuestions}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        </section>

        <section className="flex-1 flex flex-col min-w-[320px] h-full">
          <PreviewArea
            backendMetadata={projectState.backendMetadata}
            frontendMetadata={projectState.frontendMetadata}
            jsonParseError={projectState.jsonParseError}
            rawJsonString={projectState.rawJsonString}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onFrontendMetadataChange={handleFrontendMetadataChange}
            resolvedTheme={resolvedTheme}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
