
import React, { useEffect, useRef } from 'react';
import { Coordinate } from '../types';

interface MapPanelProps {
  id: string;
  title: string;
  center: Coordinate;
  polygon?: any;
  onMapClick?: (lat: number, lng: number) => void;
  onSelectionEnd?: (bounds: [[number, number], [number, number]]) => void;
  isSelectMode: boolean;
}

declare const L: any;

const MapPanel: React.FC<MapPanelProps> = ({ 
  id, title, center, polygon, onMapClick, onSelectionEnd, isSelectMode 
}) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const selectionBoxRef = useRef<any>(null);
  const isMouseDownRef = useRef(false);
  const startLatLngRef = useRef<any>(null);

  // 1. Initial Map Setup
  useEffect(() => {
    if (!containerRef.current) return;

    const lat = (typeof center?.lat === 'number') ? center.lat : 0;
    const lng = (typeof center?.lng === 'number') ? center.lng : 0;

    if (mapRef.current) {
        mapRef.current.remove();
    }

    try {
      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        attributionControl: false
      }).setView([lat, lng], 3);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Robust size management
      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (e) {
      console.error("Leaflet init failed:", e);
    }
  }, []);

  // 2. Interaction & Mode Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // CRITICAL: Force Tile Rendering immediately on mode change.
    // Transitions are removed to prevent Leaflet from miscalculating size during layout shifts.
    map.invalidateSize();

    const onMouseDown = (e: any) => {
      if (!isSelectMode) return;
      L.DomEvent.stopPropagation(e);
      isMouseDownRef.current = true;
      startLatLngRef.current = e.latlng;
      
      if (selectionBoxRef.current) map.removeLayer(selectionBoxRef.current);
      selectionBoxRef.current = L.rectangle([e.latlng, e.latlng], {
        color: "#f59e0b",
        weight: 3,
        fillOpacity: 0.15,
        dashArray: '8, 8',
        interactive: false
      }).addTo(map);
    };

    const onMouseMove = (e: any) => {
      if (!isSelectMode || !isMouseDownRef.current || !selectionBoxRef.current) return;
      L.DomEvent.stopPropagation(e);
      selectionBoxRef.current.setBounds(L.latLngBounds(startLatLngRef.current, e.latlng));
    };

    const onMouseUp = (e: any) => {
      if (!isSelectMode || !isMouseDownRef.current) return;
      L.DomEvent.stopPropagation(e);
      isMouseDownRef.current = false;
      
      if (selectionBoxRef.current) {
        const bounds = selectionBoxRef.current.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const dist = Math.abs(sw.lat - ne.lat) + Math.abs(sw.lng - ne.lng);
        
        if (dist > 0.001 && onSelectionEnd) {
          onSelectionEnd([[sw.lat, sw.lng], [ne.lat, ne.lng]]);
        }
        map.removeLayer(selectionBoxRef.current);
        selectionBoxRef.current = null;
      }
      startLatLngRef.current = null;
    };

    const handlePointClick = (e: any) => {
      if (!isSelectMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    if (isSelectMode) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    }
    map.on('click', handlePointClick);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.off('click', handlePointClick);
    };
  }, [isSelectMode, onSelectionEnd, onMapClick]);

  // 3. Data Sync (Center & Polygons)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) map.removeLayer(markerRef.current);
    if (typeof center?.lat === 'number' && typeof center?.lng === 'number') {
      markerRef.current = L.marker([center.lat, center.lng]).addTo(map);
    }

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }

    const isValidPolygon = (p: any): boolean => {
      return Array.isArray(p) && p.length > 0 && Array.isArray(p[0]);
    };

    if (isValidPolygon(polygon)) {
      try {
        polygonLayerRef.current = L.polygon(polygon, {
          color: title.toLowerCase().includes('source') ? '#2563eb' : '#dc2626',
          fillColor: title.toLowerCase().includes('source') ? '#3b82f6' : '#ef4444',
          fillOpacity: 0.25,
          weight: 2
        }).addTo(map);
        
        const bounds = polygonLayerRef.current.getBounds();
        if (bounds && bounds.isValid() && !isMouseDownRef.current) {
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
        }
      } catch (err) {
        console.warn("Polygon draw error:", err);
      }
    } else if (typeof center?.lat === 'number' && typeof center?.lng === 'number') {
      const currentBounds = map.getBounds();
      if (currentBounds.isValid() && !currentBounds.contains([center.lat, center.lng])) {
        map.panTo([center.lat, center.lng], { animate: true });
      }
    }
  }, [center, polygon, title]);

  return (
    <div className="relative w-full h-full flex flex-col bg-white overflow-hidden">
      {/* Absolute Overlay UI */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border flex items-center gap-2 ${
            isSelectMode ? 'bg-amber-500 text-white border-amber-600 scale-105' : 'bg-white/95 backdrop-blur-md text-slate-800 border-slate-200'
          }`}>
            {isSelectMode && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            {title}
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[9px] font-mono shadow-lg w-fit">
            {typeof center?.lat === 'number' ? center.lat.toFixed(5) : '0'}, {typeof center?.lng === 'number' ? center.lng.toFixed(5) : '0'}
          </div>
        </div>
      </div>

      {/* Map Body: Use pure absolute positioning to avoid flex container quirks */}
      <div 
        ref={containerRef} 
        className={`absolute inset-0 z-0 ${isSelectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      />
    </div>
  );
};

export default MapPanel;
