
import React, { useState, useCallback } from 'react';
import MapPanel from './components/MapPanel';
import MoleAnimation from './components/MoleAnimation';
import { Coordinate } from './types';
import { calculateAntipode, calculatePolygonAntipodes, reverseGeocode, searchGeocode } from './services/geoService';

const App: React.FC = () => {
  const [view, setView] = useState<'source' | 'anti'>('source');
  const [sourceCenter, setSourceCenter] = useState<Coordinate>({ lat: 39.9042, lng: 116.4074 }); 
  const [antiCenter, setAntiCenter] = useState<Coordinate>(calculateAntipode({ lat: 39.9042, lng: 116.4074 }));
  
  const [sourcePolygon, setSourcePolygon] = useState<any>(null);
  const [antiPolygon, setAntiPolygon] = useState<any>(null);
  
  const [hierarchy, setHierarchy] = useState<{ name: string, query: string }[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStage, setAnimationStage] = useState<'down' | 'up'>('down');
  const [isLoading, setIsLoading] = useState(false);

  const updateAntipodes = (sourcePoly: any) => {
    const newAntiCenter = calculateAntipode(sourceCenter);
    setAntiCenter(newAntiCenter);
    if (sourcePoly && Array.isArray(sourcePoly) && Array.isArray(sourcePoly[0])) {
      setAntiPolygon(calculatePolygonAntipodes(sourcePoly));
    } else {
      setAntiPolygon(null);
    }
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setIsLoading(true);
    setSourceCenter({ lat, lng });
    try {
      const results = await reverseGeocode(lat, lng);
      if (results && results.length > 0) {
        const result = results[0];
        
        // Nominatim's display_name is naturally ordered Smallest -> Largest.
        // We use this as our primary source of hierarchy for maximum reliability.
        if (result.display_name) {
          const parts = result.display_name.split(',').map(p => p.trim());
          const levels: { name: string, query: string }[] = [];
          const seen = new Set<string>();

          parts.forEach((part) => {
            const lower = part.toLowerCase();
            // Filter out zip codes, very short strings (codes), and duplicates
            if (part && 
                !seen.has(lower) && 
                isNaN(Number(part)) && 
                part.length > 2) {
              levels.push({ name: part, query: part });
              seen.add(lower);
            }
          });
          setHierarchy(levels);
        }

        // Polygon detection
        if (result.geojson && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')) {
           const convertCoords = (coords: any): any => {
             if (!coords) return null;
             if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
               return [coords[1], coords[0]]; 
             }
             if (Array.isArray(coords)) {
               return coords.map(convertCoords).filter((c: any) => c !== null);
             }
             return null;
           };
           const converted = convertCoords(result.geojson.coordinates);
           if (Array.isArray(converted) && Array.isArray(converted[0])) {
              setSourcePolygon(converted);
           } else {
              setSourcePolygon(null);
           }
        } else {
           setSourcePolygon(null);
        }
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLevelClick = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const results = await searchGeocode(query);
      if (results && results.length > 0) {
        // Find result with polygon
        const result = results.find(r => r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon')) || results[0];
        if (result.geojson && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')) {
           const convertCoords = (coords: any): any => {
             if (!coords) return null;
             if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number') {
               return [coords[1], coords[0]];
             }
             if (Array.isArray(coords)) {
               return coords.map(convertCoords).filter((c: any) => c !== null);
             }
             return null;
           };
           const converted = convertCoords(result.geojson.coordinates);
           if (Array.isArray(converted) && Array.isArray(converted[0])) {
              setSourcePolygon(converted);
           }
           if (result.boundingbox) {
             const bbox = result.boundingbox.map(Number);
             setSourceCenter({ lat: (bbox[0] + bbox[1]) / 2, lng: (bbox[2] + bbox[3]) / 2 });
           }
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectionEnd = useCallback((bounds: [[number, number], [number, number]]) => {
    const [[s, w], [n, e]] = bounds;
    const poly: [number, number][] = [[n, w], [n, e], [s, e], [s, w], [n, w]];
    setSourcePolygon(poly);
    setSourceCenter({ lat: (n + s) / 2, lng: (w + e) / 2 });
    setHierarchy([]); 
    setIsSelectMode(false);
  }, []);

  const triggerDiscovery = () => {
    setIsAnimating(true);
    setAnimationStage('down');
    setTimeout(() => {
      setAnimationStage('up');
      updateAntipodes(sourcePolygon);
      setView('anti');
    }, 1500);
  };

  const backToSource = () => {
    setView('source');
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-slate-100 p-4 md:px-8 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-2xl shadow-xl shadow-indigo-100 font-bold text-xl">🕳️</span>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Antipodes</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Surface Explorer</p>
          </div>
        </div>
        
        <div className="flex gap-2.5">
           {view === 'anti' && (
              <button onClick={backToSource} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-[11px] transition-all flex items-center gap-2 border border-slate-200 shadow-sm active:scale-95">
                ← Return to Surface
              </button>
           )}
           <button 
             onClick={() => setIsSelectMode(!isSelectMode)}
             className={`px-5 py-2.5 rounded-2xl font-bold text-[11px] transition-all flex items-center gap-2 border shadow-sm ${
               isSelectMode ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
             }`}
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
             {isSelectMode ? 'Exit Selection' : 'Select Rectangle'}
           </button>
           <button 
             onClick={triggerDiscovery}
             disabled={isAnimating}
             className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 text-[11px] active:scale-95"
           >
             Dig to Antipode
           </button>
        </div>
      </header>

      {view === 'source' && (
        <section className="flex-shrink-0 bg-white border-b border-slate-100 px-4 md:px-8 py-3.5 flex items-center gap-5 overflow-hidden z-40">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0 border-r border-slate-100 pr-5">Small → Large</span>
            <div className="flex flex-row gap-2.5 overflow-x-auto whitespace-nowrap scrollbar-hide flex-grow">
            {hierarchy.length > 0 ? (
                hierarchy.map((level, idx) => (
                <button 
                    key={idx}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-all flex items-center gap-2.5 active:scale-95 shadow-sm"
                    onClick={() => handleLevelClick(level.query)}
                >
                    {level.name}
                    {idx < hierarchy.length - 1 && <svg className="w-2.5 h-2.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>}
                </button>
                ))
            ) : (
                <div className="text-slate-300 italic text-[11px] py-1.5 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Click map to reveal regional hierarchy...
                </div>
            )}
            </div>
            {isLoading && <div className="flex-shrink-0 w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
        </section>
      )}

      <main className="flex-grow flex flex-col relative bg-slate-100 overflow-hidden">
        {view === 'source' ? (
          <MapPanel 
            key="source-map-instance"
            id="source-map" 
            title="Source Surface" 
            center={sourceCenter} 
            polygon={sourcePolygon}
            onMapClick={handleMapClick}
            onSelectionEnd={handleSelectionEnd}
            isSelectMode={isSelectMode}
          />
        ) : (
          <MapPanel 
            key="anti-map-instance"
            id="anti-map" 
            title="Antipodal Result" 
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
