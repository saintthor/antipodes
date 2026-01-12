
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeoRegion {
  name: string;
  type: string;
  polygon?: number[][][]; // Array of rings, each ring is [lat, lng][]
  bounds?: [number, number][]; // [[lat, lng], [lat, lng]]
}

export interface NominatimResult {
  display_name: string;
  type: string;
  address: {
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    hamlet?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    province?: string;
    state_district?: string;
    state?: string;
    region?: string;
    country?: string;
    country_code?: string;
  };
  geojson?: {
    type: string;
    coordinates: any;
  };
  boundingbox: string[];
}
