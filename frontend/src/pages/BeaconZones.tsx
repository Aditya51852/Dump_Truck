// src/pages/BeaconZones.tsx
import React, { useState, useMemo } from 'react';
import {
  Radio,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Search,
  Compass,
} from 'lucide-react';
import { useBeaconZones } from '../hooks/useBeaconZones';
import { addOrUpdateBeaconZone, deleteBeaconZone } from '../firebase/beaconService';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import type { BeaconZoneData } from '../types';

interface ZoneItem {
  id: string;
  data: BeaconZoneData;
}

const ZONE_PRESETS = [
  {
    prefix: 'DUMP',
    label: 'Dumping Station',
    type: 'DUMPING',
    icon: '🏗️',
    color: 'from-green-500 to-emerald-600',
    desc: 'Offloading point for hauled material',
  },
  {
    prefix: 'EXC',
    label: 'Excavator / Loading',
    type: 'EXCAVATOR',
    icon: '⛏️',
    color: 'from-orange-500 to-amber-600',
    desc: 'Excavator shovel loading zone',
  },
  {
    prefix: 'PARK',
    label: 'Parking Yard',
    type: 'PARKING',
    icon: '🅿️',
    color: 'from-slate-500 to-gray-600',
    desc: 'Staging and maintenance depot',
  },
  {
    prefix: 'CRUSH',
    label: 'Crusher Feed',
    type: 'CRUSHER',
    icon: '🏭',
    color: 'from-purple-500 to-indigo-600',
    desc: 'Primary crusher feeding hopper',
  },
  {
    prefix: 'WEIGH',
    label: 'Weighbridge',
    type: 'WEIGHBRIDGE',
    icon: '⚖️',
    color: 'from-cyan-500 to-blue-600',
    desc: 'Gross weight measurement bridge',
  },
];

function getZoneIcon(id: string, type?: string): string {
  const t = (type || id).toUpperCase();
  if (t.includes('DUMP')) return '🏗️';
  if (t.includes('EXC')) return '⛏️';
  if (t.includes('PARK')) return '🅿️';
  if (t.includes('CRUSH')) return '🏭';
  if (t.includes('WEIGH')) return '⚖️';
  return '📍';
}

function getZoneColor(id: string, type?: string): string {
  const t = (type || id).toUpperCase();
  if (t.includes('DUMP')) return 'from-green-500 to-emerald-600';
  if (t.includes('EXC')) return 'from-orange-500 to-amber-600';
  if (t.includes('PARK')) return 'from-slate-500 to-gray-600';
  if (t.includes('CRUSH')) return 'from-purple-500 to-indigo-600';
  if (t.includes('WEIGH')) return 'from-cyan-500 to-blue-600';
  return 'from-violet-500 to-purple-600';
}

export default function BeaconZones() {
  const { zoneList: rawZoneList, loading } = useBeaconZones();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState({
    zoneId: '',
    zoneName: '',
    type: 'CUSTOM',
    latitude: '',
    longitude: '',
    radius: '50',
    description: '',
  });

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize zone items
  const zoneList: ZoneItem[] = useMemo(() => {
    return rawZoneList.map(({ id, data }) => {
      let parsed: BeaconZoneData = {};
      if (typeof data === 'string') {
        parsed = { zoneName: data };
      } else if (data && typeof data === 'object') {
        parsed = data as BeaconZoneData;
      }
      return { id, data: parsed };
    });
  }, [rawZoneList]);

  const filteredZones = useMemo(() => {
    return zoneList.filter((z) => {
      const q = search.toLowerCase();
      const zName = z.data.zoneName || '';
      const zDesc = z.data.description || '';
      const matchesSearch =
        z.id.toLowerCase().includes(q) ||
        zName.toLowerCase().includes(q) ||
        zDesc.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (typeFilter !== 'all') {
        const t = (z.data.type || z.id).toUpperCase();
        return t.includes(typeFilter.toUpperCase());
      }

      return true;
    });
  }, [zoneList, search, typeFilter]);

  const handleOpenAdd = () => {
    setEditingZoneId(null);
    setZoneForm({
      zoneId: '',
      zoneName: '',
      type: 'CUSTOM',
      latitude: '23.456789',
      longitude: '85.123456',
      radius: '50',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: (typeof ZONE_PRESETS)[0]) => {
    // Generate next free sequence like DUMP002, EXC002, etc.
    const matchingCount = zoneList.filter((z) => z.id.startsWith(preset.prefix)).length;
    const nextSeq = String(matchingCount + 1).padStart(3, '0');
    const autoId = `${preset.prefix}${nextSeq}`;

    setZoneForm((prev) => ({
      ...prev,
      zoneId: prev.zoneId || autoId,
      zoneName: prev.zoneName || `${preset.label} ${nextSeq}`,
      type: preset.type,
      description: prev.description || preset.desc,
    }));
  };

  const handleOpenEdit = (zone: ZoneItem) => {
    setEditingZoneId(zone.id);
    setZoneForm({
      zoneId: zone.id,
      zoneName: zone.data.zoneName || zone.id,
      type: (zone.data.type as string) || 'CUSTOM',
      latitude: zone.data.latitude !== undefined && zone.data.latitude !== null ? String(zone.data.latitude) : '',
      longitude: zone.data.longitude !== undefined && zone.data.longitude !== null ? String(zone.data.longitude) : '',
      radius: zone.data.radius ? String(zone.data.radius) : '50',
      description: zone.data.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneForm.zoneId.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Beacon Zone ID is required',
        type: 'error',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await addOrUpdateBeaconZone(zoneForm.zoneId, {
        zoneName: zoneForm.zoneName || zoneForm.zoneId,
        type: zoneForm.type,
        latitude: zoneForm.latitude ? parseFloat(zoneForm.latitude) : null,
        longitude: zoneForm.longitude ? parseFloat(zoneForm.longitude) : null,
        radius: zoneForm.radius ? parseFloat(zoneForm.radius) : 50,
        description: zoneForm.description,
      });

      addToast({
        title: editingZoneId ? 'Beacon Zone Updated' : 'Beacon Zone Created',
        message: `Zone ${zoneForm.zoneId} configured directly in Firebase RTDB (/vehicle_beacon_zones/${zoneForm.zoneId})`,
        type: 'success',
      });

      setIsModalOpen(false);
    } catch (err) {
      addToast({
        title: 'Save Failed',
        message: (err as Error).message || 'Failed to update Firebase',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setIsSubmitting(true);
      await deleteBeaconZone(deleteTargetId);
      addToast({
        title: 'Beacon Zone Deleted',
        message: `Removed ${deleteTargetId} directly from Firebase RTDB`,
        type: 'info',
      });
      setDeleteTargetId(null);
    } catch (err) {
      addToast({
        title: 'Delete Failed',
        message: (err as Error).message || 'Failed to remove beacon zone',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillBrowserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setZoneForm((prev) => ({
            ...prev,
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6),
          }));
          addToast({
            title: 'GPS Coordinates Detected',
            message: `Lat: ${pos.coords.latitude.toFixed(6)}, Lon: ${pos.coords.longitude.toFixed(6)}`,
            type: 'info',
          });
        },
        () => {
          addToast({
            title: 'Geolocation Error',
            message: 'Unable to retrieve location. Please enter coordinates manually.',
            type: 'warning',
          });
        }
      );
    }
  };

  if (loading) return <LoadingState message="Loading beacon zones from Firebase..." />;

  const dumpCount = zoneList.filter((z) => (z.data.type || z.id).includes('DUMP')).length;
  const excCount = zoneList.filter((z) => (z.data.type || z.id).includes('EXC')).length;
  const parkCount = zoneList.filter((z) => (z.data.type || z.id).includes('PARK')).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">Beacon Zones</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Firebase Sync
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Configure BLE beacon zones and geofenced points of interest recognized by truck firmware
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Beacon Zone</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium">Total Configured</p>
          <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{zoneList.length}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium">Dumping Yards</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{dumpCount}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium">Excavator Pits</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{excCount}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium">Parking Depots</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{parkCount}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Beacon ID, Zone Name, or Type..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          {['all', 'DUMP', 'EXC', 'PARK', 'CRUSH'].map((cat) => (
            <button
              key={cat}
              onClick={() => setTypeFilter(cat)}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                typeFilter === cat
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Zones' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Zone Cards Grid */}
      {filteredZones.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center">
          <Radio className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No beacon zones found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {search ? 'Try modifying your search criteria.' : 'Create your first zone on Firebase to get started.'}
          </p>
          {!search && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Zone
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredZones.map((zone) => {
            const icon = getZoneIcon(zone.id, zone.data.type as string);
            const colorClass = getZoneColor(zone.id, zone.data.type as string);
            const zoneName = zone.data.zoneName || zone.id;

            return (
              <div
                key={zone.id}
                className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className={`h-1.5 bg-gradient-to-r ${colorClass}`} />
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-xl shrink-0 shadow-md`}
                        >
                          {icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-100 font-mono">
                              {zone.id}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-semibold uppercase">
                              {(zone.data.type as string) || 'ZONE'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{zoneName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(zone)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                          title="Edit Zone"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(zone.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Zone"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Description if present */}
                    {zone.data.description && (
                      <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                        {zone.data.description}
                      </p>
                    )}

                    {/* Geolocation Details */}
                    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Coordinates
                        </span>
                        <span className="text-slate-300 font-mono">
                          {zone.data.latitude && zone.data.longitude
                            ? `${Number(zone.data.latitude).toFixed(4)}, ${Number(zone.data.longitude).toFixed(4)}`
                            : 'Not set'}
                        </span>
                      </div>

                      {zone.data.radius !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Radio className="w-3.5 h-3.5 text-cyan-400" /> Detection Radius
                          </span>
                          <span className="text-slate-300 font-mono">
                            {zone.data.radius} meters
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-2.5 border-t border-slate-700/40 bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Firebase: vehicle_beacon_zones/{zone.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingZoneId ? `Edit Beacon Zone ${editingZoneId}` : 'Add New Beacon Zone'}
        subtitle="This directly modifies Firebase Realtime Database (/vehicle_beacon_zones/{id})"
      >
        <form onSubmit={handleSaveZone} className="space-y-4">
          {/* Quick presets for new zones */}
          {!editingZoneId && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Quick Template Presets:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {ZONE_PRESETS.map((preset) => (
                  <button
                    key={preset.prefix}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-600 text-xs text-slate-200 transition-colors"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Beacon Zone ID <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                disabled={!!editingZoneId}
                required
                value={zoneForm.zoneId}
                onChange={(e) => setZoneForm({ ...zoneForm, zoneId: e.target.value.toUpperCase() })}
                placeholder="e.g. DUMP001, EXC002, PARK001"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The identifier broadcast by the physical BLE beacon tag.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Zone Name / Title <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={zoneForm.zoneName}
                onChange={(e) => setZoneForm({ ...zoneForm, zoneName: e.target.value })}
                placeholder="e.g. North Dumping Yard"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Zone Type
              </label>
              <select
                value={zoneForm.type}
                onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="DUMPING">DUMPING (Dumping Station)</option>
                <option value="EXCAVATOR">EXCAVATOR (Loading Point)</option>
                <option value="PARKING">PARKING (Parking / Maintenance)</option>
                <option value="CRUSHER">CRUSHER (Primary Crusher)</option>
                <option value="WEIGHBRIDGE">WEIGHBRIDGE</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Detection Radius (Meters)
              </label>
              <input
                type="number"
                min="5"
                max="500"
                value={zoneForm.radius}
                onChange={(e) => setZoneForm({ ...zoneForm, radius: e.target.value })}
                placeholder="50"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* GPS Coordinates */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                GPS Geofence Center (Optional)
              </label>
              <button
                type="button"
                onClick={handleFillBrowserLocation}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                <Compass className="w-3 h-3" /> Use Device Location
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                value={zoneForm.latitude}
                onChange={(e) => setZoneForm({ ...zoneForm, latitude: e.target.value })}
                placeholder="Latitude (e.g. 23.456789)"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={zoneForm.longitude}
                onChange={(e) => setZoneForm({ ...zoneForm, longitude: e.target.value })}
                placeholder="Longitude (e.g. 85.123456)"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={zoneForm.description}
              onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
              placeholder="e.g. Main dumping pit situated at Level 3 Bench"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving to Firebase...' : editingZoneId ? 'Update Firebase' : 'Save to Firebase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="Delete Beacon Zone"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to remove beacon zone{' '}
            <span className="font-mono font-bold text-red-400">{deleteTargetId}</span> from
            Firebase Realtime Database?
          </p>
          <p className="text-xs text-slate-500">
            Vehicles will no longer identify this beacon zone when detecting its BLE signal.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Zone'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
