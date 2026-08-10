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
 * Calculates Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2].
 */
export function calculateIoU(boxA: number[], boxB: number[]): number {
  if (!boxA || !boxB || boxA.length < 4 || boxB.length < 4) return 0;

  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const interX1 = Math.max(ax1!, bx1!);
  const interY1 = Math.max(ay1!, by1!);
  const interX2 = Math.min(ax2!, bx2!);
  const interY2 = Math.min(ay2!, by2!);

  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);

  const areaA = (ax2! - ax1!) * (ay2! - ay1!);
  const areaB = (bx2! - bx1!) * (by2! - by1!);

  const unionArea = areaA + areaB - interArea;
  if (unionArea <= 0) return 0;

  return interArea / unionArea;
}

/**
 * Checks if Box A is substantially nested / contained within Box B (e.g. raised arm box inside body box).
 */
export function isBoxNested(boxA: number[], boxB: number[], threshold = 0.65): boolean {
  if (!boxA || !boxB || boxA.length < 4 || boxB.length < 4) return false;

  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const interX1 = Math.max(ax1!, bx1!);
  const interY1 = Math.max(ay1!, by1!);
  const interX2 = Math.min(ax2!, bx2!);
  const interY2 = Math.min(ay2!, by2!);

  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
  const areaA = (ax2! - ax1!) * (ay2! - ay1!);

  if (areaA <= 0) return false;
  // If >65% of Box A is enclosed inside Box B and Box A is smaller than Box B
  const areaB = (bx2! - bx1!) * (by2! - by1!);
  return (interArea / areaA) >= threshold && areaA < areaB;
}

/**
 * Filters out nested bounding boxes (e.g. raised arms, hands, split body parts) within a single frame.
 */
export function suppressNestedBoxes(detections: BoundingBoxDetection[]): BoundingBoxDetection[] {
  if (!detections || detections.length <= 1) return detections || [];

  // Sort boxes by area descending (largest person body boxes first)
  const sorted = [...detections].sort((a, b) => {
    const areaA = (a.box[2]! - a.box[0]!) * (a.box[3]! - a.box[1]!);
    const areaB = (b.box[2]! - b.box[0]!) * (b.box[3]! - b.box[1]!);
    return areaB - areaA;
  });

  const kept: BoundingBoxDetection[] = [];

  for (const candidate of sorted) {
    let isDuplicateNested = false;
    for (const master of kept) {
      if (isBoxNested(candidate.box, master.box, 0.60) || calculateIoU(candidate.box, master.box) > 0.75) {
        isDuplicateNested = true;
        break;
      }
    }
    if (!isDuplicateNested) {
      kept.push(candidate);
    }
  }

  return kept;
}

export interface PersonTrack {
  trackId: number;
  lastBox: number[];
  lastFrameIdx: number;
  hitCount: number;
  coastingFrames: number;
  confidences: number[];
}

/**
 * Dynamic Multi-Object Trajectory Tracking Engine across capture frames.
 * Associates bounding boxes using IoU and centroid distance, maintaining persistent track IDs
 * for moving students while filtering transient motion anomalies.
 */
export function trackMultiFrameDetections(frames: FrameDetection[]): {
  uniqueTrackCount: number;
  tracks: PersonTrack[];
} {
  const activeTracks: PersonTrack[] = [];
  let nextTrackId = 1;

  for (const frame of frames) {
    const rawDetections = frame.detections || [];
    const cleanDetections = suppressNestedBoxes(rawDetections);

    // Increment coasting counter for existing tracks
    for (const track of activeTracks) {
      track.coastingFrames += 1;
    }

    // Match clean detections to existing active tracks
    for (const det of cleanDetections) {
      let bestTrack: PersonTrack | null = null;
      let bestScore = 0.25; // Minimum IoU/similarity threshold to match

      for (const track of activeTracks) {
        if (track.coastingFrames > 3) continue; // Skip stale tracks lost for >3 frames (~1.2s)
        const iou = calculateIoU(det.box, track.lastBox);
        if (iou > bestScore) {
          bestScore = iou;
          bestTrack = track;
        }
      }

      if (bestTrack) {
        // Matched to existing moving trajectory
        bestTrack.lastBox = det.box;
        bestTrack.lastFrameIdx = frame.frameIndex;
        bestTrack.hitCount += 1;
        bestTrack.coastingFrames = 0;
        bestTrack.confidences.push(normalizeConfidence(det.confidence));
      } else {
        // New student trajectory detected
        activeTracks.push({
          trackId: nextTrackId++,
          lastBox: det.box,
          lastFrameIdx: frame.frameIndex,
          hitCount: 1,
          coastingFrames: 0,
          confidences: [normalizeConfidence(det.confidence)],
        });
      }
    }
  }

  // Filter valid persistent tracks (seen in >= 25% of captured frames or min 2 hits)
  const minHits = Math.max(2, Math.floor(frames.length * 0.25));
  const validTracks = activeTracks.filter((t) => t.hitCount >= minHits);

  return {
    uniqueTrackCount: validTracks.length,
    tracks: validTracks,
  };
}

/**
 * Aggregates a series of captured frame detections over a multi-second window
 * to determine the dominant, high-confidence person count.
 *
 * Rejects isolated frame anomalies (e.g. sudden movement, hand raising, or glare) by computing
 * frequency distribution, trajectory tracking, and weighted confidence consensus across all valid frames.
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

  // Sanitize and apply nested box suppression to every frame
  const sanitizedFrames: FrameDetection[] = frames.map((f) => {
    if (!f || typeof f !== 'object') return f;
    if (f.detections && Array.isArray(f.detections) && f.detections.length > 0) {
      const cleanDets = suppressNestedBoxes(f.detections);
      return {
        ...f,
        personCount: cleanDets.length,
        detections: cleanDets,
      };
    }
    return f;
  });

  // Filter valid frames (non-negative person count, non-NaN and non-negative confidence)
  const validFrames = sanitizedFrames.filter(
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

  // Run Trajectory Tracking Engine if bounding boxes exist
  const framesWithDets = validFrames.filter((f) => f.detections && f.detections.length > 0);
  let trackingResult: { uniqueTrackCount: number; tracks: PersonTrack[] } | null = null;

  if (framesWithDets.length >= Math.min(2, minFramesRequired)) {
    trackingResult = trackMultiFrameDetections(validFrames);
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

    // Score combines frequency, trajectory tracking boost, and average confidence
    let trajectoryBonus = 1.0;
    if (trackingResult && trackingResult.uniqueTrackCount === personCount) {
      trajectoryBonus = 1.25; // 25% score boost when count matches persistent multi-frame trajectories
    }

    const score = Number((frequency * (avgConf / 100) * trajectoryBonus).toFixed(3));

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
  // 1. Primary: Trajectory & score weighted consensus descending
  // 2. Secondary: Frequency descending
  // 3. Tertiary: Average confidence descending
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    return b.avgConfidence - a.avgConfidence;
  });

  // If trajectory tracking uniquely identified persistent tracks, ensure trajectory consensus takes priority
  let selected = candidates[0]!;
  if (
    trackingResult &&
    trackingResult.uniqueTrackCount > 0 &&
    countMap.has(trackingResult.uniqueTrackCount)
  ) {
    const trackedCandidate = candidates.find(
      (c) => c.personCount === trackingResult!.uniqueTrackCount,
    );
    if (trackedCandidate && trackedCandidate.frequency >= Math.floor(validFrames.length * 0.3)) {
      selected = trackedCandidate;
    }
  }

  const stabilityPercentage = Math.round((selected.frequency / validFrames.length) * 100);
  const isStable = stabilityPercentage >= 40;

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
