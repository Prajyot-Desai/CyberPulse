import { LocationMetric, RadarMetrics } from '../types/api';
import { getCountryCoords } from './countryCoordinates';

export type FlowLayer = 'layer3' | 'layer7';
export type LayerFilter = 'all' | 'layer3' | 'layer7';

export interface ThreatFlow {
  id: string;
  origin: {
    code: string;
    name: string;
    lat: number;
    lon: number;
  };
  target: {
    code: string;
    name: string;
    lat: number;
    lon: number;
  };
  layer: FlowLayer;
  protocol: string;
  volumePercentage: number;
  color: string; // '#ff5e00' for Layer 3, '#00e5ff' for Layer 7
  pulseSpeed: number;
  pulsePhase: number;
  isSimulated: true;
}

/**
 * Deterministic seeded demo flows used when upstream Cloudflare Radar data
 * is unconfigured or unavailable. Every attribute is deterministic so the scene
 * renders identically across test and demo runs.
 */
export const SEEDED_DEMO_FLOWS: ThreatFlow[] = [
  {
    id: 'demo-flow-1',
    origin: { code: 'CN', name: 'China', lat: 35.8617, lon: 104.1954 },
    target: { code: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
    layer: 'layer3',
    protocol: 'UDP Flood',
    volumePercentage: 35.0,
    color: '#ff5e00',
    pulseSpeed: 0.35,
    pulsePhase: 0.1,
    isSimulated: true,
  },
  {
    id: 'demo-flow-2',
    origin: { code: 'BR', name: 'Brazil', lat: -14.235, lon: -51.9253 },
    target: { code: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
    layer: 'layer7',
    protocol: 'HTTP/2 Rapid Reset',
    volumePercentage: 18.5,
    color: '#00e5ff',
    pulseSpeed: 0.42,
    pulsePhase: 0.45,
    isSimulated: true,
  },
  {
    id: 'demo-flow-3',
    origin: { code: 'RU', name: 'Russia', lat: 61.524, lon: 105.3188 },
    target: { code: 'DE', name: 'Germany', lat: 51.1657, lon: 10.4515 },
    layer: 'layer3',
    protocol: 'NTP Amplification',
    volumePercentage: 14.2,
    color: '#ff5e00',
    pulseSpeed: 0.3,
    pulsePhase: 0.7,
    isSimulated: true,
  },
  {
    id: 'demo-flow-4',
    origin: { code: 'DE', name: 'Germany', lat: 51.1657, lon: 10.4515 },
    target: { code: 'GB', name: 'United Kingdom', lat: 55.3781, lon: -3.436 },
    layer: 'layer7',
    protocol: 'HTTPS TLS Renegotiation',
    volumePercentage: 12.0,
    color: '#00e5ff',
    pulseSpeed: 0.48,
    pulsePhase: 0.25,
    isSimulated: true,
  },
  {
    id: 'demo-flow-5',
    origin: { code: 'IN', name: 'India', lat: 20.5937, lon: 78.9629 },
    target: { code: 'SG', name: 'Singapore', lat: 1.3521, lon: 103.8198 },
    layer: 'layer3',
    protocol: 'SYN Flood',
    volumePercentage: 9.8,
    color: '#ff5e00',
    pulseSpeed: 0.38,
    pulsePhase: 0.6,
    isSimulated: true,
  },
  {
    id: 'demo-flow-6',
    origin: { code: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
    target: { code: 'JP', name: 'Japan', lat: 36.2048, lon: 138.2529 },
    layer: 'layer7',
    protocol: 'HTTP POST Request Flood',
    volumePercentage: 11.4,
    color: '#00e5ff',
    pulseSpeed: 0.33,
    pulsePhase: 0.85,
    isSimulated: true,
  },
  {
    id: 'demo-flow-7',
    origin: { code: 'FR', name: 'France', lat: 46.2276, lon: 2.2137 },
    target: { code: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
    layer: 'layer3',
    protocol: 'DNS Amplification',
    volumePercentage: 8.2,
    color: '#ff5e00',
    pulseSpeed: 0.4,
    pulsePhase: 0.35,
    isSimulated: true,
  },
  {
    id: 'demo-flow-8',
    origin: { code: 'VN', name: 'Vietnam', lat: 14.0583, lon: 108.2772 },
    target: { code: 'AU', name: 'Australia', lat: -25.2744, lon: 133.7751 },
    layer: 'layer7',
    protocol: 'Layer 7 API Abuse',
    volumePercentage: 7.1,
    color: '#00e5ff',
    pulseSpeed: 0.36,
    pulsePhase: 0.55,
    isSimulated: true,
  },
];

/**
 * Derives simulated visualization flows from aggregated origin and target country metrics.
 *
 * IMPORTANT DATA INTEGRITY POLICY:
 * Cloudflare Radar provides macroscopic aggregates, not packet traces or point-to-point attack logs.
 * Any arc rendered on the globe is explicitly derived as an illustrative representation
 * of aggregate geographic ratios and is labeled as such in the UI.
 */
export function deriveFlowsFromMetrics(metrics: RadarMetrics | null | undefined): ThreatFlow[] {
  if (!metrics || !metrics.top_origin_countries?.length || !metrics.top_target_countries?.length) {
    return SEEDED_DEMO_FLOWS;
  }

  const origins = metrics.top_origin_countries;
  const targets = metrics.top_target_countries;
  const flows: ThreatFlow[] = [];

  // Pair top origins with targets deterministically
  for (let i = 0; i < origins.length; i++) {
    const origItem: LocationMetric = origins[i];
    const targetItem: LocationMetric = targets[i % targets.length];

    // If origin and target are identical country, shift target to avoid self-pointing arc
    const resolvedTarget =
      origItem.country_code === targetItem.country_code
        ? targets[(i + 1) % targets.length]
        : targetItem;

    const origCoords = getCountryCoords(origItem.country_code);
    const targetCoords = getCountryCoords(resolvedTarget.country_code);

    if (!origCoords || !targetCoords) {
      continue;
    }

    const layer: FlowLayer = i % 2 === 0 ? 'layer3' : 'layer7';
    const protocol =
      layer === 'layer3'
        ? (metrics.protocols?.[0]?.protocol || 'UDP') + ' Vector'
        : 'Layer 7 Application Flood';

    flows.push({
      id: `derived-flow-${origItem.country_code}-${resolvedTarget.country_code}-${i}`,
      origin: {
        code: origItem.country_code,
        name: origItem.country_name,
        lat: origCoords.lat,
        lon: origCoords.lon,
      },
      target: {
        code: resolvedTarget.country_code,
        name: resolvedTarget.country_name,
        lat: targetCoords.lat,
        lon: targetCoords.lon,
      },
      layer,
      protocol,
      volumePercentage: origItem.percentage,
      color: layer === 'layer3' ? '#ff5e00' : '#00e5ff',
      pulseSpeed: 0.3 + (i * 0.04) % 0.2,
      pulsePhase: (i * 0.23) % 1.0,
      isSimulated: true,
    });
  }

  return flows.length > 0 ? flows : SEEDED_DEMO_FLOWS;
}

/**
 * Filters threat flows based on active layer filter ('all', 'layer3', 'layer7').
 */
export function filterFlowsByLayer(flows: ThreatFlow[], layerFilter: LayerFilter): ThreatFlow[] {
  if (layerFilter === 'all') return flows;
  return flows.filter((f) => f.layer === layerFilter);
}
