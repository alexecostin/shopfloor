import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Timer, Calculator, Settings, Save, X } from 'lucide-react'

// --------------- Tab 1: Timpi Setup per Masina ---------------
function MachineSetupTab() {
  const qc = useQueryClient()
  const [machineId, setMachineId] = useState('')
  const [editDefault, setEditDefault] = useState(false)
  const [defaultTime, setDefaultTime] = useState('')
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [editingOverride, setEditingOverride] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ product_id: '', setup_time: '' })
  const [calcMachineId, setCalcMachineId] = useState('')
  const [calcProductId, setCalcProductId] = useState('')

  const { data: machines = [] } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines').then(r => r.data?.data || r.data || []),
  })

  const { data: machineSetup, isLoading: loadingSetup } = useQuery({
    queryKey: ['setup-machine', machineId],
    queryFn: () => api.get(`/setup/machines/${machineId}`).then(r => r.data),
    enabled: !!machineId,
    onSuccess: data => { if (data?.default_setup_time != null) setDefaultTime(String(data.default_setup_time)) },
  })

  const { data: overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: ['setup-overrides', machineId],
    queryFn: () => api.get(`/setup/machines/${machineId}/overrides`).then(r => r.data),
    enabled: !!machineId,
  })

  const setDefaultMut = useMutation({
    mutationFn: time => api.post(`/setup/machines/${machineId}/default`, { default_setup_time: Number(time) }),
    onSuccess: () => { qc.invalidateQueries(['setup-machine', machineId]); setEditDefault(false); toast.success('Timp implicit salvat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const createOverrideMut = useMutation({
    mutationFn: data => api.post(`/setup/machines/${machineId}/overrides`, data),
    onSuccess: () => { qc.invalidateQueries(['setup-overrides', machineId]); closeOverrideForm(); toast.success('Override creat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const updateOverrideMut = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/setup/overrides/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['setup-overrides', machineId]); closeOverrideForm(); toast.success('Override actualizat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteOverrideMut = useMutation({
    mutationFn: id => api.delete(`/setup/overrides/${id}`),
    onSuccess: () => { qc.invalidateQueries(['setup-overrides', machineId]); toast.success('Sters.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const { data: calcResult, isFetching: calcLoading } = useQuery({
    queryKey: ['setup-calculate', calcMachineId, calcProductId],
    queryFn: () => api.get(`/setup/calculate?machineId=${calcMachineId}&productId=${calcProductId}`).then(r => r.data),
    enabled: !!calcMachineId && !!calcProductId,
  })

  function closeOverrideForm() { setShowOverrideForm(false); setEditingOverride(null); setOverrideForm({ product_id: '', setup_time: '' }) }
  function openEditOverride(ov) {
    setEditingOverride(ov)
    setOverrideForm({ product_id: ov.product_id || '', setup_time: String(ov.setup_time || '') })
    setShowOverrideForm(true)
  }
  function handleSaveOverride() {
    const payload = { product_id: overrideForm.product_id, setup_time: Number(overrideForm.setup_time) }
    if (editingOverride) updateOverrideMut.mutate({ id: editingOverride.id, ...payload })
    else createOverrideMut.mutate(payload)
  }

  return (
    <div className="space-y-6">
      {/* Machine selector */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Masina *</label>
          <select className="input w-64" value={machineId} onChange={e => { setMachineId(e.target.value); setEditDefault(false) }}>
            <option value="">Selecteaza masina...</option>
          {(Array.isArray(machines) ? machines : []).map(m => (
            <option key={m.id} value={m.id}>{m.code || m.name} — {m.name || m.code}</option>
          ))}
          </select>
        </div>
      </div>

      {!machineId && <div className="text-slate-400 text-sm py-8 text-center">Selecteaza o masina pentru a gestiona timpii de setup.</div>}

      {machineId && (
        <>
          {/* Default setup time */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Timp setup implicit</div>
                {loadingSetup ? (
                  <div className="text-slate-400 text-sm mt-1">Se incarca...</div>
                ) : editDefault ? (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="number" className="input w-32" value={defaultTime} onChange={e => setDefaultTime(e.target.value)} placeholder="minute" />
                    <span className="text-sm text-slate-500">minute</span>
                    <button onClick={() => setDefaultMut.mutate(defaultTime)} disabled={setDefaultMut.isPending} className="btn-primary text-sm">
                      <Save size={14} />
                    </button>
                    <button onClick={() => setEditDefault(false)} className="btn-secondary text-sm">Anuleaza</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-2xl font-bold text-slate-800">{machineSetup?.default_setup_time ?? '—'}</span>
                    <span className="text-sm text-slate-500">minute</span>
                    <button onClick={() => { setDefaultTime(String(machineSetup?.default_setup_time || '')); setEditDefault(true) }} className="text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product-specific overrides */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Override-uri per produs</h3>
              <button onClick={() => { closeOverrideForm(); setShowOverrideForm(true) }} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} /> Adauga override</button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Timp setup (min)</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingOverrides && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
                  {overrides.map(ov => (
                    <tr key={ov.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{ov.product_name || ov.product_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{ov.setup_time} min</td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <button onClick={() => openEditOverride(ov)} className="text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                        <button onClick={() => { if (confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteOverrideMut.mutate(ov.id) }} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {!loadingOverrides && overrides.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Niciun override. Se va folosi timpul implicit.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Override modal */}
          {showOverrideForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
                <h3 className="font-semibold text-slate-800 mb-4">{editingOverride ? 'Editeaza override' : 'Override nou'}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Produs ID *</label>
                    <input className="input" value={overrideForm.product_id} onChange={e => setOverrideForm({ ...overrideForm, product_id: e.target.value })} disabled={!!editingOverride} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Timp setup (minute) *</label>
                    <input type="number" className="input" value={overrideForm.setup_time} onChange={e => setOverrideForm({ ...overrideForm, setup_time: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-5 justify-end">
                  <button onClick={closeOverrideForm} className="btn-secondary">Anuleaza</button>
                  <button onClick={handleSaveOverride} disabled={!overrideForm.product_id || !overrideForm.setup_time || createOverrideMut.isPending || updateOverrideMut.isPending} className="btn-primary">
                    {(createOverrideMut.isPending || updateOverrideMut.isPending) ? 'Se salveaza...' : 'Salveaza'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calculate section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2"><Calculator size={14} /> Calculeaza timp setup estimat</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <select className="input w-48" value={calcMachineId} onChange={e => setCalcMachineId(e.target.value)}>
                <option value="">Masina...</option>
                {(Array.isArray(machines) ? machines : []).map(m => (
                  <option key={m.id} value={m.id}>{m.code || m.name}</option>
                ))}
              </select>
              <input className="input w-48" placeholder="Product ID" value={calcProductId} onChange={e => setCalcProductId(e.target.value)} />
              {calcLoading && <span className="text-sm text-slate-400">Se calculeaza...</span>}
              {calcResult && !calcLoading && (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg">
                  <Timer size={16} />
                  <span className="font-bold text-lg">{calcResult.estimated_time ?? calcResult.setup_time ?? '—'}</span>
                  <span className="text-sm">minute</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --------------- Tab 2: Factori ---------------
function FactorsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', multiplier: 1, description: '' })

  const { data: factors = [], isLoading } = useQuery({
    queryKey: ['setup-factors'],
    queryFn: () => api.get('/setup/factors').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: data => api.post('/setup/factors', data),
    onSuccess: () => { qc.invalidateQueries(['setup-factors']); closeForm(); toast.success('Factor creat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/setup/factors/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['setup-factors']); closeForm(); toast.success('Factor actualizat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  function closeForm() { setShowForm(false); setEditing(null); setForm({ name: '', multiplier: 1, description: '' }) }
  function openEdit(f) {
    setEditing(f)
    setForm({ name: f.name || '', multiplier: f.multiplier ?? 1, description: f.description || '' })
    setShowForm(true)
  }
  function handleSave() {
    const payload = { ...form, multiplier: Number(form.multiplier) }
    if (editing) updateMut.mutate({ id: editing.id, ...payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { closeForm(); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={14} /> Factor nou</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Multiplicator</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Descriere</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {factors.map(f => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{f.name}</td>
                <td className="px-4 py-3 text-slate-700">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.multiplier > 1 ? 'bg-red-100 text-red-700' : f.multiplier < 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    x{f.multiplier}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{f.description || '—'}</td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!isLoading && factors.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Niciun factor definit. Adauga factori de complexitate, material, etc.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">{editing ? 'Editeaza factor' : 'Factor nou'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nume *</label>
                <input className="input" placeholder="ex: Complexitate, Material" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Multiplicator *</label>
                <input type="number" step="0.1" className="input" value={form.multiplier} onChange={e => setForm({ ...form, multiplier: e.target.value })} />
                <p className="text-xs text-slate-400 mt-1">1.0 = fara efect, 1.5 = +50% timp, 0.8 = -20% timp</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={closeForm} className="btn-secondary">Anuleaza</button>
              <button onClick={handleSave} disabled={!form.name || createMut.isPending || updateMut.isPending} className="btn-primary">
                {(createMut.isPending || updateMut.isPending) ? 'Se salveaza...' : 'Salveaza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --------------- Main Page ---------------
export default function SetupPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('machine')

  const tabs = [
    { id: 'machine', label: 'Timpi Setup per Masina', icon: Timer },
    { id: 'factors', label: 'Factori', icon: Settings },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Timpi Setup</h2>
        <p className="text-sm text-slate-500">Gestioneaza timpii de setup per masina, override-uri per produs si factori de ajustare.</p>
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

      {tab === 'machine' && <MachineSetupTab />}
      {tab === 'factors' && <FactorsTab />}
    </div>
  )
}
