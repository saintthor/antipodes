
import React, { useState, useCallback } from 'react';
import MapPanel from './components/MapPanel';
import MoleAnimation from './components/MoleAnimation';
import { Coordinate } from './types';
import { calculateAntipode, calculatePolygonAntipodes, reverseGeocode, searchGeocode } from './services/geoService';

const RANKED_LEVELS: Record<string, number> = {
  'neighbourhood': 10,
  'suburb': 20,
  'village': 21,
  'hamlet': 22,
  'city_district': 30,
  'district': 31,
  'city': 40,
  'town': 41,
  'county': 50,
  'state': 60,
  'province': 61,
  'region': 62,
  'country': 100
};

const App: React.FC = () => {
  const [view, setView] = useState<'source' | 'anti'>('source');
  const [sourceCenter, setSourceCenter] = useState<Coordinate>({ lat: 39.9042, lng: 116.4074 }); 
  const [antiCenter, setAntiCenter] = useState<Coordinate>(calculateAntipode({ lat: 39.9042, lng: 116.4074 }));
  
  const [sourcePolygon, setSourcePolygon] = useState<any>(null);
  const [antiPolygon, setAntiPolygon] = useState<any>(null);
  
  const [hierarchy, setHierarchy] = useState<{ name: string, query: string, rank: number }[]>([]);
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
        const addr = result.address;
        const levels: { name: string, query: string, rank: number }[] = [];
        const seenNames = new Set<string>();

        if (addr) {
          Object.entries(addr).forEach(([key, val]) => {
            if (val && typeof val === 'string' && RANKED_LEVELS[key]) {
              const nameLower = val.toLowerCase();
              if (!seenNames.has(nameLower)) {
                let query = val;
                if (addr.country && key !== 'country') query += `, ${addr.country}`;
                levels.push({ name: val, query, rank: RANKED_LEVELS[key] });
                seenNames.add(nameLower);
              }
            }
          });
        }
        
        levels.sort((a, b) => a.rank - b.rank);
        setHierarchy(levels);

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
          <span className="bg-amber-600 text-white w-10 h-10 flex items-center justify-center rounded-2xl shadow-xl shadow-amber-100 font-bold text-xl">🐾</span>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Antipode Mole</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Global Tunneling Simulator</p>
          </div>
        </div>
        
        <div className="flex gap-2.5">
           {view === 'anti' && (
              <button onClick={backToSource} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-[11px] transition-all flex items-center gap-2 border border-slate-200 shadow-sm active:scale-95">
                ← Return to Surface
              </button>
           )}
        </div>
      </header>

      {view === 'source' && (
        <>
          <section className="flex-shrink-0 bg-white border-b border-slate-100 px-4 md:px-8 py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-5 overflow-hidden z-40">
              <p className="text-[11px] font-medium text-slate-500 max-w-[200px] leading-tight shrink-0 italic">
                Click map to select a spot. Choose a region, then dig to the other side!
              </p>
              <div className="flex flex-row gap-2.5 overflow-x-auto whitespace-nowrap scrollbar-hide flex-grow h-full items-center py-1">
              {hierarchy.length > 0 ? (
                  hierarchy.map((level, idx) => (
                  <button 
                      key={idx}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-amber-600 hover:border-amber-600 hover:text-white transition-all flex items-center gap-2.5 active:scale-95 shadow-sm"
                      onClick={() => handleLevelClick(level.query)}
                  >
                      {level.name}
                      {idx < hierarchy.length - 1 && <svg className="w-2.5 h-2.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>}
                  </button>
                  ))
              ) : (
                  <div className="text-slate-300 italic text-[11px] py-1.5 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Waiting for your first click...
                  </div>
              )}
              </div>
              {isLoading && <div className="flex-shrink-0 w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>}
          </section>

          <div className="flex-shrink-0 px-4 md:px-8 py-2 bg-white flex justify-center border-b border-slate-100 shadow-sm z-30">
            <button 
              onClick={triggerDiscovery}
              disabled={isAnimating}
              className="w-full max-w-xl py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-xl shadow-amber-100 transition-all disabled:opacity-50 text-[13px] tracking-wide active:scale-[0.98] flex items-center justify-center gap-3 group"
            >
              <span className="group-hover:animate-bounce">🕳️</span>
              Dig to Antipode!
              <span className="group-hover:animate-bounce">🕳️</span>
            </button>
          </div>
        </>
      )}

      <main className="flex-grow relative bg-white overflow-hidden">
        {view === 'source' ? (
          <MapPanel 
            key="source-map"
            id="source-map" 
            title="Current Location" 
            center={sourceCenter} 
            polygon={sourcePolygon}
            onMapClick={handleMapClick}
            isSelectMode={false}
          />
        ) : (
          <MapPanel 
            key="anti-map"
            id="anti-map" 
            title="Opposite Side" 
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
