/**
 * Pure Analytics Utility Module for CyberPulse Time-Series Telemetry.
 *
 * METRIC SEMANTICS & CONSTRAINTS:
 * - Source metrics originate from Cloudflare Radar API v4 endpoints (Layer 3 & Layer 7).
 * - Values represent normalized upstream activity scores/percentages. They must NOT be
 *   treated as absolute packet counts, byte volumes, or attack instance counts.
 * - Layer 3 (transport-layer network flood) and Layer 7 (application-layer HTTP mitigation)
 *   metrics represent fundamentally distinct phenomena and are incommensurable. They must
 *   never be summed or subtracted as if they shared a common unit.
 * - All utility functions in this module are pure, deterministic, and do not mutate inputs.
 */

import { TimeseriesPoint } from '../types/api';

// -----------------------------------------------------------------------------
// Validation & Timestamp Helpers
// -----------------------------------------------------------------------------

/**
 * Validates whether an entity is a well-formed TimeseriesPoint with a finite number value.
 */
export function isFinitePoint(pt: unknown): pt is TimeseriesPoint {
  if (!pt || typeof pt !== 'object') return false;
  const p = pt as TimeseriesPoint;
  return (
    typeof p.timestamp === 'string' &&
    typeof p.value === 'number' &&
    Number.isFinite(p.value)
  );
}

/**
 * Validates whether a timestamp string parses to a valid finite millisecond epoch.
 */
export function isValidTimestamp(timestamp: string): boolean {
  if (typeof timestamp !== 'string' || !timestamp.trim()) return false;
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time);
}

/**
 * Safely normalizes an ISO timestamp string to epoch milliseconds.
 * Returns null if the timestamp string is missing, invalid, or unparseable.
 */
export function getNormalizedEpochMs(timestamp: string): number | null {
  if (typeof timestamp !== 'string' || !timestamp.trim()) return null;
  const ms = new Date(timestamp).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// -----------------------------------------------------------------------------
// 1. Peak and Trough Analysis
// -----------------------------------------------------------------------------

export interface PeakAndTroughResult {
  peak: TimeseriesPoint;
  trough: TimeseriesPoint;
}

/**
 * Identifies the maximum (peak) and minimum (trough) valid points in a time series.
 *
 * - Filters out null, non-numeric, or non-finite values.
 * - Returns `null` if the input is empty, null/undefined, or contains no finite points.
 * - Ties are broken deterministically by selecting the chronologically earliest point.
 * - Does not mutate the input array.
 */
export function calculatePeakAndTrough(
  points?: TimeseriesPoint[] | null
): PeakAndTroughResult | null {
  if (!points || !Array.isArray(points)) return null;

  const valid = points.filter(isFinitePoint);
  if (valid.length === 0) return null;

  // Sort chronologically to ensure deterministic tie-breaking (earliest timestamp wins)
  const sorted = [...valid].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }
    return a.timestamp.localeCompare(b.timestamp);
  });

  let peak = sorted[0];
  let trough = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const pt = sorted[i];
    if (pt.value > peak.value) {
      peak = pt;
    }
    if (pt.value < trough.value) {
      trough = pt;
    }
  }

  return {
    peak: { timestamp: peak.timestamp, value: peak.value },
    trough: { timestamp: trough.timestamp, value: trough.value },
  };
}

// -----------------------------------------------------------------------------
// 2. Baseline Statistics (Parametric & Robust)
// -----------------------------------------------------------------------------

export interface BaselineStats {
  count: number;
  mean: number | null;
  stdDev: number | null;
}

/**
 * Calculates conventional arithmetic mean and population standard deviation.
 *
 * - Non-finite or missing values are strictly ignored and NOT treated as zeros.
 * - Returns `{ count: 0, mean: null, stdDev: null }` for empty or invalid inputs.
 * - Population standard deviation for N = 1 is 0.0.
 * - Does not mutate the input array.
 */
export function calculateBaselineStats(
  points?: TimeseriesPoint[] | null
): BaselineStats {
  if (!points || !Array.isArray(points)) {
    return { count: 0, mean: null, stdDev: null };
  }

  const validValues = points.filter(isFinitePoint).map((p) => p.value);
  const count = validValues.length;

  if (count === 0) {
    return { count: 0, mean: null, stdDev: null };
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  if (count === 1) {
    return { count: 1, mean, stdDev: 0 };
  }

  const varianceSum = validValues.reduce((acc, val) => {
    const diff = val - mean;
    return acc + diff * diff;
  }, 0);

  const stdDev = Math.sqrt(varianceSum / count);

  return { count, mean, stdDev };
}

/**
 * Calculates the exact median of a numeric array.
 * Pure and deterministic; sorts a defensive copy.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface RobustBaselineStats {
  count: number;
  median: number | null;
  mad: number | null;
  scale: number | null;
}

/**
 * Calculates robust baseline center and dispersion using Median and Median Absolute Deviation (MAD).
 *
 * STATISTICAL METHODOLOGY & MASKING MITIGATION:
 * Conventional standard-deviation z-scores ((x - μ) / σ) suffer from severe outlier masking:
 * an extreme observation, or a sustained elevated run of attacks, inflates both the mean and
 * standard deviation, reducing the calculated z-score and hiding genuine anomalies.
 *
 * To mitigate self-masking, this function computes:
 * 1. Center: median(X)
 * 2. Dispersion: MAD = median(|x_i - median(X)|)
 * 3. Scale: s = 1.4826 * MAD (consistency factor for normally distributed data)
 *
 * Handling Zero MAD:
 * If >50% of observations in the series are identical (common in quiet telemetry baselines),
 * MAD evaluates to exactly 0.0 even when genuine anomalies exist.
 * When MAD = 0, the scale falls back to the Mean Absolute Deviation about the median:
 * s = 1.2533 * MeanAD, where MeanAD = mean(|x_i - median(X)|).
 * Note: While this prevents division by zero, MeanAD has a 0% breakdown point and can be
 * influenced by extreme outliers in the series.
 * If MeanAD is also 0, the entire series is strictly constant (zero variance).
 */
export function calculateRobustBaselineStats(
  points?: TimeseriesPoint[] | null
): RobustBaselineStats {
  if (!points || !Array.isArray(points)) {
    return { count: 0, median: null, mad: null, scale: null };
  }

  const validValues = points.filter(isFinitePoint).map((p) => p.value);
  const count = validValues.length;

  if (count === 0) {
    return { count: 0, median: null, mad: null, scale: null };
  }

  if (count === 1) {
    return { count: 1, median: validValues[0], mad: 0, scale: 0 };
  }

  const median = calculateMedian(validValues);
  const absDevs = validValues.map((v) => Math.abs(v - median));
  const mad = calculateMedian(absDevs);

  // Normal consistency factor for MAD: 1 / norminv(0.75) ≈ 1.4826
  let scale = 1.4826 * mad;

  // Zero-MAD fallback using MeanAD
  if (scale === 0) {
    const meanAd = absDevs.reduce((acc, d) => acc + d, 0) / count;
    scale = 1.2533 * meanAd;
  }

  return { count, median, mad, scale };
}

// -----------------------------------------------------------------------------
// 3. Window Trajectory
// -----------------------------------------------------------------------------

export type TrajectoryStatus =
  | 'valid'
  | 'insufficient_data'
  | 'zero_baseline'
  | 'invalid_data';

export interface WindowTrajectoryResult {
  status: TrajectoryStatus;
  percentageChange: number | null;
  initialQuarterMean: number | null;
  finalQuarterMean: number | null;
  initialQuarterCount: number;
  finalQuarterCount: number;
}

/**
 * Evaluates the percentage change between the first quartile and the final quartile
 * of a chronologically sorted series.
 *
 * ARCHITECTURAL CONTEXT & LIMITATION:
 * This is strictly a WITHIN-WINDOW comparison across the chronological progress of a
 * single observation window (e.g. comparing the opening 24h vs closing 24h within a 7d dataset).
 * All points within a single query window share the exact same upstream normalization baseline.
 * This MUST NOT be treated as a comparison between two separate, independently-queried
 * observation windows (e.g. comparing a 24h query result with a 30d query result), which may
 * have differing upstream normalization baselines.
 *
 * - Returns `status: 'insufficient_data'` if fewer than 4 chronological points exist.
 * - Returns `status: 'zero_baseline'` with `percentageChange: null` if the initial quarter mean is zero.
 * - Does not mutate the input array.
 */
export function calculateWindowTrajectory(
  points?: TimeseriesPoint[] | null
): WindowTrajectoryResult {
  const defaultUnavailable: WindowTrajectoryResult = {
    status: 'insufficient_data',
    percentageChange: null,
    initialQuarterMean: null,
    finalQuarterMean: null,
    initialQuarterCount: 0,
    finalQuarterCount: 0,
  };

  if (!points || !Array.isArray(points)) {
    return defaultUnavailable;
  }

  // Filter only points that have both a finite numeric value and a valid timestamp
  const valid = points.filter(
    (p) => isFinitePoint(p) && isValidTimestamp(p.timestamp)
  );

  if (valid.length < 4) {
    return defaultUnavailable;
  }

  // Sort chronologically ascending
  const sorted = [...valid].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const quarterSize = Math.floor(sorted.length / 4);
  if (quarterSize === 0) {
    return defaultUnavailable;
  }

  const firstQuarter = sorted.slice(0, quarterSize);
  const lastQuarter = sorted.slice(sorted.length - quarterSize);

  const initialQuarterMean =
    firstQuarter.reduce((acc, p) => acc + p.value, 0) / firstQuarter.length;
  const finalQuarterMean =
    lastQuarter.reduce((acc, p) => acc + p.value, 0) / lastQuarter.length;

  if (initialQuarterMean === 0) {
    return {
      status: 'zero_baseline',
      percentageChange: null,
      initialQuarterMean: 0,
      finalQuarterMean,
      initialQuarterCount: firstQuarter.length,
      finalQuarterCount: lastQuarter.length,
    };
  }

  const percentageChange =
    ((finalQuarterMean - initialQuarterMean) / Math.abs(initialQuarterMean)) * 100;

  return {
    status: 'valid',
    percentageChange,
    initialQuarterMean,
    finalQuarterMean,
    initialQuarterCount: firstQuarter.length,
    finalQuarterCount: lastQuarter.length,
  };
}

// -----------------------------------------------------------------------------
// 4. UTC Diurnal Distribution
// -----------------------------------------------------------------------------

export interface DiurnalHourBucket {
  hour: number; // 0 to 23
  average: number | null;
  count: number;
}

/**
 * Aggregates finite observations across the time series into 24 UTC hour buckets (00–23).
 *
 * - Averages finite point values grouped by the UTC hour (`getUTCHours()`).
 * - Invalid timestamps or non-finite values are safely ignored without fabricating defaults.
 * - Hours with zero valid observations return `average: null` and `count: 0`.
 * - Does not mutate the input array.
 */
export function calculateUtcDiurnalDistribution(
  points?: TimeseriesPoint[] | null
): DiurnalHourBucket[] {
  const sums = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);

  if (points && Array.isArray(points)) {
    for (const pt of points) {
      if (!isFinitePoint(pt) || !isValidTimestamp(pt.timestamp)) {
        continue;
      }
      const d = new Date(pt.timestamp);
      const utcHour = d.getUTCHours();
      if (utcHour >= 0 && utcHour <= 23) {
        sums[utcHour] += pt.value;
        counts[utcHour] += 1;
      }
    }
  }

  const result: DiurnalHourBucket[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({
      hour: h,
      count: counts[h],
      average: counts[h] > 0 ? sums[h] / counts[h] : null,
    });
  }

  return result;
}

// -----------------------------------------------------------------------------
// 5. Spike Candidates Detection (Robust Modified Z-Score)
// -----------------------------------------------------------------------------

export interface SpikeCandidate {
  timestamp: string;
  value: number;
  score: number; // Robust modified z-score (MAD-based)
  zScore: number; // Backwards-compatible alias to score
}

export type SpikeDetectionStatus = 'valid' | 'zero_variance' | 'insufficient_data';

export interface SpikeDetectionResult {
  candidates: SpikeCandidate[];
  baselineMedian: number | null;
  baselineMad: number | null;
  baselineScale: number | null;
  thresholdScore: number;
  thresholdZScore: number; // Backwards-compatible alias to thresholdScore
  status: SpikeDetectionStatus;
  method: 'robust_modified_z';
}

/**
 * Identifies anomaly candidates using a robust Modified Z-Score based on Median and MAD.
 *
 * Formula:
 *   Score = (x_i - median(X)) / scale
 *   where scale = 1.4826 * MAD (or 1.2533 * MeanAD if MAD = 0).
 *
 * Candidates are observations where Score >= thresholdScore (default 2.0).
 *
 * STATISTICAL METHODOLOGY & LIMITATIONS:
 * - Statistical Anomaly Candidates Only: Points identified by this algorithm are statistical
 *   anomaly candidates relative to the window baseline; they are NOT confirmed security incidents
 *   or verified attacks.
 * - Majority Regime Shift Limitation: A median-based detector operates up to a 50% breakdown
 *   point. If sustained elevated values become the majority (>50%) of the observation window,
 *   the baseline median shifts to the elevated level, and the detector will miss the regime shift.
 * - Outlier Influence on Fallback: When MAD = 0, the fallback scale based on MeanAD can be
 *   influenced by extreme outliers.
 *
 * - Requires at least 2 finite observations.
 * - If scale is 0 (all points identical), returns status: 'zero_variance' with no candidates.
 * - Chronologically orders candidate results.
 * - Does not mutate the input array.
 */
export function detectSpikeCandidates(
  points?: TimeseriesPoint[] | null,
  thresholdScore: number = 2.0
): SpikeDetectionResult {
  const defaultUnavailable: SpikeDetectionResult = {
    candidates: [],
    baselineMedian: null,
    baselineMad: null,
    baselineScale: null,
    thresholdScore,
    thresholdZScore: thresholdScore,
    status: 'insufficient_data',
    method: 'robust_modified_z',
  };

  if (!points || !Array.isArray(points)) {
    return defaultUnavailable;
  }

  const valid = points.filter(isFinitePoint);
  if (valid.length < 2) {
    return defaultUnavailable;
  }

  const robustStats = calculateRobustBaselineStats(valid);
  if (robustStats.median === null || robustStats.scale === null) {
    return defaultUnavailable;
  }

  if (robustStats.scale === 0) {
    return {
      candidates: [],
      baselineMedian: robustStats.median,
      baselineMad: robustStats.mad,
      baselineScale: 0,
      thresholdScore,
      thresholdZScore: thresholdScore,
      status: 'zero_variance',
      method: 'robust_modified_z',
    };
  }

  const sorted = [...valid].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }
    return a.timestamp.localeCompare(b.timestamp);
  });

  const candidates: SpikeCandidate[] = [];
  for (const pt of sorted) {
    const score = (pt.value - robustStats.median) / robustStats.scale;
    if (score >= thresholdScore) {
      candidates.push({
        timestamp: pt.timestamp,
        value: pt.value,
        score,
        zScore: score,
      });
    }
  }

  return {
    candidates,
    baselineMedian: robustStats.median,
    baselineMad: robustStats.mad,
    baselineScale: robustStats.scale,
    thresholdScore,
    thresholdZScore: thresholdScore,
    status: 'valid',
    method: 'robust_modified_z',
  };
}

// -----------------------------------------------------------------------------
// 6. Cross-Layer Candidate Correlation (Normalized Instant Matching)
// -----------------------------------------------------------------------------

export interface CorrelatedSpikeCandidate {
  timestamp: string;
  layer3Value: number;
  layer3Score: number;
  layer3ZScore: number;
  layer7Value: number;
  layer7Score: number;
  layer7ZScore: number;
}

export interface CorrelatedSpikeResult {
  candidates: CorrelatedSpikeCandidate[];
  unalignedLayer3SpikesCount: number;
  unalignedLayer7SpikesCount: number;
  limitationsNote: string;
}

/**
 * Matches spike anomaly candidates occurring at equivalent time instants across
 * Layer 3 and Layer 7 time-series.
 *
 * TIMESTAMP NORMALIZATION & DUPLICATE BEHAVIOR:
 * - Timestamps are normalized to epoch milliseconds (via getNormalizedEpochMs), ensuring
 *   equivalent instants match regardless of string formatting differences (e.g. trailing
 *   'Z', '+00:00', or '.000Z' fractional seconds).
 * - Invalid or unparseable timestamps are ignored for correlation without throwing.
 * - Original timestamp strings from candidates are preserved in the returned records.
 * - Duplicate Timestamp Rule: If multiple candidate observations within the same layer
 *   share the exact same normalized epoch ms, the candidate with the highest anomaly score
 *   is retained deterministically to prevent arbitrary map overwrites.
 *
 * INCOMMENSURABILITY CONSTRAINTS:
 * - Layer 3 (transport-level flood index) and Layer 7 (application-level HTTP mitigation index)
 *   represent distinct physical metrics and are NEVER combined or summed.
 */
export function findCorrelatedSpikeCandidates(
  layer3Points?: TimeseriesPoint[] | null,
  layer7Points?: TimeseriesPoint[] | null,
  thresholdScore: number = 2.0
): CorrelatedSpikeResult {
  const limitationsNote =
    'Correlates observations by normalized epoch millisecond across discrete time buckets. ' +
    'Layer 3 (network flood) and Layer 7 (application HTTP mitigation) values represent distinct ' +
    'physical metrics and are never combined or summed.';

  const l3Result = detectSpikeCandidates(layer3Points, thresholdScore);
  const l7Result = detectSpikeCandidates(layer7Points, thresholdScore);

  // Group Layer 3 candidates by normalized epoch ms
  const l3Map = new Map<number, SpikeCandidate>();
  for (const c of l3Result.candidates) {
    const epoch = getNormalizedEpochMs(c.timestamp);
    if (epoch === null) continue; // ignore unparseable timestamps
    const existing = l3Map.get(epoch);
    if (!existing || c.score > existing.score) {
      l3Map.set(epoch, c);
    }
  }

  // Group Layer 7 candidates by normalized epoch ms
  const l7Map = new Map<number, SpikeCandidate>();
  for (const c of l7Result.candidates) {
    const epoch = getNormalizedEpochMs(c.timestamp);
    if (epoch === null) continue;
    const existing = l7Map.get(epoch);
    if (!existing || c.score > existing.score) {
      l7Map.set(epoch, c);
    }
  }

  const correlated: CorrelatedSpikeCandidate[] = [];

  for (const [epoch, l3] of l3Map.entries()) {
    const l7 = l7Map.get(epoch);
    if (l7) {
      correlated.push({
        timestamp: l3.timestamp, // preserve original timestamp string
        layer3Value: l3.value,
        layer3Score: l3.score,
        layer3ZScore: l3.score,
        layer7Value: l7.value,
        layer7Score: l7.score,
        layer7ZScore: l7.score,
      });
    }
  }

  // Sort correlated candidates chronologically ascending by epoch
  correlated.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (Number.isFinite(timeA) && Number.isFinite(timeB)) {
      return timeA - timeB;
    }
    return a.timestamp.localeCompare(b.timestamp);
  });

  // Calculate unaligned candidates (candidates whose normalized epoch is absent in counterpart layer)
  const unalignedLayer3SpikesCount = l3Result.candidates.filter((c) => {
    const epoch = getNormalizedEpochMs(c.timestamp);
    return epoch === null || !l7Map.has(epoch);
  }).length;

  const unalignedLayer7SpikesCount = l7Result.candidates.filter((c) => {
    const epoch = getNormalizedEpochMs(c.timestamp);
    return epoch === null || !l3Map.has(epoch);
  }).length;

  return {
    candidates: correlated,
    unalignedLayer3SpikesCount,
    unalignedLayer7SpikesCount,
    limitationsNote,
  };
}
