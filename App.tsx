
import React, { useState, useCallback, useRef, useEffect } from 'react';
import MapPanel from './components/MapPanel';
import MoleAnimation from './components/MoleAnimation';
import { Coordinate } from './types';
import { calculateAntipode, calculatePolygonAntipodes, reverseGeocode, fetchDetails, lookupObjects, searchGeocode } from './services/geoService';

const VALID_LEVEL_KEYS = [
  'neighbourhood', 'suburb', 'city_district', 'district', 'borough', 
  'town', 'village', 'hamlet', 'city', 'municipality', 'county', 
  'state_district', 'province', 'state', 'region', 'prefecture', 
  'country', 'territory', 'sovereignty', 'continent'
];

interface HierarchyItem {
  name: string;
  osmId: string;
  osmType: string;
  idKey: string;
  geojson?: any;
  loaded: boolean;
}

const App: React.FC = () => {
  const [view, setView] = useState<'source' | 'anti'>('source');
  const [sourceCenter, setSourceCenter] = useState<Coordinate>({ lat: 35.6762, lng: 139.6503 }); 
  const [antiCenter, setAntiCenter] = useState<Coordinate>(calculateAntipode({ lat: 35.6762, lng: 139.6503 }));
  const [sourcePolygon, setSourcePolygon] = useState<any>(null);
  const [antiPolygon, setAntiPolygon] = useState<any>(null);
  
  const [hierarchy, setHierarchy] = useState<HierarchyItem[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStage, setAnimationStage] = useState<'down' | 'up'>('down');
  const [isLoading, setIsLoading] = useState(false);
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [isRectangleMode, setIsRectangleMode] = useState(false);

  const lastRequestTime = useRef<number>(0);
  const skipNextClick = useRef<boolean>(false);

  /**
   * Helper to convert GeoJSON coordinates to Leaflet-compatible [lat, lng] format.
   * Also includes sampling for very large polygons to improve performance.
   */
  const convertGeoJsonToLeaflet = (coords: any): any => {
    if (!coords) return null;
    if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
      return [coords[1], coords[0]]; 
    }
    if (Array.isArray(coords)) {
        if (coords.length > 800 && Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            const step = Math.ceil(coords.length / 500); 
            const sampled = [];
            for (let i = 0; i < coords.length; i += step) {
                const p = coords[i];
                sampled.push([p[1], p[0]]);
            }
            const last = coords[coords.length - 1];
            sampled.push([last[1], last[0]]);
            return sampled;
        }
        return coords.map(convertGeoJsonToLeaflet);
    }
    return null;
  };

  /**
   * Updates the antipode center and polygon based on the current source location.
   */
  const updateAntipodes = (sourcePoly: any) => {
    const newAntiCenter = calculateAntipode(sourceCenter);
    setAntiCenter(newAntiCenter);
    if (sourcePoly) {
      setAntiPolygon(calculatePolygonAntipodes(sourcePoly));
    } else {
      setAntiPolygon(null);
    }
  };

  // Sync antipode state whenever the source changes
  useEffect(() => {
    updateAntipodes(sourcePolygon);
  }, [sourceCenter, sourcePolygon]);

  /**
   * Fetches the administrative hierarchy for a given location to allow region-level navigation.
   */
  const traceHierarchyStructure = async (initialResult: any) => {
    if (!initialResult) return [];
    
    try {
      const items: HierarchyItem[] = [];
      const seenIds = new Set<string>();

      if (initialResult.osm_id && initialResult.osm_type) {
        const details = await fetchDetails(initialResult.osm_type, String(initialResult.osm_id));
        if (details && details.address) {
          details.address.forEach((item: any) => {
            const hasValidType = item.type && VALID_LEVEL_KEYS.includes(item.type);
            const hasAdminLevel = item.admin_level !== undefined && parseInt(item.admin_level) > 0;
            
            if (item.osm_id && item.osm_type && (hasValidType || hasAdminLevel)) {
              const idKey = `${item.osm_type.charAt(0).toUpperCase()}${item.osm_id}`;
              if (!seenIds.has(idKey)) {
                items.push({
                  name: item.localname || item.name || item.type,
                  osmId: String(item.osm_id),
                  osmType: item.osm_type,
                  idKey: idKey,
                  loaded: false
                });
                seenIds.add(idKey);
              }
            }
          });
        }
      }

      const countryName = initialResult.address?.country;
      if (countryName && !items.some(i => i.name.toLowerCase().includes(countryName.toLowerCase()))) {
         const searchResults = await searchGeocode(countryName);
         const c = searchResults.find(r => 
            (r.osm_type === 'relation') && 
            (r.type === 'administrative' || (r as any).class === 'boundary')
         ) || searchResults[0];

         if (c && c.osm_id && c.osm_type) {
            const idKey = `${c.osm_type.charAt(0).toUpperCase()}${c.osm_id}`;
            if (!seenIds.has(idKey)) {
                items.push({
                    name: countryName,
                    osmId: String(c.osm_id),
                    osmType: c.osm_type,
                    idKey: idKey,
                    loaded: false
                });
            }
         }
      }

      if (initialResult.osm_id && initialResult.osm_type) {
          const selfIdKey = `${initialResult.osm_type.charAt(0).toUpperCase()}${initialResult.osm_id}`;
          if (!seenIds.has(selfIdKey)) {
            items.unshift({
              name: (initialResult.display_name || 'Selected Location').split(',')[0],
              osmId: String(initialResult.osm_id),
              osmType: initialResult.osm_type,
              idKey: selfIdKey,
              loaded: false
            });
          }
      }

      return items;
    } catch (e) {
      console.error("Hierarchy Trace Error:", e);
      return [];
    }
  };

  /**
   * Loads the boundary polygon for a specific administrative level.
   */
  const loadLevelBoundary = async (item: HierarchyItem) => {
    if (item.loaded) {
        setActiveLevelId(item.idKey);
        setSourcePolygon(convertGeoJsonToLeaflet(item.geojson.coordinates));
        return;
    }

    setIsLevelLoading(true);
    setError(null);
    try {
        const results = await lookupObjects([item.idKey]);
        if (results && results[0] && results[0].geojson) {
            const geojson = results[0].geojson;
            setHierarchy(prev => prev.map(h => h.idKey === item.idKey ? { ...h, geojson, loaded: true } : h));
            setActiveLevelId(item.idKey);
            setSourcePolygon(convertGeoJsonToLeaflet(geojson.coordinates));
        } else {
            setError("Could not retrieve boundary for this level.");
        }
    } catch (e) {
        setError("Network error loading boundary.");
    } finally {
        setIsLevelLoading(false);
    }
  };

  /**
   * Handles map click events to select a new source location.
   */
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (isRectangleMode || skipNextClick.current) {
        skipNextClick.current = false;
        return;
    }

    const now = Date.now();
    if (now - lastRequestTime.current < 500) return;
    
    setIsLoading(true);
    setError(null);
    setHierarchy([]); 
    setActiveLevelId(null);
    setSourceCenter({ lat, lng });
    lastRequestTime.current = now;
    
    try {
      const res = await reverseGeocode(lat, lng);
      if (res && !res.error) {
        const structure = await traceHierarchyStructure(res);
        if (structure.length > 0) {
            setHierarchy(structure);
            loadLevelBoundary(structure[0]);
        } else {
            setError("No detailed region data found.");
            if (res.geojson) setSourcePolygon(convertGeoJsonToLeaflet(res.geojson.coordinates));
        }
      } else {
        setError("Location not found (Ocean or invalid coordinates).");
      }
    } catch (err) {
      setError("Service busy, please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [isRectangleMode]);

  /**
   * Handles custom rectangle selection to define a specific area.
   */
  const handleRectangleSelect = (bounds: any) => {
    skipNextClick.current = true;

    const centerLat = (bounds._northEast.lat + bounds._southWest.lat) / 2;
    const centerLng = (bounds._northEast.lng + bounds._southWest.lng) / 2;
    setSourceCenter({ lat: centerLat, lng: centerLng });
    
    const poly = [
      [bounds._northEast.lat, bounds._northEast.lng],
      [bounds._northEast.lat, bounds._southWest.lng],
      [bounds._southWest.lat, bounds._southWest.lng],
      [bounds._southWest.lat, bounds._northEast.lng],
      [bounds._northEast.lat, bounds._northEast.lng]
    ];
    setSourcePolygon([poly]);
    setHierarchy([{ name: 'Custom Selection', osmId: '0', osmType: 'box', idKey: 'custom', loaded: true, geojson: { coordinates: [] } }]);
    setActiveLevelId('custom');
    
    setTimeout(() => {
        setIsRectangleMode(false);
        setTimeout(() => { skipNextClick.current = false; }, 150);
    }, 50);
  };

  /**
   * Handles location search functionality.
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const results = await searchGeocode(searchInput);
      if (results && results.length > 0) {
        const first = results[0];
        setSourceCenter({ lat: parseFloat(first.lat!), lng: parseFloat(first.lon!) });
        const structure = await traceHierarchyStructure(first);
        setHierarchy(structure);
        if (structure.length > 0) {
          loadLevelBoundary(structure[0]);
        } else if (first.geojson) {
          setSourcePolygon(convertGeoJsonToLeaflet(first.geojson.coordinates));
        }
      } else {
        setError("Place not found.");
      }
    } catch (err) {
      setError("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Triggers the mole digging animation to switch views.
   */
  const triggerMoleTravel = () => {
    setIsAnimating(true);
    setAnimationStage('down');
  };

  /**
   * Handles the conclusion of the mole animation stages.
   */
  const handleAnimationFinish = () => {
    if (animationStage === 'down') {
      setView(view === 'source' ? 'anti' : 'source');
      setAnimationStage('up');
    } else {
      setIsAnimating(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      <MoleAnimation 
        isAnimating={isAnimating} 
        onFinish={handleAnimationFinish} 
        direction={animationStage} 
      />

      {/* Sidebar UI */}
      <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="text-3xl">🕳️</span> ANTi-MOLE
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Global Antipode Explorer
          </p>
        </div>

        <div className="p-4 flex-grow overflow-y-auto space-y-6">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search a place..."
              className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 transition-all outline-none"
            />
            <span className="absolute left-3.5 top-3.5 text-slate-400">🔍</span>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => setIsRectangleMode(!isRectangleMode)}
              className={`flex-1 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                isRectangleMode 
                ? 'bg-amber-100 border-amber-300 text-amber-700 ring-2 ring-amber-500/20' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {isRectangleMode ? '⏹️ Stop Selection' : '⬛ Draw Box'}
            </button>
            <button
              onClick={triggerMoleTravel}
              disabled={isAnimating}
              className="flex-1 py-3 px-2 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
            >
              🚀 Dig {view === 'source' ? 'Antipode' : 'Back'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs font-medium italic">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
              Looking deep...
            </div>
          )}

          {hierarchy.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Region Levels</h3>
              <div className="space-y-1">
                {hierarchy.map((item) => (
                  <button
                    key={item.idKey}
                    onClick={() => loadLevelBoundary(item)}
                    disabled={isLevelLoading}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${
                      activeLevelId === item.idKey
                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    } flex items-center justify-between group`}
                  >
                    <span className="truncate pr-2 font-medium">{item.name}</span>
                    {activeLevelId === item.idKey && isLevelLoading && (
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                    {activeLevelId === item.idKey && !isLevelLoading && (
                      <span className="text-xs">📍</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100">
           <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
             <span>Current View</span>
             <span className={view === 'source' ? 'text-amber-600' : 'text-blue-600'}>
               {view === 'source' ? 'Surface' : 'The Other Side'}
             </span>
           </div>
           <div className="flex bg-slate-200 p-1 rounded-xl">
             <button 
                onClick={() => setView('source')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${view === 'source' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
             >
               SOURCE
             </button>
             <button 
                onClick={() => setView('anti')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${view === 'anti' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
             >
               ANTIPODE
             </button>
           </div>
        </div>
      </div>

      {/* Map Content Viewports */}
      <div className="flex-grow relative bg-slate-200">
        <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: view === 'source' ? 1 : 0, pointerEvents: view === 'source' ? 'auto' : 'none' }}>
            <MapPanel 
              id="source-map"
              title="Source Location"
              center={sourceCenter}
              polygon={sourcePolygon}
              onMapClick={handleMapClick}
              isSelectMode={isRectangleMode}
              onRectangleSelect={handleRectangleSelect}
            />
        </div>
        <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: view === 'anti' ? 1 : 0, pointerEvents: view === 'anti' ? 'auto' : 'none' }}>
            <MapPanel 
              id="anti-map"
              title="Antipode Location"
              center={antiCenter}
              polygon={antiPolygon}
              isSelectMode={false}
            />
        </div>
      </div>
    </div>
  );
};

// Fixed the missing default export to resolve the module error in index.tsx
export default App;
