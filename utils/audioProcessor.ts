
/**
 * 將 File 物件轉換為 Base64 字串
 */
export const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 自動分割音檔邏輯
 * 為了確保 Gemini 辨識品質，如果音檔超過 10 分鐘，我們進行分割。
 * (Gemini 3 Flash 其實可以處理很長，但分割可以加速並增加穩定性)
 */
export const splitAudio = async (
  file: File,
  chunkDurationSeconds: number = 600 // 預設 10 分鐘一塊
): Promise<Blob[]> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const totalDuration = audioBuffer.duration;
  const chunks: Blob[] = [];
  
  if (totalDuration <= chunkDurationSeconds) {
    return [file];
  }

  const numChunks = Math.ceil(totalDuration / chunkDurationSeconds);
  
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkDurationSeconds;
    const end = Math.min((i + 1) * chunkDurationSeconds, totalDuration);
    const duration = end - start;
    
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      duration * audioBuffer.sampleRate,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0, start, duration);
    
    const renderedBuffer = await offlineContext.startRendering();
    const wavBlob = await bufferToWav(renderedBuffer);
    chunks.push(wavBlob);
  }
  
  return chunks;
};

// 輔助函式：將 AudioBuffer 轉成 WAV Blob
async function bufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const buffer_arr = new ArrayBuffer(length);
  const view = new DataView(buffer_arr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < numOfChan; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;                                     // next source sample
  }

  return new Blob([buffer_arr], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
