import React, { useRef } from 'react';
import type { ProjectState } from '../types/metadata';

interface ImportExportProps {
  state: ProjectState;
  onImport: (importedState: ProjectState) => void;
}

export const ImportExport: React.FC<ImportExportProps> = ({ state, onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(state, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `yadokari-${state.projectName.replace(/\s+/g, '_') || 'project'}-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to export project', error);
      alert('プロジェクトのエクスポートに失敗しました。');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    
    if (!files || files.length === 0) return;

    fileReader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        
        const imported = JSON.parse(content) as ProjectState;
        
        // 簡易的なスキーマ検証
        if (typeof imported.projectName !== 'string' || !Array.isArray(imported.chatHistory)) {
          throw new Error('Invalid project file format');
        }

        onImport(imported);
        
        // inputをリセット
        if (fileInputRef.current) fileInputRef.current.value = '';
        
      } catch (error) {
        console.error('Failed to import project', error);
        alert('プロジェクトファイルの読み込みに失敗しました。正しいJSON形式であることを確認してください。');
      }
    };

    fileReader.readAsText(files[0]);
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleExport}
        className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition-all duration-200 shadow-sm"
        title="現在のプロジェクトをエクスポートする"
      >
        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
        </svg>
        エクスポート
      </button>

      <button
        onClick={handleImportClick}
        className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-medium transition-all duration-200 shadow-sm"
        title="プロジェクトファイルをインポートする"
      >
        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
        </svg>
        インポート
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
    </div>
  );
};
