import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronRight, Cpu, Layers, Wrench, Clock, Euro, UserPlus, UserMinus, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { useLookup } from '../hooks/useLookup'

function LookupSelect({ lookupType, value, onChange, placeholder }) {
  const { values } = useLookup(lookupType)
  return (
    <select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder || 'Selecteaza...'}</option>
      {values.map(v => <option key={v.code} value={v.code}>{v.displayName}</option>)}
    </select>
  )
}

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-slate-100 text-slate-500',
}

// ─── Modal adauga/editeaza utilaj ────────────────────────────────────────────

function MachineModal({ machine, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!machine?.id
  const [form, setForm] = useState({
    code: machine?.code ?? '', name: machine?.name ?? '',
    type: machine?.type ?? '', location: machine?.location ?? '',
    status: machine?.status ?? 'active',
    controller_type: machine?.controller_type ?? '',
    controller_model: machine?.controller_model ?? '',
  })
  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/machines/${machine.id}`, data) : api.post('/machines', data),
    onSuccess: () => { qc.invalidateQueries(['machines']); toast.success(isEdit ? 'Actualizat.' : 'Adaugat.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja. Codul trebuie sa fie unic.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza utilaj' : 'Utilaj nou'}</h3>
        <div className="space-y-3">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cod utilaj *</label>
              <input className="input" placeholder="Ex: CNC-01" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              <p className="text-[11px] text-slate-400 mt-0.5">Codul trebuie sa fie unic si identifica utilajul in sistem</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Denumire *</label>
            <input className="input" placeholder="Ex: Strung CNC Doosan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip masina</label>
            <LookupSelect lookupType="machine_types" value={form.type} onChange={v => setForm({ ...form, type: v })} placeholder="Tip masina" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Locatie</label>
            <input className="input" placeholder="Ex: Hala A" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="active">Activ</option>
              <option value="maintenance">In mentenanta</option>
              <option value="inactive">Inactiv</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip controler</label>
            <select className="input" value={form.controller_type} onChange={e => setForm({ ...form, controller_type: e.target.value })}>
              <option value="">Fara / Necunoscut</option>
              {['Fanuc', 'Siemens', 'Heidenhain', 'Mazatrol', 'Fagor', 'Haas', 'Mitsubishi', 'Altul'].map(ct => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Model controler</label>
            <input className="input" placeholder='Ex: Fanuc 0i-TF, Sinumerik 840D' value={form.controller_model} onChange={e => setForm({ ...form, controller_model: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.name} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal adauga capabilitate ────────────────────────────────────────────────

function CapabilityModal({ machineId, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ operationType: '', operationName: '', cycleTimeSeconds: '', hourlyRateEur: '', setupTimeMinutes: '0', nrCavities: '1', isPreferred: false })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/machines/${machineId}/capabilities`, data),
    onSuccess: () => { qc.invalidateQueries(['machine-detail', machineId]); toast.success('Capabilitate adaugata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Operatie posibila pe utilaj</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Tip operatie * (ex: Strunjire, Frezare)" value={form.operationType} onChange={f('operationType')} />
          <input className="input" placeholder="Denumire operatie (optional)" value={form.operationName} onChange={f('operationName')} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Timp ciclu (sec)</label>
              <input className="input" type="number" placeholder="ex: 45" value={form.cycleTimeSeconds} onChange={f('cycleTimeSeconds')} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Nr. cavitati</label>
              <input className="input" type="number" min="1" value={form.nrCavities} onChange={f('nrCavities')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Cost orar (EUR)</label>
              <input className="input" type="number" step="0.01" placeholder="ex: 35.50" value={form.hourlyRateEur} onChange={f('hourlyRateEur')} /></div>
            <div><label className="text-xs text-slate-500 mb-1 block">Timp setup (min)</label>
              <input className="input" type="number" value={form.setupTimeMinutes} onChange={f('setupTimeMinutes')} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.isPreferred} onChange={e => setForm({ ...form, isPreferred: e.target.checked })} />
            Masina preferata pentru acest tip operatie
          </label>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, cycleTimeSeconds: form.cycleTimeSeconds ? Number(form.cycleTimeSeconds) : null, hourlyRateEur: form.hourlyRateEur ? Number(form.hourlyRateEur) : null, setupTimeMinutes: Number(form.setupTimeMinutes), nrCavities: Number(form.nrCavities) })}
            disabled={mutation.isPending || !form.operationType}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se adauga...' : 'Adauga'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card profil utilaj ───────────────────────────────────────────────────────

function MachineCard({ machine, onClose, isAdmin }) {
  const qc = useQueryClient()
  const [addCap, setAddCap] = useState(false)
  const [planTab, setPlanTab] = useState(false)
  const [opsTab, setOpsTab] = useState(false)
  const [certTab, setCertTab] = useState(false)
  const [showAssignOp, setShowAssignOp] = useState(false)
  const [assignUserId, setAssignUserId] = useState('')
  const [showAddCert, setShowAddCert] = useState(false)
  const [certForm, setCertForm] = useState({ userId: '', machineType: machine.type || '', controllerType: machine.controller_type || '', level: 'operator', certifiedDate: '', expiryDate: '' })

  const { data: detail } = useQuery({
    queryKey: ['machine-detail', machine.id],
    queryFn: () => api.get(`/machines/${machine.id}`).then(r => r.data),
  })

  const { data: planning } = useQuery({
    queryKey: ['machine-planning', machine.id],
    queryFn: () => api.get(`/machines/${machine.id}/planning`).then(r => r.data),
    enabled: planTab,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn: () => api.get('/auth/users').then(r => r.data?.data || r.data || []),
    enabled: (opsTab || certTab) && isAdmin,
  })

  const { data: certifiedOps } = useQuery({
    queryKey: ['certified-operators', machine.id],
    queryFn: () => api.get(`/machines/${machine.id}/certified-operators`).then(r => r.data),
    enabled: certTab,
  })

  const addCertMut = useMutation({
    mutationFn: (data) => api.post(`/machines/${machine.id}/certifications`, data),
    onSuccess: () => { qc.invalidateQueries(['certified-operators', machine.id]); toast.success('Certificare adaugata.'); setShowAddCert(false) },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare la adaugare certificare.'),
  })

  const removeCertMut = useMutation({
    mutationFn: (id) => api.delete(`/machines/certifications/${id}`),
    onSuccess: () => { qc.invalidateQueries(['certified-operators', machine.id]); toast.success('Certificare dezactivata.') },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const assignOperator = useMutation({
    mutationFn: (userId) => api.post(`/machines/${machine.id}/operators`, { userId }),
    onSuccess: () => { qc.invalidateQueries(['machine-detail', machine.id]); toast.success('Operator alocat.'); setShowAssignOp(false); setAssignUserId('') },
    onError: (e) => {
      const msg = e.response?.data?.message || ''
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Operatorul este deja alocat.')
      else toast.error(msg || 'Eroare la alocare operator.')
    },
  })

  const removeOperator = useMutation({
    mutationFn: (userId) => api.delete(`/machines/${machine.id}/operators/${userId}`),
    onSuccess: () => { qc.invalidateQueries(['machine-detail', machine.id]); toast.success('Operator dezalocat.') },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare la dezalocare operator.'),
  })

  const deleteCap = useMutation({
    mutationFn: (id) => api.delete(`/machines/capabilities/${id}`),
    onSuccess: () => { qc.invalidateQueries(['machine-detail', machine.id]); toast.success('Sters.') },
  })

  const piecesPerHour = (cap) => {
    if (!cap.cycle_time_seconds || !cap.nr_cavities) return null
    return Math.round((3600 / cap.cycle_time_seconds) * cap.nr_cavities)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 rounded-lg p-2.5"><Cpu size={20} className="text-blue-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{machine.code}</h3>
                <p className="text-slate-500 text-sm">{machine.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-400 flex-wrap">
            {machine.type && <span className="flex items-center gap-1"><Wrench size={11} />{machine.type}</span>}
            {machine.location && <span>{machine.location}</span>}
            {machine.controller_type && (
              <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {machine.controller_type}{machine.controller_model ? ` — ${machine.controller_model}` : ''}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[machine.status]}`}>
              {machine.status === 'active' ? 'Activ' : machine.status === 'maintenance' ? 'Mentenanta' : 'Inactiv'}
            </span>
            {detail?.groups?.map(g => (
              <span key={g.id} className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                <Layers size={10} className="inline mr-1" />{g.name}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {[['cap', 'Operatii posibile'], ['ops', 'Operatori'], ['cert', 'Certificari'], ['plan', 'Planificare']].map(([t, l]) => {
            const active = (t === 'cap' && !planTab && !opsTab && !certTab) || (t === 'ops' && opsTab) || (t === 'plan' && planTab) || (t === 'cert' && certTab)
            return (
              <button key={t}
                onClick={() => { setPlanTab(t === 'plan'); setOpsTab(t === 'ops'); setCertTab(t === 'cert') }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${active
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                {l}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {!planTab && !opsTab && !certTab && (
            <>
              {/* Capabilities */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700">Operatii posibile pe acest utilaj</h4>
                {isAdmin && (
                  <button onClick={() => setAddCap(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={12} /> Adauga
                  </button>
                )}
              </div>

              {detail?.capabilities?.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">
                  Nicio operatie definita. Adauga operatiile pe care le poate executa acest utilaj.
                </p>
              )}

              <div className="space-y-2">
                {detail?.capabilities?.map(cap => {
                  const pph = piecesPerHour(cap)
                  return (
                    <div key={cap.id} className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 text-sm">{cap.operation_type}</span>
                          {cap.is_preferred && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">preferat</span>}
                          {cap.operation_name && <span className="text-xs text-slate-400">— {cap.operation_name}</span>}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-slate-400">
                          {cap.cycle_time_seconds && (
                            <span className="flex items-center gap-1"><Clock size={10} />{cap.cycle_time_seconds}s ciclu</span>
                          )}
                          {pph && <span>{pph} buc/h</span>}
                          {cap.setup_time_minutes > 0 && <span>Setup: {cap.setup_time_minutes} min</span>}
                          {cap.hourly_rate_eur && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Euro size={10} />{Number(cap.hourly_rate_eur).toFixed(2)}/h
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteCap.mutate(cap.id)} className="text-slate-300 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {opsTab && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700">Operatori alocati</h4>
                {isAdmin && (
                  <button onClick={() => setShowAssignOp(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <UserPlus size={12} /> Aloca operator
                  </button>
                )}
              </div>

              {detail?.operators?.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">
                  Niciun operator alocat. Adauga operatorii calificati pe acest utilaj.
                </p>
              )}

              <div className="space-y-2">
                {detail?.operators?.map(op => (
                  <div key={op.id} className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-3">
                    <div className="flex-1">
                      <span className="font-medium text-slate-800 text-sm">{op.full_name}</span>
                      {op.role && <span className="text-xs text-slate-400 ml-2">{op.role}</span>}
                      {op.email && <span className="text-xs text-slate-400 ml-2">{op.email}</span>}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => { if (confirm(`Sigur doriti sa dezalocati operatorul "${op.full_name}"?`)) removeOperator.mutate(op.id) }}
                        className="text-slate-300 hover:text-red-400 flex items-center gap-1 text-xs"
                        title="Dezaloca operator"
                      >
                        <UserMinus size={13} /> Dezaloca
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {showAssignOp && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <h5 className="text-xs font-medium text-blue-700 mb-2">Aloca operator nou</h5>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <select className="input text-sm w-full" value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
                        <option value="">Selecteaza operator...</option>
                        {(usersData || []).filter(u => !detail?.operators?.find(o => o.id === u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => assignOperator.mutate(assignUserId)}
                      disabled={!assignUserId || assignOperator.isPending}
                      className="btn-primary text-xs"
                    >
                      {assignOperator.isPending ? 'Se aloca...' : 'Aloca'}
                    </button>
                    <button onClick={() => setShowAssignOp(false)} className="btn-secondary text-xs">Anuleaza</button>
                  </div>
                </div>
              )}
            </>
          )}

          {certTab && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700">Operatori certificati</h4>
                {isAdmin && (
                  <button onClick={() => setShowAddCert(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <Plus size={12} /> Adauga certificare
                  </button>
                )}
              </div>

              {(!certifiedOps || certifiedOps.length === 0) && (
                <p className="text-slate-400 text-sm text-center py-4">
                  Niciun operator certificat pe acest tip de masina.
                </p>
              )}

              <div className="space-y-2">
                {(certifiedOps || []).map((op, i) => {
                  const isExpired = op.expiry_date && new Date(op.expiry_date) < new Date()
                  const isExpiring = op.expiry_date && !isExpired && new Date(op.expiry_date) < new Date(Date.now() + 30 * 86400000)
                  const levelColors = {
                    operator: 'bg-blue-100 text-blue-700',
                    senior: 'bg-green-100 text-green-700',
                    trainer: 'bg-purple-100 text-purple-700',
                    exception: 'bg-amber-100 text-amber-700',
                  }
                  return (
                    <div key={op.id + '-' + i} className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 text-sm">{op.full_name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${levelColors[op.certification_level] || 'bg-slate-100 text-slate-600'}`}>
                            {op.certification_level}
                          </span>
                          {isExpired && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Expirat</span>}
                          {isExpiring && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Expira curand</span>}
                          {!isExpired && !isExpiring && op.expiry_date && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Valid</span>}
                        </div>
                        <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                          {op.email && <span>{op.email}</span>}
                          {op.expiry_date && <span>Expira: {new Date(op.expiry_date).toLocaleDateString('ro-RO')}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {showAddCert && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <h5 className="text-xs font-medium text-blue-700 mb-2">Adauga certificare</h5>
                  <div className="space-y-2">
                    <select className="input text-sm w-full" value={certForm.userId} onChange={e => setCertForm({ ...certForm, userId: e.target.value })}>
                      <option value="">Selecteaza operator...</option>
                      {(usersData || []).map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input text-sm" value={certForm.level} onChange={e => setCertForm({ ...certForm, level: e.target.value })}>
                        <option value="operator">Operator</option>
                        <option value="senior">Senior</option>
                        <option value="trainer">Trainer</option>
                      </select>
                      <input className="input text-sm" type="date" placeholder="Data certificare" value={certForm.certifiedDate} onChange={e => setCertForm({ ...certForm, certifiedDate: e.target.value })} />
                    </div>
                    <input className="input text-sm w-full" type="date" placeholder="Data expirare (optional)" value={certForm.expiryDate} onChange={e => setCertForm({ ...certForm, expiryDate: e.target.value })} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddCert(false)} className="btn-secondary text-xs">Anuleaza</button>
                      <button
                        onClick={() => addCertMut.mutate(certForm)}
                        disabled={!certForm.userId || !certForm.certifiedDate || addCertMut.isPending}
                        className="btn-primary text-xs"
                      >
                        {addCertMut.isPending ? 'Se adauga...' : 'Adauga'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {planTab && planning && (
            <>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Alocari planificate (urmatoarele 30 zile)</h4>
              {planning.allocations?.length === 0 && planning.workOrderOperations?.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">Nicio planificare.</p>
              )}
              <div className="space-y-2">
                {planning.allocations?.map(a => (
                  <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-blue-700">
                        {new Date(a.plan_date).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })} • {a.shift}
                      </span>
                      {a.product_name && <span className="text-xs text-slate-500 ml-2">{a.product_name}</span>}
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {a.planned_qty > 0 && <span>{a.planned_qty.toLocaleString()} buc</span>}
                      {a.planned_hours && <span className="ml-2">{a.planned_hours}h</span>}
                    </div>
                  </div>
                ))}
                {planning.workOrderOperations?.map(op => (
                  <div key={op.id} className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-orange-700">CL: {op.work_order_number}</span>
                      <span className="text-xs text-slate-500 ml-2">{op.operation_name} • {op.product_name}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {op.quantity?.toLocaleString()} buc • {op.planned_hours}h
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {addCap && <CapabilityModal machineId={machine.id} onClose={() => setAddCap(false)} />}
      </div>
    </div>
  )
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function MachinesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [tab, setTab] = useState('machines')
  const isAdmin = ['admin', 'production_manager'].includes(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get('/machines').then(r => r.data),
  })

  const { data: groups } = useQuery({
    queryKey: ['machine-groups'],
    queryFn: () => api.get('/machines/groups/all').then(r => r.data),
    enabled: tab === 'groups',
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/machines/${id}`),
    onSuccess: () => { qc.invalidateQueries(['machines']); toast.success('Sters.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const [groupModal, setGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({ name: '', description: '' })
  const createGroup = useMutation({
    mutationFn: (data) => api.post('/machines/groups', data),
    onSuccess: () => { qc.invalidateQueries(['machine-groups']); toast.success('Grupa creata.'); setGroupModal(false) },
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Utilaje</h2>
        {isAdmin && tab === 'machines' && (
          <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Adauga
          </button>
        )}
        {isAdmin && tab === 'groups' && (
          <button onClick={() => setGroupModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Grupa noua
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['machines', 'Utilaje'], ['groups', 'Grupe']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'machines' && (
        <>
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              <span className="ml-2 text-slate-500">Se incarca...</span>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Tip</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Locatie</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Controler</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.data?.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedMachine(m)}>
                    <td className="px-4 py-3 font-mono font-medium text-blue-600">{m.code}</td>
                    <td className="px-4 py-3 text-slate-700">{m.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{m.type}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{m.location || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {m.controller_type ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700" title={m.controller_model || ''}>
                          {m.controller_type}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                        {m.status === 'active' ? 'Activ' : m.status === 'maintenance' ? 'Mentenanta' : 'Inactiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end items-center">
                        {isAdmin && (
                          <>
                            <button onClick={() => setModal(m)} className="text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14} /></button>
                            <button onClick={() => { if (confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteMutation.mutate(m.id) }} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                          </>
                        )}
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.data?.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center">
                    <Cpu size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Niciun utilaj</p>
                    <p className="text-slate-400 text-sm mt-1">Apasa butonul "Adauga" pentru a inregistra primul utilaj.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'groups' && (
        <div className="grid gap-3">
          {groups?.map(g => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-purple-500" />
                  <h4 className="font-medium text-slate-800">{g.name}</h4>
                </div>
                {g.description && <p className="text-xs text-slate-400 mt-0.5 ml-6">{g.description}</p>}
              </div>
              <span className="text-xs text-slate-400">{g.machine_count} utilaje</span>
            </div>
          ))}
          {groups?.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <Layers size={32} className="mx-auto mb-2 text-slate-300" />
              Nicio grupa. Creeaza grupe pentru a organiza utilajele de acelasi tip.
            </div>
          )}
        </div>
      )}

      {modal !== null && <MachineModal machine={modal} onClose={() => setModal(null)} />}
      {selectedMachine && (
        <MachineCard machine={selectedMachine} onClose={() => setSelectedMachine(null)} isAdmin={isAdmin} />
      )}

      {groupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Grupa noua</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Denumire grupa *</label>
                <input className="input" placeholder="Ex: Strunguri CNC" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descriere</label>
                <input className="input" placeholder="Descriere (optional)" value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setGroupModal(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => createGroup.mutate(groupForm)} disabled={!groupForm.name || createGroup.isPending} className="btn-primary">
                {createGroup.isPending ? 'Se creeaza...' : 'Creeaza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
