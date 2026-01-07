
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptionSegment } from "../types";

export class GeminiTranscriptionService {
  private ai: any;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async transcribeChunk(
    base64Audio: string, 
    mimeType: string, 
    chunkIndex: number,
    startTimeOffset: number = 0
  ): Promise<TranscriptionSegment[]> {
    try {
      // 構建 Prompt
      const systemInstruction = `
        你是一位專業的速記員。請根據提供的音檔生成詳細的繁體中文逐字稿。
        規則：
        1. 標註每一句話的時間戳，格式為 [MM:SS]。
        2. 盡可能辨識並標註說話者（例如：說話者 A, 說話者 B）。
        3. 如果遇到無法辨識的詞，請用 [不詳] 標註。
        4. 輸出的格式必須是嚴格的 JSON Array。
        5. 時間戳應根據當前音檔片段的起始時間進行調整（起始偏移量：${startTimeOffset} 秒）。
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: "請將這段錄音轉錄為繁體中文逐字稿，包含說話者標記與時間點。" }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { 
                  type: Type.STRING,
                  description: "格式如 [01:23]"
                },
                speaker: { 
                  type: Type.STRING,
                  description: "說話者標記"
                },
                text: { 
                  type: Type.STRING,
                  description: "逐字內容"
                }
              },
              required: ["timestamp", "speaker", "text"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      
      return JSON.parse(text) as TranscriptionSegment[];
    } catch (error) {
      console.error("Gemini Transcription Error:", error);
      throw error;
    }
  }
}
