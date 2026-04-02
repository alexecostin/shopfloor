import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Pencil, Trash2, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'

/* ---- Calibration Status Helpers ---- */
const calibrationBadge = (status, tool) => {
  const map = {
    valid: { cls: 'bg-green-100 text-green-700', label: 'Calibrat' },
    expiring_soon: { cls: 'bg-amber-100 text-amber-700', label: 'Calibrare expira curand' },
    expired: { cls: 'bg-red-100 text-red-700', label: 'Calibrare expirata' },
    not_applicable: { cls: 'bg-slate-100 text-slate-500', label: 'N/A' },
  }
  const m = map[status] || map.not_applicable
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${m.cls}`} title={
      tool?.next_calibration_date
        ? `Calibrare expira pe ${new Date(tool.next_calibration_date).toLocaleDateString('ro-RO')}`
        : status === 'expiring_soon' ? 'Calibrarea expira in curand — programeaza recalibrare' : ''
    }>
      {m.label}
    </span>
  )
}

const maintenanceBadge = (tool) => {
  if (!tool.maintenance_interval_cycles || !tool.current_cycles) return null
  const pct = Math.round((tool.current_cycles / tool.maintenance_interval_cycles) * 100)
  if (pct < 80) return null
  const cls = pct >= 100 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
  const label = pct >= 100 ? 'Mentenanta necesara' : 'Mentenanta aproape'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`} title={`${tool.current_cycles?.toLocaleString()}/${tool.maintenance_interval_cycles?.toLocaleString()} cicluri (${pct}%) — programeaza inlocuire/mentenanta`}>
      {label}
    </span>
  )
}

/* ---- Calibration Modal ---- */
function CalibrateModal({ tool, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    calibratedAt: new Date().toISOString().slice(0, 10),
    calibratedBy: '',
    certificateUrl: '',
    intervalMonths: tool.calibration_interval_months || 12,
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  const mut = useMutation({
    mutationFn: d => api.post(`/tools/${tool.id}/calibrate`, d),
    onSuccess: () => {
      qc.invalidateQueries(['tools'])
      qc.invalidateQueries(['tool', tool.id])
      qc.invalidateQueries(['calibration-dashboard'])
      toast.success('Calibrare inregistrata.')
      onClose()
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Calibreaza: {tool.name}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600">Data calibrare *</label>
            <input className="input" type="date" value={form.calibratedAt} onChange={f('calibratedAt')} />
          </div>
          <div>
            <label className="text-xs text-slate-600">Calibrat de *</label>
            <input className="input" placeholder="Nume / Firma" value={form.calibratedBy} onChange={f('calibratedBy')} />
          </div>
          <div>
            <label className="text-xs text-slate-600">URL Certificat</label>
            <input className="input" placeholder="https://..." value={form.certificateUrl} onChange={f('certificateUrl')} />
          </div>
          <div>
            <label className="text-xs text-slate-600">Interval calibrare (luni)</label>
            <input className="input" type="number" min="1" value={form.intervalMonths} onChange={f('intervalMonths')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mut.mutate({ ...form, intervalMonths: Number(form.intervalMonths) })}
            disabled={mut.isPending || !form.calibratedAt || !form.calibratedBy}
            className="btn-primary"
          >
            {mut.isPending ? 'Se salveaza...' : 'Salveaza Calibrare'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Calibration Dashboard Cards ---- */
function CalibrationDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['calibration-dashboard'],
    queryFn: () => api.get('/tools/calibration/dashboard').then(r => r.data),
  })
  const [calibrateTool, setCalibrateTool] = useState(null)

  if (isLoading) return null
  if (!data) return null
  const { valid, expiringSoon, expired, tools } = data
  if (valid === 0 && expiringSoon === 0 && expired === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Calibrare Instrumente</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="text-green-600" size={20} />
          <div>
            <p className="text-2xl font-bold text-green-700">{valid}</p>
            <p className="text-xs text-green-600">Calibrate</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-600" size={20} />
          <div>
            <p className="text-2xl font-bold text-amber-700">{expiringSoon}</p>
            <p className="text-xs text-amber-600">Calibrare expira curand</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="text-red-600" size={20} />
          <div>
            <p className="text-2xl font-bold text-red-700">{expired}</p>
            <p className="text-xs text-red-600">Expirate</p>
          </div>
        </div>
      </div>

      {tools && tools.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Cod</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Nume</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Urm. Calibrare</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Status</th>
                <th className="px-4 py-2 text-xs" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tools.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{t.code}</td>
                  <td className="px-4 py-2 text-slate-800">
                    {t.name}
                    {t.maintenance_interval_cycles && t.current_cycles >= t.maintenance_interval_cycles * 0.8 && (
                      <span className="block text-[10px] text-amber-600 mt-0.5">
                        {t.current_cycles?.toLocaleString()}/{t.maintenance_interval_cycles?.toLocaleString()} cicluri — mentenanta necesara
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {t.next_calibration_date
                      ? `Calibrare expira pe ${new Date(t.next_calibration_date).toLocaleDateString('ro-RO')}`
                      : '-'}
                  </td>
                  <td className="px-4 py-2">{calibrationBadge(t.calibration_status, t)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setCalibrateTool(t)} className="text-xs text-blue-600 hover:underline">Calibreaza</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {calibrateTool && <CalibrateModal tool={calibrateTool} onClose={() => setCalibrateTool(null)} />}
    </div>
  )
}

/* ---- Add Tool Modal ---- */
function AddToolModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    code: '', name: '', type: '', tracking_mode: 'tracked',
    maintenance_interval_cycles: '',
    calibration_interval_months: '', last_calibrated_at: '',
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const mut = useMutation({
    mutationFn: d => api.post('/tools', d),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['calibration-dashboard']); toast.success('Scula adaugata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga Scula</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cod scula *</label>
            <input className="input" placeholder="Ex: FREZA-001" value={form.code} onChange={f('code')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Denumire *</label>
            <input className="input" placeholder="Ex: Freza cilindrica D10" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip</label>
            <input className="input" placeholder="Ex: Freza, Burghiu, Placuta" value={form.type} onChange={f('type')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mod urmarire</label>
            <select className="input" value={form.tracking_mode} onChange={f('tracking_mode')}>
              <option value="tracked">Tracked</option>
              <option value="consumable">Consumabil</option>
              <option value="measurement_instrument">Instrument Masura</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-0.5">Tracked = scula cu cicluri, Consumabil = inlocuibil periodic, Instrument = necesita calibrare</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Interval mentenanta (cicluri)</label>
            <input className="input" type="number" placeholder="Ex: 5000" value={form.maintenance_interval_cycles} onChange={f('maintenance_interval_cycles')} />
          </div>
          {form.tracking_mode === 'measurement_instrument' && (
            <>
              <input className="input" type="number" placeholder="Interval calibrare (luni) *" min="1" value={form.calibration_interval_months} onChange={f('calibration_interval_months')} />
              <div>
                <label className="text-xs text-slate-500">Ultima calibrare</label>
                <input className="input" type="date" value={form.last_calibrated_at} onChange={f('last_calibrated_at')} />
              </div>
            </>
          )}
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

/* ---- Edit Tool Modal ---- */
function EditToolModal({ tool, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    code: tool.code || '',
    name: tool.name || '',
    type: tool.type || '',
    tracking_mode: tool.tracking_mode || 'tracked',
    maintenance_interval_cycles: tool.maintenance_interval_cycles || '',
    calibration_interval_months: tool.calibration_interval_months || '',
    last_calibrated_at: tool.last_calibrated_at ? new Date(tool.last_calibrated_at).toISOString().slice(0, 10) : '',
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  const mut = useMutation({
    mutationFn: d => api.put(`/tools/${tool.id}`, d),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); qc.invalidateQueries(['calibration-dashboard']); toast.success('Scula actualizata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Editeaza Scula</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cod scula *</label>
            <input className="input" placeholder="Cod" value={form.code} onChange={f('code')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Denumire *</label>
            <input className="input" placeholder="Denumire scula" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip</label>
            <input className="input" placeholder="Ex: Freza, Burghiu" value={form.type} onChange={f('type')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mod urmarire</label>
            <select className="input" value={form.tracking_mode} onChange={f('tracking_mode')}>
              <option value="tracked">Tracked</option>
              <option value="consumable">Consumabil</option>
              <option value="measurement_instrument">Instrument Masura</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Interval mentenanta (cicluri)</label>
            <input className="input" type="number" placeholder="Ex: 5000" value={form.maintenance_interval_cycles} onChange={f('maintenance_interval_cycles')} />
          </div>
          {form.tracking_mode === 'measurement_instrument' && (
            <>
              <input className="input" type="number" placeholder="Interval calibrare (luni) *" min="1" value={form.calibration_interval_months} onChange={f('calibration_interval_months')} />
              <div>
                <label className="text-xs text-slate-500">Ultima calibrare</label>
                <input className="input" type="date" value={form.last_calibrated_at} onChange={f('last_calibrated_at')} />
              </div>
            </>
          )}
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

/* ---- Tool Detail Modal ---- */
function ToolDetail({ tool, onClose }) {
  const qc = useQueryClient()
  const [assignMachine, setAssignMachine] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({ type: '', description: '', cost: '' })
  const [cyclesVal, setCyclesVal] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [showCalibrate, setShowCalibrate] = useState(false)
  const mf = k => e => setMaintenanceForm({ ...maintenanceForm, [k]: e.target.value })

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data) })
  const { data: detail } = useQuery({ queryKey: ['tool', tool.id], queryFn: () => api.get(`/tools/${tool.id}`).then(r => r.data) })

  const assignMut = useMutation({
    mutationFn: ({ machineId }) => api.post(`/tools/${tool.id}/assign`, { machine_id: machineId }),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); toast.success('Asignat.'); setAssignMachine(false) },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const maintMut = useMutation({
    mutationFn: d => api.post(`/tools/${tool.id}/maintenance`, d),
    onSuccess: () => { qc.invalidateQueries(['tool', tool.id]); toast.success('Mentenanta adaugata.'); setMaintenanceForm({ type: '', description: '', cost: '' }) },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const cyclesMut = useMutation({
    mutationFn: cycles => api.put(`/tools/${tool.id}/cycles`, { cycles }),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['tool', tool.id]); toast.success('Cicluri actualizate.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/tools/${tool.id}`),
    onSuccess: () => { qc.invalidateQueries(['tools']); toast.success('Scula stearsa.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
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
            <button onClick={() => { if (confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteMut.mutate() }} className="text-slate-400 hover:text-red-500" title="Sterge"><Trash2 size={16} /></button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        {/* Calibration info */}
        {t.calibration_status && t.calibration_status !== 'not_applicable' && (
          <div className="bg-slate-50 rounded p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Calibrare</p>
                <div className="flex items-center gap-2">
                  {calibrationBadge(t.calibration_status, t)}
                  {t.next_calibration_date && (
                    <span className="text-xs text-slate-500">Calibrare expira pe: {new Date(t.next_calibration_date).toLocaleDateString('ro-RO')}</span>
                  )}
                </div>
                {t.calibrated_by && <p className="text-xs text-slate-400 mt-1">Calibrat de: {t.calibrated_by}</p>}
                {t.last_calibrated_at && <p className="text-xs text-slate-400">Data calibrare: {new Date(t.last_calibrated_at).toLocaleDateString('ro-RO')}</p>}
              </div>
              <button onClick={() => setShowCalibrate(true)} className="btn-primary text-xs py-1">Calibreaza</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">Data certificare = cand a fost certificat/calibrat instrumentul. Data expirare = pana cand e valabila calibrarea.</p>
          </div>
        )}

        {/* Maintenance status */}
        {t.maintenance_interval_cycles > 0 && (
          <div className="bg-slate-50 rounded p-3 mb-3">
            <p className="text-xs font-medium text-slate-600 mb-1">Mentenanta scula</p>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(t.current_cycles / t.maintenance_interval_cycles) > 0.8 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, Math.round((t.current_cycles / t.maintenance_interval_cycles) * 100))}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {(t.current_cycles || 0).toLocaleString()}/{t.maintenance_interval_cycles.toLocaleString()} cicluri
              </span>
            </div>
            {(t.current_cycles / t.maintenance_interval_cycles) >= 0.9 && (
              <p className="text-xs text-amber-600 font-medium">
                {Math.round((t.current_cycles / t.maintenance_interval_cycles) * 100)}% — programeaza inlocuire/mentenanta
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap mb-4">
          <button onClick={() => setAssignMachine(!assignMachine)} className="btn-secondary text-xs">Asigneaza Masina</button>
          {(t.tracking_mode === 'measurement_instrument' || t.calibration_status === 'expired' || t.calibration_status === 'expiring_soon') && (
            <button onClick={() => setShowCalibrate(true)} className="btn-secondary text-xs">Calibreaza</button>
          )}
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tip mentenanta *</label>
            <input className="input text-sm" placeholder="Ex: Inlocuire, Reascutire" value={maintenanceForm.type} onChange={mf('type')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descriere</label>
            <input className="input text-sm" placeholder="Detalii mentenanta" value={maintenanceForm.description} onChange={mf('description')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cost (RON)</label>
            <input className="input text-sm" type="number" placeholder="Ex: 50" value={maintenanceForm.cost} onChange={mf('cost')} />
          </div>
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
      {showCalibrate && <CalibrateModal tool={t} onClose={() => setShowCalibrate(false)} />}
    </div>
  )
}

/* ---- Main Page ---- */
export default function ToolsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('tools')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [calibrationFilter, setCalibrationFilter] = useState('')

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: () => api.get('/tools', { params: { trackingMode: 'tracked' } }).then(r => r.data),
  })
  const { data: instrumentTools } = useQuery({
    queryKey: ['tools-instruments'],
    queryFn: () => api.get('/tools', { params: { trackingMode: 'measurement_instrument' } }).then(r => r.data),
  })
  const { data: consumables, isLoading: cLoading } = useQuery({
    queryKey: ['consumables'],
    queryFn: () => api.get('/tools/consumables/status').then(r => r.data),
    enabled: tab === 'consumables',
  })

  const deleteToolMut = useMutation({
    mutationFn: (id) => api.delete(`/tools/${id}`),
    onSuccess: () => { qc.invalidateQueries(['tools']); qc.invalidateQueries(['calibration-dashboard']); toast.success('Scula stearsa.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const rawToolList = tools?.data || tools || []
  const rawInstrList = instrumentTools?.data || instrumentTools || []
  const allTools = [...rawToolList, ...rawInstrList.filter(i => !rawToolList.find(t => t.id === i.id))]

  const toolList = calibrationFilter
    ? allTools.filter(t => t.calibration_status === calibrationFilter)
    : allTools
  const consList = consumables?.data || consumables || []

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  const dayColor = d => d > 7 ? 'bg-green-100 text-green-700' : d >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  const statusColor = s => ({ active: 'bg-green-100 text-green-700', maintenance: 'bg-amber-100 text-amber-700', retired: 'bg-slate-100 text-slate-600' })[s] || 'bg-slate-100 text-slate-600'

  const calFilterCls = v => v === calibrationFilter
    ? 'px-3 py-1 text-xs rounded-full border font-medium bg-blue-50 border-blue-300 text-blue-700'
    : 'px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Scule & Consumabile</h1>

      {tab === 'tools' && <CalibrationDashboard />}

      <div className="flex border-b border-slate-200 mb-4">
        <button className={tabCls('tools')} onClick={() => setTab('tools')}>Scule Tracked</button>
        <button className={tabCls('consumables')} onClick={() => setTab('consumables')}>Consumabile</button>
      </div>

      {tab === 'tools' && (
        <div>
          <div className="flex justify-between items-center gap-2 mb-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button className={calFilterCls('')} onClick={() => setCalibrationFilter('')}>Toate</button>
              <button className={calFilterCls('valid')} onClick={() => setCalibrationFilter('valid')}>Calibrate</button>
              <button className={calFilterCls('expiring_soon')} onClick={() => setCalibrationFilter('expiring_soon')}>Calibrare expira curand</button>
              <button className={calFilterCls('expired')} onClick={() => setCalibrationFilter('expired')}>Expirate</button>
              <button className={calFilterCls('not_applicable')} onClick={() => setCalibrationFilter('not_applicable')}>N/A</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                if (navigator.mediaDevices) {
                  setShowScanner(true)
                  toast('Scanare QR — in dezvoltare', { icon: '\uD83D\uDCF7' })
                } else {
                  toast.error('Camera indisponibila pe acest dispozitiv')
                }
              }} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                {'\uD83D\uDCF7'} Scan QR
              </button>
              <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={15} />Adauga Scula</button>
            </div>
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
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Calibrare</th>
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
                        <td className="px-4 py-3 text-slate-500">{t.machine_name || t.machine?.name || '—'}</td>
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
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {calibrationBadge(t.calibration_status || 'not_applicable', t)}
                            {maintenanceBadge(t)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteToolMut.mutate(t.id) }}
                            className="text-slate-400 hover:text-red-500"
                            title="Sterge"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {toolList.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nicio scula.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'consumables' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Adauga consumabil
            </button>
          </div>
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
