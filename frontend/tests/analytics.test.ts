import { describe, it, expect } from 'vitest';
import {
  calculatePeakAndTrough,
  calculateBaselineStats,
  calculateMedian,
  calculateRobustBaselineStats,
  calculateWindowTrajectory,
  calculateUtcDiurnalDistribution,
  detectSpikeCandidates,
  findCorrelatedSpikeCandidates,
  isFinitePoint,
  isValidTimestamp,
  getNormalizedEpochMs,
} from '../src/utils/analytics';
import { TimeseriesPoint } from '../src/types/api';

describe('Analytics Utility Module', () => {
  // ---------------------------------------------------------------------------
  // Validation & Normalization Helpers
  // ---------------------------------------------------------------------------
  describe('Validation & Normalization Helpers', () => {
    it('validates finite points correctly', () => {
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: 10.5 })).toBe(true);
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: 0 })).toBe(true);
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: -5 })).toBe(true);
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: NaN })).toBe(false);
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: Infinity })).toBe(false);
      expect(isFinitePoint({ timestamp: '2026-10-20T00:00:00Z', value: '10' as unknown as number })).toBe(false);
      expect(isFinitePoint(null)).toBe(false);
      expect(isFinitePoint(undefined)).toBe(false);
      expect(isFinitePoint({})).toBe(false);
    });

    it('validates timestamp strings correctly', () => {
      expect(isValidTimestamp('2026-10-20T12:00:00Z')).toBe(true);
      expect(isValidTimestamp('2026-10-20')).toBe(true);
      expect(isValidTimestamp('not-a-timestamp')).toBe(false);
      expect(isValidTimestamp('')).toBe(false);
      expect(isValidTimestamp('   ')).toBe(false);
    });

    it('normalizes valid timestamps to epoch milliseconds and rejects invalid ones', () => {
      const epochZ = getNormalizedEpochMs('2026-10-20T10:00:00Z');
      const epochOffset = getNormalizedEpochMs('2026-10-20T10:00:00+00:00');
      const epochMillis = getNormalizedEpochMs('2026-10-20T10:00:00.000Z');

      expect(epochZ).toBe(1792490400000);
      expect(epochOffset).toBe(epochZ);
      expect(epochMillis).toBe(epochZ);

      expect(getNormalizedEpochMs('invalid-date')).toBeNull();
      expect(getNormalizedEpochMs('')).toBeNull();
      expect(getNormalizedEpochMs('   ')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Peak and Trough Analysis
  // ---------------------------------------------------------------------------
  describe('calculatePeakAndTrough', () => {
    it('returns null for empty or invalid inputs', () => {
      expect(calculatePeakAndTrough(null)).toBeNull();
      expect(calculatePeakAndTrough(undefined)).toBeNull();
      expect(calculatePeakAndTrough([])).toBeNull();
      expect(
        calculatePeakAndTrough([
          { timestamp: '2026-10-20T00:00:00Z', value: NaN },
          { timestamp: '2026-10-20T01:00:00Z', value: Infinity },
        ])
      ).toBeNull();
    });

    it('identifies maximum and minimum points correctly', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 120.5 },
        { timestamp: '2026-10-20T01:00:00Z', value: 340.2 },
        { timestamp: '2026-10-20T02:00:00Z', value: 45.0 },
        { timestamp: '2026-10-20T03:00:00Z', value: 210.8 },
      ];

      const result = calculatePeakAndTrough(points);
      expect(result).not.toBeNull();
      expect(result?.peak).toEqual({ timestamp: '2026-10-20T01:00:00Z', value: 340.2 });
      expect(result?.trough).toEqual({ timestamp: '2026-10-20T02:00:00Z', value: 45.0 });
    });

    it('handles ties deterministically by selecting the earliest chronological occurrence', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T04:00:00Z', value: 300 },
        { timestamp: '2026-10-20T01:00:00Z', value: 50 },
        { timestamp: '2026-10-20T00:00:00Z', value: 50 },
        { timestamp: '2026-10-20T02:00:00Z', value: 300 },
      ];

      const result = calculatePeakAndTrough(points);
      expect(result?.peak).toEqual({ timestamp: '2026-10-20T02:00:00Z', value: 300 });
      expect(result?.trough).toEqual({ timestamp: '2026-10-20T00:00:00Z', value: 50 });
    });

    it('does not mutate the input array', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T02:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
      ];
      const copy = [...points];
      calculatePeakAndTrough(points);
      expect(points).toEqual(copy);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Baseline Statistics (Parametric & Robust)
  // ---------------------------------------------------------------------------
  describe('calculateBaselineStats & calculateRobustBaselineStats', () => {
    it('handles empty and invalid inputs safely', () => {
      expect(calculateBaselineStats(null)).toEqual({ count: 0, mean: null, stdDev: null });
      expect(calculateBaselineStats([])).toEqual({ count: 0, mean: null, stdDev: null });
      expect(calculateRobustBaselineStats(null)).toEqual({ count: 0, median: null, mad: null, scale: null });
      expect(calculateRobustBaselineStats([])).toEqual({ count: 0, median: null, mad: null, scale: null });
    });

    it('calculates exact median for odd and even length arrays', () => {
      expect(calculateMedian([3, 1, 2])).toBe(2);
      expect(calculateMedian([4, 1, 3, 2])).toBe(2.5);
      expect(calculateMedian([10])).toBe(10);
      expect(calculateMedian([])).toBe(0);
    });

    it('calculates parametric mean and population stdDev', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
        { timestamp: '2026-10-20T02:00:00Z', value: 30 },
        { timestamp: '2026-10-20T03:00:00Z', value: 40 },
      ];

      const stats = calculateBaselineStats(points);
      expect(stats.count).toBe(4);
      expect(stats.mean).toBe(25);
      expect(stats.stdDev).toBeCloseTo(Math.sqrt(125), 6);
    });

    it('calculates robust median and MAD scale on normal noisy data', () => {
      // Data: [8, 9, 10, 10, 11, 12, 10, 9, 11]
      // sorted: [8, 9, 9, 10, 10, 10, 11, 11, 12] -> median = 10
      // deviations: [2, 1, 1, 0, 0, 0, 1, 1, 2] -> sorted: [0, 0, 0, 1, 1, 1, 1, 2, 2] -> median = 1
      // scale = 1.4826 * 1.0 = 1.4826
      const points: TimeseriesPoint[] = [8, 9, 10, 10, 11, 12, 10, 9, 11].map((val, idx) => ({
        timestamp: `2026-10-20T0${idx}:00:00Z`,
        value: val,
      }));

      const robust = calculateRobustBaselineStats(points);
      expect(robust.count).toBe(9);
      expect(robust.median).toBe(10);
      expect(robust.mad).toBe(1);
      expect(robust.scale).toBeCloseTo(1.4826, 4);
    });

    it('falls back to MeanAD when MAD is zero (>50% identical values) preventing division by zero', () => {
      // 18 points of 10, 6 points of 100
      // median = 10
      // deviations: 18 zeros, 6 values of 90 -> median of deviations = 0 (MAD = 0)
      // fallback MeanAD = (6 * 90) / 24 = 22.5
      // scale = 1.2533 * 22.5 = 28.19925
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 18 }, (_, i) => ({
          timestamp: `2026-10-20T${i.toString().padStart(2, '0')}:00:00Z`,
          value: 10,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          timestamp: `2026-10-20T${(18 + i).toString().padStart(2, '0')}:00:00Z`,
          value: 100,
        })),
      ];

      const robust = calculateRobustBaselineStats(points);
      expect(robust.median).toBe(10);
      expect(robust.mad).toBe(0);
      expect(robust.scale).toBeCloseTo(1.2533 * 22.5, 4);
    });

    it('returns scale 0 for completely constant series (true zero variance)', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 50 },
        { timestamp: '2026-10-20T01:00:00Z', value: 50 },
        { timestamp: '2026-10-20T02:00:00Z', value: 50 },
      ];

      const robust = calculateRobustBaselineStats(points);
      expect(robust.median).toBe(50);
      expect(robust.mad).toBe(0);
      expect(robust.scale).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Window Trajectory
  // ---------------------------------------------------------------------------
  describe('calculateWindowTrajectory', () => {
    it('returns insufficient_data when series has fewer than 4 valid points', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
        { timestamp: '2026-10-20T02:00:00Z', value: 30 },
      ];

      const result = calculateWindowTrajectory(points);
      expect(result.status).toBe('insufficient_data');
      expect(result.percentageChange).toBeNull();
    });

    it('calculates positive trajectory for an increasing series', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 10 },
        { timestamp: '2026-10-20T02:00:00Z', value: 15 },
        { timestamp: '2026-10-20T03:00:00Z', value: 15 },
        { timestamp: '2026-10-20T04:00:00Z', value: 18 },
        { timestamp: '2026-10-20T05:00:00Z', value: 18 },
        { timestamp: '2026-10-20T06:00:00Z', value: 20 },
        { timestamp: '2026-10-20T07:00:00Z', value: 20 },
      ];

      const result = calculateWindowTrajectory(points);
      expect(result.status).toBe('valid');
      expect(result.initialQuarterMean).toBe(10);
      expect(result.finalQuarterMean).toBe(20);
      expect(result.percentageChange).toBe(100);
    });

    it('calculates negative trajectory for a decreasing series', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 100 },
        { timestamp: '2026-10-20T01:00:00Z', value: 80 },
        { timestamp: '2026-10-20T02:00:00Z', value: 50 },
        { timestamp: '2026-10-20T03:00:00Z', value: 25 },
      ];

      const result = calculateWindowTrajectory(points);
      expect(result.status).toBe('valid');
      expect(result.percentageChange).toBe(-75);
    });

    it('calculates 0% trajectory for a flat series', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 50 },
        { timestamp: '2026-10-20T01:00:00Z', value: 50 },
        { timestamp: '2026-10-20T02:00:00Z', value: 50 },
        { timestamp: '2026-10-20T03:00:00Z', value: 50 },
      ];

      const result = calculateWindowTrajectory(points);
      expect(result.status).toBe('valid');
      expect(result.percentageChange).toBe(0);
    });

    it('returns zero_baseline with null percentageChange when the initial quarter mean is zero', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 0 },
        { timestamp: '2026-10-20T01:00:00Z', value: 10 },
        { timestamp: '2026-10-20T02:00:00Z', value: 20 },
        { timestamp: '2026-10-20T03:00:00Z', value: 30 },
      ];

      const result = calculateWindowTrajectory(points);
      expect(result.status).toBe('zero_baseline');
      expect(result.percentageChange).toBeNull();
      expect(result.initialQuarterMean).toBe(0);
      expect(result.finalQuarterMean).toBe(30);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. UTC Diurnal Distribution
  // ---------------------------------------------------------------------------
  describe('calculateUtcDiurnalDistribution', () => {
    it('produces exactly 24 buckets with null averages for empty input', () => {
      const buckets = calculateUtcDiurnalDistribution([]);
      expect(buckets).toHaveLength(24);
      for (let h = 0; h < 24; h++) {
        expect(buckets[h]).toEqual({ hour: h, count: 0, average: null });
      }
    });

    it('averages observations by their UTC hour correctly across multiple days', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T14:15:00Z', value: 100 },
        { timestamp: '2026-10-21T14:45:00Z', value: 200 },
        { timestamp: '2026-10-20T03:00:00Z', value: 50 },
      ];

      const buckets = calculateUtcDiurnalDistribution(points);
      expect(buckets).toHaveLength(24);
      expect(buckets[14]).toEqual({ hour: 14, count: 2, average: 150 });
      expect(buckets[3]).toEqual({ hour: 3, count: 1, average: 50 });
      expect(buckets[0]).toEqual({ hour: 0, count: 0, average: null });
    });

    it('skips invalid timestamps and non-finite values safely', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: 'not-a-valid-date', value: 100 },
        { timestamp: '2026-10-20T05:00:00Z', value: NaN },
        { timestamp: '2026-10-20T05:00:00Z', value: 60 },
      ];

      const buckets = calculateUtcDiurnalDistribution(points);
      expect(buckets[5]).toEqual({ hour: 5, count: 1, average: 60 });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Spike Candidates Detection (Robust Modified Z-Score)
  // ---------------------------------------------------------------------------
  describe('detectSpikeCandidates', () => {
    it('returns insufficient_data for fewer than 2 points', () => {
      const result = detectSpikeCandidates([{ timestamp: '2026-10-20T00:00:00Z', value: 100 }]);
      expect(result.status).toBe('insufficient_data');
      expect(result.candidates).toEqual([]);
    });

    it('returns zero_variance when all values are identical', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 50 },
        { timestamp: '2026-10-20T01:00:00Z', value: 50 },
        { timestamp: '2026-10-20T02:00:00Z', value: 50 },
      ];

      const result = detectSpikeCandidates(points);
      expect(result.status).toBe('zero_variance');
      expect(result.baselineScale).toBe(0);
      expect(result.candidates).toEqual([]);
    });

    it('detects isolated spikes using robust baseline', () => {
      // 9 points at 10, 1 point at 100
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 100 },
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      expect(result.method).toBe('robust_modified_z');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].timestamp).toBe('2026-10-20T10:00:00Z');
      expect(result.candidates[0].value).toBe(100);
      expect(result.candidates[0].score).toBeGreaterThanOrEqual(2.0);
      expect(result.candidates[0].zScore).toBe(result.candidates[0].score);
    });

    it('detects sustained elevated runs in a short window that would be masked by standard stdDev', () => {
      // 24-hour window: 18 hours at 10, 6 hours at 100
      // In standard stdDev z-score: mean = 32.5, stdDev = 38.97 -> z = (100 - 32.5)/38.97 = 1.73 < 2.0 (MASKED!)
      // In robust modified z-score: median = 10, scale = 28.2 -> score = 90 / 28.2 = 3.19 >= 2.0 (DETECTED!)
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 18 }, (_, i) => ({
          timestamp: `2026-10-20T${i.toString().padStart(2, '0')}:00:00Z`,
          value: 10,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          timestamp: `2026-10-20T${(18 + i).toString().padStart(2, '0')}:00:00Z`,
          value: 100,
        })),
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      // All 6 sustained attack points are properly detected
      expect(result.candidates).toHaveLength(6);
      for (const candidate of result.candidates) {
        expect(candidate.value).toBe(100);
        expect(candidate.score).toBeCloseTo(3.19, 1);
      }
    });

    it('handles zero baselines with an outlier safely', () => {
      // 5 points at 0, 1 point at 50
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 0 },
        { timestamp: '2026-10-20T01:00:00Z', value: 0 },
        { timestamp: '2026-10-20T02:00:00Z', value: 0 },
        { timestamp: '2026-10-20T03:00:00Z', value: 0 },
        { timestamp: '2026-10-20T04:00:00Z', value: 0 },
        { timestamp: '2026-10-20T05:00:00Z', value: 50 },
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].timestamp).toBe('2026-10-20T05:00:00Z');
      expect(result.candidates[0].value).toBe(50);
      expect(result.candidates[0].score).toBeGreaterThanOrEqual(2.0);
    });

    it('ignores non-finite values safely', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: NaN },
        { timestamp: '2026-10-20T02:00:00Z', value: Infinity },
        { timestamp: '2026-10-20T03:00:00Z', value: 10 },
        { timestamp: '2026-10-20T04:00:00Z', value: 100 },
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].value).toBe(100);
    });

    it('does not classify very low outliers below the median as upward spike candidates', () => {
      // 9 points at 100, 1 point at 0 (sharp downward drop)
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 100,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 0 },
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      // Upward spike candidates should NOT include the downward trough
      expect(result.candidates).toHaveLength(0);
    });

    it('respects a custom thresholdScore parameter', () => {
      // 8 points at 10, 1 point at 35 (moderate deviation), 1 point at 100 (large deviation)
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T08:00:00Z', value: 35 },
        { timestamp: '2026-10-20T09:00:00Z', value: 100 },
      ];

      const standardResult = detectSpikeCandidates(points, 2.0);
      expect(standardResult.thresholdScore).toBe(2.0);
      expect(standardResult.thresholdZScore).toBe(2.0);
      expect(standardResult.candidates.length).toBeGreaterThanOrEqual(1);

      // With a stricter custom threshold of 5.0, only the extreme spike remains
      const strictResult = detectSpikeCandidates(points, 5.0);
      expect(strictResult.thresholdScore).toBe(5.0);
      expect(strictResult.thresholdZScore).toBe(5.0);
      expect(strictResult.candidates).toHaveLength(1);
      expect(strictResult.candidates[0].value).toBe(100);
    });

    it('includes a candidate whose score is exactly equal to the threshold (inclusive comparison)', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
        { timestamp: '2026-10-20T01:00:00Z', value: 10 },
        { timestamp: '2026-10-20T02:00:00Z', value: 10 },
        { timestamp: '2026-10-20T03:00:00Z', value: 10 },
        { timestamp: '2026-10-20T04:00:00Z', value: 25 },
      ];

      const robustStats = calculateRobustBaselineStats(points);
      expect(robustStats.median).not.toBeNull();
      expect(robustStats.scale).not.toBeNull();

      const exactScore = (25 - robustStats.median!) / robustStats.scale!;

      // Setting thresholdScore equal to the exact score must include the candidate
      const resultExact = detectSpikeCandidates(points, exactScore);
      expect(resultExact.candidates).toHaveLength(1);
      expect(resultExact.candidates[0].value).toBe(25);
      expect(resultExact.candidates[0].score).toBe(exactScore);

      // Threshold slightly above the exact score excludes it
      const resultHigher = detectSpikeCandidates(points, exactScore + 0.001);
      expect(resultHigher.candidates).toHaveLength(0);
    });

    it('illustrates the limitation when elevated observations become the majority (>50%) of the window', () => {
      // 24-hour window where elevated values span 14 hours (majority of window)
      // 10 quiet baseline points at 10, 14 elevated points at 100
      const points: TimeseriesPoint[] = [
        ...Array.from({ length: 10 }, (_, i) => ({
          timestamp: `2026-10-20T${i.toString().padStart(2, '0')}:00:00Z`,
          value: 10,
        })),
        ...Array.from({ length: 14 }, (_, i) => ({
          timestamp: `2026-10-20T${(10 + i).toString().padStart(2, '0')}:00:00Z`,
          value: 100,
        })),
      ];

      const result = detectSpikeCandidates(points, 2.0);
      expect(result.status).toBe('valid');
      // When >50% of the sample is 100, the baseline median shifts to 100 (majority regime shift).
      // The detector treats 100 as the expected baseline and scores it as (100 - 100) / scale = 0.
      // Demonstrates the ~50% breakdown point limitation of median-based outlier detection.
      expect(result.baselineMedian).toBe(100);
      expect(result.candidates).toHaveLength(0);
    });

    it('does not mutate input array', () => {
      const points: TimeseriesPoint[] = [
        { timestamp: '2026-10-20T01:00:00Z', value: 20 },
        { timestamp: '2026-10-20T00:00:00Z', value: 10 },
      ];
      const copy = [...points];
      detectSpikeCandidates(points);
      expect(points).toEqual(copy);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Cross-Layer Candidate Correlation (Instant Matching)
  // ---------------------------------------------------------------------------
  describe('findCorrelatedSpikeCandidates', () => {
    it('correlates equivalent instants even with differing string formats (Z vs +00:00 vs .000Z)', () => {
      // Layer 3 spike formatted as "2026-10-20T10:00:00Z"
      const l3Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 100 },
      ];

      // Layer 7 spike formatted as "2026-10-20T10:00:00.000+00:00"
      const l7Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00+00:00`,
          value: 5,
        })),
        { timestamp: '2026-10-20T10:00:00.000+00:00', value: 80 },
      ];

      const result = findCorrelatedSpikeCandidates(l3Points, l7Points, 2.0);

      // Equivalent instant must be recognized as correlated!
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].timestamp).toBe('2026-10-20T10:00:00Z');
      expect(result.candidates[0].layer3Value).toBe(100);
      expect(result.candidates[0].layer7Value).toBe(80);
      expect(result.unalignedLayer3SpikesCount).toBe(0);
      expect(result.unalignedLayer7SpikesCount).toBe(0);
    });

    it('does not correlate different time instants', () => {
      const l3Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 100 },
      ];

      const l7Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 5,
        })),
        { timestamp: '2026-10-20T11:00:00Z', value: 80 }, // 1 hour later
      ];

      const result = findCorrelatedSpikeCandidates(l3Points, l7Points, 2.0);
      expect(result.candidates).toHaveLength(0);
      expect(result.unalignedLayer3SpikesCount).toBe(1);
      expect(result.unalignedLayer7SpikesCount).toBe(1);
    });

    it('ignores invalid timestamps safely without throwing and counts them as unaligned', () => {
      const l3Points: TimeseriesPoint[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: 'invalid-date-format', value: 100 },
        { timestamp: '2026-10-20T10:00:00Z', value: 100 },
      ];
      const l7Points: TimeseriesPoint[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 5,
        })),
        { timestamp: 'another-invalid-date', value: 80 },
        { timestamp: '2026-10-20T10:00:00Z', value: 80 },
      ];

      let result!: ReturnType<typeof findCorrelatedSpikeCandidates>;
      expect(() => {
        result = findCorrelatedSpikeCandidates(l3Points, l7Points, 2.0);
      }).not.toThrow();

      // Only the valid instant at 10:00Z should correlate
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].timestamp).toBe('2026-10-20T10:00:00Z');
      // The invalid timestamp candidates are safely counted in unaligned counts without throwing
      expect(result.unalignedLayer3SpikesCount).toBe(1);
      expect(result.unalignedLayer7SpikesCount).toBe(1);
    });

    it('handles duplicate normalized timestamps deterministically retaining higher score candidate', () => {
      // L3 has two observations with identical instant, different values
      const l3Points: TimeseriesPoint[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 60 },
        { timestamp: '2026-10-20T10:00:00.000Z', value: 120 }, // higher value at same instant
      ];

      // L7 also has duplicate normalized timestamps (40 vs 90)
      const l7Points: TimeseriesPoint[] = [
        ...Array.from({ length: 8 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 5,
        })),
        { timestamp: '2026-10-20T10:00:00+00:00', value: 40 },
        { timestamp: '2026-10-20T10:00:00.000+00:00', value: 90 }, // higher value at same instant
      ];

      const result = findCorrelatedSpikeCandidates(l3Points, l7Points, 2.0);
      expect(result.candidates).toHaveLength(1);
      // Retained candidates in both layers should be the higher scoring ones
      expect(result.candidates[0].layer3Value).toBe(120);
      expect(result.candidates[0].layer7Value).toBe(90);
      expect(result.unalignedLayer3SpikesCount).toBe(0);
      expect(result.unalignedLayer7SpikesCount).toBe(0);
    });

    it('never sums Layer 3 and Layer 7 values', () => {
      const l3Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 10,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 100 },
      ];

      const l7Points: TimeseriesPoint[] = [
        ...Array.from({ length: 9 }, (_, i) => ({
          timestamp: `2026-10-20T0${i}:00:00Z`,
          value: 5,
        })),
        { timestamp: '2026-10-20T10:00:00Z', value: 80 },
      ];

      const result = findCorrelatedSpikeCandidates(l3Points, l7Points, 2.0);
      const candidate = result.candidates[0];

      expect(candidate.layer3Value).toBe(100);
      expect(candidate.layer7Value).toBe(80);
      // Verify no property contains the sum (180)
      expect(Object.values(candidate)).not.toContain(180);
    });

    it('does not mutate input arrays', () => {
      const l3: TimeseriesPoint[] = [{ timestamp: '2026-10-20T00:00:00Z', value: 10 }];
      const l7: TimeseriesPoint[] = [{ timestamp: '2026-10-20T00:00:00Z', value: 20 }];
      const copyL3 = [...l3];
      const copyL7 = [...l7];

      findCorrelatedSpikeCandidates(l3, l7);
      expect(l3).toEqual(copyL3);
      expect(l7).toEqual(copyL7);
    });
  });
});
