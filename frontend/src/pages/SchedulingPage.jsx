import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Zap, Play, Eye, CheckCircle, Star, BarChart3, Calendar, Settings, FlaskConical, X } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

// --------------- Gantt helpers ---------------
function GanttBar({ operation, dayStart, totalDays }) {
  const start = new Date(operation.scheduled_start)
  const end = new Date(operation.scheduled_end)
  const dayMs = 86400000
  const leftPct = ((start - dayStart) / (totalDays * dayMs)) * 100
  const widthPct = ((end - start) / (totalDays * dayMs)) * 100
  return (
    <div className="relative h-6 bg-slate-100 rounded" title={`${operation.product_name} — ${operation.machine_code}`}>
      <div
        className="absolute h-full rounded bg-blue-500 text-white text-[10px] flex items-center px-1 overflow-hidden"
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.max(2, widthPct)}%` }}
      >
        {operation.product_name}
      </div>
    </div>
  )
}

function GanttChart({ data = [] }) {
  if (!data.length) return <div className="text-sm text-slate-400 py-4 text-center">Nicio operatie pentru Gantt.</div>
  const allStarts = data.map(o => new Date(o.scheduled_start).getTime())
  const allEnds = data.map(o => new Date(o.scheduled_end).getTime())
  const minDate = new Date(Math.min(...allStarts))
  const maxDate = new Date(Math.max(...allEnds))
  const dayMs = 86400000
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / dayMs))
  const dayStart = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>{dayStart.toLocaleDateString('ro-RO')}</span>
        <span>{new Date(dayStart.getTime() + totalDays * dayMs).toLocaleDateString('ro-RO')}</span>
      </div>
      {data.map((op, i) => (
        <GanttBar key={op.id || i} operation={op} dayStart={dayStart} totalDays={totalDays} />
      ))}
    </div>
  )
}

// --------------- Config form helpers ---------------
const CRITERIA_OPTIONS = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'utilization', label: 'Utilizare masini' },
  { value: 'setup_time', label: 'Timp setup' },
  { value: 'cost', label: 'Cost' },
]

const CONSTRAINT_OPTIONS = [
  { key: 'respect_shifts', label: 'Respecta turele configurate' },
  { key: 'allow_overtime', label: 'Permite overtime' },
  { key: 'respect_dependencies', label: 'Respecta dependinte BOM' },
  { key: 'minimize_changeovers', label: 'Minimizeaza schimbarile' },
  { key: 'allow_weekend', label: 'Permite lucru in weekend' },
]

const DEFAULT_PRIORITIES = [
  { criterion: 'deadline', weight: 40 },
  { criterion: 'utilization', weight: 30 },
  { criterion: 'setup_time', weight: 30 },
]

const DEFAULT_CONSTRAINTS = {
  respect_shifts: true,
  allow_overtime: false,
  respect_dependencies: false,
  minimize_changeovers: false,
  allow_weekend: false,
  max_shifts_per_day: 2,
  overtime_percent: 10,
}

function parsePriorities(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch { /* ignore */ } }
  return [...DEFAULT_PRIORITIES]
}

function parseConstraints(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw === 'string') { try { const c = JSON.parse(raw); if (c && typeof c === 'object') return c } catch { /* ignore */ } }
  return { ...DEFAULT_CONSTRAINTS }
}

// --------------- Tab 1: Configurari ---------------
function ConfigsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', priorities: [...DEFAULT_PRIORITIES], constraints: { ...DEFAULT_CONSTRAINTS } })

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['scheduling-configs'],
    queryFn: () => api.get('/scheduling/configs').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: data => api.post('/scheduling/configs', data),
    onSuccess: () => { qc.invalidateQueries(['scheduling-configs']); closeForm(); toast.success('Configuratie creata.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/scheduling/configs/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['scheduling-configs']); closeForm(); toast.success('Configuratie actualizata.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/scheduling/configs/${id}`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-configs']); toast.success('Sters.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const setDefaultMut = useMutation({
    mutationFn: id => api.put(`/scheduling/configs/${id}/set-default`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-configs']); toast.success('Setat ca implicit.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  function closeForm() { setShowForm(false); setEditing(null); setForm({ name: '', description: '', priorities: [...DEFAULT_PRIORITIES], constraints: { ...DEFAULT_CONSTRAINTS } }) }
  function openEdit(cfg) {
    setEditing(cfg)
    setForm({
      name: cfg.name || '',
      description: cfg.description || '',
      priorities: parsePriorities(cfg.priorities),
      constraints: parseConstraints(cfg.constraints),
    })
    setShowForm(true)
  }

  // Priorities helpers
  const weightsSum = form.priorities.reduce((s, p) => s + (Number(p.weight) || 0), 0)
  function setPriority(idx, key, val) {
    const next = [...form.priorities]
    next[idx] = { ...next[idx], [key]: key === 'weight' ? Number(val) || 0 : val }
    setForm({ ...form, priorities: next })
  }
  function addPriority() {
    const used = new Set(form.priorities.map(p => p.criterion))
    const available = CRITERIA_OPTIONS.find(c => !used.has(c.value))
    if (available) setForm({ ...form, priorities: [...form.priorities, { criterion: available.value, weight: 0 }] })
  }
  function removePriority(idx) {
    setForm({ ...form, priorities: form.priorities.filter((_, i) => i !== idx) })
  }
  function toggleConstraint(key) {
    setForm({ ...form, constraints: { ...form.constraints, [key]: !form.constraints[key] } })
  }

  function handleSave() {
    const payload = {
      name: form.name,
      description: form.description,
      priorities: typeof form.priorities === 'string' ? form.priorities : JSON.stringify(form.priorities),
      constraints: typeof form.constraints === 'string' ? form.constraints : JSON.stringify(form.constraints),
    }
    if (editing) updateMut.mutate({ id: editing.id, ...payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { closeForm(); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={14} /> Configuratie noua</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Prioritati</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Descriere</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Implicit</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {configs.map(cfg => (
              <tr key={cfg.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{cfg.name}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate text-xs">{Array.isArray(cfg.priorities) ? cfg.priorities.map(p => `${p.criterion}:${p.weight}%`).join(', ') : '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{cfg.description || '—'}</td>
                <td className="px-4 py-3">
                  {cfg.is_default
                    ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Implicit</span>
                    : <button onClick={() => setDefaultMut.mutate(cfg.id)} className="text-xs text-slate-400 hover:text-amber-600 flex items-center gap-1"><Star size={12} /> Seteaza implicit</button>
                  }
                </td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => openEdit(cfg)} className="text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                  <button onClick={() => { if (confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteMut.mutate(cfg.id) }} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!isLoading && configs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio configuratie. Creeaza prima configuratie de planificare.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">{editing ? 'Editeaza configuratie' : 'Configuratie noua'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nume *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              {/* Priorities — dynamic rows with dropdowns */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Prioritati</label>
                <div className="space-y-2">
                  {form.priorities.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        className="input flex-1"
                        value={p.criterion}
                        onChange={e => setPriority(idx, 'criterion', e.target.value)}
                      >
                        {CRITERIA_OPTIONS.map(c => (
                          <option key={c.value} value={c.value} disabled={c.value !== p.criterion && form.priorities.some(pp => pp.criterion === c.value)}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <div className="relative w-24 flex-shrink-0">
                        <input
                          className="input pr-6 text-right"
                          type="number"
                          min="0"
                          max="100"
                          value={p.weight}
                          onChange={e => setPriority(idx, 'weight', e.target.value)}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                      <button
                        onClick={() => removePriority(idx)}
                        className="text-slate-300 hover:text-red-400 p-1"
                        title="Sterge criteriu"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {form.priorities.length < CRITERIA_OPTIONS.length && (
                  <button onClick={addPriority} className="text-xs text-blue-500 hover:text-blue-700 mt-2 flex items-center gap-1">
                    <Plus size={12} /> Adauga criteriu
                  </button>
                )}
                <p className={`text-[10px] mt-1 ${weightsSum === 100 ? 'text-green-600' : 'text-red-500'}`}>
                  Total ponderi: {weightsSum}% {weightsSum !== 100 && '(trebuie sa fie 100%)'}
                </p>
              </div>

              {/* Constraints — checkboxes */}
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Constrangeri</label>
                <div className="space-y-2">
                  {CONSTRAINT_OPTIONS.map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!form.constraints[opt.key]}
                        onChange={() => toggleConstraint(opt.key)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Nr. schimburi / zi</label>
                    <select className="input" value={form.constraints.max_shifts_per_day || 2}
                      onChange={e => setForm({ ...form, constraints: { ...form.constraints, max_shifts_per_day: Number(e.target.value) } })}>
                      <option value={1}>1 schimb</option>
                      <option value={2}>2 schimburi</option>
                      <option value={3}>3 schimburi</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Overtime permis (%)</label>
                    <input type="number" className="input" min="0" max="100" step="0.5"
                      value={form.constraints.overtime_percent ?? 10}
                      onChange={e => setForm({ ...form, constraints: { ...form.constraints, overtime_percent: Number(e.target.value) } })}
                      placeholder="Ex: 7.5, 12" />
                    <p className="text-[10px] text-slate-400 mt-0.5">Ore suplimentare peste programul normal</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={closeForm} className="btn-secondary">Anuleaza</button>
              <button onClick={handleSave} disabled={!form.name || weightsSum !== 100 || createMut.isPending || updateMut.isPending} className="btn-primary">
                {(createMut.isPending || updateMut.isPending) ? 'Se salveaza...' : 'Salveaza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --------------- Tab 2: Executii (Runs) ---------------
function RunsTab() {
  const qc = useQueryClient()
  const [showGenerate, setShowGenerate] = useState(false)
  const [genForm, setGenForm] = useState({ configId: '', masterPlanId: '', periodStart: new Date().toISOString().split('T')[0], periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] })
  const [selectedRun, setSelectedRun] = useState(null)

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['scheduling-runs'],
    queryFn: () => api.get('/scheduling/runs').then(r => r.data),
  })

  const { data: configs = [] } = useQuery({
    queryKey: ['scheduling-configs'],
    queryFn: () => api.get('/scheduling/configs').then(r => r.data),
  })

  const { data: masterPlans = [] } = useQuery({
    queryKey: ['master-plans-for-scheduling'],
    queryFn: () => api.get('/planning/master-plans', { params: { limit: 100 } }).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d?.data || [])
    }),
  })

  const generateMut = useMutation({
    mutationFn: data => api.post('/scheduling/generate', data),
    onSuccess: () => { qc.invalidateQueries(['scheduling-runs']); setShowGenerate(false); toast.success('Planificare generata cu succes.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la generare'),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/scheduling/runs/${id}`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-runs']); setSelectedRun(null); toast.success('Executie stearsa.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const applyMut = useMutation({
    mutationFn: id => api.post(`/scheduling/runs/${id}/apply`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-runs']); toast.success('Planificare aplicata cu succes!') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const statusColor = {
    completed: 'bg-green-100 text-green-700',
    running: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    applied: 'bg-purple-100 text-purple-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowGenerate(true)} className="btn-primary flex items-center gap-2"><Play size={14} /> Genereaza Planificare</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Configuratie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Operatii</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Durata (s)</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {runs.map(run => (
              <tr key={run.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedRun(run)}>
                <td className="px-4 py-3 text-slate-700">{new Date(run.created_at).toLocaleString('ro-RO')}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{run.config_name || run.config_id}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[run.status] || 'bg-slate-100 text-slate-600'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{run.total_operations ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{run.duration_seconds ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={e => { e.stopPropagation(); setSelectedRun(run) }} className="text-slate-400 hover:text-blue-500"><Eye size={14} /></button>
                </td>
              </tr>
            ))}
            {!isLoading && runs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio executie. Genereaza prima planificare.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Generate modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Genereaza Planificare</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Configuratie *</label>
                <select className="input" value={genForm.configId} onChange={e => setGenForm({ ...genForm, configId: e.target.value })}>
                  <option value="">Selecteaza...</option>
                  {configs.map(c => <option key={c.id} value={c.id}>{c.name} {c.is_default ? '(implicit)' : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Data start *</label>
                  <input type="date" className="input" value={genForm.periodStart || ''} onChange={e => setGenForm({ ...genForm, periodStart: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Data sfarsit *</label>
                  <input type="date" className="input" value={genForm.periodEnd || ''} onChange={e => setGenForm({ ...genForm, periodEnd: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Master Plan (optional)</label>
                <select className="input" value={genForm.masterPlanId} onChange={e => setGenForm({ ...genForm, masterPlanId: e.target.value })}>
                  <option value="">Fara plan master (genereaza automat)</option>
                  {masterPlans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.start_date?.split('T')[0]} - {p.end_date?.split('T')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowGenerate(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => generateMut.mutate({ ...genForm, masterPlanId: genForm.masterPlanId || undefined })} disabled={!genForm.configId || !genForm.periodStart || !genForm.periodEnd || generateMut.isPending} className="btn-primary">
                {generateMut.isPending ? 'Se genereaza...' : 'Genereaza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run detail modal */}
      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} onDelete={id => deleteMut.mutate(id)} onApply={id => applyMut.mutate(id)} applyPending={applyMut.isPending} />}
    </div>
  )
}

function RunDetailModal({ run, onClose, onDelete, onApply, applyPending }) {
  const [detailTab, setDetailTab] = useState('summary')

  const { data: detail } = useQuery({
    queryKey: ['scheduling-run', run.id],
    queryFn: () => api.get(`/scheduling/runs/${run.id}`).then(r => r.data),
  })

  const { data: operations = [] } = useQuery({
    queryKey: ['scheduling-run-ops', run.id],
    queryFn: () => api.get(`/scheduling/runs/${run.id}/operations`).then(r => r.data),
    enabled: detailTab === 'operations' || detailTab === 'gantt',
  })

  const { data: ganttData = [] } = useQuery({
    queryKey: ['scheduling-run-gantt', run.id],
    queryFn: () => api.get(`/scheduling/runs/${run.id}/gantt`).then(r => r.data),
    enabled: detailTab === 'gantt',
  })

  const rd = detail || run

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="font-semibold text-slate-800">Detalii executie — {new Date(rd.created_at).toLocaleString('ro-RO')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mx-6 mt-4">
          {[
            { id: 'summary', label: 'Sumar' },
            { id: 'operations', label: 'Operatii' },
            { id: 'gantt', label: 'Gantt' },
          ].map(t => (
            <button key={t.id} onClick={() => setDetailTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${detailTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-auto flex-1">
          {detailTab === 'summary' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Status</div>
                <div className="font-medium text-slate-800">{rd.status}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Configuratie</div>
                <div className="font-medium text-slate-800">{rd.config_name || rd.config_id}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Total operatii</div>
                <div className="font-medium text-slate-800">{rd.total_operations ?? '—'}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Durata generare</div>
                <div className="font-medium text-slate-800">{rd.duration_seconds ?? '—'}s</div>
              </div>
              {rd.efficiency && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Eficienta</div>
                  <div className="font-medium text-slate-800">{rd.efficiency}%</div>
                </div>
              )}
              {rd.makespan && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Makespan</div>
                  <div className="font-medium text-slate-800">{rd.makespan}</div>
                </div>
              )}
            </div>
          )}

          {detailTab === 'operations' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Start</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">End</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Durata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operations.map((op, i) => (
                    <tr key={op.id || i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{op.product_name || op.product_id}</td>
                      <td className="px-4 py-3 text-slate-700 font-mono">{op.machine_code || op.machine_id}</td>
                      <td className="px-4 py-3 text-slate-500">{op.scheduled_start ? new Date(op.scheduled_start).toLocaleString('ro-RO') : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{op.scheduled_end ? new Date(op.scheduled_end).toLocaleString('ro-RO') : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{op.duration_minutes ? `${op.duration_minutes} min` : '—'}</td>
                    </tr>
                  ))}
                  {operations.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio operatie.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {detailTab === 'gantt' && (
            <GanttChart data={ganttData.length ? ganttData : operations} />
          )}
        </div>

        <div className="flex gap-2 p-6 border-t justify-end">
          <button onClick={() => { if (confirm('Stergi aceasta executie?')) onDelete(run.id) }} className="btn-secondary text-red-600 flex items-center gap-2">
            <Trash2 size={14} /> Sterge
          </button>
          {run.status === 'completed' && (
            <button onClick={() => onApply(run.id)} disabled={applyPending} className="btn-primary flex items-center gap-2">
              <CheckCircle size={14} /> {applyPending ? 'Se aplica...' : 'Aplica in Plan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --------------- Tab 3: Simulari (Redesigned Wizard) ---------------
const SCENARIO_TYPES = [
  { value: 'machine_down', label: 'Masina indisponibila' },
  { value: 'urgent_order', label: 'Comanda urgenta noua' },
  { value: 'constraint_change', label: 'Schimbare constrangeri' },
  { value: 'custom', label: 'Custom' },
]

function SimulationsTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedSim, setSelectedSim] = useState(null)

  const { data: simulations = [], isLoading } = useQuery({
    queryKey: ['scheduling-simulations'],
    queryFn: () => api.get('/scheduling/simulations').then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/scheduling/simulations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); setSelectedSim(null); toast.success('Simulare stearsa.') },
    onError: (e) => { toast.error(e.response?.data?.message || 'A aparut o eroare. Incercati din nou.') },
  })

  const applyMut = useMutation({
    mutationFn: id => api.post(`/scheduling/simulations/${id}/apply`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); toast.success('Simulare aplicata cu succes!') },
    onError: (e) => { toast.error(e.response?.data?.message || 'A aparut o eroare. Incercati din nou.') },
  })

  const statusColor = {
    completed: 'bg-green-100 text-green-700',
    running: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    applied: 'bg-purple-100 text-purple-700',
    pending: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Simulare noua</button>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="text-slate-400 text-sm">Se incarca...</div>}
        {simulations.map(sim => (
          <div key={sim.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setSelectedSim(sim)}>
            <FlaskConical size={18} className="text-purple-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{sim.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[sim.status] || 'bg-slate-100 text-slate-600'}`}>
                  {sim.status || 'draft'}
                </span>
              </div>
              <div className="text-sm text-slate-500 truncate">{sim.description || 'Fara descriere'}</div>
              <div className="text-xs text-slate-400 mt-1">{sim.created_at ? new Date(sim.created_at).toLocaleString('ro-RO') : ''}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={e => { e.stopPropagation(); if (confirm('Aplici simularea?')) applyMut.mutate(sim.id) }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Aplica</button>
              <button onClick={e => { e.stopPropagation(); if (confirm('Stergi simularea?')) deleteMut.mutate(sim.id) }} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {!isLoading && simulations.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Nicio simulare. Creeaza una pentru a testa scenarii what-if.</div>
        )}
      </div>

      {showCreate && <SimulationWizard onClose={() => { setShowCreate(false); qc.invalidateQueries(['scheduling-simulations']) }} />}
      {selectedSim && <SimulationDetailModal sim={selectedSim} onClose={() => setSelectedSim(null)} onApply={id => applyMut.mutate(id)} onDelete={id => deleteMut.mutate(id)} applyPending={applyMut.isPending} />}
    </div>
  )
}

// --------------- Simulation Wizard (3-step) ---------------
function SimulationWizard({ onClose }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', description: '', scenarioType: 'machine_down',
    disabledMachines: [],
    urgentProduct: '', urgentQuantity: '', urgentDeadline: '',
    shifts: 2, allowOvertime: false, allowWeekend: false,
    customDescription: '',
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  })
  const [simResult, setSimResult] = useState(null)
  const [createdSimId, setCreatedSimId] = useState(null)

  const { data: machinesData } = useQuery({
    queryKey: ['scheduling-machines-list'],
    queryFn: () => api.get('/machines', { params: { limit: 500 } }).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data || [])
    }),
  })

  const { data: productsData } = useQuery({
    queryKey: ['sim-products-list'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d?.data || [])
    }),
    enabled: form.scenarioType === 'urgent_order',
  })

  const machinesList = machinesData || []
  const productsList = productsData || []

  const createAndRunMut = useMutation({
    mutationFn: data => api.post('/scheduling/simulations', data),
    onSuccess: (res) => {
      const sim = res.data
      const simId = sim?.id || sim?.data?.id
      setCreatedSimId(simId)
      if (simId) {
        fetchSimResult(simId)
      } else {
        setSimResult({ detail: sim, compare: null })
      }
      qc.invalidateQueries(['scheduling-simulations'])
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Eroare la crearea simularii.')
    },
  })

  const applyMut = useMutation({
    mutationFn: id => api.post(`/scheduling/simulations/${id}/apply`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); toast.success('Plan simulat aplicat cu succes!'); onClose() },
    onError: (e) => { toast.error(e.response?.data?.message || 'Eroare la aplicare.') },
  })

  async function fetchSimResult(simId) {
    try {
      const [detailRes, compareRes] = await Promise.allSettled([
        api.get(`/scheduling/simulations/${simId}`),
        api.get(`/scheduling/simulations/${simId}/compare`),
      ])
      const detail = detailRes.status === 'fulfilled' ? detailRes.value.data : null
      const compare = compareRes.status === 'fulfilled' ? compareRes.value.data : null
      setSimResult({ detail, compare })
    } catch {
      setSimResult({ detail: null, compare: null })
    }
  }

  function buildPayload() {
    const constraintsModified = {}
    if (form.scenarioType === 'machine_down') {
      constraintsModified.disabled_machines = form.disabledMachines
    } else if (form.scenarioType === 'urgent_order') {
      constraintsModified.urgent_order = {
        product: form.urgentProduct,
        quantity: Number(form.urgentQuantity) || 0,
        deadline: form.urgentDeadline,
      }
    } else if (form.scenarioType === 'constraint_change') {
      constraintsModified.shifts = form.shifts
      constraintsModified.allow_overtime = form.allowOvertime
      constraintsModified.allow_weekend = form.allowWeekend
    } else {
      constraintsModified.custom = form.customDescription
    }
    return {
      name: form.name,
      description: form.description,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      constraintsModified,
    }
  }

  function handleRun() {
    if (!form.periodStart || !form.periodEnd) { toast.error('Perioada este obligatorie.'); return }
    if (!form.name) { toast.error('Numele simularii este obligatoriu.'); return }
    createAndRunMut.mutate(buildPayload())
  }

  const canGoStep2 = form.name && form.scenarioType
  const canRunSim = form.periodStart && form.periodEnd

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header with steps */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Simulare noua</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="flex gap-2">
            {[
              { n: 1, label: 'Definire scenariu' },
              { n: 2, label: 'Configurare' },
              { n: 3, label: 'Rezultat' },
            ].map(s => (
              <div key={s.n} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === s.n ? 'bg-blue-100 text-blue-700' : step > s.n ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.n ? 'bg-blue-600 text-white' : step > s.n ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'}`}>{step > s.n ? '\u2713' : s.n}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto flex-1">
          {/* Step 1: Definire scenariu */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nume simulare *</label>
                <input className="input" placeholder="Ex: Test masina CNC oprita" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
                <textarea className="input" rows={2} placeholder="Ce doriti sa aflati din aceasta simulare?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tip scenariu *</label>
                <select className="input" value={form.scenarioType} onChange={e => setForm({ ...form, scenarioType: e.target.value })}>
                  {SCENARIO_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {form.scenarioType === 'machine_down' && 'Ce se intampla daca una sau mai multe masini se strica?'}
                  {form.scenarioType === 'urgent_order' && 'Ce se intampla daca vine o comanda urgenta?'}
                  {form.scenarioType === 'constraint_change' && 'Ce se intampla daca modificam turele sau permitem overtime/weekend?'}
                  {form.scenarioType === 'custom' && 'Scenariu personalizat cu descriere libera.'}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Configurare */}
          {step === 2 && (
            <div className="space-y-4">
              {form.scenarioType === 'machine_down' && (
                <div>
                  <label className="text-xs text-slate-500 mb-2 block">Selecteaza masinile indisponibile</label>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {machinesList.map(m => (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-slate-50 px-2 py-1 rounded">
                        <input type="checkbox" checked={form.disabledMachines.includes(m.id)}
                          onChange={e => {
                            const checked = e.target.checked
                            setForm(f => ({ ...f, disabledMachines: checked ? [...f.disabledMachines, m.id] : f.disabledMachines.filter(id => id !== m.id) }))
                          }}
                          className="rounded border-slate-300 text-red-600" />
                        <span className="text-slate-700">{m.code ? `${m.code} - ` : ''}{m.name}</span>
                      </label>
                    ))}
                    {machinesList.length === 0 && <p className="text-xs text-slate-400 py-2">Nicio masina disponibila.</p>}
                  </div>
                  {form.disabledMachines.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">{form.disabledMachines.length} masina(i) selectata(e) ca indisponibila(e)</p>
                  )}
                </div>
              )}

              {form.scenarioType === 'urgent_order' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Produs *</label>
                    <select className="input" value={form.urgentProduct} onChange={e => setForm({ ...form, urgentProduct: e.target.value })}>
                      <option value="">Selecteaza produs...</option>
                      {productsList.map(p => <option key={p.id} value={p.code || p.name}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Cantitate *</label>
                    <input type="number" className="input" min="1" placeholder="Ex: 500" value={form.urgentQuantity} onChange={e => setForm({ ...form, urgentQuantity: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Deadline *</label>
                    <input type="date" className="input" value={form.urgentDeadline} onChange={e => setForm({ ...form, urgentDeadline: e.target.value })} />
                  </div>
                </div>
              )}

              {form.scenarioType === 'constraint_change' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Numar schimburi / zi</label>
                    <select className="input w-40" value={form.shifts} onChange={e => setForm({ ...form, shifts: Number(e.target.value) })}>
                      <option value={1}>1 schimb</option>
                      <option value={2}>2 schimburi</option>
                      <option value={3}>3 schimburi</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allowOvertime} onChange={e => setForm({ ...form, allowOvertime: e.target.checked })} className="rounded border-slate-300 text-blue-600" />
                    <span className="text-sm text-slate-700">Permite overtime</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allowWeekend} onChange={e => setForm({ ...form, allowWeekend: e.target.checked })} className="rounded border-slate-300 text-blue-600" />
                    <span className="text-sm text-slate-700">Permite lucru in weekend</span>
                  </label>
                </div>
              )}

              {form.scenarioType === 'custom' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Descriere scenariu custom</label>
                  <textarea className="input" rows={4} placeholder="Descrieti scenariul in detaliu..." value={form.customDescription} onChange={e => setForm({ ...form, customDescription: e.target.value })} />
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="text-xs text-slate-500 font-medium mb-2 block">Perioada simulare *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Data start</label>
                    <input type="date" className="input" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Data sfarsit</label>
                    <input type="date" className="input" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
                  </div>
                </div>
                {(!form.periodStart || !form.periodEnd) && (
                  <p className="text-xs text-amber-600 mt-1">Perioada este obligatorie.</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Rezultat */}
          {step === 3 && (
            <div className="space-y-4">
              {createAndRunMut.isPending && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Se ruleaza simularea...</p>
                  <p className="text-xs text-slate-400 mt-1">Se calculeaza impactul asupra planificarii</p>
                </div>
              )}

              {createAndRunMut.isError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-red-700 font-medium">Eroare la rularea simularii</p>
                  <p className="text-xs text-red-500 mt-1">{createAndRunMut.error?.response?.data?.message || 'Incercati din nou.'}</p>
                  <button onClick={handleRun} className="btn-secondary mt-3 text-sm">Reincearca</button>
                </div>
              )}

              {simResult && !createAndRunMut.isPending && (
                <SimulationResultView result={simResult} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t justify-between">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <div className="flex gap-2">
            {step > 1 && step < 3 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-secondary">Inapoi</button>
            )}
            {step === 1 && (
              <button onClick={() => setStep(2)} disabled={!canGoStep2} className="btn-primary">Urmatorul pas</button>
            )}
            {step === 2 && (
              <button onClick={() => { setStep(3); handleRun() }} disabled={!canRunSim || createAndRunMut.isPending} className="btn-primary flex items-center gap-2">
                <Zap size={14} /> Ruleaza simulare
              </button>
            )}
            {step === 3 && simResult && createdSimId && !createAndRunMut.isPending && (
              <button onClick={() => applyMut.mutate(createdSimId)} disabled={applyMut.isPending} className="btn-primary flex items-center gap-2">
                <CheckCircle size={14} /> {applyMut.isPending ? 'Se aplica...' : 'Aplica planul simulat'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --------------- Simulation Result View ---------------
function SimulationResultView({ result }) {
  const { detail, compare } = result || {}
  const orders = compare?.orders || compare?.impacted_orders || compare?.data?.orders || []
  const machineLoad = compare?.machine_load || compare?.machineLoad || compare?.data?.machine_load || []
  const summary = compare?.summary || compare?.data?.summary || null

  const delayedCount = orders.filter(o => (o.delay_days || o.delayDays || 0) > 0).length
  const avgLoad = machineLoad.length > 0 ? Math.round(machineLoad.reduce((s, m) => s + (m.load_after || m.load_simulation || m.load || 0), 0) / machineLoad.length) : null
  const avgLoadBefore = machineLoad.length > 0 ? Math.round(machineLoad.reduce((s, m) => s + (m.load_before || m.load_base || m.load_current || 0), 0) / machineLoad.length) : null

  const hasCompareData = orders.length > 0 || machineLoad.length > 0 || summary

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-500 mb-1">Comenzi analizate</p>
          <p className="text-xl font-bold text-blue-700">{orders.length || (detail?.total_orders ?? '-')}</p>
        </div>
        <div className={`${delayedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-xl p-4 text-center`}>
          <p className={`text-xs ${delayedCount > 0 ? 'text-red-500' : 'text-green-500'} mb-1`}>Comenzi intarziate</p>
          <p className={`text-xl font-bold ${delayedCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{delayedCount}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-xs text-purple-500 mb-1">Incarcare medie</p>
          <p className="text-xl font-bold text-purple-700">{avgLoad != null ? `${avgLoad}%` : '-'}</p>
          {avgLoadBefore != null && avgLoad != null && (
            <p className="text-[10px] text-slate-400">{avgLoadBefore}% {'\u2192'} {avgLoad}%</p>
          )}
        </div>
      </div>

      {summary && typeof summary === 'string' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">{summary}</div>
      )}
      {summary && typeof summary === 'object' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          {summary.message || summary.text || Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(' | ')}
        </div>
      )}

      {!hasCompareData && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-sm">
          Simulare fara date de comparatie. Serverul nu a returnat date de impact.
        </div>
      )}

      {/* Impact comenzi table */}
      {orders.length > 0 && (
        <div>
          <h4 className="text-xs text-slate-500 font-medium mb-2">Impact comenzi</h4>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Comanda</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Produs</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Deadline</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Estimare noua</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Intarziere (zile)</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o, i) => {
                  const delay = o.delay_days || o.delayDays || 0
                  const isLate = delay > 0
                  return (
                    <tr key={o.id || i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-800">{o.order_number || o.orderNumber || o.order || `#${o.id || i + 1}`}</td>
                      <td className="px-4 py-2 text-slate-600">{o.product || o.product_name || o.productName || '-'}</td>
                      <td className="px-4 py-2 text-slate-500">{o.deadline ? new Date(o.deadline).toLocaleDateString('ro-RO') : '-'}</td>
                      <td className="px-4 py-2 text-slate-500">{(o.new_estimate || o.newEstimate || o.estimated_end) ? new Date(o.new_estimate || o.newEstimate || o.estimated_end).toLocaleDateString('ro-RO') : '-'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${isLate ? 'text-red-600' : 'text-green-600'}`}>{delay > 0 ? `+${delay}` : delay}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {isLate ? 'intarziat' : 'la timp'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Machine load comparison */}
      {machineLoad.length > 0 && (
        <div>
          <h4 className="text-xs text-slate-500 font-medium mb-2">Incarcare masini (inainte vs. dupa)</h4>
          <div className="space-y-2">
            {machineLoad.map((m, i) => {
              const before = m.load_before || m.load_base || m.load_current || 0
              const after = m.load_after || m.load_simulation || m.load || 0
              return (
                <div key={m.machine || m.machine_code || i} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{m.machine || m.machine_code || m.machine_name || `Masina ${i + 1}`}</span>
                    <span className="text-xs text-slate-400">{before}% {'\u2192'} {after}%</span>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div className="flex-1 bg-slate-200 rounded overflow-hidden" title={`Inainte: ${before}%`}>
                      <div className="h-full bg-blue-400 rounded" style={{ width: `${Math.min(100, before)}%` }} />
                    </div>
                    <div className="flex-1 bg-slate-200 rounded overflow-hidden" title={`Dupa: ${after}%`}>
                      <div className={`h-full rounded ${after > 90 ? 'bg-red-400' : after > 75 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, after)}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Inainte</span>
                    <span>Dupa simulare</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// --------------- Simulation Detail Modal ---------------
function SimulationDetailModal({ sim, onClose, onApply, onDelete, applyPending }) {
  const { data: detail } = useQuery({
    queryKey: ['scheduling-simulation', sim.id],
    queryFn: () => api.get(`/scheduling/simulations/${sim.id}`).then(r => r.data),
  })

  const { data: comparison, isLoading: compareLoading } = useQuery({
    queryKey: ['scheduling-simulation-compare', sim.id],
    queryFn: () => api.get(`/scheduling/simulations/${sim.id}/compare`).then(r => r.data),
  })

  const sd = detail || sim

  const params = sd.scenario_params
    ? (typeof sd.scenario_params === 'string' ? (() => { try { return JSON.parse(sd.scenario_params) } catch { return null } })() : sd.scenario_params)
    : (sd.constraintsModified
      ? (typeof sd.constraintsModified === 'string' ? (() => { try { return JSON.parse(sd.constraintsModified) } catch { return null } })() : sd.constraintsModified)
      : null)

  const DETAIL_LABELS = {
    disabled_machines: 'Masini dezactivate',
    urgent_order: 'Comanda urgenta',
    urgent_orders: 'Comenzi urgente',
    allow_overtime: 'Overtime permis',
    allow_weekend: 'Weekend permis',
    shifts: 'Schimburi / zi',
    custom: 'Scenariu custom',
  }

  function fmtVal(val) {
    if (val === true) return 'Da'
    if (val === false) return 'Nu'
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'Niciunul'
    if (val === null || val === undefined || val === '') return '-'
    if (typeof val === 'object') {
      const entries = Object.entries(val)
      if (entries.length === 0) return '-'
      return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ')
    }
    return String(val)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="font-semibold text-slate-800">{sd.name}</h3>
            {sd.created_at && <p className="text-xs text-slate-400 mt-0.5">{new Date(sd.created_at).toLocaleString('ro-RO')}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 overflow-auto flex-1 space-y-4">
          <div className="text-sm text-slate-600">{sd.description || 'Fara descriere'}</div>

          {params && typeof params === 'object' && Object.keys(params).length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 font-medium mb-2">Parametri scenariu</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(params).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">{DETAIL_LABELS[key] || key}</div>
                    <div className="font-medium text-slate-800 text-sm">{fmtVal(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {compareLoading && <p className="text-slate-400 text-sm">Se incarca datele de comparatie...</p>}

          {!compareLoading && comparison && (
            <SimulationResultView result={{ detail, compare: comparison }} />
          )}

          {!compareLoading && !comparison && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-sm">
              Simulare fara date de comparatie.
            </div>
          )}
        </div>

        <div className="flex gap-2 p-6 border-t justify-end">
          <button onClick={() => { if (confirm('Stergi simularea?')) onDelete(sim.id) }} className="btn-secondary text-red-600 flex items-center gap-2">
            <Trash2 size={14} /> Sterge
          </button>
          <button onClick={() => onApply(sim.id)} disabled={applyPending} className="btn-primary flex items-center gap-2">
            <CheckCircle size={14} /> {applyPending ? 'Se aplica...' : 'Aplica planul simulat'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------- Main Page ---------------
export default function SchedulingPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('configs')

  const tabs = [
    { id: 'configs', label: 'Configurari', icon: Settings },
    { id: 'runs', label: 'Executii', icon: BarChart3 },
    { id: 'simulations', label: 'Simulari', icon: FlaskConical },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Planificare Automata</h2>
        <p className="text-sm text-slate-500">Configurare algoritmi, generare planificari si simulari de scenarii.</p>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'configs' && <ConfigsTab />}
      {tab === 'runs' && <RunsTab />}
      {tab === 'simulations' && <SimulationsTab />}
    </div>
  )
}
