
import React, { useState, useCallback, useRef } from 'react';
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

  const updateAntipodes = (sourcePoly: any) => {
    const newAntiCenter = calculateAntipode(sourceCenter);
    setAntiCenter(newAntiCenter);
    if (sourcePoly) {
      setAntiPolygon(calculatePolygonAntipodes(sourcePoly));
    } else {
      setAntiPolygon(null);
    }
  };

  /**
   * 强化版层级追踪：特别针对 USA 等大国做了优化，增加了防御性代码
   */
  const traceHierarchyStructure = async (initialResult: any) => {
    if (!initialResult) return [];
    
    try {
      const items: HierarchyItem[] = [];
      const seenIds = new Set<string>();

      // 1. 尝试从详情接口获取层级 (这是最准确的)
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

      // 2. 国家级补全 (针对 USA/United States 特别优化)
      const countryName = initialResult.address?.country;
      if (countryName && !items.some(i => i.name.toLowerCase().includes(countryName.toLowerCase()))) {
         const searchResults = await searchGeocode(countryName);
         // 优先寻找：类型为 boundary 且为 relation 的结果
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

      // 3. 将自身添加进层级 (增加防御性检查防止 charAt 报错)
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

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (isRectangleMode) return;
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
      // Nominatim reverse 可能返回 error 对象而非 null
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

  const handleRectangleSelect = (bounds: any) => {
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
    setIsRectangleMode(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchGeocode(searchInput);
      if (results && results.length > 0) {
        const res = results[0];
        setSourceCenter({ lat: parseFloat(res.lat || '0'), lng: parseFloat(res.lon || '0') });
        const structure = await traceHierarchyStructure(res);
        setHierarchy(structure);
        if (structure.length > 0) {
            loadLevelBoundary(structure[0]);
        } else if (res.geojson) {
            setSourcePolygon(convertGeoJsonToLeaflet(res.geojson.coordinates));
        }
      } else {
        setError("No results for search.");
      }
    } catch (err) {
      setError("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDiscovery = () => {
    setIsAnimating(true);
    setAnimationStage('down');
    setTimeout(() => {
      setAnimationStage('up');
      updateAntipodes(sourcePolygon);
      setView('anti');
    }, 1500);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      <header className="flex-shrink-0 bg-white border-b border-slate-200 p-3 md:px-8 flex flex-col sm:flex-row justify-between items-center z-50 gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-amber-600 text-white w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg font-bold text-xl">🐾</div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Antipode Mole</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Defensive Boundary Logic</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex-grow max-w-lg w-full flex gap-2">
          <input 
            type="text" 
            placeholder="City, State or Country..." 
            className="flex-grow px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md">Search</button>
        </form>
        
        <div className="flex gap-2">
           {view === 'anti' && (
              <button onClick={() => setView('source')} className="px-4 py-2 bg-amber-50 text-amber-700 font-bold rounded-2xl text-[10px] border border-amber-200 shadow-sm active:scale-95">
                ← Back
              </button>
           )}
        </div>
      </header>

      {view === 'source' && (
        <>
          <section className="flex-shrink-0 bg-white border-b border-slate-100 px-4 md:px-8 py-2.5 flex flex-col md:flex-row md:items-center gap-4 overflow-hidden z-40">
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Tools</span>
                  <button 
                    onClick={() => setIsRectangleMode(!isRectangleMode)}
                    className={`mt-1 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all border ${isRectangleMode ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-50 text-slate-600 border-slate-200 shadow-sm hover:border-amber-400'}`}
                  >
                    {isRectangleMode ? 'CANCEL' : 'DRAW BOX'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col flex-grow overflow-hidden">
                <div className="flex justify-between items-end pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Geography Levels</span>
                    {isLevelLoading && <span className="text-[10px] text-amber-600 font-bold animate-pulse">Simplifying Large Boundary...</span>}
                </div>
                <div className="flex flex-row gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide items-center py-2 min-h-[48px]">
                {isLoading ? (
                    <div className="text-amber-500 font-bold text-[11px] animate-pulse">Analyzing territory...</div>
                ) : error ? (
                    <div className="text-red-500 text-[11px] font-bold">{error}</div>
                ) : hierarchy.length > 0 ? (
                    hierarchy.map((level) => (
                    <button 
                        key={level.idKey}
                        disabled={isLevelLoading}
                        className={`px-4 py-1.5 border rounded-xl text-[11px] font-bold transition-all shadow-sm ${activeLevelId === level.idKey ? 'bg-amber-600 text-white border-amber-600 scale-105' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white disabled:opacity-50'}`}
                        onClick={() => loadLevelBoundary(level)}
                    >
                      {level.name}
                    </button>
                  ))
                ) : (
                  <div className="text-slate-400 text-[11px] italic">Trace hierarchy by clicking map</div>
                )}
                </div>
              </div>
          </section>

          <div className="flex-shrink-0 bg-white border-b border-slate-200 z-30 px-4 md:px-8 py-3">
            <button 
              onClick={triggerDiscovery}
              disabled={isLoading || isLevelLoading || (!sourcePolygon && !sourceCenter)}
              className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black transition-all disabled:opacity-40 disabled:bg-slate-200 text-[14px] tracking-[0.2em] active:scale-[0.98] flex items-center justify-center gap-3 rounded-2xl shadow-xl uppercase"
            >
              <span>🕳️</span> DIG TO THE OTHER SIDE <span>🕳️</span>
            </button>
          </div>
        </>
      )}

      <main className="flex-grow relative bg-white overflow-hidden">
        {view === 'source' ? (
          <MapPanel 
            key="source-map"
            id="source-map" 
            title="SOURCE REGION" 
            center={sourceCenter} 
            polygon={sourcePolygon}
            onMapClick={handleMapClick}
            isSelectMode={isRectangleMode}
            onRectangleSelect={handleRectangleSelect}
          />
        ) : (
          <MapPanel 
            key="anti-map"
            id="anti-map" 
            title="ANTIPODE REGION" 
            center={antiCenter} 
            polygon={antiPolygon}
            isSelectMode={false}
          />
        )}
      </main>

      <MoleAnimation 
        isAnimating={isAnimating} 
        onFinish={() => setIsAnimating(false)} 
        direction={animationStage}
      />
    </div>
  );
};

export default App;
