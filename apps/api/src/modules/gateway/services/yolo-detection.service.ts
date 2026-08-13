import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPersonDetector } from '../interfaces/person-detection.interface';
import { PersonDetectionService } from './person-detection.service';

@Injectable()
export class YoloDetectionService implements IPersonDetector {
  private readonly logger = new Logger(YoloDetectionService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly fallbackDetector: PersonDetectionService,
  ) {
    const rawUrl =
      this.configService.get<string>('AI_DETECTION_SERVICE_URL') ||
      process.env.AI_DETECTION_SERVICE_URL ||
      'http://ai-detection:5000';

    const cleanUrl = rawUrl.replace(/\/+$/, '');
    this.aiServiceUrl = cleanUrl.endsWith('/detect') ? cleanUrl : `${cleanUrl}/detect`;
    this.logger.log(`YoloDetectionService initialized with target URL: ${this.aiServiceUrl}`);
  }

  async detect(
    imagePayload: string,
    expectedCount: number = 30,
    frameBytes?: number,
  ) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6-second timeout for YOLO inference

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

      if (typeof data.personCount !== 'number') {
        throw new Error('AI service returned invalid person count');
      }

      this.logger.log(
        `AI Person Detection Completed: Detected=${data.personCount}, Conf=${(data.confidence * 100).toFixed(0)}% in ${processingTimeMs}ms`,
      );

      return {
        personCount: data.personCount,
        confidence: data.confidence || 0.95,
        detections: data.detections || [],
        status: 'ANALYSIS_COMPLETE' as const,
        analyzedAt: new Date().toISOString(),
        processingTimeMs,
      };
    } catch (err: any) {
      this.logger.warn(
        `AI service unavailable or timed out (${err.message}). Engaging edge optical fallback...`,
      );
      return this.fallbackDetector.analyze(imagePayload, expectedCount, frameBytes);
    }
  }
}
