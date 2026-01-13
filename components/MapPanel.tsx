
import React, { useEffect, useRef } from 'react';
import { Coordinate } from '../types';

interface MapPanelProps {
  id: string;
  title: string;
  center: Coordinate;
  polygon?: any;
  onMapClick?: (lat: number, lng: number) => void;
  isSelectMode: boolean;
  onRectangleSelect?: (bounds: any) => void;
}

declare const L: any;

const MapPanel: React.FC<MapPanelProps> = ({ 
  id, title, center, polygon, onMapClick, isSelectMode, onRectangleSelect
}) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tempRectRef = useRef<any>(null);
  const startPointRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const lat = center?.lat || 0;
    const lng = center?.lng || 0;

    if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isSelectMode) {
      map.dragging.disable();
      
      const onMouseDown = (e: any) => {
        startPointRef.current = e.latlng;
        tempRectRef.current = L.rectangle([e.latlng, e.latlng], {
          color: "#d97706",
          weight: 1,
          fillOpacity: 0.1,
          dashArray: '5, 5'
        }).addTo(map);
      };

      const onMouseMove = (e: any) => {
        if (startPointRef.current && tempRectRef.current) {
          tempRectRef.current.setBounds([startPointRef.current, e.latlng]);
        }
      };

      const onMouseUp = (e: any) => {
        if (startPointRef.current && onRectangleSelect) {
          const bounds = tempRectRef.current.getBounds();
          onRectangleSelect(bounds);
        }
        if (tempRectRef.current) {
          map.removeLayer(tempRectRef.current);
          tempRectRef.current = null;
        }
        startPointRef.current = null;
      };

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);

      return () => {
        map.dragging.enable();
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
      };
    } else {
      const handlePointClick = (e: any) => {
        if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
      };
      map.on('click', handlePointClick);
      return () => map.off('click', handlePointClick);
    }
  }, [isSelectMode, onMapClick, onRectangleSelect]);

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
          color: title.toLowerCase().includes('source') ? '#d97706' : '#2563eb',
          fillColor: title.toLowerCase().includes('source') ? '#fbbf24' : '#3b82f6',
          fillOpacity: 0.2,
          weight: 2
        }).addTo(map);
        
        const bounds = polygonLayerRef.current.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 });
        }
      } catch (err) {
        console.warn("Polygon draw error:", err);
      }
    } else if (typeof center?.lat === 'number' && typeof center?.lng === 'number') {
      map.panTo([center.lat, center.lng], { animate: true });
    }

    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [center, polygon, title]);

  return (
    <div className="absolute inset-0 h-full w-full flex flex-col bg-white overflow-hidden">
      <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border bg-white/95 backdrop-blur-md text-slate-800 border-slate-200">
            {title}
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-[9px] font-mono shadow-lg w-fit">
            {center?.lat.toFixed(5)}, {center?.lng.toFixed(5)}
          </div>
        </div>
        {isSelectMode && (
          <div className="bg-amber-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase animate-pulse shadow-lg pointer-events-auto">
            Click and drag to draw box
          </div>
        )}
      </div>
      <div ref={containerRef} className="flex-grow h-full w-full z-0 cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default MapPanel;
