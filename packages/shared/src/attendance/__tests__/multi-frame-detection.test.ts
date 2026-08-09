import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateFrameDetections,
  normalizeConfidence,
  calculateMedian,
} from '../multi-frame-detection.ts';
import type { FrameDetection } from '../multi-frame-detection.ts';

describe('Multi-Frame Camera Detection & Consensus Aggregator', () => {
  describe('normalizeConfidence', () => {
    it('normalizes 0-1 range to 0-100 percentage', () => {
      assert.equal(normalizeConfidence(0.95), 95);
      assert.equal(normalizeConfidence(0.5), 50);
      assert.equal(normalizeConfidence(0.854), 85);
      assert.equal(normalizeConfidence(1), 100);
      assert.equal(normalizeConfidence(0), 0);
    });

    it('handles 0-100 percentage range directly', () => {
      assert.equal(normalizeConfidence(88), 88);
      assert.equal(normalizeConfidence(100), 100);
      assert.equal(normalizeConfidence(105), 100);
    });

    it('handles invalid or out-of-range confidence values safely', () => {
      assert.equal(normalizeConfidence(NaN), 0);
      assert.equal(normalizeConfidence(-10), 0);
      // @ts-expect-error test null input
      assert.equal(normalizeConfidence(null), 0);
      // @ts-expect-error test undefined input
      assert.equal(normalizeConfidence(undefined), 0);
    });
  });

  describe('calculateMedian', () => {
    it('returns 0 for empty arrays', () => {
      assert.equal(calculateMedian([]), 0);
    });

    it('calculates median for odd-length arrays', () => {
      assert.equal(calculateMedian([80, 95, 90]), 90);
      assert.equal(calculateMedian([50]), 50);
    });

    it('calculates median for even-length arrays by averaging mid elements', () => {
      assert.equal(calculateMedian([80, 90]), 85);
      assert.equal(calculateMedian([70, 80, 90, 100]), 85);
    });
  });

  describe('aggregateFrameDetections', () => {
    it('1. Stable counts: 5 of 6 frames detect 32 -> outputs 32 with high stability', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 32, confidence: 0.92, image: 'img0' },
        { frameIndex: 1, timestamp: 2000, personCount: 32, confidence: 0.95, image: 'img1' },
        { frameIndex: 2, timestamp: 3000, personCount: 32, confidence: 0.88, image: 'img2' },
        { frameIndex: 3, timestamp: 4000, personCount: 31, confidence: 0.80, image: 'img3' },
        { frameIndex: 4, timestamp: 5000, personCount: 32, confidence: 0.94, image: 'img4' },
        { frameIndex: 5, timestamp: 6000, personCount: 32, confidence: 0.91, image: 'img5' },
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.personCount, 32);
      assert.equal(result.totalFramesCaptured, 6);
      assert.equal(result.validFramesCount, 6);
      assert.equal(result.isStable, true);
      assert.equal(result.stabilityPercentage, 83); // 5 / 6 = 83%
      assert.equal(result.confidence, 92); // (92+95+88+94+91)/5 = 92
      assert.equal(result.bestFrameImage, 'img1'); // highest confidence frame among count=32
      assert.equal(result.selectedCandidate?.frequency, 5);
      assert.deepEqual(result.selectedCandidate?.frameIndices, [0, 1, 2, 4, 5]);
    });

    it('2. Anomaly rejection: 1 anomalous frame of 5 people in a 30-person room is ignored', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 30, confidence: 0.89 },
        { frameIndex: 1, timestamp: 2000, personCount: 30, confidence: 0.91 },
        { frameIndex: 2, timestamp: 3000, personCount: 5, confidence: 0.99 }, // Anomaly frame (e.g. brief obstruction)
        { frameIndex: 3, timestamp: 4000, personCount: 30, confidence: 0.88 },
        { frameIndex: 4, timestamp: 5000, personCount: 30, confidence: 0.93 },
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.personCount, 30);
      assert.equal(result.isStable, true);
      assert.equal(result.stabilityPercentage, 80); // 4 of 5 frames
      assert.equal(result.consensusCandidates.length, 2);
      assert.equal(result.consensusCandidates[0]?.personCount, 30);
      assert.equal(result.consensusCandidates[1]?.personCount, 5);
      assert.equal(result.consensusCandidates[1]?.frequency, 1);
    });

    it('3. Confidence weighting tie-breaking: when frequencies match, higher confidence wins', () => {
      const frames: FrameDetection[] = [
        // 2 frames with count 20, high confidence (90%)
        { frameIndex: 0, timestamp: 1000, personCount: 20, confidence: 0.90, image: 'count20_img1' },
        { frameIndex: 1, timestamp: 2000, personCount: 20, confidence: 0.92, image: 'count20_img2' },
        // 2 frames with count 25, lower confidence (60%)
        { frameIndex: 2, timestamp: 3000, personCount: 25, confidence: 0.58, image: 'count25_img1' },
        { frameIndex: 3, timestamp: 4000, personCount: 25, confidence: 0.62, image: 'count25_img2' },
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.personCount, 20);
      assert.equal(result.confidence, 91); // avg of 90 and 92
      assert.equal(result.bestFrameImage, 'count20_img2');
      assert.equal(result.consensusCandidates[0]?.personCount, 20);
      assert.equal(result.consensusCandidates[1]?.personCount, 25);
    });

    it('4. Insufficient frames: < 3 frames returns error result', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 15, confidence: 0.95 },
        { frameIndex: 1, timestamp: 2000, personCount: 15, confidence: 0.90 },
      ];

      const result = aggregateFrameDetections(frames, 3);

      assert.equal(result.success, false);
      assert.equal(result.personCount, 0);
      assert.equal(result.confidence, 0);
      assert.equal(result.totalFramesCaptured, 2);
      assert.equal(result.validFramesCount, 2);
      assert.equal(result.isStable, false);
      assert.equal(
        result.errorMessage,
        'Insufficient valid frames captured for reliable analysis (minimum 3 required)',
      );
    });

    it('5. Empty frames array: returns error result', () => {
      const result = aggregateFrameDetections([]);

      assert.equal(result.success, false);
      assert.equal(result.personCount, 0);
      assert.equal(result.confidence, 0);
      assert.equal(result.totalFramesCaptured, 0);
      assert.equal(result.validFramesCount, 0);
      assert.equal(result.consensusCandidates.length, 0);
      assert.equal(result.isStable, false);
      assert.equal(
        result.errorMessage,
        'Insufficient valid frames captured for reliable analysis (minimum 3 required)',
      );
    });

    it('6. Invalid frames filtering: filters out negative counts and NaN confidences', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 12, confidence: 0.90 },
        { frameIndex: 1, timestamp: 2000, personCount: -1, confidence: 0.85 }, // Invalid negative personCount
        { frameIndex: 2, timestamp: 3000, personCount: 12, confidence: NaN }, // Invalid NaN confidence
        { frameIndex: 3, timestamp: 4000, personCount: 12, confidence: 0.88 },
        { frameIndex: 4, timestamp: 5000, personCount: 12, confidence: 0.92 },
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.totalFramesCaptured, 5);
      assert.equal(result.validFramesCount, 3);
      assert.equal(result.personCount, 12);
      assert.equal(result.isStable, true);
      assert.equal(result.stabilityPercentage, 100); // 3 of 3 valid frames
    });

    it('7. Low stability detection: detects unstable counts when no consensus reaches >= 50%', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 10, confidence: 0.80 },
        { frameIndex: 1, timestamp: 2000, personCount: 15, confidence: 0.82 },
        { frameIndex: 2, timestamp: 3000, personCount: 20, confidence: 0.85 },
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.isStable, false);
      assert.equal(result.stabilityPercentage, 33); // 1 of 3 frames (33%)
    });

    it('8. Fallback bestFrameImage: picks highest confidence frame when winning candidate has no image', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 10, confidence: 0.80 }, // winning count, no image
        { frameIndex: 1, timestamp: 2000, personCount: 10, confidence: 0.85 }, // winning count, no image
        { frameIndex: 2, timestamp: 3000, personCount: 10, confidence: 0.90 }, // winning count, no image
        { frameIndex: 3, timestamp: 4000, personCount: 5, confidence: 0.99, image: 'fallback_image' }, // other count, has image
      ];

      const result = aggregateFrameDetections(frames);

      assert.equal(result.success, true);
      assert.equal(result.personCount, 10);
      assert.equal(result.bestFrameImage, 'fallback_image');
    });

    it('9. Custom minFramesRequired threshold works as expected', () => {
      const frames: FrameDetection[] = [
        { frameIndex: 0, timestamp: 1000, personCount: 8, confidence: 0.9 },
        { frameIndex: 1, timestamp: 2000, personCount: 8, confidence: 0.9 },
        { frameIndex: 2, timestamp: 3000, personCount: 8, confidence: 0.9 },
      ];

      // With default minFramesRequired = 3 -> success
      const resultDefault = aggregateFrameDetections(frames);
      assert.equal(resultDefault.success, true);

      // With custom minFramesRequired = 5 -> insufficient
      const resultCustom = aggregateFrameDetections(frames, 5);
      assert.equal(resultCustom.success, false);
      assert.equal(
        resultCustom.errorMessage,
        'Insufficient valid frames captured for reliable analysis (minimum 5 required)',
      );
    });
  });
});
