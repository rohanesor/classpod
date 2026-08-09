/* eslint-disable */
const assert = require('assert');
const { aggregateFrameDetections, normalizeConfidence } = require('../dist');

console.log('Testing Multi-Frame Detection Consensus Aggregation...');

// Test 1: normalizeConfidence
assert.strictEqual(normalizeConfidence(0.95), 95, '0.95 should normalize to 95');
assert.strictEqual(normalizeConfidence(0.964), 96, '0.964 should normalize to 96');
assert.strictEqual(normalizeConfidence(88), 88, '88 should normalize to 88');
assert.strictEqual(normalizeConfidence(0), 0, '0 should normalize to 0');
assert.strictEqual(normalizeConfidence(1), 100, '1 should normalize to 100');
console.log('✔ normalizeConfidence passed');

// Test 2: Dominant consensus (User specification example)
const framesSpec = [
  { frameIndex: 0, timestamp: 1000, personCount: 31, confidence: 0.88, image: 'img_31_1' },
  { frameIndex: 1, timestamp: 1500, personCount: 32, confidence: 0.94, image: 'img_32_1' },
  { frameIndex: 2, timestamp: 2000, personCount: 32, confidence: 0.96, image: 'img_32_2' },
  { frameIndex: 3, timestamp: 2500, personCount: 32, confidence: 0.95, image: 'img_32_3' },
  { frameIndex: 4, timestamp: 3000, personCount: 31, confidence: 0.89, image: 'img_31_2' },
  { frameIndex: 5, timestamp: 3500, personCount: 32, confidence: 0.97, image: 'img_32_4' },
];

const res1 = aggregateFrameDetections(framesSpec, 3);
assert.strictEqual(res1.success, true);
assert.strictEqual(res1.personCount, 32, 'Consensus count should be 32');
assert(res1.confidence >= 95, `Confidence ${res1.confidence} should be >= 95%`);
assert.strictEqual(res1.isStable, true);
assert.strictEqual(res1.stabilityPercentage, 67);
assert.strictEqual(res1.bestFrameImage, 'img_32_4');
console.log('✔ Dominant consensus example passed (Count: 32, Conf: ' + res1.confidence + '%)');

// Test 3: Anomaly rejection
const framesAnomaly = [
  { frameIndex: 0, timestamp: 1000, personCount: 30, confidence: 0.92 },
  { frameIndex: 1, timestamp: 1500, personCount: 5, confidence: 0.40 }, // Anomaly frame
  { frameIndex: 2, timestamp: 2000, personCount: 30, confidence: 0.94 },
  { frameIndex: 3, timestamp: 2500, personCount: 30, confidence: 0.91 },
  { frameIndex: 4, timestamp: 3000, personCount: 30, confidence: 0.95 },
];

const res2 = aggregateFrameDetections(framesAnomaly, 3);
assert.strictEqual(res2.success, true);
assert.strictEqual(res2.personCount, 30, 'Anomaly 5 should be ignored; count should be 30');
assert.strictEqual(res2.selectedCandidate.frequency, 4);
console.log('✔ Anomaly rejection passed (Count: 30, Frequency: 4/5)');

// Test 4: Insufficient frames (< 3 frames)
const framesInsufficient = [
  { frameIndex: 0, timestamp: 1000, personCount: 25, confidence: 0.90 },
  { frameIndex: 1, timestamp: 1500, personCount: 25, confidence: 0.92 },
];
const res3 = aggregateFrameDetections(framesInsufficient, 3);
assert.strictEqual(res3.success, false);
assert.strictEqual(res3.personCount, 0);
assert(res3.errorMessage.includes('Insufficient valid frames captured'));
console.log('✔ Insufficient frames protection passed');

// Test 5: Empty frames array
const res4 = aggregateFrameDetections([], 3);
assert.strictEqual(res4.success, false);
assert.strictEqual(res4.personCount, 0);
console.log('✔ Empty frames handling passed');

console.log('==============================================');
console.log('ALL MULTI-FRAME CONSENSUS AGGREGATOR TESTS PASSED!');
console.log('==============================================');
