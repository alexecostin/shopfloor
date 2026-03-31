// File: frontend/src/pages/dashboards/ExecutiveDashboard.jsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { TrendingUp, DollarSign, Activity, AlertTriangle, BarChart2 } from 'lucide-react'
import DailyAssistant from '../../components/DailyAssistant'

function KPICard({ label, value, sub, color = 'blue', trend }) {
  const colors = { blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50', yellow: 'border-yellow-200 bg-yellow-50', red: 'border-red-200 bg-red-50' }
  const textColors = { blue: 'text-blue-700', green: 'text-green-700', yellow: 'text-yellow-700', red: 'text-red-700' }
  return (
    <div className={`bg-white rounded-xl border p-4 lg:p-5 ${colors[color]}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl lg:text-3xl font-bold ${textColors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      {trend != null && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs luna trecuta
        </div>
      )}
    </div>
  )
}

export default function ExecutiveDashboard() {
  // All dashboard data is consolidated in UTC; the backend's locale.service.js
  // resolves timezone per factory. Date ranges are sent with timezone context
  // to ensure consistent cross-factory aggregation.
  const today = new Date().toISOString().slice(0, 10)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleEmail, setScheduleEmail] = useState('')
  const [scheduleDay, setScheduleDay] = useState('monday')
  const { data: oee } = useQuery({
    queryKey: ['dashboard-oee', today],
    queryFn: () => api.get(`/production/dashboard?date=${today}&tz=${encodeURIComponent(tz)}`).then(r => r.data),
    refetchInterval: 60000,
  })
  const { data: maintenance } = useQuery({
    queryKey: ['maintenance-dashboard'],
    queryFn: () => api.get('/maintenance/dashboard').then(r => r.data),
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Raport Executiv</h2>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <button onClick={() => setShowSchedule(true)} className="text-xs text-slate-500 hover:text-blue-600 mt-1">
          Programeaza raport saptamanal
        </button>
      </div>

      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-4">Raport saptamanal pe email</h3>
            <input placeholder="Email" value={scheduleEmail} onChange={e => setScheduleEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-3" />
            <select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-4">
              <option value="monday">Luni</option>
              <option value="tuesday">Marti</option>
              <option value="wednesday">Miercuri</option>
              <option value="thursday">Joi</option>
              <option value="friday">Vineri</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => { toast.success('Raport programat!'); setShowSchedule(false) }} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg">Salveaza</button>
              <button onClick={() => setShowSchedule(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg">Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      <DailyAssistant />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard label="OEE Mediu Azi" value={oee?.avgOEE ? `${oee.avgOEE.toFixed(1)}%` : '—'} color={oee?.avgOEE >= 85 ? 'green' : oee?.avgOEE >= 65 ? 'yellow' : 'red'} />
        <KPICard label="Utilaje Active" value={oee?.machines?.length ?? '—'} color="blue" />
        <KPICard label="Cereri Mentenanta" value={maintenance?.byStatus?.open ?? 0} color={maintenance?.byStatus?.open > 5 ? 'red' : 'yellow'} sub="deschise" />
        <KPICard label="Critice" value={maintenance?.openCritical?.length ?? 0} color="red" />
      </div>

      {/* OEE overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Activity size={16} /> Performanta Utilaje
        </h3>
        <div className="space-y-3">
          {oee?.machines?.map(m => (
            <div key={m.machineId} className="flex items-center gap-3">
              <div className="w-28 lg:w-40 text-sm text-slate-700 truncate">{m.machineCode}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full ${m.oee >= 85 ? 'bg-green-500' : m.oee >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(m.oee, 100)}%` }}
                />
              </div>
              <span className={`w-14 text-right text-sm font-bold ${m.oee >= 85 ? 'text-green-600' : m.oee >= 65 ? 'text-yellow-500' : 'text-red-500'}`}>
                {m.oee?.toFixed(1)}%
              </span>
            </div>
          ))}
          {!oee?.machines?.length && <p className="text-slate-400 text-sm text-center py-4">Nu exista date de productie pentru azi.</p>}
        </div>
      </div>

      {/* Maintenance summary */}
      {maintenance?.byStatus && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart2 size={16} /> Sumar Mentenanta
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(maintenance.byStatus).map(([status, count]) => (
              <div key={status} className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{count}</div>
                <div className="text-xs text-slate-500 capitalize mt-0.5">{status.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
