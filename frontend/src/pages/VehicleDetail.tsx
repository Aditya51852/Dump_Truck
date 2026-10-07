import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Gauge,
  Compass,
  Satellite,
  Cpu,
  Radio,
  Vibrate,
  CheckCircle,
  XCircle,
  Activity,
  Hash,
  User,
  Clock,
  Calendar,
} from 'lucide-react';
import { useVehicle } from '../hooks/useVehicle';
import { useVehicleEvents } from '../hooks/useVehicleEvents';
import { useDrivers } from '../hooks/useDrivers';
import { assignDriverToVehicle, unassignDriverFromVehicle } from '../firebase/driverService';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import LiveMap from '../components/LiveMap';
import Modal from '../components/Modal';
import {
  formatSpeed,
  formatRSSI,
  getSignalStrength,
  formatEventName,
  formatZoneName,
} from '../utils/formatters';
import { getEventColor } from '../utils/stateColors';

function HealthIndicator({ value, label }: { value: boolean | undefined; label: string }) {
  const healthy = value === true;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${healthy ? 'text-emerald-400' : 'text-red-400'}`}>
        {healthy ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {healthy ? 'Healthy' : 'Fault'}
      </div>
    </div>
  );
}

function DataCard({ label, value, icon: Icon, unit }: { label: string; value: string | number | undefined; icon?: any; unit?: string }) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-200 font-mono">
        {value ?? '—'}
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function VehicleDetail() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { vehicle, loading, error } = useVehicle(vehicleId);
  const { events } = useVehicleEvents(vehicleId, 50);
  const { drivers } = useDrivers();
  const { addToast } = useToast();

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [inputDriverId, setInputDriverId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return <LoadingState message={`Loading ${vehicleId}...`} />;
  if (error) return <ErrorState message={error.message} />;
  if (!vehicle) return <ErrorState title="Vehicle not found" message={`No data found for ${vehicleId}`} />;

  const mapVehicles = vehicle.gps?.locationValid
    ? [{ id: vehicleId!, current: vehicle }]
    : [];

  const handleOpenAssignModal = () => {
    setInputDriverId(vehicle.driverId || '');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !inputDriverId.trim()) return;

    try {
      setIsSubmitting(true);
      await assignDriverToVehicle(inputDriverId.trim(), vehicleId);
      addToast({
        title: 'Driver Assigned',
        message: `Driver ${inputDriverId.trim()} assigned to ${vehicleId} in Firebase RTDB`,
        type: 'success',
      });
      setIsAssignModalOpen(false);
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

  const handleUnassign = async () => {
    if (!vehicleId) return;
    try {
      setIsSubmitting(true);
      await unassignDriverFromVehicle(vehicleId, vehicle.driverId);
      addToast({
        title: 'Driver Unassigned',
        message: `Driver released from ${vehicleId} in Firebase RTDB`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Unassign Failed',
        message: (err as Error).message || 'Failed to unassign driver',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link
            to="/fleet"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Fleet
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-100">{vehicleId}</h1>
            <StatusBadge stateName={vehicle.stateName} size="lg" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-slate-200">{vehicle.driverId || 'No driver'}</span>
              </span>
              {vehicle.driverId ? (
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    onClick={handleOpenAssignModal}
                    className="text-xs px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleUnassign}
                    disabled={isSubmitting}
                    className="text-xs px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    Unassign
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenAssignModal}
                  className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors ml-1 shadow"
                >
                  + Assign Driver
                </button>
              )}
            </div>
            <span className="flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-slate-500" /> Cycle {vehicle.cycleNumber}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> {vehicle.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> {vehicle.time}
            </span>
          </div>
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GPS Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">GPS</h2>
            {vehicle.gps?.locationValid && (
              <span className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Valid</span>
            )}
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DataCard label="Latitude" value={vehicle.gps?.latitude?.toFixed(6)} icon={MapPin} />
            <DataCard label="Longitude" value={vehicle.gps?.longitude?.toFixed(6)} icon={MapPin} />
            <DataCard label="Altitude" value={vehicle.gps?.altitude?.toFixed(1)} icon={Compass} unit="m" />
            <DataCard label="Speed" value={vehicle.gps?.speedKmph?.toFixed(1)} icon={Gauge} unit="km/h" />
            <DataCard label="Satellites" value={vehicle.gps?.satellites} icon={Satellite} />
            <DataCard label="Valid" value={vehicle.gps?.locationValid ? 'Yes' : 'No'} />
          </div>
        </div>

        {/* IMU Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-200">IMU Sensor</h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DataCard label="Accel X" value={vehicle.imu?.accelX?.toFixed(3)} unit="g" />
            <DataCard label="Accel Y" value={vehicle.imu?.accelY?.toFixed(3)} unit="g" />
            <DataCard label="Accel Z" value={vehicle.imu?.accelZ?.toFixed(3)} unit="g" />
            <DataCard label="Gyro X" value={vehicle.imu?.gyroX?.toFixed(2)} unit="°/s" />
            <DataCard label="Gyro Y" value={vehicle.imu?.gyroY?.toFixed(2)} unit="°/s" />
            <DataCard label="Gyro Z" value={vehicle.imu?.gyroZ?.toFixed(2)} unit="°/s" />
          </div>
        </div>

        {/* Beacon Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">Beacon</h2>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            <DataCard label="Beacon ID" value={vehicle.beacon?.id || '—'} icon={Radio} />
            <DataCard label="Present" value={vehicle.beacon?.present ? 'Yes' : 'No'} />
            <DataCard label="Zone Name" value={formatZoneName(vehicle.beacon?.zoneName)} />
          </div>
        </div>

        {/* Vibration Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <Vibrate className="w-4 h-4 text-pink-400" />
            <h2 className="text-sm font-semibold text-slate-200">Vibration</h2>
            {vehicle.vibration?.detected && (
              <span className="ml-auto text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-full border border-pink-500/20 animate-pulse">Active</span>
            )}
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            <DataCard label="Analog" value={vehicle.vibration?.analog} />
            <DataCard label="Digital" value={vehicle.vibration?.digital} />
            <DataCard label="Detected" value={vehicle.vibration?.detected ? 'Yes' : 'No'} />
          </div>
        </div>

        {/* System Health Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">System Health</h2>
          </div>
          <div className="p-4 space-y-1">
            <HealthIndicator value={vehicle.system?.mpu6500} label="MPU6500 (IMU)" />
            <HealthIndicator value={vehicle.system?.pn532} label="PN532 (NFC)" />
            <HealthIndicator value={vehicle.system?.rtc} label="RTC (Clock)" />
            <HealthIndicator value={vehicle.system?.wifi} label="WiFi" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">WiFi RSSI</span>
              <span className={`text-xs font-mono font-medium ${
                getSignalStrength(vehicle.system?.wifiRSSI) === 'excellent' ? 'text-emerald-400' :
                getSignalStrength(vehicle.system?.wifiRSSI) === 'good' ? 'text-blue-400' :
                getSignalStrength(vehicle.system?.wifiRSSI) === 'fair' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {formatRSSI(vehicle.system?.wifiRSSI)}
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle Map */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">Location</h2>
          </div>
          <LiveMap vehicles={mapVehicles} height="260px" />
        </div>
      </div>

      {/* Event Timeline */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">Event Timeline</h2>
          <span className="ml-auto text-xs text-slate-500">{events.length} events</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
          {events.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">No events recorded</div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-700/50" />
              {events.map((event, i) => (
                <div
                  key={event.id || i}
                  className="flex items-start gap-4 px-4 py-3 hover:bg-slate-700/20 transition-colors relative"
                >
                  {/* Timeline dot */}
                  <div className="w-8 flex justify-center shrink-0 relative z-10">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                      event.event?.includes('ARRIVAL') ? 'bg-emerald-400' :
                      event.event?.includes('STARTED') ? 'bg-blue-400' :
                      event.event?.includes('INVALID') ? 'bg-red-400' :
                      'bg-amber-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${getEventColor(event.event)}`}>
                      {formatEventName(event.event)}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                      <span>{event.date} {event.time}</span>
                      <span>Cycle #{event.cycleNumber}</span>
                      {event.speedKmph > 0 && <span>{formatSpeed(event.speedKmph)}</span>}
                    </div>
                  </div>
                  <StatusBadge stateName={event.stateName} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Driver Assignment Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Driver to ${vehicleId}`}
        subtitle="Directly updates vehicles/{vehicleId}/current/driverId in Firebase RTDB"
      >
        <form onSubmit={handleConfirmAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Registered Driver or Enter ID
            </label>
            <input
              type="text"
              required
              value={inputDriverId}
              onChange={(e) => setInputDriverId(e.target.value.toUpperCase())}
              placeholder="e.g. DRV001 or DRV_OPERATOR"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {drivers.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Registered Drivers:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {drivers.map((d) => (
                  <div
                    key={d.driverId}
                    onClick={() => setInputDriverId(d.driverId)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      inputDriverId === d.driverId
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-mono font-semibold">{d.driverId}</span>
                      {d.name && d.name !== d.driverId && (
                        <span className="text-slate-400">({d.name})</span>
                      )}
                    </div>
                    {d.currentVehicle && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        on {d.currentVehicle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !inputDriverId.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating Firebase...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
