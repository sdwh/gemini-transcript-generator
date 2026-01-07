
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, Loader2, CheckCircle2, AlertCircle, PlayCircle, Clock } from 'lucide-react';
import { TranscriptionSegment, ProcessingStatus, AudioMetadata } from './types';
import { splitAudio, fileToBase64 } from './utils/audioProcessor';
import { GeminiTranscriptionService } from './services/geminiService';
import TranscriptionList from './components/TranscriptionList';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({
    step: 'idle',
    progress: 0,
    message: '請上傳音檔開始辨識'
  });
  const [results, setResults] = useState<TranscriptionSegment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith('audio/')) {
        alert('請上傳正確的音訊檔案格式');
        return;
      }
      setFile(selectedFile);
      setMetadata({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });
      setResults([]);
      setStatus({ step: 'idle', progress: 0, message: '音檔已就緒' });
    }
  };

  const startTranscription = async () => {
    if (!file) return;

    try {
      setResults([]);
      setStatus({ step: 'splitting', progress: 10, message: '正在分析並分割音檔...' });
      
      // 1. 分割音檔 (每 10 分鐘一塊)
      const chunks = await splitAudio(file, 600);
      const totalChunks = chunks.length;
      
      setStatus({ 
        step: 'transcribing', 
        progress: 20, 
        message: `開始使用 Gemini 3 Flash 辨識 (共 ${totalChunks} 個片段)...` 
      });

      const service = new GeminiTranscriptionService();
      let allSegments: TranscriptionSegment[] = [];

      // 2. 逐一處理片段
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const base64 = await fileToBase64(chunk);
        
        setStatus(prev => ({ 
          ...prev, 
          progress: 20 + Math.floor((i / totalChunks) * 60),
          message: `正在辨識第 ${i + 1}/${totalChunks} 個片段...`
        }));

        const startTimeOffset = i * 600;
        const chunkSegments = await service.transcribeChunk(
          base64, 
          file.type || 'audio/wav', 
          i,
          startTimeOffset
        );
        
        allSegments = [...allSegments, ...chunkSegments];
        // 動態更新結果讓使用者可以看到進度
        setResults([...allSegments]);
      }

      setStatus({ 
        step: 'completed', 
        progress: 100, 
        message: '辨識完成！' 
      });

    } catch (error: any) {
      console.error(error);
      setStatus({ 
        step: 'error', 
        progress: 0, 
        message: `錯誤: ${error.message || '未知錯誤發生'}` 
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 flex items-center justify-center gap-2">
          <FileAudio className="w-10 h-10 text-indigo-600" />
          <span>Gemini 逐字稿助手</span>
        </h1>
        <p className="text-slate-500">
          上傳音檔，由 <span className="font-bold text-indigo-500">Gemini 3 Flash</span> 自動標註時間與說話者
        </p>
      </header>

      <main className="w-full max-w-4xl space-y-6">
        {/* Upload Section */}
        <section className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100 transition-all">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
              file ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-white'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="audio/*"
            />
            {file ? (
              <div className="text-center">
                <div className="bg-indigo-600 text-white p-3 rounded-full inline-block mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">{metadata?.name}</h2>
                <p className="text-sm text-slate-500">{formatFileSize(metadata?.size || 0)} • {metadata?.type}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="bg-slate-200 text-slate-500 p-4 rounded-full inline-block mb-4">
                  <Upload className="w-8 h-8" />
                </div>
                <p className="text-lg font-medium text-slate-700">點擊或拖放音檔到此處</p>
                <p className="text-sm text-slate-400 mt-1">支援 mp3, wav, m4a 等常見格式</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={startTranscription}
              disabled={!file || status.step !== 'idle' && status.step !== 'completed' && status.step !== 'error'}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                !file || (status.step !== 'idle' && status.step !== 'completed' && status.step !== 'error')
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95'
              }`}
            >
              {status.step === 'idle' || status.step === 'completed' || status.step === 'error' ? (
                <>
                  <PlayCircle className="w-5 h-5" />
                  開始辨識
                </>
              ) : (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  正在處理中...
                </>
              )}
            </button>
            
            {file && (
               <button
               onClick={() => {
                 setFile(null);
                 setMetadata(null);
                 setResults([]);
                 setStatus({ step: 'idle', progress: 0, message: '請上傳音檔開始辨識' });
               }}
               className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium transition-all"
             >
               重新選擇
             </button>
            )}
          </div>
        </section>

        {/* Status Section */}
        {status.step !== 'idle' && (
          <section className={`rounded-xl p-4 flex items-center gap-4 border ${
            status.step === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
            status.step === 'completed' ? 'bg-green-50 border-green-100 text-green-700' :
            'bg-indigo-50 border-indigo-100 text-indigo-700'
          }`}>
            <div className="flex-shrink-0">
              {status.step === 'error' ? <AlertCircle className="w-6 h-6" /> :
               status.step === 'completed' ? <CheckCircle2 className="w-6 h-6" /> :
               <Clock className="w-6 h-6 animate-pulse" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <p className="font-bold text-sm">{status.message}</p>
                <span className="text-xs font-mono">{status.progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    status.step === 'error' ? 'bg-red-500' :
                    status.step === 'completed' ? 'bg-green-500' :
                    'bg-indigo-600'
                  }`}
                  style={{ width: `${status.progress}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {/* Results Section */}
        <TranscriptionList segments={results} />
      </main>

      <footer className="mt-12 text-slate-400 text-sm text-center">
        <p>© 2026 Gemini 繁體中文逐字稿助手 - 採用 Gemini 3 Flash 模型</p>
        <p className="mt-1">Powered by World-Class AI Engineering</p>
      </footer>
    </div>
  );
};

export default App;
