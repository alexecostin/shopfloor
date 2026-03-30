// File: frontend/src/pages/dashboards/MaintenanceDashboard.jsx
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import { Wrench, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

const PRIORITY_COLORS = { low: 'text-slate-500 bg-slate-100', medium: 'text-yellow-700 bg-yellow-100', high: 'text-orange-700 bg-orange-100', critical: 'text-red-700 bg-red-100' }

function StatCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', yellow: 'bg-yellow-50 text-yellow-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${colors[color]}`}><Icon size={18} /></div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}

export default function MaintenanceDashboard() {
  const { data: dash } = useQuery({
    queryKey: ['maintenance-dashboard'],
    queryFn: () => api.get('/maintenance/dashboard').then(r => r.data),
    refetchInterval: 60000,
  })
  const { data: planned } = useQuery({
    queryKey: ['planned-interventions'],
    queryFn: () => api.get('/maintenance/planned').then(r => r.data),
  })

  const open = dash?.byStatus?.open || 0
  const inProgress = dash?.byStatus?.in_progress || 0
  const critical = dash?.openCritical?.length || 0
  const upcomingPlanned = planned?.filter(p => ['scheduled', 'confirmed'].includes(p.status))?.length || 0

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dashboard Mentenanta</h2>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Wrench} label="Cereri deschise" value={open} color="yellow" />
        <StatCard icon={Clock} label="In lucru" value={inProgress} color="blue" />
        <StatCard icon={AlertTriangle} label="Critice" value={critical} color="red" />
        <StatCard icon={CheckCircle} label="Planificate" value={upcomingPlanned} color="green" />
      </div>

      {/* Critical open requests */}
      {dash?.openCritical?.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <h3 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Cereri Critice
          </h3>
          <div className="space-y-2">
            {dash.openCritical.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-800">{r.request_number}</div>
                  <div className="text-xs text-slate-400">{r.problem_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.medium}`}>{r.priority}</span>
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('ro-RO')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming planned */}
      {upcomingPlanned > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> Interventii Planificate
          </h3>
          <div className="space-y-2">
            {planned?.filter(p => ['scheduled', 'confirmed'].includes(p.status)).slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-800">{p.title}</div>
                  <div className="text-xs text-slate-400">{p.machine_code || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-blue-600">{new Date(p.planned_start_date).toLocaleDateString('ro-RO')}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
