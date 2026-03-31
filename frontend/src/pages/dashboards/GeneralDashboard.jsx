// File: frontend/src/pages/dashboards/GeneralDashboard.jsx
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react'
import useDarkMode from '../../hooks/useDarkMode'
import DailyAssistant from '../../components/DailyAssistant'

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}><Icon size={20} /></div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  )
}

export default function GeneralDashboard() {
  useDarkMode() // auto dark mode for night shift
  const today = new Date().toISOString().slice(0, 10)

  const { data: oee, isLoading } = useQuery({
    queryKey: ['dashboard-oee', today],
    queryFn: () => api.get(`/production/dashboard?date=${today}`).then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: maintenance } = useQuery({
    queryKey: ['maintenance-dashboard'],
    queryFn: () => api.get('/maintenance/dashboard').then(r => r.data),
    refetchInterval: 60000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dashboard</h2>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <DailyAssistant />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon={Activity} label="OEE Mediu" value={oee ? `${oee.avgOEE?.toFixed(1)}%` : '—'} color="blue" />
        <StatCard icon={TrendingUp} label="Utilaje active" value={oee?.machines?.length ?? '—'} color="green" />
        <StatCard icon={AlertTriangle} label="Cereri deschise" value={maintenance?.byStatus?.open ?? 0} color="yellow" />
        <StatCard icon={AlertTriangle} label="Critice" value={maintenance?.openCritical?.length ?? 0} color="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
        <h3 className="font-semibold text-slate-700 mb-4">OEE per Utilaj — Azi</h3>
        {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
        {oee?.machines?.length === 0 && <p className="text-slate-400 text-sm">Nu exista utilaje active.</p>}
        <div className="space-y-3">
          {oee?.machines?.map((m) => (
            <div key={m.machineId} className="flex items-center gap-3">
              <div className="w-24 lg:w-32 text-sm font-medium text-slate-700 truncate">{m.machineCode}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all ${m.oee >= 85 ? 'bg-green-500' : m.oee >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(m.oee, 100)}%` }}
                />
              </div>
              <div className={`w-14 text-right text-sm font-bold ${m.oee >= 85 ? 'text-green-600' : m.oee >= 65 ? 'text-yellow-500' : 'text-red-500'}`}>
                {m.oee?.toFixed(1)}%
              </div>
              <div className="w-24 text-xs text-slate-400 hidden lg:block">
                {m.totalGoodPieces} bune / {m.totalScrapPieces} rebuturi
              </div>
            </div>
          ))}
        </div>
      </div>

      {maintenance?.openCritical?.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-4 lg:p-5">
          <h3 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Cereri Critice Deschise
          </h3>
          <div className="space-y-2">
            {maintenance.openCritical.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                <span className="font-medium text-slate-700">{r.request_number}</span>
                <span className="text-slate-500 text-xs hidden sm:block">{r.problem_type}</span>
                <span className="text-red-500 text-xs">{new Date(r.created_at).toLocaleDateString('ro-RO')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
