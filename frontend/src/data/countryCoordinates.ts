/**
 * Country Geographic Centroids (ISO-3166-1 alpha-2)
 *
 * Provides accurate WGS-84 latitude and longitude coordinates for major
 * origin and destination countries observed in global cyber threat telemetry.
 */

export interface CountryInfo {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export const COUNTRY_COORDINATES: Record<string, CountryInfo> = {
  US: { code: 'US', name: 'United States', lat: 37.0902, lon: -95.7129 },
  CN: { code: 'CN', name: 'China', lat: 35.8617, lon: 104.1954 },
  DE: { code: 'DE', name: 'Germany', lat: 51.1657, lon: 10.4515 },
  BR: { code: 'BR', name: 'Brazil', lat: -14.235, lon: -51.9253 },
  GB: { code: 'GB', name: 'United Kingdom', lat: 55.3781, lon: -3.436 },
  JP: { code: 'JP', name: 'Japan', lat: 36.2048, lon: 138.2529 },
  IN: { code: 'IN', name: 'India', lat: 20.5937, lon: 78.9629 },
  AU: { code: 'AU', name: 'Australia', lat: -25.2744, lon: 133.7751 },
  FR: { code: 'FR', name: 'France', lat: 46.2276, lon: 2.2137 },
  SG: { code: 'SG', name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  NL: { code: 'NL', name: 'Netherlands', lat: 52.1326, lon: 5.2913 },
  KR: { code: 'KR', name: 'South Korea', lat: 35.9078, lon: 127.7669 },
  CA: { code: 'CA', name: 'Canada', lat: 56.1304, lon: -106.3468 },
  RU: { code: 'RU', name: 'Russia', lat: 61.524, lon: 105.3188 },
  ZA: { code: 'ZA', name: 'South Africa', lat: -30.5595, lon: 22.9375 },
  IT: { code: 'IT', name: 'Italy', lat: 41.8719, lon: 12.5674 },
  ES: { code: 'ES', name: 'Spain', lat: 40.4637, lon: -3.7492 },
  SE: { code: 'SE', name: 'Sweden', lat: 60.1282, lon: 18.6435 },
  NO: { code: 'NO', name: 'Norway', lat: 60.472, lon: 8.4689 },
  FI: { code: 'FI', name: 'Finland', lat: 61.9241, lon: 25.7482 },
  MX: { code: 'MX', name: 'Mexico', lat: 23.6345, lon: -102.5528 },
  ID: { code: 'ID', name: 'Indonesia', lat: -0.7893, lon: 113.9213 },
  TR: { code: 'TR', name: 'Turkey', lat: 38.9637, lon: 35.2433 },
  SA: { code: 'SA', name: 'Saudi Arabia', lat: 23.8859, lon: 45.0792 },
  IL: { code: 'IL', name: 'Israel', lat: 31.0461, lon: 34.8516 },
  UA: { code: 'UA', name: 'Ukraine', lat: 48.3794, lon: 31.1656 },
  PL: { code: 'PL', name: 'Poland', lat: 51.9194, lon: 19.1451 },
  AR: { code: 'AR', name: 'Argentina', lat: -38.4161, lon: -63.6167 },
  VN: { code: 'VN', name: 'Vietnam', lat: 14.0583, lon: 108.2772 },
  TH: { code: 'TH', name: 'Thailand', lat: 15.87, lon: 100.9925 },
  MY: { code: 'MY', name: 'Malaysia', lat: 4.2105, lon: 101.9758 },
  EG: { code: 'EG', name: 'Egypt', lat: 26.8206, lon: 30.8025 },
  NG: { code: 'NG', name: 'Nigeria', lat: 9.082, lon: 8.6753 },
  HK: { code: 'HK', name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  TW: { code: 'TW', name: 'Taiwan', lat: 23.6978, lon: 120.9605 },
  IE: { code: 'IE', name: 'Ireland', lat: 53.1424, lon: -7.6921 },
  CH: { code: 'CH', name: 'Switzerland', lat: 46.8182, lon: 8.2275 },
};

/**
 * Returns geographic coordinates for a given country code, or null if unknown.
 */
export function getCountryCoords(code: string): CountryInfo | null {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_COORDINATES[normalized] || null;
}
