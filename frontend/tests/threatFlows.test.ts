import { describe, it, expect } from 'vitest';
import {
  SEEDED_DEMO_FLOWS,
  deriveFlowsFromMetrics,
  filterFlowsByLayer,
} from '../src/data/threatFlows';
import { RadarMetrics } from '../src/types/api';

describe('Threat Flows & Deterministic Simulation Engine', () => {
  describe('SEEDED_DEMO_FLOWS Data Quality & Provenance', () => {
    it('provides deterministic illustrative flows with strict simulation markers', () => {
      expect(SEEDED_DEMO_FLOWS.length).toBeGreaterThan(0);

      for (const flow of SEEDED_DEMO_FLOWS) {
        expect(flow.id).toBeDefined();
        expect(flow.isSimulated).toBe(true);
        expect(flow.volumePercentage).toBeGreaterThan(0);
        expect(['layer3', 'layer7']).toContain(flow.layer);
        expect(flow.origin.code).toBeDefined();
        expect(flow.origin.lat).toBeGreaterThanOrEqual(-90);
        expect(flow.origin.lat).toBeLessThanOrEqual(90);
        expect(flow.origin.lon).toBeGreaterThanOrEqual(-180);
        expect(flow.origin.lon).toBeLessThanOrEqual(180);
        expect(flow.target.code).toBeDefined();
        expect(flow.target.lat).toBeGreaterThanOrEqual(-90);
        expect(flow.target.lat).toBeLessThanOrEqual(90);
      }
    });

    it('contains both Layer 3 (orange) and Layer 7 (cyan) threat vectors', () => {
      const layer3Flows = SEEDED_DEMO_FLOWS.filter((f) => f.layer === 'layer3');
      const layer7Flows = SEEDED_DEMO_FLOWS.filter((f) => f.layer === 'layer7');

      expect(layer3Flows.length).toBeGreaterThan(0);
      expect(layer7Flows.length).toBeGreaterThan(0);
      expect(layer3Flows[0].color).toBe('#ff5e00');
      expect(layer7Flows[0].color).toBe('#00e5ff');
    });
  });

  describe('deriveFlowsFromMetrics Adapter', () => {
    it('returns seeded demo flows when metrics are null or empty', () => {
      expect(deriveFlowsFromMetrics(null)).toEqual(SEEDED_DEMO_FLOWS);
      expect(deriveFlowsFromMetrics(undefined)).toEqual(SEEDED_DEMO_FLOWS);

      const emptyMetrics: RadarMetrics = {
        layer3_timeseries: [],
        layer7_timeseries: [],
        top_target_countries: [],
        top_origin_countries: [],
        protocols: [],
      };
      expect(deriveFlowsFromMetrics(emptyMetrics)).toEqual(SEEDED_DEMO_FLOWS);
    });

    it('derives proportional flows when valid aggregates are supplied', () => {
      const mockMetrics: RadarMetrics = {
        layer3_timeseries: [],
        layer7_timeseries: [],
        top_target_countries: [
          { country_code: 'US', country_name: 'United States', percentage: 45.0 },
          { country_code: 'DE', country_name: 'Germany', percentage: 20.0 },
        ],
        top_origin_countries: [
          { country_code: 'CN', country_name: 'China', percentage: 38.0 },
          { country_code: 'BR', country_name: 'Brazil', percentage: 15.0 },
        ],
        protocols: [{ protocol: 'UDP', percentage: 70.0 }],
      };

      const flows = deriveFlowsFromMetrics(mockMetrics);
      expect(flows.length).toBe(2);

      expect(flows[0].origin.code).toBe('CN');
      expect(flows[0].target.code).toBe('US');
      expect(flows[0].isSimulated).toBe(true);

      expect(flows[1].origin.code).toBe('BR');
      expect(flows[1].target.code).toBe('DE');
      expect(flows[1].isSimulated).toBe(true);
    });

    it('prevents self-pointing arcs when origin and target are identical country', () => {
      const mockMetricsWithOverlap: RadarMetrics = {
        layer3_timeseries: [],
        layer7_timeseries: [],
        top_target_countries: [
          { country_code: 'US', country_name: 'United States', percentage: 50.0 },
          { country_code: 'GB', country_name: 'United Kingdom', percentage: 25.0 },
        ],
        top_origin_countries: [
          { country_code: 'US', country_name: 'United States', percentage: 40.0 },
        ],
        protocols: [],
      };

      const flows = deriveFlowsFromMetrics(mockMetricsWithOverlap);
      expect(flows.length).toBe(1);
      // Origin is US, so target should shift to GB to avoid self-loop
      expect(flows[0].origin.code).toBe('US');
      expect(flows[0].target.code).toBe('GB');
    });
  });

  describe('filterFlowsByLayer', () => {
    it('returns all flows when layerFilter is "all"', () => {
      const result = filterFlowsByLayer(SEEDED_DEMO_FLOWS, 'all');
      expect(result.length).toBe(SEEDED_DEMO_FLOWS.length);
    });

    it('filters strictly to Layer 3 flows when layerFilter is "layer3"', () => {
      const result = filterFlowsByLayer(SEEDED_DEMO_FLOWS, 'layer3');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((f) => f.layer === 'layer3')).toBe(true);
    });

    it('filters strictly to Layer 7 flows when layerFilter is "layer7"', () => {
      const result = filterFlowsByLayer(SEEDED_DEMO_FLOWS, 'layer7');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((f) => f.layer === 'layer7')).toBe(true);
    });
  });
});
