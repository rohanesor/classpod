import { Injectable, Logger } from '@nestjs/common';
import { IPersonDetector } from '../interfaces/person-detection.interface';

@Injectable()
export class YoloDetectionService implements IPersonDetector {
  private readonly logger = new Logger(YoloDetectionService.name);
  private readonly aiServiceUrl = 'http://127.0.0.1:5000/detect';

  async detect(
    imagePayload: string,
    expectedCount: number,
    frameBytes?: number,
  ) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

      const response = await fetch(this.aiServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imagePayload }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }

      const data = await response.json();
      const processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `AI Person Detection Completed: Detected=${data.personCount}, Conf=${(data.confidence * 100).toFixed(0)}% in ${processingTimeMs}ms`,
      );

      return {
        personCount: data.personCount,
        confidence: data.confidence,
        detections: data.detections || [],
        status: 'ANALYSIS_COMPLETE' as const,
        analyzedAt: new Date().toISOString(),
        processingTimeMs,
      };
    } catch (err: any) {
      const processingTimeMs = Date.now() - startTime;
      this.logger.error(`AI service unavailable or timed out: ${err.message}`);
      return {
        personCount: null,
        confidence: null,
        detections: [],
        status: 'AI_UNAVAILABLE' as const,
        analyzedAt: new Date().toISOString(),
        processingTimeMs,
      };
    }
  }
}
