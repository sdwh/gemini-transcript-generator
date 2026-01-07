
export interface TranscriptionSegment {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface ProcessingStatus {
  step: 'idle' | 'splitting' | 'transcribing' | 'merging' | 'completed' | 'error';
  progress: number;
  message: string;
}

export interface AudioMetadata {
  name: string;
  size: number;
  type: string;
  duration?: number;
}
