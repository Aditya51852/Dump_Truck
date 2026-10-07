// src/pages/LiveFleet.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Wifi,
  WifiOff,
  Plus,
  User,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useDrivers } from '../hooks/useDrivers';
import { addVehicle, deleteVehicle } from '../firebase/vehicleService';
import { assignDriverToVehicle, unassignDriverFromVehicle } from '../firebase/driverService';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import {
  formatSpeed,
  formatCoordinates,
  formatRSSI,
  getSignalStrength,
} from '../utils/formatters';

export default function LiveFleet() {
  const { vehicleList, loading, error } = useVehicles();
  const { drivers } = useDrivers();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Add Vehicle Modal
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [initialDriverId, setInitialDriverId] = useState('');

  // Quick Assign Driver Modal
  const [assignTargetVehicle, setAssignTargetVehicle] = useState<string | null>(null);
  const [quickDriverId, setQuickDriverId] = useState('');

  // Delete Vehicle confirmation
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAddVehicle = () => {
    // Generate next free vehicle ID like DUMPER_002
    const nextSeq = String(vehicleList.length + 1).padStart(3, '0');
    setNewVehicleId(`DUMPER_${nextSeq}`);
    setInitialDriverId('');
    setIsAddVehicleOpen(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleId.trim()) return;

    try {
      setIsSubmitting(true);
      await addVehicle(newVehicleId.trim(), {
        driverId: initialDriverId.trim() || undefined,
      });

      addToast({
        title: 'Vehicle Registered',
        message: `Registered ${newVehicleId.trim()} in Firebase RTDB (/vehicles/${newVehicleId.trim()})`,
        type: 'success',
      });

      setIsAddVehicleOpen(false);
    } catch (err) {
      addToast({
        title: 'Registration Failed',
        message: (err as Error).message || 'Failed to add vehicle',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmQuickAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetVehicle) return;

    try {
      setIsSubmitting(true);
      if (quickDriverId.trim()) {
        await assignDriverToVehicle(quickDriverId.trim(), assignTargetVehicle);
        addToast({
          title: 'Driver Assigned',
          message: `Driver ${quickDriverId.trim()} assigned to ${assignTargetVehicle} in Firebase RTDB`,
          type: 'success',
        });
      } else {
        await unassignDriverFromVehicle(assignTargetVehicle);
        addToast({
          title: 'Driver Unassigned',
          message: `Cleared driver from ${assignTargetVehicle} in Firebase RTDB`,
          type: 'info',
        });
      }
      setAssignTargetVehicle(null);
    } catch (err) {
      addToast({
        title: 'Assignment Failed',
        message: (err as Error).message || 'Failed to assign driver',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deleteVehicleId) return;
    try {
      setIsSubmitting(true);
      await deleteVehicle(deleteVehicleId);
      addToast({
        title: 'Vehicle Removed',
        message: `Removed ${deleteVehicleId} from Firebase RTDB`,
        type: 'info',
      });
      setDeleteVehicleId(null);
    } catch (err) {
      addToast({
        title: 'Delete Failed',
        message: (err as Error).message || 'Failed to remove vehicle',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading fleet data from Firebase..." />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">Live Fleet</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Live RTDB Feed
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time status of all vehicles • {vehicleList.length} vehicle{vehicleList.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={handleOpenAddVehicle}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {vehicleList.length === 0 ? (
        <EmptyState
          title="No vehicles found"
          message="No vehicles are currently registered in Firebase. Click 'Add Vehicle' above to create one."
        />
      ) : (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Vehicle ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Current Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Speed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">GPS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Cycle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Beacon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">WiFi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">RSSI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last Update</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {vehicleList.map(({ id, current }) => {
                  const signalStrength = getSignalStrength(current.system?.wifiRSSI);
                  return (
                    <tr
                      key={id}
                      className="hover:bg-slate-700/20 transition-colors group"
                    >
                      {/* ID */}
                      <td
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => navigate(`/vehicle/${id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-amber-400" />
                          <span className="font-semibold text-slate-200 group-hover:text-amber-400 transition-colors font-mono">
                            {id}
                          </span>
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300 font-mono text-xs">
                            {current.driverId || <span className="text-slate-500 italic">None</span>}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssignTargetVehicle(id);
                              setQuickDriverId(current.driverId || '');
                            }}
                            className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                            title="Assign / Reassign Driver"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* State */}
                      <td className="px-4 py-3">
                        <StatusBadge stateName={current.stateName} size="sm" />
                      </td>

                      {/* Zone */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {current.beacon?.zoneName || '—'}
                      </td>

                      {/* Speed */}
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                        {formatSpeed(current.gps?.speedKmph)}
                      </td>

                      {/* GPS */}
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {formatCoordinates(current.gps?.latitude, current.gps?.longitude)}
                      </td>

                      {/* Cycle */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-300 font-mono">
                          #{current.cycleNumber}
                        </span>
                      </td>

                      {/* Beacon */}
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                        {current.beacon?.id || '—'}
                      </td>

                      {/* WiFi */}
                      <td className="px-4 py-3">
                        {current.system?.wifi ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs">
                            <Wifi className="w-3.5 h-3.5" /> Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-xs">
                            <WifiOff className="w-3.5 h-3.5" /> Offline
                          </span>
                        )}
                      </td>

                      {/* RSSI */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-mono ${
                          signalStrength === 'excellent' ? 'text-emerald-400' :
                          signalStrength === 'good' ? 'text-blue-400' :
                          signalStrength === 'fair' ? 'text-amber-400' :
                          signalStrength === 'weak' ? 'text-red-400' : 'text-slate-500'
                        }`}>
                          {formatRSSI(current.system?.wifiRSSI)}
                        </span>
                      </td>

                      {/* Last Update */}
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                        {current.time || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/vehicle/${id}`)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                            title="View Dashboard"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteVehicleId(id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      <Modal
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        title="Add New Vehicle"
        subtitle="Initializes vehicle telemetry structure directly in Firebase RTDB (/vehicles/{id}/current)"
      >
        <form onSubmit={handleCreateVehicle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Vehicle ID <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newVehicleId}
              onChange={(e) => setNewVehicleId(e.target.value.toUpperCase())}
              placeholder="e.g. TRUCK002"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assign Initial Driver (Optional)
            </label>
            <input
              type="text"
              value={initialDriverId}
              onChange={(e) => setInitialDriverId(e.target.value.toUpperCase())}
              placeholder="e.g. DRV001 (or select below)"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            {drivers.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span className="text-[11px] text-slate-400">Registered:</span>
                {drivers.map((d) => (
                  <button
                    key={d.driverId}
                    type="button"
                    onClick={() => setInitialDriverId(d.driverId)}
                    className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:border-amber-500/50"
                  >
                    {d.driverId}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddVehicleOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newVehicleId.trim()}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-semibold text-sm rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Registering on Firebase...' : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Assign Driver Modal */}
      <Modal
        isOpen={!!assignTargetVehicle}
        onClose={() => setAssignTargetVehicle(null)}
        title={`Assign Driver to ${assignTargetVehicle}`}
        subtitle="Directly updates Firebase RTDB vehicles/{id}/current/driverId"
      >
        <form onSubmit={handleConfirmQuickAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Driver ID
            </label>
            <input
              type="text"
              value={quickDriverId}
              onChange={(e) => setQuickDriverId(e.target.value.toUpperCase())}
              placeholder="e.g. DRV001 (or leave blank to unassign)"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {drivers.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Registered Drivers:</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {drivers.map((d) => (
                  <div
                    key={d.driverId}
                    onClick={() => setQuickDriverId(d.driverId)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                      quickDriverId === d.driverId
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-mono font-semibold">{d.driverId}</span>
                    {d.name && d.name !== d.driverId && (
                      <span className="text-slate-400">({d.name})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setAssignTargetVehicle(null)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : quickDriverId.trim() ? 'Assign Driver' : 'Clear Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Vehicle Modal */}
      <Modal
        isOpen={!!deleteVehicleId}
        onClose={() => setDeleteVehicleId(null)}
        title="Remove Vehicle"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to remove vehicle{' '}
            <span className="font-mono font-bold text-red-400">{deleteVehicleId}</span> from
            Firebase Realtime Database?
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteVehicleId(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDeleteVehicle}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Vehicle'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
