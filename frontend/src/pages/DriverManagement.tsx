// src/pages/DriverManagement.tsx
import React, { useState, useMemo } from 'react';
import {
  Users,
  Truck,
  Hash,
  Activity,
  Plus,
  Edit2,
  Trash2,
  Search,
  Phone,
  CreditCard,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useDrivers } from '../hooks/useDrivers';
import { useVehicles } from '../hooks/useVehicles';
import {
  addOrUpdateDriver,
  deleteDriver,
  assignDriverToVehicle,
  unassignDriverFromVehicle,
} from '../firebase/driverService';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import Modal from '../components/Modal';
import { formatEventName } from '../utils/formatters';
import { getEventColor } from '../utils/stateColors';
import type { DriverInfo } from '../types';

export default function DriverManagement() {
  const { drivers, loading } = useDrivers();
  const { vehicleList } = useVehicles();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_duty' | 'available' | 'off_duty'>('all');

  // Add / Edit Modal state
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState({
    driverId: '',
    name: '',
    phone: '',
    licenseNumber: '',
    status: 'AVAILABLE',
    assignedVehicle: '',
    notes: '',
  });

  // Assign Vehicle Modal state
  const [assignTargetDriver, setAssignTargetDriver] = useState<DriverInfo | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  // Delete confirm state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available vehicles list
  const vehicleOptions = useMemo(() => {
    return vehicleList.map((v) => ({
      id: v.id,
      driverId: v.current?.driverId || '',
      stateName: v.current?.stateName || 'PARKED',
    }));
  }, [vehicleList]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const q = search.toLowerCase();
      const matchesSearch =
        driver.driverId.toLowerCase().includes(q) ||
        (driver.name && driver.name.toLowerCase().includes(q)) ||
        (driver.currentVehicle && driver.currentVehicle.toLowerCase().includes(q)) ||
        (driver.licenseNumber && driver.licenseNumber.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'on_duty') return !!driver.currentVehicle;
      if (statusFilter === 'available') return !driver.currentVehicle && driver.status !== 'OFF_DUTY';
      if (statusFilter === 'off_duty') return driver.status === 'OFF_DUTY';
      return true;
    });
  }, [drivers, search, statusFilter]);

  const handleOpenAdd = () => {
    setEditingDriverId(null);
    setDriverForm({
      driverId: '',
      name: '',
      phone: '',
      licenseNumber: '',
      status: 'AVAILABLE',
      assignedVehicle: '',
      notes: '',
    });
    setIsDriverModalOpen(true);
  };

  const handleOpenEdit = (driver: DriverInfo) => {
    setEditingDriverId(driver.driverId);
    setDriverForm({
      driverId: driver.driverId,
      name: driver.name || driver.driverId,
      phone: driver.phone || '',
      licenseNumber: driver.licenseNumber || '',
      status: driver.status || (driver.currentVehicle ? 'ON_DUTY' : 'AVAILABLE'),
      assignedVehicle: driver.currentVehicle || '',
      notes: '',
    });
    setIsDriverModalOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.driverId.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Driver ID is required',
        type: 'error',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await addOrUpdateDriver(driverForm.driverId, {
        name: driverForm.name,
        phone: driverForm.phone,
        licenseNumber: driverForm.licenseNumber,
        status: driverForm.status,
        assignedVehicle: driverForm.assignedVehicle || null,
        notes: driverForm.notes,
      });

      addToast({
        title: editingDriverId ? 'Driver Profile Updated' : 'Driver Registered',
        message: `Driver ${driverForm.driverId} saved directly to Firebase RTDB`,
        type: 'success',
      });

      setIsDriverModalOpen(false);
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

  const handleOpenAssignModal = (driver: DriverInfo) => {
    setAssignTargetDriver(driver);
    setSelectedVehicleId(driver.currentVehicle || (vehicleOptions[0]?.id || ''));
  };

  const handleConfirmAssignment = async () => {
    if (!assignTargetDriver || !selectedVehicleId) return;
    try {
      setIsSubmitting(true);
      await assignDriverToVehicle(assignTargetDriver.driverId, selectedVehicleId);
      addToast({
        title: 'Driver Assigned',
        message: `Assigned ${assignTargetDriver.driverId} to ${selectedVehicleId} directly in Firebase`,
        type: 'success',
      });
      setAssignTargetDriver(null);
    } catch (err) {
      addToast({
        title: 'Assignment Failed',
        message: (err as Error).message || 'Failed to assign vehicle',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassignDriver = async (driver: DriverInfo) => {
    if (!driver.currentVehicle) return;
    try {
      setIsSubmitting(true);
      await unassignDriverFromVehicle(driver.currentVehicle, driver.driverId);
      addToast({
        title: 'Driver Unassigned',
        message: `Released ${driver.driverId} from ${driver.currentVehicle} in Firebase`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Unassign Failed',
        message: (err as Error).message || 'Failed to unassign vehicle',
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
      await deleteDriver(deleteTargetId);
      addToast({
        title: 'Driver Removed',
        message: `Removed ${deleteTargetId} from Firebase drivers registry`,
        type: 'info',
      });
      setDeleteTargetId(null);
    } catch (err) {
      addToast({
        title: 'Delete Failed',
        message: (err as Error).message || 'Failed to remove driver',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading drivers from Firebase..." />;

  const onDutyCount = drivers.filter((d) => !!d.currentVehicle).length;
  const availableCount = drivers.length - onDutyCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">Driver Management</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Live Firebase Sync
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Register personnel, assign trucks, and synchronize driver records with Firebase RTDB
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Driver</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Registered Drivers</p>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{drivers.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Active On Duty</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{onDutyCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Available Drivers</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
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
            placeholder="Search by Driver ID, Name, Truck, License..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === 'all' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({drivers.length})
          </button>
          <button
            onClick={() => setStatusFilter('on_duty')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === 'on_duty' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            On Duty ({onDutyCount})
          </button>
          <button
            onClick={() => setStatusFilter('available')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              statusFilter === 'available' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Available ({availableCount})
          </button>
        </div>
      </div>

      {/* Driver Cards Grid */}
      {filteredDrivers.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No drivers found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {search
              ? 'Try modifying your search filter.'
              : 'Add your first driver or assign a driver to a vehicle to see them here.'}
          </p>
          {!search && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Driver
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const isOnDuty = !!driver.currentVehicle;

            return (
              <div
                key={driver.driverId}
                className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0 shadow-md">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-100 font-mono">
                            {driver.driverId}
                          </h3>
                          {driver.isRegistered && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              title="Registered in Firebase Drivers collection"
                            >
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {driver.name && driver.name !== driver.driverId ? driver.name : 'Operator'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(driver)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                        title="Edit Driver"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(driver.driverId)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Driver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-5 space-y-3">
                    {/* Status & Assigned Vehicle */}
                    <div className="flex items-center justify-between text-sm py-1 border-b border-slate-700/30">
                      <span className="text-slate-400 flex items-center gap-1.5 text-xs">
                        <Truck className="w-3.5 h-3.5 text-amber-400" /> Current Truck
                      </span>
                      {driver.currentVehicle ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-mono font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {driver.currentVehicle}
                          </span>
                          {driver.currentState && (
                            <StatusBadge stateName={driver.currentState} size="sm" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No truck assigned</span>
                      )}
                    </div>

                    {/* Contact & License if available */}
                    {driver.phone && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> Phone
                        </span>
                        <span className="text-slate-300 font-mono">{driver.phone}</span>
                      </div>
                    )}

                    {driver.licenseNumber && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3" /> License No
                        </span>
                        <span className="text-slate-300 font-mono">{driver.licenseNumber}</span>
                      </div>
                    )}

                    {/* Total Cycles */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Hash className="w-3 h-3" /> Completed Cycles
                      </span>
                      <span className="text-slate-200 font-mono font-semibold">
                        {driver.totalCycles}
                      </span>
                    </div>

                    {/* Recent Events */}
                    {driver.recentEvents.length > 0 && (
                      <div className="pt-2 border-t border-slate-700/30">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Activity className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[11px] text-slate-500 font-medium">Recent Activity</span>
                        </div>
                        <div className="space-y-1">
                          {driver.recentEvents.slice(0, 3).map((event, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className={`font-medium ${getEventColor(event.event)} text-[11px]`}>
                                {formatEventName(event.event)}
                              </span>
                              <span className="text-slate-500 font-mono text-[10px]">{event.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action: Assign / Unassign */}
                <div className="px-5 py-3 border-t border-slate-700/40 bg-slate-900/40 flex items-center justify-between gap-2">
                  {isOnDuty ? (
                    <>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Operating {driver.currentVehicle}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenAssignModal(driver)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                        >
                          Reassign
                        </button>
                        <button
                          onClick={() => handleUnassignDriver(driver)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/20 transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Available for dispatch
                      </span>
                      <button
                        onClick={() => handleOpenAssignModal(driver)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-colors inline-flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Assign Truck
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Driver Modal */}
      <Modal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        title={editingDriverId ? `Edit Driver ${editingDriverId}` : 'Register New Driver'}
        subtitle="Saves driver profile directly to Firebase Realtime Database (/drivers/{id})"
      >
        <form onSubmit={handleSaveDriver} className="space-y-4">
          {!editingDriverId && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-400">Quick Fill:</span>
              <button
                type="button"
                onClick={() => setDriverForm({ ...driverForm, driverId: 'DRIVER_001', name: 'Primary Driver' })}
                className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-colors font-mono"
              >
                + DRIVER_001 (Active Fleet Driver)
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Driver ID <span className="text-blue-400">*</span>
              </label>
              <input
                type="text"
                disabled={!!editingDriverId}
                required
                value={driverForm.driverId}
                onChange={(e) => setDriverForm({ ...driverForm, driverId: e.target.value.toUpperCase() })}
                placeholder="e.g. DRIVER_001 or DRV002"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={driverForm.name}
                onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                placeholder="e.g. Aditya Verma"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                License Number
              </label>
              <input
                type="text"
                value={driverForm.licenseNumber}
                onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
                placeholder="e.g. DL-2024-HVO-891"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Driver Status
              </label>
              <select
                value={driverForm.status}
                onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ON_DUTY">ON_DUTY</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Assign to Vehicle (Optional)
              </label>
              <select
                value={driverForm.assignedVehicle}
                onChange={(e) => setDriverForm({ ...driverForm, assignedVehicle: e.target.value })}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="">— Do not assign truck now —</option>
                {vehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} {v.driverId ? `(Current driver: ${v.driverId})` : '(Available)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={driverForm.notes}
              onChange={(e) => setDriverForm({ ...driverForm, notes: e.target.value })}
              placeholder="e.g. Certified for Caterpillar 797F and Komatsu dump trucks"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDriverModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving to Firebase...' : editingDriverId ? 'Update Firebase' : 'Save to Firebase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Vehicle Modal */}
      <Modal
        isOpen={!!assignTargetDriver}
        onClose={() => setAssignTargetDriver(null)}
        title={`Assign Truck to Driver ${assignTargetDriver?.driverId}`}
        subtitle="Directly updates vehicles/{vehicleId}/current/driverId in Firebase RTDB"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Select which dump truck or fleet vehicle to assign to{' '}
            <span className="font-semibold text-blue-400 font-mono">
              {assignTargetDriver?.driverId}
            </span>
            :
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {vehicleOptions.length === 0 ? (
              <p className="text-xs text-slate-500">No vehicles available in the fleet.</p>
            ) : (
              vehicleOptions.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                const isCurrentAssigned = assignTargetDriver?.currentVehicle === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/60 shadow'
                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold font-mono text-slate-200">{v.id}</p>
                        <p className="text-xs text-slate-400">
                          {v.driverId
                            ? isCurrentAssigned
                              ? 'Currently assigned to this driver'
                              : `Currently assigned to ${v.driverId}`
                            : 'Unassigned (Parked)'}
                        </p>
                      </div>
                    </div>

                    <StatusBadge stateName={v.stateName} size="sm" />
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAssignTargetDriver(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !selectedVehicleId}
              onClick={handleConfirmAssignment}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating Firebase...' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Driver Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="Remove Driver"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to remove driver{' '}
            <span className="font-mono font-bold text-red-400">{deleteTargetId}</span> from
            Firebase Realtime Database?
          </p>
          <p className="text-xs text-slate-500">
            This will remove their profile record from Firebase.
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
              {isSubmitting ? 'Deleting...' : 'Delete Driver'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
