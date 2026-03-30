import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { Activity, Clock, Wrench, TrendingUp, BarChart3, ArrowLeftRight } from 'lucide-react'

const PERIODS = [
  { value: 'month', label: 'Luna' },
  { value: 'quarter', label: 'Trimestru' },
  { value: 'year', label: 'An' },
]

function KPICard({ icon: Icon, label, value, unit, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold">
        {value === Infinity ? '∞' : value}
        {unit && <span className="text-base font-medium ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs mt-1 opacity-75">{sub}</div>}
    </div>
  )
}

function OEETrendChart({ trend }) {
  if (!trend || trend.length === 0) return <div className="text-sm text-slate-400">Fara date</div>
  const maxOEE = Math.max(...trend.map(t => t.oee), 1)
  return (
    <div className="flex items-end gap-1 h-48">
      {trend.map((t, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[10px] text-slate-500 mb-1">{Math.round(t.oee)}%</div>
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${Math.max(4, (t.oee / Math.max(maxOEE, 100)) * 100)}%`,
              backgroundColor: t.oee >= 75 ? '#22c55e' : t.oee >= 50 ? '#f59e0b' : '#ef4444',
            }}
            title={`${t.weekLabel}: OEE ${t.oee}% | Disp ${t.availability}% | Perf ${t.performance}% | Qual ${t.quality}%`}
          />
          <div className="text-[9px] text-slate-400 mt-1 truncate w-full text-center">{t.weekLabel}</div>
        </div>
      ))}
    </div>
  )
}

function StopReasonsChart({ reasons }) {
  if (!reasons || reasons.length === 0) return <div className="text-sm text-slate-400">Fara opriri inregistrate</div>
  const maxMin = Math.max(...reasons.map(r => Number(r.total_minutes) || 0), 1)
  return (
    <div className="space-y-2">
      {reasons.map((r, i) => {
        const mins = Number(r.total_minutes) || 0
        const pct = (mins / maxMin) * 100
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-700 font-medium truncate">{r.category || 'Necunoscut'}</span>
              <span className="text-slate-500 whitespace-nowrap ml-2">{Math.round(mins)} min ({r.count}x)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div className="bg-red-400 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ComparisonTable({ data }) {
  if (!data || data.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="py-2 pr-4">Utilaj</th>
            <th className="py-2 pr-4">MTBF (ore)</th>
            <th className="py-2 pr-4">MTTR (min)</th>
            <th className="py-2 pr-4">Disponibilitate</th>
            <th className="py-2 pr-4">OEE</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.machineId} className="border-b">
              <td className="py-2 pr-4 font-medium">{m.code} — {m.name}</td>
              <td className="py-2 pr-4">{m.mtbf.mtbf === Infinity ? '∞' : Math.round(m.mtbf.mtbf * 10) / 10}</td>
              <td className="py-2 pr-4">{m.mttr.mttr}</td>
              <td className="py-2 pr-4">{m.availability.availability}%</td>
              <td className="py-2 pr-4 font-semibold">{m.oee}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MachineKPIPage() {
  const [machineId, setMachineId] = useState('')
  const [period, setPeriod] = useState('month')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState([])

  const { data: machines } = useQuery({
    queryKey: ['machines-kpi-list'],
    queryFn: () => api.get('/machines?limit=500').then(r => r.data?.data || r.data || []),
  })

  const { data: kpi, isLoading } = useQuery({
    queryKey: ['machine-kpi', machineId, period],
    queryFn: () => api.get(`/machines/${machineId}/kpi?period=${period}`).then(r => r.data),
    enabled: !!machineId && !compareMode,
  })

  const { data: comparisonData, isLoading: compLoading } = useQuery({
    queryKey: ['machine-kpi-compare', compareIds, period],
    queryFn: () => api.get(`/machines/kpi/comparison?machineIds=${compareIds.join(',')}&period=${period}`).then(r => r.data),
    enabled: compareMode && compareIds.length >= 2,
  })

  function toggleCompareId(id) {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 size={22} /> KPI Utilaje
        </h1>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${period === p.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setCompareMode(!compareMode); setCompareIds([]) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${compareMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <ArrowLeftRight size={14} /> Compara
          </button>
        </div>
      </div>

      {/* Machine selector */}
      {!compareMode ? (
        <div>
          <select
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
            className="input max-w-sm"
          >
            <option value="">Selecteaza utilaj...</option>
            {(machines || []).map(m => (
              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 mb-2">Selecteaza 2-3 utilaje pentru comparatie:</p>
          <div className="flex flex-wrap gap-2">
            {(machines || []).map(m => (
              <button
                key={m.id}
                onClick={() => toggleCompareId(m.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${compareIds.includes(m.id) ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {m.code} — {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compare mode results */}
      {compareMode && compareIds.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Comparatie utilaje</h2>
          {compLoading ? (
            <div className="text-sm text-slate-400">Se incarca...</div>
          ) : (
            <ComparisonTable data={comparisonData} />
          )}
        </div>
      )}

      {/* Single machine KPI */}
      {!compareMode && machineId && (
        <>
          {isLoading ? (
            <div className="text-sm text-slate-400">Se incarca KPI...</div>
          ) : kpi ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  icon={Clock}
                  label="MTBF"
                  value={kpi.mtbf.mtbf === Infinity ? Infinity : Math.round(kpi.mtbf.mtbf * 10) / 10}
                  unit="ore"
                  sub={`${kpi.mtbf.defects} defecte | ${kpi.mtbf.operatingHours}h operare`}
                  color="blue"
                />
                <KPICard
                  icon={Wrench}
                  label="MTTR"
                  value={kpi.mttr.mttr}
                  unit="min"
                  sub={`${kpi.mttr.repairs} reparatii | ${kpi.mttr.totalRepairHours}h total`}
                  color="amber"
                />
                <KPICard
                  icon={Activity}
                  label="Disponibilitate"
                  value={kpi.availability.availability}
                  unit="%"
                  sub={`${kpi.availability.availableHours}h disponibil | ${kpi.availability.stopHours}h opriri`}
                  color="green"
                />
                <KPICard
                  icon={TrendingUp}
                  label="OEE"
                  value={kpi.oee}
                  unit="%"
                  sub="Disponibilitate x Performanta x Calitate"
                  color="purple"
                />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* OEE Trend */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp size={16} /> Trend OEE ({kpi.trend.length} saptamani)
                  </h2>
                  <OEETrendChart trend={kpi.trend} />
                  <div className="flex gap-4 mt-3 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &ge;75%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 50-74%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;50%</span>
                  </div>
                </div>

                {/* Top Stop Reasons */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <BarChart3 size={16} /> Top cauze opriri
                  </h2>
                  <StopReasonsChart reasons={kpi.topStopReasons} />
                </div>
              </div>

              {/* Period info */}
              <div className="text-xs text-slate-400">
                Perioada: {kpi.dateFrom} — {kpi.dateTo}
              </div>
            </>
          ) : null}
        </>
      )}

      {!compareMode && !machineId && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p>Selecteaza un utilaj pentru a vedea indicatorii de performanta.</p>
        </div>
      )}
    </div>
  )
}
