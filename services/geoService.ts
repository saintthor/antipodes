
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
    // If it's a coordinate [lat, lng]
    if (item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
      const anti = calculateAntipode({ lat: item[0], lng: item[1] });
      return [anti.lat, anti.lng];
    }
    // If it's an array of arrays, recurse
    if (Array.isArray(item)) {
      return item.map(processRecursive);
    }
    return item;
  };

  return processRecursive(polygon);
};

/**
 * Reverse geocode to get area hierarchies with high zoom for accuracy.
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<NominatimResult[]> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&polygon_geojson=1`;
  try {
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return [data];
  } catch (e) {
    return [];
  }
};

/**
 * Search geocode for specific names to get high-quality polygons.
 */
export const searchGeocode = async (query: string): Promise<NominatimResult[]> => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&polygon_geojson=1&limit=5&addressdetails=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    return [];
  }
};
