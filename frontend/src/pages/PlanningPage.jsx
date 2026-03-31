import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Calendar, ChevronRight, Trash2, Pencil, Search, BarChart3, PlayCircle, XCircle, ArrowLeft, ArrowRight, Check, AlertTriangle, Info, Loader2 } from 'lucide-react'

const SHIFTS = ['Tura I', 'Tura II', 'Tura III']
const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-500',
  pending_approval: 'bg-amber-100 text-amber-700',
  replan: 'bg-purple-100 text-purple-700',
}
const STATUS_LABELS = {
  draft: 'Ciorna', active: 'Activ', closed: 'Inchis', cancelled: 'Anulat',
  pending_approval: 'Asteapta aprobare', replan: 'Replanificare',
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

// ─── Modal Alocare Noua (Wizard inteligent) ──────────────────────────────────

function MachineLoadBar({ load }) {
  const pct = Math.min(100, Math.max(0, load))
  const color = load > 100 ? 'bg-red-500' : load > 80 ? 'bg-amber-500' : 'bg-green-500'
  const textColor = pct > 30 ? 'text-white' : 'text-slate-600'
  return (
    <div className="h-6 bg-slate-100 rounded relative overflow-hidden">
      {pct > 0 && (
        <div className={`h-full rounded ${color} flex items-center justify-center transition-all`} style={{ width: `${pct}%` }}>
          <span className={`text-[10px] font-bold ${textColor}`}>{Math.round(load)}%</span>
        </div>
      )}
      {pct === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">0%</span>}
    </div>
  )
}

function AllocationModal({ plan, machines, onClose }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [machineId, setMachineId] = useState('')
  const [selectedOp, setSelectedOp] = useState(null)
  const [allocQty, setAllocQty] = useState('')
  const [startDate, setStartDate] = useState(plan.start_date?.split('T')[0] || getMonday())
  const [endDate, setEndDate] = useState(plan.end_date?.split('T')[0] || '')
  const [shift, setShift] = useState('Tura I')
  const [saved, setSaved] = useState(false)

  const activeMachines = machines?.filter(m => m.status === 'active') || []
  const selectedMachine = activeMachines.find(m => m.id === machineId)

  // Fetch machine load when machine selected
  const { data: machineLoad, isLoading: loadingLoad } = useQuery({
    queryKey: ['machine-load', machineId, plan.start_date, plan.end_date],
    queryFn: () => api.get(`/planning/machine-load/${machineId}`, {
      params: { dateFrom: plan.start_date?.split('T')[0], dateTo: plan.end_date?.split('T')[0] }
    }).then(r => r.data),
    enabled: !!machineId,
  })

  // Fetch allocation context when machine selected
  const { data: context, isLoading: loadingCtx } = useQuery({
    queryKey: ['allocation-context', machineId],
    queryFn: () => api.get(`/planning/allocation-context/${machineId}`).then(r => r.data),
    enabled: !!machineId && step >= 2,
  })

  // Fetch shift definitions for picker
  const { data: shiftDefs } = useQuery({
    queryKey: ['shift-definitions'],
    queryFn: () => api.get('/shifts/definitions').then(r => r.data),
  })

  const shiftOptions = useMemo(() => {
    if (shiftDefs?.length) return shiftDefs.map(s => s.shift_name || s.shiftName || s.shift_code || s.shiftCode)
    return SHIFTS
  }, [shiftDefs])

  // Auto-calculate hours
  const calcHours = useMemo(() => {
    if (!selectedOp || !allocQty) return null
    const qty = Number(allocQty)
    if (qty <= 0) return null
    const cycleS = selectedOp.cycleTimeSeconds || 0
    const setupM = selectedOp.setupTimeMinutes || 0
    const productionHours = (qty * cycleS) / 3600
    const setupHours = setupM / 60
    const total = productionHours + setupHours
    return { productionHours, setupHours, total }
  }, [selectedOp, allocQty])

  // MBOM dependency warning — check if previous operation is completed
  const depWarning = useMemo(() => {
    if (!selectedOp || !context?.availableOperations) return null
    const seq = selectedOp.sequence
    if (!seq || seq <= 1) return null
    // Find the previous operation for the same product
    const sameProduct = context.availableOperations.filter(
      ao => ao.productReference === selectedOp.productReference
    )
    const prevOps = sameProduct.filter(ao => ao.sequence < seq)
    if (prevOps.length > 0) {
      const prev = prevOps.sort((a, b) => b.sequence - a.sequence)[0]
      if (prev.remaining > 0) {
        return {
          message: `${prev.operationName || 'Operatia anterioara'} (OP${String(prev.sequence).padStart(2, '0')}) are inca ${prev.remaining} buc nealocat. Asigurati-va ca operatia precedenta este planificata inainte.`,
          prevOp: prev,
        }
      }
    }
    return null
  }, [selectedOp, context])

  const mutation = useMutation({
    mutationFn: (data) => api.post('/planning/allocations', data),
    onSuccess: () => {
      qc.invalidateQueries(['plan-detail', plan.id])
      qc.invalidateQueries(['planning-dashboard'])
      qc.invalidateQueries(['allocation-context', machineId])
      qc.invalidateQueries(['machine-load', machineId])
      toast.success('Alocare adaugata.')
      setSaved(true)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const handleAllocate = () => {
    const qty = Number(allocQty)
    mutation.mutate({
      masterPlanId: plan.id,
      machineId,
      planDate: startDate,
      shift,
      productReference: selectedOp.productReference || null,
      productName: selectedOp.productName || null,
      productId: selectedOp.operation?.product_id || null,
      orderId: selectedOp.order?.id || null,
      plannedQty: qty,
      plannedHours: calcHours ? Math.round(calcHours.total * 100) / 100 : null,
      notes: `${selectedOp.operationName || ''} — ${selectedOp.order?.orderNumber || ''}`,
    })
  }

  const handleAllocateAnother = () => {
    setSaved(false)
    setSelectedOp(null)
    setAllocQty('')
    setStep(2)
  }

  const dayNames = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Alocare inteligenta</h3>
              <p className="text-xs text-slate-400 mt-0.5">{plan.name}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { n: 1, label: 'Utilaj' },
              { n: 2, label: 'Operatie' },
              { n: 3, label: 'Configurare' },
              { n: 4, label: 'Confirmare' },
            ].map(({ n, label }) => (
              <div key={n} className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {step > n ? <Check size={12} /> : n}
                </div>
                <span className={`text-xs font-medium ${step >= n ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                {n < 4 && <ChevronRight size={12} className="text-slate-300 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ─── Step 1: Select Machine ─────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Selecteaza utilaj</label>
                <select className="input" value={machineId} onChange={e => setMachineId(e.target.value)}>
                  <option value="">-- Alege utilaj --</option>
                  {activeMachines.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name} {m.type ? `[${m.type}]` : ''} {m.location ? `(${m.location})` : ''}
                    </option>
                  ))}
                </select>
                {activeMachines.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">Niciun utilaj activ. Adauga utilaje din pagina Utilaje.</p>
                )}
              </div>

              {/* Machine Load mini-Gantt */}
              {machineId && (
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">
                    Incarcare {selectedMachine?.code || ''}
                    {' '}({plan.start_date?.split('T')[0]} — {plan.end_date?.split('T')[0]})
                  </label>
                  {loadingLoad && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                      <Loader2 size={14} className="animate-spin" /> Se incarca...
                    </div>
                  )}
                  {machineLoad && (
                    <div className="grid gap-1">
                      {machineLoad.map(day => {
                        const avail = Number(day.availableHours) || 16
                        const used = Number(day.totalHours) || 0
                        const loadPct = avail > 0 ? (used / avail) * 100 : 0
                        const dt = new Date(day.date)
                        const isWeekend = dt.getDay() === 0 || dt.getDay() === 6
                        return (
                          <div key={day.date} className={`flex items-center gap-2 ${isWeekend ? 'opacity-50' : ''}`}>
                            <span className="text-[10px] text-slate-500 w-16 flex-shrink-0 text-right">
                              {dayNames[dt.getDay()]} {dt.getDate()}/{dt.getMonth() + 1}
                            </span>
                            <div className="flex-1">
                              <MachineLoadBar load={loadPct} />
                            </div>
                            <span className="text-[10px] text-slate-400 w-16 flex-shrink-0">
                              {used.toFixed(1)}h / {avail}h
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {machineLoad && machineLoad.length === 0 && (
                    <p className="text-xs text-slate-400 py-2">Nicio incarcare existenta.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 2: Select Operation ───────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              {loadingCtx && (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Se cauta operatii compatibile...
                </div>
              )}
              {context && context.availableOperations?.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <AlertTriangle size={28} className="mx-auto mb-2 text-amber-400" />
                  <p className="text-sm">Nicio operatie compatibila gasita pentru {selectedMachine?.code}.</p>
                  <p className="text-xs mt-1">Verificati ca exista comenzi active cu produse care au operatii alocabile pe acest utilaj.</p>
                </div>
              )}
              {context && context.availableOperations?.length > 0 && (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-2 font-medium text-slate-600">Comanda</th>
                        <th className="text-left px-2 py-2 font-medium text-slate-600">Client</th>
                        <th className="text-left px-2 py-2 font-medium text-slate-600">Produs</th>
                        <th className="text-left px-2 py-2 font-medium text-slate-600">Operatie</th>
                        <th className="text-right px-2 py-2 font-medium text-slate-600">Total</th>
                        <th className="text-right px-2 py-2 font-medium text-slate-600">Alocat</th>
                        <th className="text-right px-2 py-2 font-medium text-slate-600">Ramas</th>
                        <th className="text-right px-2 py-2 font-medium text-slate-600">Timp/pcs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {context.availableOperations.map((ao, i) => (
                        <tr
                          key={`${ao.operation?.id}-${ao.order?.id}-${i}`}
                          onClick={() => { setSelectedOp(ao); setAllocQty(String(ao.remaining)); setStep(3) }}
                          className={`cursor-pointer transition-colors hover:bg-blue-50 ${selectedOp?.operation?.id === ao.operation?.id && selectedOp?.order?.id === ao.order?.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                        >
                          <td className="px-2 py-2 font-medium text-blue-700">{ao.order?.orderNumber || '-'}</td>
                          <td className="px-2 py-2 text-slate-600">{ao.order?.clientName || '-'}</td>
                          <td className="px-2 py-2 text-slate-700 font-medium">{ao.productReference}</td>
                          <td className="px-2 py-2 text-slate-600">{ao.operationName || ao.operationType || '-'}</td>
                          <td className="px-2 py-2 text-right text-slate-500">{ao.totalQty?.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-slate-500">{ao.alreadyAllocated?.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right font-bold text-slate-800">{ao.remaining?.toLocaleString()}</td>
                          <td className="px-2 py-2 text-right text-slate-500">{ao.cycleTimeSeconds ? `${ao.cycleTimeSeconds}s` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: Configure Allocation ───────────── */}
          {step === 3 && selectedOp && (
            <div className="space-y-4">
              {/* Summary header */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-semibold text-blue-800 text-sm">
                  {selectedOp.productReference} — {selectedOp.operationName || selectedOp.operationType}
                  {' '}pe {selectedMachine?.code}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Comanda: {selectedOp.order?.orderNumber} {selectedOp.order?.clientName ? `(${selectedOp.order.clientName})` : ''}
                </p>
              </div>

              {/* Qty info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Total comanda</p>
                  <p className="text-sm font-bold text-slate-700">{selectedOp.totalQty?.toLocaleString()} buc</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-slate-400 uppercase">Deja alocat</p>
                  <p className="text-sm font-bold text-slate-700">{selectedOp.alreadyAllocated?.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-green-600 uppercase">Disponibil</p>
                  <p className="text-sm font-bold text-green-700">{selectedOp.remaining?.toLocaleString()}</p>
                </div>
              </div>

              {/* Allocation form */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">Cantitate de alocat (buc) *</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max={selectedOp.remaining}
                    value={allocQty}
                    onChange={e => setAllocQty(e.target.value)}
                    placeholder={`max ${selectedOp.remaining}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">Data start *</label>
                    <input className="input" type="date" value={startDate}
                      min={plan.start_date?.split('T')[0]}
                      max={plan.end_date?.split('T')[0]}
                      onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">Data sfarsit</label>
                    <input className="input" type="date" value={endDate}
                      min={startDate}
                      max={plan.end_date?.split('T')[0]}
                      onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">Tura *</label>
                  <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
                    {shiftOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Auto-calculated time */}
              {calcHours && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                  <span className="font-medium">{Number(allocQty).toLocaleString()} buc</span>
                  {' x '}
                  <span>{selectedOp.cycleTimeSeconds}s</span>
                  {' = '}
                  <span className="font-medium">{calcHours.productionHours.toFixed(2)}h</span>
                  {selectedOp.setupTimeMinutes > 0 && (
                    <>
                      {' + setup '}
                      <span className="font-medium">{selectedOp.setupTimeMinutes}min</span>
                    </>
                  )}
                  {' = '}
                  <span className="font-bold text-blue-700">{calcHours.total.toFixed(2)}h total</span>
                </div>
              )}

              {/* MBOM dependency warning */}
              {depWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{depWarning.message}</p>
                </div>
              )}

              {/* Deadline warning */}
              {selectedOp.order?.deadline && startDate > selectedOp.order.deadline.split('T')[0] && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    Data start ({startDate}) depaseste deadline-ul comenzii ({selectedOp.order.deadline.split('T')[0]}).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 4: Confirm ────────────────────────── */}
          {step === 4 && selectedOp && !saved && (
            <div className="space-y-4">
              <h4 className="font-medium text-slate-700 text-sm">Confirmare alocare</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Utilaj</span>
                  <span className="font-medium text-slate-800">{selectedMachine?.code} — {selectedMachine?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Produs</span>
                  <span className="font-medium text-slate-800">{selectedOp.productReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operatie</span>
                  <span className="font-medium text-slate-800">{selectedOp.operationName || selectedOp.operationType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Comanda</span>
                  <span className="font-medium text-slate-800">{selectedOp.order?.orderNumber}</span>
                </div>
                <hr className="border-slate-200" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Cantitate</span>
                  <span className="font-bold text-slate-800">{Number(allocQty).toLocaleString()} buc</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data</span>
                  <span className="font-medium text-slate-800">{startDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tura</span>
                  <span className="font-medium text-slate-800">{shift}</span>
                </div>
                {calcHours && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ore planificate</span>
                    <span className="font-bold text-blue-700">{calcHours.total.toFixed(2)}h</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── After save ─────────────────────────────── */}
          {step === 4 && saved && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={24} className="text-green-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Alocare salvata cu succes!</p>
              {selectedOp && (() => {
                const newRemaining = selectedOp.remaining - Number(allocQty)
                if (newRemaining > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700">
                        Ramas nealocat: <strong>{newRemaining.toLocaleString()} buc</strong> — aloca pe alta masina?
                      </p>
                      <button onClick={handleAllocateAnother} className="btn-primary text-xs mt-2">
                        Aloca in continuare
                      </button>
                    </div>
                  )
                }
                return <p className="text-xs text-green-600">Toata cantitatea a fost alocata.</p>
              })()}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-between flex-shrink-0">
          <div>
            {step > 1 && !saved && (
              <button onClick={() => setStep(step - 1)} className="btn-secondary text-xs flex items-center gap-1">
                <ArrowLeft size={13} /> Inapoi
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              {saved ? 'Inchide' : 'Anuleaza'}
            </button>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!machineId}
                className="btn-primary text-xs flex items-center gap-1"
              >
                Urmatorul <ArrowRight size={13} />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={!selectedOp}
                className="btn-primary text-xs flex items-center gap-1"
              >
                Configureaza <ArrowRight size={13} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                disabled={!allocQty || Number(allocQty) <= 0 || Number(allocQty) > selectedOp.remaining || !startDate}
                className="btn-primary text-xs flex items-center gap-1"
              >
                Verifica <ArrowRight size={13} />
              </button>
            )}
            {step === 4 && !saved && (
              <button
                onClick={handleAllocate}
                disabled={mutation.isPending}
                className="btn-primary text-xs flex items-center gap-1"
              >
                {mutation.isPending ? (
                  <><Loader2 size={13} className="animate-spin" /> Se salveaza...</>
                ) : (
                  <><Check size={13} /> Aloca</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editare Plan ──────────────────────────────────────────────────────

function EditPlanModal({ plan, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: plan.name || '',
    notes: plan.notes || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/planning/master-plans/${plan.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['master-plans'])
      qc.invalidateQueries(['plan-detail', plan.id])
      toast.success('Plan actualizat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la actualizare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pencil size={16} /> Editeaza plan
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Denumire *</label>
            <input className="input" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Note</label>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editare Alocare ───────────────────────────────────────────────────

function EditAllocationModal({ allocation, planId, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    plannedQty: String(allocation.planned_qty || 0),
    plannedHours: String(allocation.planned_hours || ''),
    status: allocation.status || 'planned',
    notes: allocation.notes || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/planning/allocations/${allocation.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['plan-detail', planId])
      qc.invalidateQueries(['planning-dashboard'])
      toast.success('Alocare actualizata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la actualizare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pencil size={16} /> Editeaza alocare
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate planificata</label>
              <input className="input" type="number" value={form.plannedQty} onChange={f('plannedQty')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ore planificate</label>
              <input className="input" type="number" step="0.5" value={form.plannedHours} onChange={f('plannedHours')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Status</label>
            <select className="input" value={form.status} onChange={f('status')}>
              <option value="planned">Planificat</option>
              <option value="in_progress">In executie</option>
              <option value="completed">Finalizat</option>
              <option value="cancelled">Anulat</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Note</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              plannedQty: form.plannedQty ? Number(form.plannedQty) : 0,
              plannedHours: form.plannedHours ? Number(form.plannedHours) : null,
              status: form.status,
              notes: form.notes || null,
            })}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Cerere Noua ───────────────────────────────────────────────────────

function DemandModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    clientName: '',
    productReference: '',
    demandDate: new Date().toISOString().split('T')[0],
    requiredQty: '',
    deliveryDate: '',
    priority: 'normal',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/planning/demands', data),
    onSuccess: () => {
      qc.invalidateQueries(['demands'])
      toast.success('Cerere creata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Cerere noua</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume client" value={form.clientName} onChange={f('clientName')} />
          <input className="input" placeholder="Referinta produs *" value={form.productReference} onChange={f('productReference')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data cerere *</label>
              <input className="input" type="date" value={form.demandDate} onChange={f('demandDate')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate necesara *</label>
              <input className="input" type="number" min="1" value={form.requiredQty} onChange={f('requiredQty')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Data livrare</label>
              <input className="input" type="date" value={form.deliveryDate} onChange={f('deliveryDate')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Prioritate</label>
              <select className="input" value={form.priority} onChange={f('priority')}>
                <option value="low">Scazuta</option>
                <option value="normal">Normala</option>
                <option value="high">Ridicata</option>
                <option value="urgent">Urgenta</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              clientName: form.clientName || null,
              productReference: form.productReference,
              demandDate: form.demandDate,
              requiredQty: Number(form.requiredQty),
              deliveryDate: form.deliveryDate || null,
              priority: form.priority,
            })}
            disabled={mutation.isPending || !form.productReference || !form.requiredQty || !form.demandDate}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
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
  const [editPlan, setEditPlan] = useState(false)
  const [editAlloc, setEditAlloc] = useState(null)

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
            <button onClick={() => setEditPlan(true)} className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={13} /> Editeaza
            </button>
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
                  <div key={a.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setEditAlloc(a)}>
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
                      onClick={(e) => { e.stopPropagation(); deleteAlloc.mutate(a.id) }}
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
        {editPlan && (
          <EditPlanModal plan={plan} onClose={() => setEditPlan(false)} />
        )}
        {editAlloc && (
          <EditAllocationModal allocation={editAlloc} planId={plan.id} onClose={() => setEditAlloc(null)} />
        )}
      </div>
    </div>
  )
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [tab, setTab] = useState('plans')
  const [weekStart, setWeekStart] = useState(getMonday())
  const [demandModal, setDemandModal] = useState(false)
  const [capFrom, setCapFrom] = useState(getMonday())
  const [capTo, setCapTo] = useState(() => { const d = new Date(getMonday()); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })
  const isManager = ['admin', 'production_manager'].includes(user?.role)
  const isFullscreen = new URLSearchParams(window.location.search).get('fullscreen') === 'true'

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

  const { data: capacity } = useQuery({
    queryKey: ['capacity', capFrom, capTo],
    queryFn: () => api.get('/planning/capacity', { params: { dateFrom: capFrom, dateTo: capTo } }).then(r => r.data),
    enabled: tab === 'capacity',
  })

  // In fullscreen mode, auto-switch to dashboard and hide chrome
  if (isFullscreen) {
    return (
      <div className="p-4 space-y-4 min-h-screen bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Planning Productie — Fullscreen</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">Saptamana de la:</label>
            <input className="input w-40" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          </div>
        </div>
        {dashboard && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Incarcare medie', value: `${dashboard.kpis.avgLoad}%` },
                { label: 'Sloturi supraincarcate', value: dashboard.kpis.overloadedSlots },
                { label: 'Total planificat', value: dashboard.kpis.totalPlanned.toLocaleString() + ' buc' },
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
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Data</th>
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
                          <td className="px-4 py-2 text-slate-400 text-xs">
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
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Planning Productie</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/planning?fullscreen=true', '_blank', 'width=1920,height=1080')}
            className="text-xs text-slate-500 hover:text-blue-600"
            title="Deschide Gantt fullscreen"
          >
            &#x26F6; Fullscreen
          </button>
          {isManager && tab === 'plans' && (
            <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={15} /> Plan nou
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['plans', 'Planuri'], ['dashboard', 'Dashboard'], ['demands', 'Cereri'], ['capacity', 'Capacitate']].map(([t, l]) => (
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
              className={`bg-white rounded-xl border p-4 flex items-center justify-between hover:border-blue-200 cursor-pointer transition-colors ${p.status === 'pending_approval' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
              onClick={() => setSelectedPlan(p)}
            >
              <div>
                <h4 className="font-medium text-slate-800">{p.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(p.start_date).toLocaleDateString('ro-RO')} — {new Date(p.end_date).toLocaleDateString('ro-RO')}
                  {' • Revizie '}{p.revision}
                </p>
                {p.status === 'pending_approval' && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">Replanificare automata — necesita aprobare</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
                {/* Draft -> Active */}
                {p.status === 'draft' && isManager && (
                  <button
                    onClick={(e) => { e.stopPropagation(); api.put(`/planning/master-plans/${p.id}`, { status: 'active' }).then(() => { qc.invalidateQueries(['master-plans']); toast.success('Plan activat!') }).catch(err => toast.error(err.response?.data?.message || 'Eroare')) }}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    <PlayCircle size={12} /> Activeaza
                  </button>
                )}
                {/* Active -> Closed */}
                {p.status === 'active' && isManager && (
                  <button
                    onClick={(e) => { e.stopPropagation(); api.put(`/planning/master-plans/${p.id}`, { status: 'closed' }).then(() => { qc.invalidateQueries(['master-plans']); toast.success('Plan inchis.') }).catch(err => toast.error(err.response?.data?.message || 'Eroare')) }}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                  >
                    <XCircle size={12} /> Inchide
                  </button>
                )}
                {/* Pending approval -> Approve / Reject */}
                {p.status === 'pending_approval' && isManager && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); api.put(`/planning/replan/${p.id}/approve`).then(() => { qc.invalidateQueries(['master-plans']); toast.success('Plan aprobat!') }).catch(err => toast.error(err.response?.data?.message || 'Eroare')) }}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Aproba
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); api.put(`/planning/replan/${p.id}/reject`, { reason: 'Respins manual' }).then(() => { qc.invalidateQueries(['master-plans']); toast.success('Plan respins — alocatiile originale restaurate.') }).catch(err => toast.error(err.response?.data?.message || 'Eroare')) }}
                      className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      Respinge
                    </button>
                  </>
                )}
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

              {/* GANTT CHART — vizualizare pe masini x zile */}
              {dashboard.capacity?.length > 0 && (() => {
                // Group capacity by machine
                const machineMap = {}
                dashboard.capacity.forEach(c => {
                  if (!machineMap[c.machine_code]) machineMap[c.machine_code] = { code: c.machine_code, name: c.machine_name, days: [] }
                  machineMap[c.machine_code].days.push(c)
                })
                const machineList = Object.values(machineMap)
                // Get unique sorted dates
                const dates = [...new Set(dashboard.capacity.map(c => c.plan_date.split('T')[0]))].sort()
                const dayNames = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S']

                return (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <h4 className="font-medium text-slate-700">Gantt — Incarcare pe masini</h4>
                      <div className="flex gap-3 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> &lt;80%</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> 80-100%</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> &gt;100%</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px]">
                        {/* Header with dates */}
                        <div className="flex border-b border-slate-100">
                          <div className="w-28 flex-shrink-0 px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50">Utilaj</div>
                          {dates.map(d => {
                            const dt = new Date(d)
                            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6
                            return (
                              <div key={d} className={`flex-1 px-1 py-2 text-center text-[10px] font-medium border-l border-slate-100 ${isWeekend ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                                <div>{dayNames[dt.getDay()]}</div>
                                <div>{dt.getDate()}/{dt.getMonth() + 1}</div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Machine rows */}
                        {machineList.map(machine => (
                          <div key={machine.code} className="flex border-b border-slate-50 hover:bg-slate-50/50">
                            <div className="w-28 flex-shrink-0 px-3 py-2 flex items-center">
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">{machine.code}</span>
                            </div>
                            {dates.map(d => {
                              const dayData = machine.days.find(dd => dd.plan_date.split('T')[0] === d)
                              const load = dayData ? Number(dayData.load_percent) : 0
                              const planned = dayData ? Number(dayData.planned_hours) : 0
                              const available = dayData ? Number(dayData.available_hours) : 0
                              const bgColor = load === 0 ? 'bg-slate-100' : load > 100 ? 'bg-red-500' : load > 80 ? 'bg-amber-500' : 'bg-green-500'
                              const textColor = load > 0 ? 'text-white' : 'text-slate-300'
                              const widthPct = Math.min(100, load)
                              return (
                                <div key={d} className="flex-1 px-0.5 py-1.5 border-l border-slate-100" title={`${machine.code} — ${d}\n${planned}h / ${available}h (${Math.round(load)}%)`}>
                                  <div className="h-7 bg-slate-100 rounded relative overflow-hidden">
                                    {load > 0 && (
                                      <div className={`h-full rounded ${bgColor} flex items-center justify-center transition-all`} style={{ width: `${widthPct}%` }}>
                                        <span className={`text-[9px] font-bold ${textColor}`}>{Math.round(load)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}

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
        <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => setDemandModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Cerere noua
          </button>
        </div>
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
        {demandModal && <DemandModal onClose={() => setDemandModal(false)} />}
        </div>
      )}

      {tab === 'capacity' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">De la:</label>
            <input className="input w-40" type="date" value={capFrom} onChange={e => setCapFrom(e.target.value)} />
            <label className="text-sm text-slate-500">Pana la:</label>
            <input className="input w-40" type="date" value={capTo} onChange={e => setCapTo(e.target.value)} />
          </div>
          {capacity && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" />
                <h4 className="font-medium text-slate-700">Capacitate utilaje</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Cod utilaj</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Denumire</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Data</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Disponibil</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Planificat</th>
                    <th className="text-right px-4 py-2 font-medium text-slate-600">Incarcare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(capacity?.data || capacity || []).map((c, i) => {
                    const load = Number(c.load_percent || 0)
                    const color = load > 100 ? 'text-red-500 bg-red-50' : load > 80 ? 'text-amber-600 bg-amber-50' : 'text-green-600 bg-green-50'
                    return (
                      <tr key={c.id || i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-xs text-blue-600">{c.machine_code}</td>
                        <td className="px-4 py-2 text-slate-700">{c.machine_name}</td>
                        <td className="px-4 py-2 text-slate-400 text-xs">{c.plan_date ? new Date(c.plan_date).toLocaleDateString('ro-RO') : '—'}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{c.available_hours}h</td>
                        <td className="px-4 py-2 text-right text-slate-500">{c.planned_hours}h</td>
                        <td className="px-4 py-2 text-right">
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${color}`}>{Math.round(load)}%</span>
                        </td>
                      </tr>
                    )
                  })}
                  {(capacity?.data || capacity || []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio data de capacitate pentru perioada selectata.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && <PlanModal onClose={() => setModal(false)} />}
      {selectedPlan && (
        <PlanDetail plan={selectedPlan} machines={machines} onClose={() => setSelectedPlan(null)} />
      )}
    </div>
  )
}
