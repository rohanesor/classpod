/**
 * Multi-Frame Camera Detection & Consensus Aggregation Module
 *
 * Implements a 5-second multi-frame observation window with consensus aggregation
 * to establish a reliable baseline person count before starting the 90s attendance timer.
 */

export type CameraAnalysisState =
  | 'IDLE'
  | 'CAPTURING_5S'
  | 'ANALYZING'
  | 'ANALYSIS_COMPLETE'
  | 'ATTENDANCE_90S'
  | 'COMPLETED'
  | 'ERROR';

export interface BoundingBoxDetection {
  box: number[]; // [x1, y1, x2, y2]
  confidence: number;
  class?: string;
}

export interface FrameDetection {
  frameIndex: number;
  timestamp: number;
  personCount: number;
  confidence: number; // 0 to 1 or 0 to 100
  detections?: Array<{ box: number[]; confidence: number; class?: string }>;
  image?: string; // base64 or URL thumbnail
}

export interface CountConsensusCandidate {
  personCount: number;
  frequency: number;
  avgConfidence: number; // percentage (0-100)
  medianConfidence: number; // percentage (0-100)
  minConfidence: number; // percentage (0-100)
  maxConfidence: number; // percentage (0-100)
  score: number; // frequency * (avgConfidence / 100)
  frameIndices: number[];
}

export interface MultiFrameAggregationResult {
  success: boolean;
  personCount: number;
  confidence: number; // percentage (0-100)
  totalFramesCaptured: number;
  validFramesCount: number;
  consensusCandidates: CountConsensusCandidate[];
  selectedCandidate?: CountConsensusCandidate;
  isStable: boolean;
  stabilityPercentage: number;
  bestFrameImage?: string;
  errorMessage?: string;
}

/**
 * Normalizes confidence value to percentage (0 - 100).
 */
export function normalizeConfidence(conf: number): number {
  if (typeof conf !== 'number' || isNaN(conf) || conf === null || conf === undefined) {
    return 0;
  }
  if (conf > 0 && conf <= 1) {
    return Math.round(conf * 100);
  }
  return Math.min(100, Math.max(0, Math.round(conf)));
}

/**
 * Calculates the median of an array of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Aggregates a series of captured frame detections over a multi-second window
 * to determine the dominant, high-confidence person count.
 *
 * Rejects isolated frame anomalies (e.g. sudden occlusion or glare) by computing
 * frequency distribution and weighted confidence consensus across all valid frames.
 *
 * @param frames Array of FrameDetection objects collected during the capture window
 * @param minFramesRequired Minimum valid frames needed to achieve consensus (default: 3)
 */
export function aggregateFrameDetections(
  frames: FrameDetection[],
  minFramesRequired = 3,
): MultiFrameAggregationResult {
  if (!frames || frames.length === 0) {
    return {
      success: false,
      personCount: 0,
      confidence: 0,
      totalFramesCaptured: 0,
      validFramesCount: 0,
      consensusCandidates: [],
      isStable: false,
      stabilityPercentage: 0,
      errorMessage: `Insufficient valid frames captured for reliable analysis (minimum ${minFramesRequired} required)`,
    };
  }

  // Filter valid frames (non-negative person count, non-NaN and non-negative confidence)
  const validFrames = frames.filter(
    (f) =>
      f !== null &&
      typeof f === 'object' &&
      typeof f.personCount === 'number' &&
      !isNaN(f.personCount) &&
      f.personCount >= 0 &&
      typeof f.confidence === 'number' &&
      !isNaN(f.confidence) &&
      f.confidence >= 0,
  );

  if (validFrames.length < minFramesRequired) {
    return {
      success: false,
      personCount: 0,
      confidence: 0,
      totalFramesCaptured: frames.length,
      validFramesCount: validFrames.length,
      consensusCandidates: [],
      isStable: false,
      stabilityPercentage: 0,
      errorMessage: `Insufficient valid frames captured for reliable analysis (minimum ${minFramesRequired} required)`,
    };
  }

  // Group frames by person count
  const countMap = new Map<
    number,
    {
      confidences: number[];
      indices: number[];
      images: Array<{ img: string; conf: number }>;
    }
  >();

  for (const frame of validFrames) {
    const count = Math.round(frame.personCount);
    const normConf = normalizeConfidence(frame.confidence);

    if (!countMap.has(count)) {
      countMap.set(count, { confidences: [], indices: [], images: [] });
    }

    const entry = countMap.get(count)!;
    entry.confidences.push(normConf);
    entry.indices.push(frame.frameIndex);
    if (frame.image) {
      entry.images.push({ img: frame.image, conf: normConf });
    }
  }

  // Build candidate stats for each distinct person count
  const candidates: CountConsensusCandidate[] = [];

  for (const [personCount, data] of countMap.entries()) {
    const frequency = data.confidences.length;
    const sumConf = data.confidences.reduce((sum, c) => sum + c, 0);
    const avgConf = Math.round(sumConf / frequency);
    const medianConf = calculateMedian(data.confidences);
    const minConf = Math.min(...data.confidences);
    const maxConf = Math.max(...data.confidences);

    // Score combines frequency and average confidence: frequency * (avgConfidence / 100)
    const score = Number((frequency * (avgConf / 100)).toFixed(3));

    candidates.push({
      personCount,
      frequency,
      avgConfidence: avgConf,
      medianConfidence: medianConf,
      minConfidence: minConf,
      maxConfidence: maxConf,
      score,
      frameIndices: data.indices,
    });
  }

  // Sort candidates by:
  // 1. Primary: Frequency descending (dominant consensus)
  // 2. Secondary: Average confidence descending
  // 3. Tertiary: Score descending
  candidates.sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    if (b.avgConfidence !== a.avgConfidence) {
      return b.avgConfidence - a.avgConfidence;
    }
    return b.score - a.score;
  });

  const selected = candidates[0]!;
  const stabilityPercentage = Math.round((selected.frequency / validFrames.length) * 100);
  const isStable = stabilityPercentage >= 50;

  // Pick best frame image from the winning candidate with the highest confidence
  let bestImage: string | undefined;
  const winningData = countMap.get(selected.personCount);
  if (winningData && winningData.images.length > 0) {
    winningData.images.sort((a, b) => b.conf - a.conf);
    bestImage = winningData.images[0]?.img;
  } else {
    // Fallback: any valid frame image with highest confidence
    const framesWithImages = validFrames.filter((f) => Boolean(f.image));
    if (framesWithImages.length > 0) {
      framesWithImages.sort(
        (a, b) => normalizeConfidence(b.confidence) - normalizeConfidence(a.confidence),
      );
      bestImage = framesWithImages[0]?.image;
    }
  }

  return {
    success: true,
    personCount: selected.personCount,
    confidence: selected.avgConfidence,
    totalFramesCaptured: frames.length,
    validFramesCount: validFrames.length,
    consensusCandidates: candidates,
    selectedCandidate: selected,
    isStable,
    stabilityPercentage,
    bestFrameImage: bestImage,
  };
}
