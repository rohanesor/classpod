export interface IPersonDetector {
  detect(
    imagePayload: string,
    expectedCount: number,
    frameBytes?: number,
  ): Promise<{
    personCount: number | null;
    confidence: number | null;
    detections: any[];
    status: 'ANALYSIS_COMPLETE' | 'AI_UNAVAILABLE';
    analyzedAt: string;
    processingTimeMs: number;
  }>;
}
