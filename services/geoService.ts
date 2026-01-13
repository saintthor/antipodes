
import { Coordinate, NominatimResult } from '../types';

/**
 * Calculates the antipode of a coordinate.
 */
export const calculateAntipode = (coord: Coordinate): Coordinate => {
  const lat = -coord.lat;
  let lng = coord.lng + 180;
  if (lng > 180) lng -= 360;
  return { lat, lng };
};

/**
 * Calculates the antipode for an entire polygon structure.
 */
export const calculatePolygonAntipodes = (polygon: any): any => {
  if (!Array.isArray(polygon)) return polygon;

  const processRecursive = (item: any): any => {
    if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
      const anti = calculateAntipode({ lat: item[0], lng: item[1] });
      return [anti.lat, anti.lng];
    }
    if (Array.isArray(item)) {
      return item.map(processRecursive);
    }
    return item;
  };

  return processRecursive(polygon);
};

/**
 * Basic reverse geocode.
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<any> => {
  // 加入 polygon_threshold=0.001 进行轻微简化
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&polygon_geojson=1&polygon_threshold=0.001`;
  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};

/**
 * Fetches the administrative hierarchy details.
 */
export const fetchDetails = async (osmType: string, osmId: string): Promise<any> => {
  const typeMap: Record<string, string> = { 'node': 'N', 'way': 'W', 'relation': 'R' };
  const type = typeMap[osmType.toLowerCase()] || osmType.toUpperCase().charAt(0);
  const url = `https://nominatim.openstreetmap.org/details?osmtype=${type}&osmid=${osmId}&format=json&addressdetails=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};

/**
 * Fetches data for multiple OSM objects.
 * 核心优化点：polygon_threshold=0.005。
 * 对于国家级边界，这能将数据量从几兆压缩到几十KB，且形状基本无损。
 */
export const lookupObjects = async (ids: string[]): Promise<NominatimResult[]> => {
  if (ids.length === 0) return [];
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${ids.join(',')}&format=json&polygon_geojson=1&addressdetails=1&polygon_threshold=0.005`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    return [];
  }
};

/**
 * Standard search geocode.
 */
export const searchGeocode = async (query: string): Promise<NominatimResult[]> => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&polygon_geojson=1&limit=5&addressdetails=1&polygon_threshold=0.002`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    return [];
  }
};
