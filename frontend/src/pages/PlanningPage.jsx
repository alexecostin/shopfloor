import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Calendar, ChevronRight, Trash2 } from 'lucide-react'

const SHIFTS = ['Tura I', 'Tura II', 'Tura III']
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-500',
}

function getMonday(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

// ─── Modal Plan Nou ───────────────────────────────────────────────────────────

function PlanModal({ onClose }) {
  const qc = useQueryClient()
  const today = new Date()
  const monday = getMonday(today)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)

  const [form, setForm] = useState({
    name: `Plan saptamana ${monday}`,
    planType: 'weekly',
    year: today.getFullYear(),
    weekNumber: Math.ceil((today - new Date(today.getFullYear(), 0, 1)) / (7 * 86400000)),
    startDate: monday,
    endDate: sunday.toISOString().split('T')[0],
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/planning/master-plans', data),
    onSuccess: () => { qc.invalidateQueries(['master-plans']); toast.success('Plan creat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Plan nou</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Denumire plan *" value={form.name} onChange={f('name')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data inceput *</label>
              <input className="input" type="date" value={form.startDate} onChange={f('startDate')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data sfarsit *</label>
              <input className="input" type="date" value={form.endDate} onChange={f('endDate')} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, year: Number(form.year), weekNumber: Number(form.weekNumber) })}
            disabled={mutation.isPending || !form.name || !form.startDate || !form.endDate}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Alocare Noua ───────────────────────────────────────────────────────

function AllocationModal({ plan, machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    machineId: '',
    planDate: plan.start_date?.split('T')[0] || getMonday(),
    shift: 'Tura I',
    productReference: '',
    productName: '',
    plannedQty: '',
    plannedHours: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/planning/allocations', data),
    onSuccess: () => {
      qc.invalidateQueries(['plan-detail', plan.id])
      qc.invalidateQueries(['planning-dashboard'])
      toast.success('Alocare adaugata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const activeMachines = machines?.filter(m => m.status === 'active') || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-1">Alocare noua</h3>
        <p className="text-xs text-slate-400 mb-4">{plan.name}</p>
        <div className="space-y-3">
          {/* Masina — din lista reala */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Utilaj *</label>
            <select className="input" value={form.machineId} onChange={f('machineId')}>
              <option value="">Selecteaza utilaj</option>
              {activeMachines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name} {m.location ? `(${m.location})` : ''}
                </option>
              ))}
            </select>
            {activeMachines.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">Niciun utilaj activ. Adauga utilaje din pagina Utilaje.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data *</label>
              <input className="input" type="date" value={form.planDate}
                min={plan.start_date?.split('T')[0]}
                max={plan.end_date?.split('T')[0]}
                onChange={f('planDate')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tura *</label>
              <select className="input" value={form.shift} onChange={f('shift')}>
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <input className="input" placeholder="Referinta produs" value={form.productReference} onChange={f('productReference')} />
          <input className="input" placeholder="Denumire produs" value={form.productName} onChange={f('productName')} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate planificata</label>
              <input className="input" type="number" placeholder="buc" value={form.plannedQty} onChange={f('plannedQty')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ore planificate</label>
              <input className="input" type="number" placeholder="ore" step="0.5" value={form.plannedHours} onChange={f('plannedHours')} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              masterPlanId: plan.id,
              machineId: form.machineId,
              planDate: form.planDate,
              shift: form.shift,
              productReference: form.productReference || null,
              productName: form.productName || null,
              plannedQty: form.plannedQty ? Number(form.plannedQty) : 0,
              plannedHours: form.plannedHours ? Number(form.plannedHours) : null,
            })}
            disabled={mutation.isPending || !form.machineId || !form.planDate}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Adauga'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detalii Plan ─────────────────────────────────────────────────────────────

function PlanDetail({ plan, machines, onClose }) {
  const qc = useQueryClient()
  const [addAlloc, setAddAlloc] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ['plan-detail', plan.id],
    queryFn: () => api.get(`/planning/master-plans/${plan.id}`).then(r => r.data),
  })

  const deleteAlloc = useMutation({
    mutationFn: (id) => api.delete(`/planning/allocations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['plan-detail', plan.id]); toast.success('Alocare stearsa.') },
    onError: () => toast.error('Eroare la stergere.'),
  })

  const machineMap = {}
  machines?.forEach(m => { machineMap[m.id] = m })

  // Group allocations by date
  const byDate = {}
  detail?.allocations?.forEach(a => {
    const d = a.plan_date?.split('T')[0] || a.plan_date
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(a)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{plan.name}</h3>
            <p className="text-xs text-slate-400">
              {new Date(plan.start_date).toLocaleDateString('ro-RO')} — {new Date(plan.end_date).toLocaleDateString('ro-RO')}
              {' • Revizie '}{plan.revision}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAddAlloc(true)} className="btn-primary text-xs flex items-center gap-1">
              <Plus size={13} /> Alocare
            </button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        {!detail?.allocations?.length && (
          <div className="text-center py-8 text-slate-400">
            <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Nicio alocare. Apasa "Alocare" pentru a adauga.</p>
          </div>
        )}

        {Object.entries(byDate).sort().map(([date, allocs]) => (
          <div key={date} className="mb-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {new Date(date).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="space-y-2">
              {allocs.map(a => {
                const machine = machineMap[a.machine_id]
                return (
                  <div key={a.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    <div className="flex-shrink-0 text-center">
                      <div className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-2 py-0.5">
                        {machine?.code || '?'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-700">{a.shift}</span>
                      {a.product_reference && (
                        <span className="text-xs text-slate-400 ml-2">{a.product_reference}</span>
                      )}
                      {a.product_name && (
                        <span className="text-xs text-slate-400 ml-1">— {a.product_name}</span>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5">
                        {machine?.name}
                        {machine?.location && ` • ${machine.location}`}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 flex-shrink-0">
                      {a.planned_qty > 0 && <div>{a.planned_qty.toLocaleString()} buc</div>}
                      {a.planned_hours && <div>{a.planned_hours}h</div>}
                    </div>
                    <button
                      onClick={() => deleteAlloc.mutate(a.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {addAlloc && (
          <AllocationModal plan={plan} machines={machines} onClose={() => setAddAlloc(false)} />
        )}
      </div>
    </div>
  )
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [tab, setTab] = useState('plans')
  const [weekStart, setWeekStart] = useState(getMonday())
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  // Utilaje din baza de date
  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get('/machines').then(r => r.data.data),
  })

  const { data: plans, isLoading } = useQuery({
    queryKey: ['master-plans'],
    queryFn: () => api.get('/planning/master-plans').then(r => r.data),
    enabled: tab === 'plans',
  })

  const { data: dashboard } = useQuery({
    queryKey: ['planning-dashboard', weekStart],
    queryFn: () => api.get('/planning/dashboard', { params: { weekStart } }).then(r => r.data),
    enabled: tab === 'dashboard',
  })

  const { data: demands } = useQuery({
    queryKey: ['demands'],
    queryFn: () => api.get('/planning/demands').then(r => r.data),
    enabled: tab === 'demands',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Planning Productie</h2>
        {isManager && tab === 'plans' && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Plan nou
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['plans', 'Planuri'], ['dashboard', 'Dashboard'], ['demands', 'Cereri']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'plans' && (
        <div className="space-y-3">
          {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
          {plans?.data?.map(p => (
            <div key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-blue-200 cursor-pointer transition-colors"
              onClick={() => setSelectedPlan(p)}
            >
              <div>
                <h4 className="font-medium text-slate-800">{p.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(p.start_date).toLocaleDateString('ro-RO')} — {new Date(p.end_date).toLocaleDateString('ro-RO')}
                  {' • Revizie '}{p.revision}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[p.status]}`}>
                  {p.status}
                </span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
          ))}
          {plans?.data?.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
              Niciun plan. Apasa "Plan nou" pentru a incepe.
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">Saptamana de la:</label>
            <input className="input w-40" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          </div>
          {dashboard && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Incarcare medie', value: `${dashboard.kpis.avgLoad}%` },
                  { label: 'Sloturi supraincarcate', value: dashboard.kpis.overloadedSlots },
                  { label: 'Total planificat', value: dashboard.kpis.totalPlanned.toLocaleString() + ' buc' },
                  { label: 'Total cereri', value: dashboard.kpis.totalDemand.toLocaleString() + ' buc' },
                  { label: 'Acoperire', value: `${dashboard.kpis.coveragePercent}%` },
                  { label: 'Cereri deschise', value: dashboard.kpis.openDemands },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {dashboard.capacity?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b"><h4 className="font-medium text-slate-700">Incarcare utilaje</h4></div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-600">Utilaj</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 hidden md:table-cell">Data</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Disponibil</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Planificat</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Incarcare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.capacity.map(c => {
                        const load = Number(c.load_percent)
                        const color = load > 100 ? 'text-red-500' : load > 80 ? 'text-amber-500' : 'text-green-600'
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium text-slate-800">
                              {c.machine_code} <span className="text-slate-400 font-normal text-xs">— {c.machine_name}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-400 text-xs hidden md:table-cell">
                              {new Date(c.plan_date).toLocaleDateString('ro-RO')}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">{c.available_hours}h</td>
                            <td className="px-4 py-2 text-right text-slate-500">{c.planned_hours}h</td>
                            <td className={`px-4 py-2 text-right font-bold ${color}`}>{Math.round(load)}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {dashboard.productSummary?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b"><h4 className="font-medium text-slate-700">Sumar produse</h4></div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-600">Produs</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Planificat</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Realizat</th>
                        <th className="text-right px-4 py-2 font-medium text-slate-600">Rebuturi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.productSummary.map(p => (
                        <tr key={p.product} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-700">{p.product}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{p.planned.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-green-600">{p.realized.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-red-500">{p.scrap.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'demands' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Referinta</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Data cerere</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cantitate</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {demands?.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{d.product_reference}</td>
                  <td className="px-4 py-3 text-slate-500">{d.client_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(d.demand_date).toLocaleDateString('ro-RO')}</td>
                  <td className="px-4 py-3 text-right font-medium">{d.required_qty.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-slate-100 text-slate-500'}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
              {demands?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio cerere.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && <PlanModal onClose={() => setModal(false)} />}
      {selectedPlan && (
        <PlanDetail plan={selectedPlan} machines={machines} onClose={() => setSelectedPlan(null)} />
      )}
    </div>
  )
}
