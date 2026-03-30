import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Wrench, Building2, Clock, DollarSign, Calendar, CheckCircle, Play, Flag, Eye, X } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'
import { formatMoney } from '../utils/currency'

function PlannedModal({ machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    machineId: '', title: '', description: '', interventionType: 'preventive',
    plannedStartDate: '', plannedEndDate: '', estimatedHours: '',
    executorType: 'internal', executorCompanyId: '', estimatedCost: '',
    internalTeamNotes: '', isRecurring: false, recurrenceRule: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const { data: companies } = useQuery({
    queryKey: ['companies-maintenance'],
    queryFn: () => api.get('/companies?limit=100').then(r => {
      const list = r.data?.data || r.data || []
      return list.filter(c => {
        const types = c.company_types || c.companyTypes || []
        return types.includes('furnizor') || types.includes('firma_mentenanta')
      })
    }),
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/maintenance/planned', data),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Interventie planificata creata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Wrench size={18} /> Programeaza mentenanta
        </h3>
        <div className="space-y-3">
          {/* Utilaj */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Utilaj *</label>
            <select className="input" value={form.machineId} onChange={f('machineId')}>
              <option value="">Selecteaza utilaj</option>
              {(machines || []).map(m => (
                <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
              ))}
            </select>
          </div>

          {/* Titlu + Tip interventie */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Titlu interventie *</label>
            <input className="input" placeholder="Ex: Revizie generala CNC-01" value={form.title} onChange={f('title')} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Tip interventie</label>
            <select className="input" value={form.interventionType} onChange={f('interventionType')}>
              <option value="preventive">Preventiva</option>
              <option value="corrective">Corectiva</option>
              <option value="predictive">Predictiva</option>
              <option value="calibration">Calibrare</option>
              <option value="inspection">Inspectie</option>
            </select>
          </div>

          {/* Date start / end */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                <Calendar size={12} /> Data start *
              </label>
              <input className="input" type="date" value={form.plannedStartDate} onChange={f('plannedStartDate')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Data sfarsit *</label>
              <input className="input" type="date" value={form.plannedEndDate} onChange={f('plannedEndDate')} />
            </div>
          </div>

          {/* Ore estimate + Cost estimat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                <Clock size={12} /> Ore estimate
              </label>
              <input className="input" type="number" placeholder="ore" step="0.5" value={form.estimatedHours} onChange={f('estimatedHours')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                <DollarSign size={12} /> Cost estimat (RON)
              </label>
              <input className="input" type="number" placeholder="0.00" step="0.01" value={form.estimatedCost} onChange={f('estimatedCost')} />
            </div>
          </div>

          {/* Executor: intern / extern */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Executor</label>
            <select className="input" value={form.executorType} onChange={f('executorType')}>
              <option value="internal">Intern (echipa proprie)</option>
              <option value="external">Extern (firma specializata)</option>
            </select>
          </div>

          {/* Firma externa */}
          {form.executorType === 'external' && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                <Building2 size={12} /> Firma mentenanta
              </label>
              <select className="input" value={form.executorCompanyId} onChange={f('executorCompanyId')}>
                <option value="">Selecteaza firma</option>
                {(companies || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Descriere */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Descriere / Note</label>
            <textarea className="input resize-none" rows={3} placeholder="Detalii despre interventie..." value={form.description} onChange={f('description')} />
          </div>

          {/* Recurenta */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} />
            <span className="text-sm text-slate-600">Interventie recurenta</span>
          </label>
          {form.isRecurring && (
            <input className="input" placeholder="Regula recurenta (ex: la fiecare 2000 ore sau 6 luni)" value={form.recurrenceRule} onChange={f('recurrenceRule')} />
          )}
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              machineId: form.machineId,
              title: form.title,
              description: form.description || null,
              interventionType: form.interventionType,
              plannedStartDate: form.plannedStartDate,
              plannedEndDate: form.plannedEndDate,
              estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
              executorType: form.executorType,
              executorCompanyId: form.executorCompanyId || null,
              estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
              internalTeamNotes: form.internalTeamNotes || null,
              isRecurring: form.isRecurring,
              recurrenceRule: form.isRecurring ? form.recurrenceRule : null,
            })}
            disabled={mutation.isPending || !form.machineId || !form.title || !form.plannedStartDate || !form.plannedEndDate}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se programeaza...' : 'Programeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Planned intervention detail modal ────────────────────────────────────────

function PlannedDetailModal({ planned, machines, tenantCurrency, canManage, onClose }) {
  const qc = useQueryClient()
  const machineInfo = (machines || []).find(m => m.id === planned.machine_id)
  const typeLabels = { preventive: 'Preventiva', corrective: 'Corectiva', predictive: 'Predictiva', calibration: 'Calibrare', inspection: 'Inspectie' }
  const [completeForm, setCompleteForm] = useState({ completion_notes: '', actual_cost: '' })
  const [showComplete, setShowComplete] = useState(false)

  const confirmMutation = useMutation({
    mutationFn: () => api.put(`/maintenance/planned/${planned.id}/confirm`),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Interventie confirmata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const startMutation = useMutation({
    mutationFn: () => api.put(`/maintenance/planned/${planned.id}/start`),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Interventie inceputa.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const completeMutation = useMutation({
    mutationFn: (data) => api.put(`/maintenance/planned/${planned.id}/complete`, data),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Interventie finalizata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Wrench size={16} /> {planned.title || 'Interventie planificata'}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${STATUS_COLORS[planned.status] || 'bg-slate-100 text-slate-500'}`}>
              {planned.status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <div className="space-y-3 text-sm">
          {/* Machine info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Utilaj</p>
              <p className="font-medium text-slate-800">{machineInfo?.code || '—'} {machineInfo?.name && `— ${machineInfo.name}`}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Tip interventie</p>
              <p className="font-medium text-slate-800">{typeLabels[planned.intervention_type] || planned.intervention_type || '—'}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Data start planificat</p>
              <p className="font-medium text-slate-800">{planned.planned_start_date ? new Date(planned.planned_start_date).toLocaleDateString('ro-RO') : '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Data sfarsit planificat</p>
              <p className="font-medium text-slate-800">{planned.planned_end_date ? new Date(planned.planned_end_date).toLocaleDateString('ro-RO') : '—'}</p>
            </div>
          </div>

          {/* Hours + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Ore estimate</p>
              <p className="font-medium text-slate-800">{planned.planned_duration_hours || planned.estimated_hours || '—'}{(planned.planned_duration_hours || planned.estimated_hours) && 'h'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Cost estimat</p>
              <p className="font-medium text-slate-800">{planned.estimated_cost ? formatMoney(Number(planned.estimated_cost), planned.currency || tenantCurrency) : '—'}</p>
            </div>
          </div>

          {/* Actual cost if completed */}
          {planned.actual_cost != null && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-500">Cost actual</p>
              <p className="font-bold text-green-800">{formatMoney(Number(planned.actual_cost), planned.currency || tenantCurrency)}</p>
            </div>
          )}

          {/* Executor */}
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Executor</p>
            {planned.executor_type === 'external' ? (
              <div>
                <p className="font-medium text-slate-800 flex items-center gap-1"><Building2 size={12} className="text-purple-500" /> {planned.executor_company_name || 'Firma externa'}</p>
                {planned.executor_contact && <p className="text-xs text-slate-500 mt-0.5">Contact: {planned.executor_contact}</p>}
              </div>
            ) : (
              <p className="font-medium text-slate-800">Intern (echipa proprie)</p>
            )}
          </div>

          {/* Description / Notes */}
          {planned.description && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Descriere</p>
              <p className="text-slate-700">{planned.description}</p>
            </div>
          )}

          {planned.internal_team_notes && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Note echipa</p>
              <p className="text-slate-700">{planned.internal_team_notes}</p>
            </div>
          )}

          {planned.completion_notes && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-500">Note finalizare</p>
              <p className="text-green-800">{planned.completion_notes}</p>
            </div>
          )}

          {/* Spare parts */}
          {planned.spare_parts_cost != null && planned.spare_parts_cost > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Cost piese de schimb</p>
              <p className="font-medium text-slate-800">{formatMoney(planned.spare_parts_cost, planned.currency || tenantCurrency)}</p>
            </div>
          )}

          {/* Recurrence */}
          {planned.is_recurring && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-400">Recurenta</p>
              <p className="text-blue-800">{planned.recurrence_rule || 'Recurenta'}</p>
            </div>
          )}

          {/* Lifecycle action buttons */}
          {canManage && (
            <div className="border-t pt-3 space-y-2">
              {planned.status === 'planned' && (
                <button
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <CheckCircle size={14} />
                  {confirmMutation.isPending ? 'Se confirma...' : 'Confirma'}
                </button>
              )}

              {planned.status === 'confirmed' && (
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Play size={14} />
                  {startMutation.isPending ? 'Se porneste...' : 'Incepe'}
                </button>
              )}

              {planned.status === 'in_progress' && !showComplete && (
                <button
                  onClick={() => setShowComplete(true)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Flag size={14} /> Finalizeaza
                </button>
              )}

              {planned.status === 'in_progress' && showComplete && (
                <div className="space-y-2 bg-green-50 rounded-lg p-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Note finalizare</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      placeholder="Descriere lucrari efectuate..."
                      value={completeForm.completion_notes}
                      onChange={e => setCompleteForm({ ...completeForm, completion_notes: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Cost actual ({tenantCurrency})</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={completeForm.actual_cost}
                      onChange={e => setCompleteForm({ ...completeForm, actual_cost: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowComplete(false)} className="btn-secondary flex-1">Anuleaza</button>
                    <button
                      onClick={() => completeMutation.mutate({
                        completion_notes: completeForm.completion_notes || null,
                        actual_cost: completeForm.actual_cost ? Number(completeForm.actual_cost) : null,
                      })}
                      disabled={completeMutation.isPending}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <Flag size={14} />
                      {completeMutation.isPending ? 'Se finalizeaza...' : 'Finalizeaza'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Lifecycle action buttons for table rows ─────────────────────────────────

function PlannedLifecycleButtons({ planned, canManage }) {
  const qc = useQueryClient()

  const confirmMutation = useMutation({
    mutationFn: () => api.put(`/maintenance/planned/${planned.id}/confirm`),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Confirmat.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const startMutation = useMutation({
    mutationFn: () => api.put(`/maintenance/planned/${planned.id}/start`),
    onSuccess: () => { qc.invalidateQueries(['maintenance-planned']); toast.success('Inceput.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  if (!canManage) return null

  return (
    <div className="flex gap-1">
      {planned.status === 'planned' && (
        <button
          onClick={(e) => { e.stopPropagation(); confirmMutation.mutate() }}
          disabled={confirmMutation.isPending}
          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
          title="Confirma"
        >
          <CheckCircle size={12} /> Confirma
        </button>
      )}
      {planned.status === 'confirmed' && (
        <button
          onClick={(e) => { e.stopPropagation(); startMutation.mutate() }}
          disabled={startMutation.isPending}
          className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 flex items-center gap-1"
          title="Incepe"
        >
          <Play size={12} /> Incepe
        </button>
      )}
      {planned.status === 'in_progress' && (
        <span className="text-xs text-amber-500 flex items-center gap-1">
          <Flag size={12} /> Click pt. finalizare
        </span>
      )}
    </div>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
}
const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function NewRequestModal({ machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', problemType: '', description: '', priority: 'normal' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/maintenance', data),
    onSuccess: () => { qc.invalidateQueries(['maintenance']); toast.success('Cerere trimisa.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Cerere mentenanta</h3>
        <div className="space-y-3">
          <SearchableSelect
            endpoint="/machines"
            labelField="name"
            valueField="id"
            placeholder="Selecteaza utilaj"
            value={form.machineId || null}
            onChange={(id) => setForm(prev => ({ ...prev, machineId: id || '' }))}
            allowCreate={false}
          />
          <input className="input" placeholder="Tipul problemei" value={form.problemType} onChange={e => setForm({ ...form, problemType: e.target.value })} />
          <textarea className="input resize-none" rows={3} placeholder="Descriere (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Scazuta</option>
            <option value="normal">Normala</option>
            <option value="high">Ridicata</option>
            <option value="critical">Critica</option>
          </select>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.machineId || !form.problemType} className="btn-primary">
            {mutation.isPending ? 'Se trimite...' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_LABELS = { open: 'Deschis', in_progress: 'In lucru', done: 'Rezolvat', cancelled: 'Anulat' }
const PRIORITY_LABELS = { low: 'Scazuta', normal: 'Normala', high: 'Ridicata', critical: 'Critica' }

function RequestDetailModal({ request, machines, canManage, user, onClose }) {
  const qc = useQueryClient()
  const [resolution, setResolution] = useState('')
  const machine = (machines || []).find(m => m.id === request.machine_id)

  const [replanInfo, setReplanInfo] = useState(null)

  const update = useMutation({
    mutationFn: (body) => api.put(`/maintenance/${request.id}`, body).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries(['maintenance'])
      if (data?.replanResult && data.replanResult.replanId) {
        setReplanInfo(data.replanResult)
        toast.success(`Cerere preluata. ${data.replanResult.movedCount} alocatii replanificate automat.`)
      } else {
        toast.success('Actualizat.')
        onClose()
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const timeSinceCreated = request.created_at
    ? Math.round((Date.now() - new Date(request.created_at).getTime()) / 60000)
    : null
  const durationInProgress = request.started_at
    ? Math.round((new Date(request.resolved_at || Date.now()).getTime() - new Date(request.started_at).getTime()) / 60000)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{request.request_number}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status] || request.status}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${PRIORITY_COLORS[request.priority]}`}>
              {PRIORITY_LABELS[request.priority] || request.priority}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Utilaj</p>
              <p className="font-medium text-slate-800">{machine?.code || '—'} {machine?.name && `— ${machine.name}`}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Raportat de</p>
              <p className="font-medium text-slate-800">{request.reported_by_name || request.reported_by || '—'}</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-400">Problema</p>
            <p className="font-medium text-slate-800">{request.problem_type}</p>
            {request.description && <p className="text-slate-600 mt-1">{request.description}</p>}
          </div>

          {request.photo_url && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Foto raportare</p>
              <img src={request.photo_url} alt="Problema" className="rounded-lg max-h-48 object-cover" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Creat</p>
              <p className="text-slate-700">{request.created_at ? new Date(request.created_at).toLocaleString('ro-RO') : '—'}</p>
              {timeSinceCreated != null && request.status === 'open' && (
                <p className="text-xs text-amber-600 mt-0.5">Deschis de {timeSinceCreated} min</p>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Durata interventie</p>
              <p className="text-slate-700">
                {durationInProgress != null
                  ? durationInProgress < 60 ? `${durationInProgress} min` : `${Math.round(durationInProgress / 60 * 10) / 10}h`
                  : '—'}
              </p>
            </div>
          </div>

          {request.assigned_to && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-400">Preluat de</p>
              <p className="font-medium text-blue-800">{request.assigned_to_name || request.assigned_to}</p>
              {request.started_at && <p className="text-xs text-blue-500">La {new Date(request.started_at).toLocaleString('ro-RO')}</p>}
            </div>
          )}

          {request.resolution && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-400">Rezolutie</p>
              <p className="text-green-800">{request.resolution}</p>
              {request.resolved_at && <p className="text-xs text-green-500">Rezolvat la {new Date(request.resolved_at).toLocaleString('ro-RO')}</p>}
            </div>
          )}

          {/* Actions */}
          {canManage && request.status === 'open' && !replanInfo && (
            <div className="border-t pt-3">
              <p className="text-xs text-slate-500 mb-2">Preia aceasta cerere — masina va fi marcata "In mentenanta" si productia va fi replanificata automat pe alte utilaje.</p>
              <button
                onClick={() => update.mutate({ status: 'in_progress', assignedTo: user?.id || user?.userId })}
                disabled={update.isPending}
                className="btn-primary w-full"
              >
                {update.isPending ? 'Se preia si se replanifica...' : 'Preia cererea'}
              </button>
            </div>
          )}

          {/* Replan result */}
          {replanInfo && (
            <div className="border-t pt-3 space-y-3">
              <div className={`rounded-lg p-4 ${replanInfo.failedCount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <p className={`font-medium text-sm ${replanInfo.failedCount > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                  Replanificare automata
                </p>
                <p className="text-sm mt-1 text-slate-700">{replanInfo.message}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-medium">{replanInfo.affectedTotal}</span> alocatii afectate |
                  <span className="font-medium text-green-600 ml-1">{replanInfo.movedCount}</span> mutate |
                  <span className={`font-medium ml-1 ${replanInfo.failedCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{replanInfo.failedCount}</span> fara alternativa
                </div>
              </div>
              {replanInfo.details?.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-500">Data</th>
                        <th className="text-left px-3 py-2 text-slate-500">Produs</th>
                        <th className="text-left px-3 py-2 text-slate-500">Cant.</th>
                        <th className="text-left px-3 py-2 text-slate-500">De pe</th>
                        <th className="text-left px-3 py-2 text-slate-500">Pe</th>
                        <th className="text-left px-3 py-2 text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replanInfo.details.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{d.date ? new Date(d.date).toLocaleDateString('ro-RO') : ''}</td>
                          <td className="px-3 py-1.5 font-medium">{d.product}</td>
                          <td className="px-3 py-1.5">{d.qty} buc</td>
                          <td className="px-3 py-1.5 text-red-500">{d.from}</td>
                          <td className="px-3 py-1.5 text-green-600 font-medium">{d.to || '—'}</td>
                          <td className="px-3 py-1.5">
                            {d.status === 'moved'
                              ? <span className="text-green-600">Mutat</span>
                              : <span className="text-red-600 font-medium">Fara alternativa!</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-slate-400">Planul de replanificare necesita aprobare in pagina Planificare.</p>
              <button onClick={onClose} className="btn-primary w-full">Inchide</button>
            </div>
          )}

          {canManage && request.status === 'in_progress' && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-slate-500">Descrie ce ai facut pentru a rezolva problema:</p>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Ex: Inlocuit rulment axial SKF 6205. Reglat tensiune curea."
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => update.mutate({ status: 'done', resolution: resolution || 'Rezolvat.' })}
                  disabled={update.isPending}
                  className="btn-primary flex-1"
                >
                  {update.isPending ? 'Se rezolva...' : 'Marcheaza rezolvat'}
                </button>
                <button
                  onClick={() => update.mutate({ status: 'cancelled', resolution: resolution || 'Anulat.' })}
                  disabled={update.isPending}
                  className="btn-secondary flex-1"
                >
                  Anuleaza
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RequestsTab({ data, isLoading, machines, canManage, user }) {
  const [selected, setSelected] = useState(null)
  const machineMap = {}
  ;(machines || []).forEach(m => { machineMap[m.id] = m })

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Utilaj</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Problema</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Prioritate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Preluat de</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(r => {
              const machine = machineMap[r.machine_id]
              return (
                <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">{r.request_number}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-2 py-0.5">{machine?.code || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{r.problem_type}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[r.priority]}`}>
                      {PRIORITY_LABELS[r.priority] || r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{r.assigned_to_name || (r.assigned_to ? 'Da' : '—')}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{r.created_at ? new Date(r.created_at).toLocaleDateString('ro-RO') : ''}</td>
                </tr>
              )
            })}
            {data?.data?.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nicio cerere.</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && (
        <RequestDetailModal
          request={selected}
          machines={machines}
          canManage={canManage}
          user={user}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

export default function MaintenancePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [plannedModal, setPlannedModal] = useState(false)
  const [tab, setTab] = useState('requests')
  const canManage = ['admin', 'production_manager', 'maintenance'].includes(user?.role)
  const isMobile = useIsMobile()

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data, isLoading } = useQuery({ queryKey: ['maintenance'], queryFn: () => api.get('/maintenance').then(r => r.data) })

  const { data: planned } = useQuery({
    queryKey: ['maintenance-planned'],
    queryFn: () => api.get('/maintenance/planned').then(r => r.data),
    enabled: tab === 'planned',
  })

  const { data: tenantSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const tenantCurrency = tenantSettings?.default_currency || tenantSettings?.defaultCurrency || 'RON'

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/maintenance/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['maintenance']); toast.success('Actualizat.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const plannedList = planned?.data || planned || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Mentenanta</h2>
        <div className="flex gap-2">
          {tab === 'planned' && canManage && (
            <button onClick={() => setPlannedModal(true)} className="btn-primary flex items-center gap-2">
              <Calendar size={15} /> Programeaza
            </button>
          )}
          {tab === 'requests' && (
            <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={15} /> Cerere noua
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['requests', 'Interventii'], ['planned', 'Planificate']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <RequestsTab data={data} isLoading={isLoading} machines={machines} canManage={canManage} update={update} user={user} />
      )}

      {tab === 'planned' && (
        <>
          {/* FIX-T5.1: On mobile (<768px), show chronological list instead of calendar grid */}
          {isMobile ? (
            <div className="space-y-2">
              {plannedList.length === 0 && <p className="text-slate-400 text-sm">Nicio interventie planificata.</p>}
              {plannedList.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800 text-sm">{p.title || p.description || 'Interventie'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.planned_start_date && new Date(p.planned_start_date).toLocaleDateString('ro-RO')}
                    {p.planned_end_date && ` — ${new Date(p.planned_end_date).toLocaleDateString('ro-RO')}`}
                  </div>
                  {p.machine_name && <div className="text-xs text-slate-400 mt-0.5">{p.machine_name}</div>}
                  {/* FIX-T5.2: Spare parts cost in tenant currency */}
                  {p.spare_parts_cost != null && p.spare_parts_cost > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      Piese: {formatMoney(p.spare_parts_cost, p.currency || tenantCurrency)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Interventie</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Utilaj</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Perioada</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ore</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Executor</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Cost estimat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plannedList.map(p => {
                    const machineInfo = (machines || []).find(m => m.id === p.machine_id);
                    const typeLabels = { preventive: 'Preventiva', corrective: 'Corectiva', predictive: 'Predictiva', calibration: 'Calibrare', inspection: 'Inspectie' };
                    return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="text-slate-800 font-medium">{p.title || 'Interventie'}</div>
                        {p.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-2 py-0.5">{machineInfo?.code || '—'}</span>
                        {machineInfo?.name && <div className="text-xs text-slate-400 mt-0.5">{machineInfo.name}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{typeLabels[p.intervention_type] || p.intervention_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {p.planned_start_date ? new Date(p.planned_start_date).toLocaleDateString('ro-RO') : '—'}
                        {p.planned_end_date && <> — {new Date(p.planned_end_date).toLocaleDateString('ro-RO')}</>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.planned_duration_hours || p.estimated_hours || '—'}{(p.planned_duration_hours || p.estimated_hours) && 'h'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {p.executor_type === 'external' ? (
                          <span className="flex items-center gap-1"><Building2 size={12} className="text-purple-500" /> {p.executor_company_name || 'Firma externa'}</span>
                        ) : (
                          <span className="text-slate-400">Intern</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-500'}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-medium">
                        {p.estimated_cost ? formatMoney(Number(p.estimated_cost), p.currency || tenantCurrency) : '—'}
                      </td>
                    </tr>
                    );
                  })}
                  {plannedList.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nicio interventie planificata.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && <NewRequestModal machines={machines} onClose={() => setModal(false)} />}
      {plannedModal && <PlannedModal machines={machines} onClose={() => setPlannedModal(false)} />}
    </div>
  )
}
