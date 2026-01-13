
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeoRegion {
  name: string;
  type: string;
  polygon?: any; 
  bounds?: [number, number][];
}

export interface NominatimResult {
  display_name: string;
  /** The OSM ID of the object */
  osm_id: string | number;
  /** The OSM type of the object (node, way, relation) */
  osm_type: string;
  type: string;
  lat?: string;
  lon?: string;
  address: {
    [key: string]: string | undefined;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    hamlet?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    district?: string;
    province?: string;
    state_district?: string;
    state?: string;
    department?: string;
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
