// File: frontend/src/pages/dashboards/ShiftDashboard.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Activity, StopCircle, CheckCircle, ClipboardList, Plus, PlayCircle } from 'lucide-react'
import DailyAssistant from '../../components/DailyAssistant'

function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', yellow: 'bg-yellow-50 text-yellow-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-1">
        <div className={`p-2 rounded-lg ${colors[color]}`}><Icon size={18} /></div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function ShiftDashboard() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  // UX-T2.1: Push notification before shift end
  useEffect(() => {
    const checkShiftEnd = () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMin = now.getMinutes()
      const currentMins = currentHour * 60 + currentMin

      // Common shift ends: 14:00 (840), 22:00 (1320), 06:00 (360)
      const shiftEnds = [840, 1320, 360]
      for (const end of shiftEnds) {
        const diff = end - currentMins
        if (diff === 15) { // exactly 15 min before
          if (Notification.permission === 'granted') {
            new Notification('Sfarsit tura', { body: 'Tura se termina in 15 minute. Completeaza predarea.' })
          }
        }
      }
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const interval = setInterval(checkShiftEnd, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const { data: oee } = useQuery({
    queryKey: ['dashboard-oee', today],
    queryFn: () => api.get(`/production/dashboard?date=${today}`).then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: stopsData } = useQuery({
    queryKey: ['stops'],
    queryFn: () => api.get('/production/stops').then(r => r.data),
    refetchInterval: 30000,
  })
  const { data: reportsData } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get('/production/reports').then(r => r.data),
    refetchInterval: 30000,
  })

  const openStops = stopsData?.data?.filter(s => !s.ended_at) || []
  const todayReports = reportsData?.data?.filter(r => r.reported_at?.startsWith(today)) || []
  const totalGood = todayReports.reduce((s, r) => s + (r.good_pieces || 0), 0)
  const totalScrap = todayReports.reduce((s, r) => s + (r.scrap_pieces || 0), 0)

  const closeStop = useMutation({
    mutationFn: (id) => api.put(`/production/stops/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries(['stops']); toast.success('Oprire inchisa.') },
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Dashboard Tura</h2>
        <p className="text-sm text-slate-500">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <DailyAssistant />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Activity} label="OEE mediu azi" value={oee?.avgOEE ? `${oee.avgOEE.toFixed(1)}%` : '—'} color="blue" />
        <StatCard icon={StopCircle} label="Opriri deschise" value={openStops.length} color={openStops.length > 0 ? 'red' : 'green'} />
        <StatCard icon={CheckCircle} label="Piese bune azi" value={totalGood.toLocaleString()} color="green" />
        <StatCard icon={ClipboardList} label="Rapoarte azi" value={todayReports.length} color="blue" sub={totalScrap > 0 ? `${totalScrap} rebuturi` : null} />
      </div>

      {/* OEE per machine */}
      {oee?.machines?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-700 mb-3">OEE Utilaje — Azi</h3>
          <div className="space-y-2.5">
            {oee.machines.map(m => (
              <div key={m.machineId} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium text-slate-700 truncate">{m.machineCode}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${m.oee >= 85 ? 'bg-green-500' : m.oee >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(m.oee, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-12 text-right ${m.oee >= 85 ? 'text-green-600' : m.oee >= 65 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {m.oee?.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open stops */}
      {openStops.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <h3 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
            <StopCircle size={16} /> Opriri Active ({openStops.length})
          </h3>
          <div className="space-y-2">
            {openStops.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-800">{s.reason}</div>
                  <div className="text-xs text-slate-400">{s.category || 'Neclasificat'} · {s.shift}</div>
                </div>
                <button onClick={() => closeStop.mutate(s.id)} className="text-xs text-green-600 flex items-center gap-1 hover:underline">
                  <PlayCircle size={13} /> Inchide
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
