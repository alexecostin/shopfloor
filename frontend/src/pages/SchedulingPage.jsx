import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Zap, Play, Eye, CheckCircle, Star, BarChart3, Calendar, Settings, FlaskConical, X } from 'lucide-react'

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
      priorities: form.priorities,
      constraints: form.constraints,
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
  const [genForm, setGenForm] = useState({ configId: '', masterPlanId: '' })
  const [selectedRun, setSelectedRun] = useState(null)

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['scheduling-runs'],
    queryFn: () => api.get('/scheduling/runs').then(r => r.data),
  })

  const { data: configs = [] } = useQuery({
    queryKey: ['scheduling-configs'],
    queryFn: () => api.get('/scheduling/configs').then(r => r.data),
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
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Master Plan ID *</label>
                <input className="input" placeholder="ID-ul planului principal" value={genForm.masterPlanId} onChange={e => setGenForm({ ...genForm, masterPlanId: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowGenerate(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => generateMut.mutate(genForm)} disabled={!genForm.configId || !genForm.masterPlanId || generateMut.isPending} className="btn-primary">
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

// --------------- Tab 3: Simulari ---------------
function SimulationsTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [simForm, setSimForm] = useState({ name: '', description: '', scenario_params: '' })
  const [selectedSim, setSelectedSim] = useState(null)

  const { data: simulations = [], isLoading } = useQuery({
    queryKey: ['scheduling-simulations'],
    queryFn: () => api.get('/scheduling/simulations').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: data => api.post('/scheduling/simulations', data),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); setShowCreate(false); setSimForm({ name: '', description: '', scenario_params: '' }); toast.success('Simulare creata.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/scheduling/simulations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); setSelectedSim(null); toast.success('Simulare stearsa.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const applyMut = useMutation({
    mutationFn: id => api.post(`/scheduling/simulations/${id}/apply`),
    onSuccess: () => { qc.invalidateQueries(['scheduling-simulations']); toast.success('Simulare aplicata cu succes!') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

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
              <div className="font-medium text-slate-800">{sim.name}</div>
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
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">Nicio simulare. Creeaza una pentru a testa scenarii.</div>
        )}
      </div>

      {/* Create simulation modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Simulare noua</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nume *</label>
                <input className="input" value={simForm.name} onChange={e => setSimForm({ ...simForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
                <textarea className="input" rows={2} value={simForm.description} onChange={e => setSimForm({ ...simForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Parametri scenariu (JSON)</label>
                <textarea className="input font-mono text-xs" rows={4} placeholder='{"capacity_factor": 1.2, "priority": "deadline"}' value={simForm.scenario_params} onChange={e => setSimForm({ ...simForm, scenario_params: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => {
                const payload = { ...simForm }
                if (simForm.scenario_params) {
                  try { payload.scenario_params = JSON.parse(simForm.scenario_params) } catch { /* send as string */ }
                }
                createMut.mutate(payload)
              }} disabled={!simForm.name || createMut.isPending} className="btn-primary">
                {createMut.isPending ? 'Se creeaza...' : 'Creeaza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation detail modal */}
      {selectedSim && <SimulationDetailModal sim={selectedSim} onClose={() => setSelectedSim(null)} onApply={id => applyMut.mutate(id)} onDelete={id => deleteMut.mutate(id)} applyPending={applyMut.isPending} />}
    </div>
  )
}

function SimulationDetailModal({ sim, onClose, onApply, onDelete, applyPending }) {
  const { data: detail } = useQuery({
    queryKey: ['scheduling-simulation', sim.id],
    queryFn: () => api.get(`/scheduling/simulations/${sim.id}`).then(r => r.data),
  })

  const { data: comparison } = useQuery({
    queryKey: ['scheduling-simulation-compare', sim.id],
    queryFn: () => api.get(`/scheduling/simulations/${sim.id}/compare`).then(r => r.data),
  })

  const sd = detail || sim

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="font-semibold text-slate-800">{sd.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 overflow-auto flex-1 space-y-4">
          <div className="text-sm text-slate-600">{sd.description || 'Fara descriere'}</div>

          {sd.scenario_params && (
            <div>
              <div className="text-xs text-slate-500 font-medium mb-1">Parametri scenariu</div>
              <pre className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 overflow-auto">{typeof sd.scenario_params === 'string' ? sd.scenario_params : JSON.stringify(sd.scenario_params, null, 2)}</pre>
            </div>
          )}

          {comparison && (
            <div>
              <div className="text-xs text-slate-500 font-medium mb-2">Comparatie cu planificarea curenta</div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(comparison).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500">{key}</div>
                    <div className="font-medium text-slate-800">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-6 border-t justify-end">
          <button onClick={() => { if (confirm('Stergi simularea?')) onDelete(sim.id) }} className="btn-secondary text-red-600 flex items-center gap-2">
            <Trash2 size={14} /> Sterge
          </button>
          <button onClick={() => onApply(sim.id)} disabled={applyPending} className="btn-primary flex items-center gap-2">
            <CheckCircle size={14} /> {applyPending ? 'Se aplica...' : 'Aplica'}
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
