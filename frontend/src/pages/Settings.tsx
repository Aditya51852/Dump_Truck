// src/pages/Settings.tsx
import { Settings as SettingsIcon, Database, Shield, Info } from 'lucide-react';
import { useConnection } from '../hooks/useConnection';
import { formatDateTime } from '../utils/formatters';

export default function Settings() {
  const { connected, lastUpdate } = useConnection();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Application configuration & status</p>
      </div>

      {/* Firebase Connection */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Firebase Connection</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Connection Status</span>
            <span className={`flex items-center gap-1.5 text-sm font-medium ${
              connected ? 'text-emerald-400' : 'text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Database Type</span>
            <span className="text-sm text-slate-300">Firebase Realtime Database</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Last Update</span>
            <span className="text-sm text-slate-300 font-mono">{formatDateTime(lastUpdate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Data Sync</span>
            <span className="text-sm text-emerald-400">Real-time Listeners (No Polling)</span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">Security</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">SDK Type</span>
            <span className="text-sm text-slate-300">Firebase Web SDK (Client-side)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Configuration</span>
            <span className="text-sm text-slate-300">Environment Variables (.env)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Admin SDK</span>
            <span className="text-sm text-emerald-400">Not used (secure)</span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <Info className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">About</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Application</span>
            <span className="text-sm text-slate-300">Dump Truck Fleet Monitor</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Architecture</span>
            <span className="text-sm text-slate-300">React + TypeScript + Vite</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Styling</span>
            <span className="text-sm text-slate-300">Tailwind CSS</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Maps</span>
            <span className="text-sm text-slate-300">Leaflet + OpenStreetMap</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Charts</span>
            <span className="text-sm text-slate-300">Recharts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Data Flow</span>
            <span className="text-sm text-slate-300">ESP32/STM32 → Firebase RTDB → React</span>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Setup</h2>
        </div>
        <div className="p-5">
          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-2">
              Create a <code className="text-amber-400">.env</code> file in the project root with your Firebase config:
            </p>
            <pre className="text-xs text-slate-400 font-mono overflow-x-auto">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
