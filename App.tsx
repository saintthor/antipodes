
import React, { useState, useCallback, useEffect } from 'react';
import MapPanel from './components/MapPanel';
import MoleAnimation from './components/MoleAnimation';
import { Coordinate, NominatimResult } from './types';
import { calculateAntipode, calculatePolygonAntipodes, reverseGeocode, searchGeocode } from './services/geoService';

const App: React.FC = () => {
  const [sourceCenter, setSourceCenter] = useState<Coordinate>({ lat: 39.9042, lng: 116.4074 }); // Beijing
  const [antiCenter, setAntiCenter] = useState<Coordinate>(calculateAntipode({ lat: 39.9042, lng: 116.4074 }));
  
  const [sourcePolygon, setSourcePolygon] = useState<[number, number][][] | undefined>();
  const [antiPolygon, setAntiPolygon] = useState<[number, number][][] | undefined>();
  
  const [hierarchy, setHierarchy] = useState<{ name: string, query: string }[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationStage, setAnimationStage] = useState<'down' | 'up'>('down');
  const [isLoading, setIsLoading] = useState(false);

  const updateAntipodes = (sourcePoly?: [number, number][][]) => {
    const newAntiCenter = calculateAntipode(sourceCenter);
    setAntiCenter(newAntiCenter);
    
    if (sourcePoly) {
      setAntiPolygon(calculatePolygonAntipodes(sourcePoly));
    } else {
      setAntiPolygon(undefined);
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setIsLoading(true);
    setSourceCenter({ lat, lng });
    try {
      const results = await reverseGeocode(lat, lng);
      if (results && results.length > 0 && results[0]) {
        const addr = results[0].address;
        const levels: { name: string, query: string }[] = [];
        
        if (addr) {
          // Comprehensive list of potential address keys for global compatibility
          const keys: (keyof typeof addr)[] = [
            'neighbourhood',
            'suburb',
            'city_district',
            'hamlet',
            'village',
            'town',
            'city',
            'municipality',
            'county',
            'province',
            'state_district',
            'state',
            'region',
            'country'
          ];

          const seenNames = new Set<string>();

          keys.forEach((key) => {
            const val = addr[key];
            if (val && typeof val === 'string' && !seenNames.has(val)) {
              let query = val;
              // Improve query precision by appending parent info
              if (['neighbourhood', 'suburb', 'city_district', 'hamlet', 'village'].includes(key)) {
                const parent = addr.city || addr.town || addr.municipality || addr.province || addr.state || '';
                if (parent && parent !== val) query += `, ${parent}`;
              } else if (['city', 'town', 'county', 'province'].includes(key)) {
                const parent = addr.state || addr.country || '';
                if (parent && parent !== val) query += `, ${parent}`;
              }

              levels.push({ name: val, query });
              seenNames.add(val);
            }
          });
          
          // Fallback if no specific levels were found but display_name exists
          if (levels.length === 0 && results[0].display_name) {
             const parts = results[0].display_name.split(',').map(s => s.trim());
             if (parts.length > 0) {
               levels.push({ name: parts[0], query: results[0].display_name });
             }
          }
        }

        setHierarchy(levels);

        // Set polygon to the most specific result found
        if (results[0].geojson && (results[0].geojson.type === 'Polygon' || results[0].geojson.type === 'MultiPolygon')) {
           const poly = results[0].geojson.type === 'Polygon' 
            ? [results[0].geojson.coordinates[0].map((c: any) => [c[1], c[0]])]
            : results[0].geojson.coordinates.map((ring: any) => ring[0].map((c: any) => [c[1], c[0]]));
           setSourcePolygon(poly);
        } else {
           setSourcePolygon(undefined);
        }
      } else {
        setHierarchy([]);
        setSourcePolygon(undefined);
      }
    } catch (err) {
      console.error(err);
      setHierarchy([]);
      setSourcePolygon(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelClick = async (query: string) => {
    setIsLoading(true);
    try {
      const results = await searchGeocode(query);
      if (results && results.length > 0) {
        // Find best match with polygon data
        const resultWithPolygon = results.find(r => r.geojson && (r.geojson.type === 'Polygon' || r.geojson.type === 'MultiPolygon')) || results[0];
        
        if (resultWithPolygon.geojson && (resultWithPolygon.geojson.type === 'Polygon' || resultWithPolygon.geojson.type === 'MultiPolygon')) {
           const poly = resultWithPolygon.geojson.type === 'Polygon' 
            ? [resultWithPolygon.geojson.coordinates[0].map((c: any) => [c[1], c[0]])]
            : resultWithPolygon.geojson.coordinates.map((ring: any) => ring[0].map((c: any) => [c[1], c[0]]));
           
           setSourcePolygon(poly);
           
           const bbox = resultWithPolygon.boundingbox.map(Number);
           const newCenter = { lat: (bbox[0] + bbox[1]) / 2, lng: (bbox[2] + bbox[3]) / 2 };
           setSourceCenter(newCenter);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectionEnd = (bounds: [[number, number], [number, number]]) => {
    const [[s, w], [n, e]] = bounds;
    const poly: [number, number][][] = [[
      [n, w], [n, e], [s, e], [s, w], [n, w]
    ]];
    setSourcePolygon(poly);
    setSourceCenter({ lat: (n + s) / 2, lng: (w + e) / 2 });
    setHierarchy([]);
    setIsSelectMode(false);
  };

  const triggerDiscovery = () => {
    setIsAnimating(true);
    setAnimationStage('down');
    
    setTimeout(() => {
      setAnimationStage('up');
      updateAntipodes(sourcePolygon);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen w-screen p-4 gap-4 bg-slate-50">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Antipodes Area Explorer</h1>
          <p className="text-slate-500 font-medium">Discover what's exactly on the other side of your world.</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
           <button 
             onClick={() => setIsSelectMode(!isSelectMode)}
             className={`px-4 py-2 rounded-lg font-bold transition-all ${isSelectMode ? 'bg-amber-500 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}
           >
             {isSelectMode ? 'Cancel Selecting' : 'Select Rectangle Area'}
           </button>
           <button 
             onClick={triggerDiscovery}
             disabled={isAnimating}
             className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50"
           >
             Get Antipodal Area
           </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col lg:flex-row gap-4 overflow-hidden">
        <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto pr-1">
          <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Area Hierarchy</h2>
            {isLoading ? (
              <div className="animate-pulse flex space-y-2 flex-col">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              </div>
            ) : hierarchy.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {hierarchy.map((level, idx) => (
                  <button 
                    key={idx}
                    className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center"
                    onClick={() => handleLevelClick(level.query)}
                  >
                    {level.name}
                    <svg className="w-3 h-3 ml-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm">Click anywhere on the source map to identify a region.</p>
            )}
          </section>

          <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Geographic Legend</h2>
             <div className="space-y-3">
                <div className="flex items-center gap-3">
                   <div className="w-4 h-4 bg-blue-500 rounded opacity-50"></div>
                   <span className="text-sm font-medium text-slate-600">Source Region</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-4 h-4 bg-red-500 rounded opacity-50"></div>
                   <span className="text-sm font-medium text-slate-600">Antipodal Region</span>
                </div>
             </div>
          </section>

          <section className="bg-indigo-900 p-4 rounded-xl shadow-lg text-white">
             <h2 className="font-bold text-indigo-200 text-xs uppercase mb-2">Did you know?</h2>
             <p className="text-sm opacity-90 leading-relaxed">
               Most land masses on Earth have oceans on their opposite side. For example, if you dig down from Beijing, you'll end up near the coast of Argentina in the Atlantic Ocean!
             </p>
          </section>
        </div>

        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
          <MapPanel 
            id="source-map" 
            title="Source Area" 
            center={sourceCenter} 
            polygon={sourcePolygon}
            onMapClick={handleMapClick}
            onSelectionEnd={handleSelectionEnd}
            isSelectMode={isSelectMode}
          />
          <MapPanel 
            id="anti-map" 
            title="Antipodal Area" 
            center={antiCenter} 
            polygon={antiPolygon}
            isSelectMode={false}
          />
        </div>
      </main>

      <MoleAnimation 
        isAnimating={isAnimating} 
        onFinish={() => setIsAnimating(false)} 
        direction={animationStage}
      />

      <footer className="text-xs text-slate-400 flex justify-between items-center py-2 px-1">
        <div>Coordinates are calculated using the WGS84 ellipsoid model.</div>
        <div className="font-mono">Mole Exploration Engine v1.2.1</div>
      </footer>
    </div>
  );
};

export default App;
