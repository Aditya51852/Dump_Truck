// src/components/LiveMap.tsx
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { VehicleCurrent } from '../types';
import { getMarkerColor } from '../utils/stateColors';
import { formatSpeed, formatStateName } from '../utils/formatters';

// Fix for default marker icon in Leaflet + Vite
import 'leaflet/dist/leaflet.css';

function createVehicleIcon(stateName: string, vehicleId: string): L.DivIcon {
  const color = getMarkerColor(stateName);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;">
        <div style="
          background: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 12px;
            font-weight: bold;
          ">🚛</span>
        </div>
        <div style="
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15,23,42,0.9);
          color: white;
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          font-weight: 600;
        ">${vehicleId.replace('DUMPER_', 'D')}</div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });
}

interface VehicleMarkerData {
  id: string;
  current: VehicleCurrent;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

interface LiveMapProps {
  vehicles: VehicleMarkerData[];
  selectedVehicle?: string;
  height?: string;
  onVehicleClick?: (vehicleId: string) => void;
}

export default function LiveMap({
  vehicles,
  selectedVehicle,
  height = '400px',
  onVehicleClick,
}: LiveMapProps) {
  const validVehicles = useMemo(
    () => vehicles.filter((v) => v.current?.gps?.locationValid && v.current.gps.latitude !== 0),
    [vehicles]
  );

  const selectedVehicleData = useMemo(
    () => validVehicles.find((v) => v.id === selectedVehicle),
    [validVehicles, selectedVehicle]
  );

  const defaultCenter: [number, number] = useMemo(() => {
    if (selectedVehicleData) {
      return [selectedVehicleData.current.gps.latitude, selectedVehicleData.current.gps.longitude];
    }
    if (validVehicles.length === 0) return [28.6139, 77.209]; // Default to Delhi
    const lat = validVehicles.reduce((s, v) => s + v.current.gps.latitude, 0) / validVehicles.length;
    const lng = validVehicles.reduce((s, v) => s + v.current.gps.longitude, 0) / validVehicles.length;
    return [lat, lng];
  }, [validVehicles, selectedVehicleData]);

  if (validVehicles.length === 0) {
    return (
      <div
        className="bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <p className="text-slate-400 text-sm">No GPS data available</p>
          <p className="text-slate-500 text-xs mt-1">Waiting for valid vehicle locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/50" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={selectedVehicleData ? 16 : 14}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapUpdater center={defaultCenter} zoom={selectedVehicleData ? 16 : 14} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {validVehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.current.gps.latitude, vehicle.current.gps.longitude]}
            icon={createVehicleIcon(vehicle.current.stateName, vehicle.id)}
            eventHandlers={{
              click: () => onVehicleClick?.(vehicle.id),
            }}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-800">{vehicle.id}</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <p><strong>State:</strong> {formatStateName(vehicle.current.stateName)}</p>
                  <p><strong>Driver:</strong> {vehicle.current.driverId || '—'}</p>
                  <p><strong>Speed:</strong> {formatSpeed(vehicle.current.gps.speedKmph)}</p>
                  <p><strong>Cycle:</strong> {vehicle.current.cycleNumber}</p>
                  <p><strong>Last Update:</strong> {vehicle.current.time}</p>
                  <p className="text-[10px] text-slate-400">
                    {vehicle.current.gps.latitude.toFixed(6)}, {vehicle.current.gps.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
