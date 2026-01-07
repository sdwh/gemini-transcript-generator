
import React from 'react';
import { TranscriptionSegment } from '../types';

interface TranscriptionListProps {
  segments: TranscriptionSegment[];
}

const TranscriptionList: React.FC<TranscriptionListProps> = ({ segments }) => {
  if (segments.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
        <h3 className="text-lg font-bold text-slate-800">逐字稿結果</h3>
      </div>
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {segments.map((segment, idx) => (
          <div 
            key={idx} 
            className="flex flex-col sm:flex-row gap-2 sm:gap-6 p-3 hover:bg-indigo-50/50 rounded-lg transition-colors group"
          >
            <div className="flex flex-row sm:flex-col items-center sm:items-start gap-3 sm:gap-1 min-w-[120px]">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                {segment.timestamp}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {segment.speaker}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-slate-700 leading-relaxed text-base">
                {segment.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center text-xs text-slate-400">
        <span>總計 {segments.length} 個片段</span>
        <button 
          onClick={() => {
            const fullText = segments.map(s => `${s.timestamp} ${s.speaker}: ${s.text}`).join('\n');
            navigator.clipboard.writeText(fullText);
            alert('逐字稿已複製到剪貼簿');
          }}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          點此複製全部
        </button>
      </div>
    </div>
  );
};

export default TranscriptionList;
