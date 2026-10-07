// src/App.tsx
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ToastContainer from './components/ToastContainer';
import Dashboard from './pages/Dashboard';
import LiveFleet from './pages/LiveFleet';
import VehicleDetail from './pages/VehicleDetail';
import TripHistory from './pages/TripHistory';
import EventLogs from './pages/EventLogs';
import GPSTracking from './pages/GPSTracking';
import DriverManagement from './pages/DriverManagement';
import NfcCards from './pages/NfcCards';
import BeaconZones from './pages/BeaconZones';
import SystemHealth from './pages/SystemHealth';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { useVehicles } from './hooks/useVehicles';

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { lastUpdate } = useVehicles();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-60'
        } pb-20 lg:pb-0`}
      >
        <TopBar lastFirebaseUpdate={lastUpdate} />
        <main className="p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<LiveFleet />} />
            <Route path="/vehicle/:vehicleId" element={<VehicleDetail />} />
            <Route path="/trips" element={<TripHistory />} />
            <Route path="/events" element={<EventLogs />} />
            <Route path="/gps" element={<GPSTracking />} />
            <Route path="/drivers" element={<DriverManagement />} />
            <Route path="/nfc" element={<NfcCards />} />
            <Route path="/beacons" element={<BeaconZones />} />
            <Route path="/health" element={<SystemHealth />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
