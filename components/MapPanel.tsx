
import React, { useEffect, useRef } from 'react';
import { Coordinate } from '../types';

interface MapPanelProps {
  id: string;
  title: string;
  center: Coordinate;
  polygon?: [number, number][][];
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
  const startLatLngRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(id).setView([center.lat, center.lng], 3);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    mapRef.current.on('click', (e: any) => {
      if (!isSelectMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    // Custom rectangle selection logic
    mapRef.current.on('mousedown', (e: any) => {
      if (!isSelectMode) return;
      mapRef.current.dragging.disable();
      startLatLngRef.current = e.latlng;
      
      if (selectionBoxRef.current) {
        mapRef.current.removeLayer(selectionBoxRef.current);
      }
      
      selectionBoxRef.current = L.rectangle([e.latlng, e.latlng], {
        color: "#ff7800", weight: 1, fillOpacity: 0.2
      }).addTo(mapRef.current);
    });

    mapRef.current.on('mousemove', (e: any) => {
      if (!isSelectMode || !startLatLngRef.current || !selectionBoxRef.current) return;
      selectionBoxRef.current.setBounds(L.latLngBounds(startLatLngRef.current, e.latlng));
    });

    mapRef.current.on('mouseup', (e: any) => {
      if (!isSelectMode || !startLatLngRef.current) return;
      const bounds = L.latLngBounds(startLatLngRef.current, e.latlng);
      
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      if (onSelectionEnd) {
        onSelectionEnd([[sw.lat, sw.lng], [ne.lat, ne.lng]]);
      }
      
      startLatLngRef.current = null;
      mapRef.current.dragging.enable();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom());
      
      if (markerRef.current) mapRef.current.removeLayer(markerRef.current);
      markerRef.current = L.marker([center.lat, center.lng]).addTo(mapRef.current);
    }
  }, [center]);

  useEffect(() => {
    if (mapRef.current && polygon) {
      if (polygonLayerRef.current) mapRef.current.removeLayer(polygonLayerRef.current);
      
      polygonLayerRef.current = L.polygon(polygon, {
        color: title.includes('Source') ? 'blue' : 'red',
        fillColor: title.includes('Source') ? '#3b82f6' : '#ef4444',
        fillOpacity: 0.5
      }).addTo(mapRef.current);
      
      const bounds = polygonLayerRef.current.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [polygon]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-semibold text-slate-700 flex justify-between items-center">
        <span>{title}</span>
        <span className="text-xs font-normal opacity-60">
          {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
        </span>
      </div>
      <div id={id} ref={containerRef} className="flex-grow z-0" />
    </div>
  );
};

export default MapPanel;
