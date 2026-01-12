
import { Coordinate, NominatimResult } from '../types';

/**
 * Calculates the antipode of a coordinate.
 * Latitude is negated.
 * Longitude is shifted by 180 degrees.
 */
export const calculateAntipode = (coord: Coordinate): Coordinate => {
  const lat = -coord.lat;
  let lng = coord.lng + 180;
  if (lng > 180) lng -= 360;
  return { lat, lng };
};

/**
 * Calculates the antipode for an entire polygon.
 */
export const calculatePolygonAntipodes = (polygon: [number, number][][]): [number, number][][] => {
  return polygon.map(ring => 
    ring.map(point => {
      const anti = calculateAntipode({ lat: point[0], lng: point[1] });
      return [anti.lat, anti.lng];
    })
  );
};

/**
 * Reverse geocode to get area hierarchies.
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<NominatimResult[]> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&polygon_geojson=1`;
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  if (!response.ok) return [];
  const data = await response.json();
  
  // Since Nominatim reverse returns one main result, we can try to extract parts.
  // Actually, to get hierarchy (City, State, Country), we use the address object.
  return [data];
};

/**
 * Search geocode for specific names to get high-quality polygons.
 */
export const searchGeocode = async (query: string): Promise<NominatimResult[]> => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&polygon_geojson=1&limit=5`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return await response.json();
};
