import React, { useState, useEffect } from 'react';
import type { FrontendMetadata, Question } from '../types/metadata';

interface AppSimulatorProps {
  metadata: FrontendMetadata | null;
}

export const AppSimulator: React.FC<AppSimulatorProps> = ({ metadata }) => {
  const [currentState, setCurrentState] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [completed, setCompleted] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>([]); // 戻るボタン用の履歴

  // 家族メンバーの管理 (ループ質問用)
  const [familyConfig, setFamilyConfig] = useState<Record<string, { count: number; currentIdx: number; members: any[] }>>({});

  useEffect(() => {
    resetSimulator();
  }, [metadata]);

  const resetSimulator = () => {
    if (metadata && metadata.flow) {
      setCurrentState(metadata.flow.start_state);
    } else {
      setCurrentState('');
    }
    setAnswers({});
    setCompleted(false);
    setHistory([]);
    setFamilyConfig({});
  };

  if (!metadata || !metadata.questions || metadata.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm py-12">
        <svg className="w-8 h-8 mb-2 stroke-current" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
        <span>フロントエンドのマニフェストが生成されると、ここに一問一答シミュレータが表示されます。</span>
      </div>
    );
  }

  const currentQuestion = metadata.questions.find(q => q.id === currentState);
  const currentStateConfig = metadata.flow.states[currentState];

  // 戻る処理
  const handleBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevState = newHistory.pop()!;
    setHistory(newHistory);
    setCurrentState(prevState);
    setCompleted(false);
  };

  // 回答を選択/入力したときの処理
  const handleAnswerSubmit = (value: any) => {
    const updatedAnswers = { ...answers, [currentState]: value };
    setAnswers(updatedAnswers);

    // 人数質問があった場合、家族ループの設定を構築
    if (currentQuestion?.type === 'PersonNum') {
      const num = parseInt(value, 10) || 0;
      // 対象エンティティを探す
      const targetRelation = currentQuestion.target_entities[0] === 'あなた' ? '子ども' : currentQuestion.target_entities[0]; // 簡易ルール
      
      setFamilyConfig(prev => ({
        ...prev,
        [targetRelation]: {
          count: num,
          currentIdx: 0,
          members: Array.from({ length: num }, (_, i) => ({ id: i + 1 }))
        }
      }));
    }

    // 次のステートを決定する
    determineNextState(updatedAnswers);
  };

  // ガード条件の判定
  const evaluateGuard = (guard: any, currentAnswers: Record<string, any>): boolean => {
    if (!guard) return true;

    if (guard.type === 'mode_check') {
      // 見積もりモードの選択値をチェック
      const modeAnswer = currentAnswers['見積もりモード'];
      return modeAnswer === guard.mode;
    }

    if (guard.type === 'has_members') {
      // 家族関係の人数が0より多いかをチェック
      const countSource = currentAnswers[guard.source];
      const count = parseInt(countSource, 10) || 0;
      return count > 0;
    }

    if (guard.type === 'loop_check') {
      // ループチェック: 現在のインデックスが上限未満か
      const relation = guard.relation;
      const config = familyConfig[relation];
      if (!config) return false;
      return config.currentIdx < config.count - 1;
    }

    return true;
  };

  // 次のステート判定ロジック
  const determineNextState = (currentAnswers: Record<string, any>) => {
    setHistory(prev => [...prev, currentState]);

    if (!currentStateConfig) {
      setCompleted(true);
      return;
    }

    // メンバー遷移ステート（ロジック定義）の処理
    if (currentStateConfig.type === 'member_transition') {
      const relation = currentStateConfig.relation!;
      const action = currentStateConfig.action;
      const config = familyConfig[relation];

      if (config) {
        if (action === 'start') {
          // ループ開始
          setFamilyConfig(prev => ({
            ...prev,
            [relation]: { ...config, currentIdx: 0 }
          }));
          setCurrentState(currentStateConfig.nextQuestionKey || '');
          return;
        } else if (action === 'next') {
          // 次のループへ進む
          const nextIdx = config.currentIdx + 1;
          if (nextIdx < config.count) {
            setFamilyConfig(prev => ({
              ...prev,
              [relation]: { ...config, currentIdx: nextIdx }
            }));
            setCurrentState(currentStateConfig.nextQuestionKey || '');
            return;
          }
        }
      }
    }

    // nextConditions の判定
    if (currentStateConfig.nextConditions && currentStateConfig.nextConditions.length > 0) {
      for (const cond of currentStateConfig.nextConditions) {
        if (evaluateGuard(cond.guard, currentAnswers)) {
          // ループを進めるアクションなどを伴うかチェック
          if (cond.target === 'changeToNextChild') {
            // 子どものループをインクリメント
            const config = familyConfig['子ども'];
            if (config) {
              setFamilyConfig(prev => ({
                ...prev,
                ['子ども']: { ...config, currentIdx: config.currentIdx + 1 }
              }));
            }
            setCurrentState('年齢'); // 年齢質問へ戻る
            return;
          }
          
          if (cond.target === 'changeToChild') {
            setCurrentState('年齢');
            return;
          }

          setCurrentState(cond.target);
          return;
        }
      }
    }

    // 標準の遷移先
    if (currentStateConfig.nextQuestionKey) {
      setCurrentState(currentStateConfig.nextQuestionKey);
    } else {
      setCompleted(true);
    }
  };

  // カスタムテーマカラーのスタイル取得
  const primaryColor = metadata.app_metadata.theme.primary_color || '#4f46e5';

  return (
    <div className="flex flex-col items-center justify-center p-4 h-full bg-slate-900/30 rounded-xl border border-slate-800/80">
      
      {/* スマホ風モックアップ */}
      <div className="w-full max-w-[360px] h-[580px] bg-slate-950 rounded-[32px] border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col relative">
        {/* スピーカーとインカメラ */}
        <div className="absolute top-0 inset-x-0 h-6 bg-slate-950 flex items-center justify-center z-20">
          <div className="w-12 h-3.5 bg-black rounded-full"></div>
        </div>

        {/* アプリヘッダー */}
        <div className="pt-8 pb-3 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-100 shrink-0">
          <div className="flex items-center space-x-1">
            {history.length > 0 && !completed && (
              <button 
                onClick={handleBack} 
                className="text-slate-400 hover:text-slate-200 transition-colors mr-1"
              >
                ← 戻る
              </button>
            )}
            <span>{metadata.app_metadata.app_title}</span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }}></div>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col text-slate-300 text-sm">
          {completed ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400 text-xl font-bold">
                ✓
              </div>
              <h4 className="font-bold text-slate-100 text-base">みつもり用の入力完了</h4>
              <p className="text-xs text-slate-400 px-4">
                以下の条件で OpenFisca バックエンドへのシミュレーションリクエストを組み立てることができます。
              </p>
              
              <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-left space-y-1.5 text-xs max-h-[220px] overflow-y-auto">
                {Object.entries(answers).map(([qKey, val]) => (
                  <div key={qKey} className="flex justify-between border-b border-slate-800/50 pb-1 last:border-0 last:pb-0">
                    <span className="text-slate-400 font-medium">{qKey}</span>
                    <span className="text-slate-200">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={resetSimulator}
                style={{ backgroundColor: primaryColor }}
                className="w-full py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-opacity hover:opacity-90"
              >
                最初からやり直す
              </button>
            </div>
          ) : currentQuestion ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* 進行インジケータ */}
                <div className="text-[10px] text-slate-500 font-mono tracking-wider">
                  QUESTION: {currentQuestion.id}
                </div>

                {/* 質問本文 */}
                <h3 className="text-base font-bold text-slate-100 leading-snug">
                  {currentQuestion.title}
                  {/* ループ中の補助表示 */}
                  {currentQuestion.id === '年齢' && familyConfig['子ども'] && (
                    <span className="text-xs font-normal text-indigo-400 ml-1.5">
                      (子どもの年齢: {familyConfig['子ども'].currentIdx + 1}人目 / 計{familyConfig['子ども'].count}人)
                    </span>
                  )}
                </h3>

                {/* 入力フォーム */}
                <div className="pt-2">
                  <QuestionInput
                    question={currentQuestion}
                    onSubmit={handleAnswerSubmit}
                    primaryColor={primaryColor}
                  />
                </div>
              </div>

              {/* 進行ガイド */}
              <div className="text-[10px] text-slate-500 text-center border-t border-slate-900 pt-3">
                ※このプレビューは現在のマニフェストに基づいてリアルタイム生成されています。
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              画面フローの定義にエラーがあります。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 質問のタイプに応じた入力UIを描画する内部コンポーネント
const QuestionInput: React.FC<{
  question: Question;
  onSubmit: (value: any) => void;
  primaryColor: string;
}> = ({ question, onSubmit, primaryColor }) => {
  const [textVal, setTextVal] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // 質問が変わったら内部ステートをリセット
  useEffect(() => {
    setTextVal('');
    setSelectedOptions([]);
  }, [question]);

  if (question.type === 'Selection' && question.options) {
    return (
      <div className="space-y-2">
        {question.options.map(option => (
          <button
            key={option}
            onClick={() => onSubmit(option)}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-left rounded-xl transition-all duration-200 font-medium text-xs shadow-sm"
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'MultipleSelection' && question.options) {
    const handleCheckboxChange = (opt: string) => {
      setSelectedOptions(prev => 
        prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
      );
    };

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {question.options.map(option => (
            <label
              key={option}
              className="flex items-center p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs cursor-pointer hover:border-slate-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedOptions.includes(option)}
                onChange={() => handleCheckboxChange(option)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 w-4 h-4 mr-3"
              />
              <span className="text-slate-200 font-medium">{option}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => onSubmit(selectedOptions)}
          disabled={selectedOptions.length === 0}
          style={{ backgroundColor: primaryColor }}
          className="w-full py-2.5 text-xs font-semibold text-white rounded-xl shadow-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          回答する
        </button>
      </div>
    );
  }

  if (question.type === 'Age' || question.type === 'PersonNum') {
    const min = 0;
    const max = question.type === 'Age' ? 120 : 20;
    const placeholder = question.type === 'Age' ? '例: 28' : '例: 2';

    return (
      <div className="space-y-3">
        <input
          type="number"
          min={min}
          max={max}
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 bg-slate-900 border border-slate-800 focus:border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={() => onSubmit(textVal)}
          disabled={!textVal}
          style={{ backgroundColor: primaryColor }}
          className="w-full py-2.5 text-xs font-semibold text-white rounded-xl shadow-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </div>
    );
  }

  if (question.type === 'Address') {
    return (
      <div className="space-y-3">
        <input
          type="text"
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          placeholder="例: 東京都千代田区"
          className="w-full p-3 bg-slate-900 border border-slate-800 focus:border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={() => onSubmit(textVal)}
          disabled={!textVal}
          style={{ backgroundColor: primaryColor }}
          className="w-full py-2.5 text-xs font-semibold text-white rounded-xl shadow-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          決定
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={textVal}
        onChange={(e) => setTextVal(e.target.value)}
        placeholder="回答を入力してください"
        className="w-full p-3 bg-slate-900 border border-slate-800 focus:border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none"
      />
      <button
        onClick={() => onSubmit(textVal)}
        disabled={!textVal}
        style={{ backgroundColor: primaryColor }}
        className="w-full py-2.5 text-xs font-semibold text-white rounded-xl shadow-md"
      >
        送信
      </button>
    </div>
  );
};
