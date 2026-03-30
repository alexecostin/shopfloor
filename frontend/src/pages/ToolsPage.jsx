import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'

function AddToolModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ code: '', name: '', type: '', tracking_mode: 'tracked', maintenance_interval_cycles: '' })
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const mut = useMutation({
    mutationFn: d => api.post('/tools', d),
    onSuccess: () => { qc.invalidateQueries(['tools']); toast.success('Scula adaugata.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga Scula</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Cod *" value={form.code} onChange={f('code')} />
          <input className="input" placeholder="Nume *" value={form.name} onChange={f('name')} />
          <input className="input" placeholder="Tip" value={form.type} onChange={f('type')} />
          <select className="input" value={form.tracking_mode} onChange={f('tracking_mode')}>
            <option value="tracked">Tracked</option>
            <option value="consumable">Consumabil</option>
          </select>
          <input className="input" type="number" placeholder="Interval mentenanta (cicluri)" value={form.maintenance_interval_cycles} onChange={f('maintenance_interval_cycles')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.code || !form.name} className="btn-primary">
            {mut.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditToolModal({ tool, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    code: tool.code || '',
    name: tool.name || '',
    type: tool.type || '',
    tracking_mode: tool.tracking_mode || 'tracked',
    maintenance_interval_cycles: tool.maintenance_interval_cycles || '',
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  const mut = useMutation({
    mutationFn: d => api.put(`/tools/${tool.id}`, d),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); toast.success('Scula actualizata.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Editeaza Scula</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Cod *" value={form.code} onChange={f('code')} />
          <input className="input" placeholder="Nume *" value={form.name} onChange={f('name')} />
          <input className="input" placeholder="Tip" value={form.type} onChange={f('type')} />
          <select className="input" value={form.tracking_mode} onChange={f('tracking_mode')}>
            <option value="tracked">Tracked</option>
            <option value="consumable">Consumabil</option>
          </select>
          <input className="input" type="number" placeholder="Interval mentenanta (cicluri)" value={form.maintenance_interval_cycles} onChange={f('maintenance_interval_cycles')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.code || !form.name} className="btn-primary">
            {mut.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolDetail({ tool, onClose }) {
  const qc = useQueryClient()
  const [assignMachine, setAssignMachine] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({ type: '', description: '', cost: '' })
  const [cyclesVal, setCyclesVal] = useState('')
  const [editMode, setEditMode] = useState(false)
  const mf = k => e => setMaintenanceForm({ ...maintenanceForm, [k]: e.target.value })

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data) })
  const { data: detail } = useQuery({ queryKey: ['tool', tool.id], queryFn: () => api.get(`/tools/${tool.id}`).then(r => r.data) })

  const assignMut = useMutation({
    mutationFn: ({ machineId }) => api.post(`/tools/${tool.id}/assign`, { machine_id: machineId }),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); toast.success('Asignat.'); setAssignMachine(false) },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const maintMut = useMutation({
    mutationFn: d => api.post(`/tools/${tool.id}/maintenance`, d),
    onSuccess: () => { qc.invalidateQueries(['tool', tool.id]); toast.success('Mentenanta adaugata.'); setMaintenanceForm({ type: '', description: '', cost: '' }) },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const cyclesMut = useMutation({
    mutationFn: cycles => api.put(`/tools/${tool.id}/cycles`, { cycles }),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); toast.success('Cicluri actualizate.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/tools/${tool.id}`),
    onSuccess: () => { qc.invalidateQueries(['tools']); toast.success('Scula stearsa.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const machineList = machines?.data || machines || []
  const t = detail || tool

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">{t.name} <span className="text-slate-400 text-sm">({t.code})</span></h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditMode(true)} className="text-slate-400 hover:text-blue-500" title="Editeaza"><Pencil size={16} /></button>
            <button onClick={() => { if (confirm('Stergi scula?')) deleteMut.mutate() }} className="text-slate-400 hover:text-red-500" title="Sterge"><Trash2 size={16} /></button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setAssignMachine(!assignMachine)} className="btn-secondary text-xs">Asigneaza Masina</button>
        </div>

        {assignMachine && (
          <div className="bg-slate-50 rounded p-3 mb-3">
            <select className="input text-sm" defaultValue="" onChange={e => assignMut.mutate({ machineId: e.target.value })}>
              <option value="">Selecteaza masina...</option>
              {machineList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div className="bg-slate-50 rounded p-3 mb-3 space-y-2">
          <p className="text-xs font-medium text-slate-600">Adauga Mentenanta</p>
          <input className="input text-sm" placeholder="Tip" value={maintenanceForm.type} onChange={mf('type')} />
          <input className="input text-sm" placeholder="Descriere" value={maintenanceForm.description} onChange={mf('description')} />
          <input className="input text-sm" type="number" placeholder="Cost" value={maintenanceForm.cost} onChange={mf('cost')} />
          <button onClick={() => maintMut.mutate(maintenanceForm)} disabled={!maintenanceForm.type || maintMut.isPending} className="btn-primary text-xs py-1">Salveaza</button>
        </div>

        <div className="bg-slate-50 rounded p-3 mb-3 flex gap-2 items-center">
          <p className="text-xs font-medium text-slate-600">Update Cicluri:</p>
          <input className="input text-sm w-28" type="number" value={cyclesVal} onChange={e => setCyclesVal(e.target.value)} />
          <button onClick={() => cyclesMut.mutate(Number(cyclesVal))} className="btn-primary text-xs py-1">Salveaza</button>
        </div>

        {t.maintenance_logs?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Istoric Mentenanta</p>
            <div className="space-y-1">
              {t.maintenance_logs.map(log => (
                <div key={log.id} className="text-xs text-slate-600 bg-slate-50 rounded px-3 py-2">
                  <span className="font-medium">{log.type}</span> — {log.description} {log.cost && `(${log.cost} RON)`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editMode && <EditToolModal tool={t} onClose={() => setEditMode(false)} />}
    </div>
  )
}

export default function ToolsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('tools')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showScanner, setShowScanner] = useState(false)

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: () => api.get('/tools', { params: { trackingMode: 'tracked' } }).then(r => r.data),
  })
  const { data: consumables, isLoading: cLoading } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => api.get('/tools/consumables/status').then(r => r.data),
    enabled: tab === 'consumables',
  })

  const deleteToolMut = useMutation({
    mutationFn: (id) => api.delete(`/tools/${id}`),
    onSuccess: () => { qc.invalidateQueries(['tools']); toast.success('Scula stearsa.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const toolList = tools?.data || tools || []
  const consList = consumables?.data || consumables || []

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  const dayColor = d => d > 7 ? 'bg-green-100 text-green-700' : d >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  const statusColor = s => ({ active: 'bg-green-100 text-green-700', maintenance: 'bg-amber-100 text-amber-700', retired: 'bg-slate-100 text-slate-600' })[s] || 'bg-slate-100 text-slate-600'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Scule & Consumabile</h1>
      <div className="flex border-b border-slate-200 mb-4">
        <button className={tabCls('tools')} onClick={() => setTab('tools')}>Scule Tracked</button>
        <button className={tabCls('consumables')} onClick={() => setTab('consumables')}>Consumabile</button>
      </div>

      {tab === 'tools' && (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <button onClick={() => {
              if (navigator.mediaDevices) {
                setShowScanner(true)
                toast('Scanare QR — in dezvoltare', { icon: '\uD83D\uDCF7' })
              } else {
                toast.error('Camera indisponibila pe acest dispozitiv')
              }
            }} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              \uD83D\uDCF7 Scan QR
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={15} />Adauga Scula</button>
          </div>
          {isLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cicluri</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {toolList.map(t => {
                    const pct = t.maintenance_interval_cycles ? Math.min(100, Math.round((t.current_cycles / t.maintenance_interval_cycles) * 100)) : 0
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(t)}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                        <td className="px-4 py-3 text-slate-500">{t.type || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{t.machine?.name || '—'}</td>
                        <td className="px-4 py-3 w-40">
                          {t.maintenance_interval_cycles ? (
                            <div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{t.current_cycles || 0}/{t.maintenance_interval_cycles}</p>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(t.status)}`}>{t.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Stergi scula?')) deleteToolMut.mutate(t.id) }}
                            className="text-slate-400 hover:text-red-500"
                            title="Sterge"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {toolList.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nicio scula.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'consumables' && (
        <div>
          {cLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Zile Ramase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consList.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.code}</td>
                      <td className="px-4 py-3 text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.machine?.name || '—'}</td>
                      <td className="px-4 py-3">
                        {c.days_remaining != null
                          ? <span className={`text-xs px-2 py-0.5 rounded-full ${dayColor(c.days_remaining)}`}>{c.days_remaining} zile</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {consList.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Niciun consumabil.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddToolModal onClose={() => setShowAdd(false)} />}
      {selected && <ToolDetail tool={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
