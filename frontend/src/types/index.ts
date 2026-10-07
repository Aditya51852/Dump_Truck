// src/types/index.ts
// TypeScript interfaces matching the Firebase Realtime Database structure

export interface GPSData {
  altitude: number;
  latitude: number;
  locationValid: boolean;
  longitude: number;
  satellites: number;
  speedKmph: number;
}

export interface IMUData {
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
}

export interface BeaconData {
  id: string;
  present: boolean;
  zoneName: string;
}

export interface SystemData {
  mpu6500: boolean;
  pn532: boolean;
  rtc: boolean;
  wifi: boolean;
  wifiRSSI: number;
}

export interface VibrationData {
  analog: number;
  detected: boolean;
  digital: number;
}

export interface TimingData {
  stateStartTime?: number;
  currentStateDurationSec?: number;
  currentMovementDurationSec?: number;
  currentHoldingDurationSec?: number;
  totalMovementSec?: number;
  totalHoldingSec?: number;
  excavatorHoldingSec?: number;
  dumpingHoldingSec?: number;
  parkingSec?: number;
  totalOperatingSec?: number;
}

export interface CycleMetrics {
  cycleNumber?: number;
  cycleStartTime?: number;
  cycleDurationSec?: number;
}

export interface SessionMetrics {
  sessionId?: string;
  driverId?: string;
  status?: string;
  tripsCompleted?: number;
  startTime?: number;
}

export interface TripMetrics {
  tripId?: string;
  tripNumber?: number;
  status?: string;
  startZone?: string;
  startTimestamp?: number;
  durationSec?: number;
  segmentCount?: number;
  routePath?: string;
}

export interface VehicleCurrent {
  beacon: BeaconData;
  cycleNumber: number;
  date: string;
  driverId: string;
  gps: GPSData;
  imu: IMUData;
  state: number;
  stateName: string;
  system: SystemData;
  time: string;
  timestamp?: number;
  vehicleId: string;
  vibration: VibrationData;
  timing?: TimingData;
  cycle?: CycleMetrics;
  session?: SessionMetrics;
  trip?: TripMetrics;
}

export interface TripSegment {
  segmentId: string;
  fromZone: string;
  toZone: string;
  departureTimestamp: number;
  arrivalTimestamp: number;
  travelTimeSec: number;
  holdTimeSec: number;
  driverId: string;
  sessionId: string;
  tripNumber: number;
}

export interface OperationalTrip {
  tripId: string;
  vehicleId: string;
  driverId: string;
  sessionId: string;
  tripNumber: number;
  startZone: string;
  endZone: string;
  startTimestamp: number;
  endTimestamp?: number;
  durationSec: number;
  status: 'ACTIVE' | 'COMPLETED' | 'IDLE' | string;
  segmentCount: number;
  movementSec?: number;
  holdingSec?: number;
  routePath?: string;
  segments?: Record<string, TripSegment>;
}

export interface DriverSession {
  sessionId: string;
  driverId: string;
  vehicleId: string;
  startTime: number;
  endTime?: number;
  status: 'ACTIVE' | 'COMPLETED' | string;
  tripsCompleted: number;
  totalDurationSec: number;
  movementSec?: number;
  holdingSec?: number;
}

export interface RouteAnalytics {
  fromZone: string;
  toZone: string;
  routeKey: string;
  occurrenceCount: number;
  totalTravelTimeSec: number;
  averageTravelTimeSec: number;
  totalHoldTimeSec: number;
  averageHoldTimeSec: number;
}

export interface VehicleEvent {
  id?: string;
  cycleNumber: number;
  date: string;
  driverId: string;
  event: string;
  latitude: number;
  longitude: number;
  speedKmph: number;
  state: number;
  stateName: string;
  time: string;
  vehicleId: string;
  // Optional beacon information that may appear on some events
  beaconId?: string;
  beaconPresent?: boolean;
  beaconZoneName?: string;
  zoneName?: string;
  [key: string]: unknown; // Allow any additional fields
}

export interface Vehicle {
  current: VehicleCurrent;
  events?: Record<string, VehicleEvent>;
}

export interface NfcCard {
  driverId: string;
  enabled?: boolean;
  cardName?: string;
  notes?: string;
  issuedDate?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface BeaconZoneData {
  zoneName?: string;
  type?: 'DUMPING' | 'EXCAVATOR' | 'PARKING' | 'CRUSHER' | 'CUSTOM' | string;
  state?: string;
  enabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radius?: number;
  description?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface BeaconZone {
  id: string;
  data: BeaconZoneData | unknown;
}

export interface DriverRecord {
  driverId: string;
  name?: string;
  phone?: string;
  licenseNumber?: string;
  status?: 'AVAILABLE' | 'ON_DUTY' | 'OFF_DUTY' | 'ON_LEAVE' | string;
  assignedVehicle?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverInfo {
  driverId: string;
  name?: string;
  phone?: string;
  licenseNumber?: string;
  status?: string;
  assignedVehicles: string[];
  currentVehicle: string | null;
  currentState: string | null;
  totalCycles: number;
  recentEvents: VehicleEvent[];
  isRegistered?: boolean;
}

// State color mapping
export type VehicleStateName =
  | 'PARKED'
  | 'DRIVER_ASSIGNED'
  | 'TO_EXCAVATOR'
  | 'AT_EXCAVATOR'
  | 'TO_DUMPING'
  | 'AT_DUMPING'
  | 'RETURNING'
  | string;

export interface FleetSummary {
  total: number;
  running: number;
  atExcavator: number;
  atDumping: number;
  parked: number;
  driverAssigned: number;
  offline: number;
  toExcavator: number;
}

export interface ConnectionStatus {
  connected: boolean;
  lastUpdate: Date | null;
}

// Toast notification type
export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  vehicleId?: string;
}
