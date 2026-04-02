import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  ClipboardCheck, Ruler, BarChart3, AlertTriangle, ShieldCheck,
  Plus, X, Check, XCircle, ChevronDown, Trash2, ArrowRight, FileText,
  Clock, CheckCircle2, Eye, Play, Flag
} from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

const TABS = [
  { key: 'plans', label: 'Planuri control', icon: ClipboardCheck },
  { key: 'measurements', label: 'Masurari', icon: Ruler },
  { key: 'spc', label: 'SPC', icon: BarChart3 },
  { key: 'ncr', label: 'NCR', icon: AlertTriangle },
  { key: 'capa', label: 'CAPA', icon: ShieldCheck },
]

const SEVERITY_COLORS = {
  minor: 'bg-yellow-50 text-yellow-700',
  major: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}

const NCR_STATUS_COLORS = {
  open: 'bg-blue-50 text-blue-700',
  investigation: 'bg-purple-50 text-purple-700',
  root_cause: 'bg-amber-50 text-amber-700',
  disposition: 'bg-indigo-50 text-indigo-700',
  closed: 'bg-slate-100 text-slate-600',
}

const CAPA_STATUS_COLORS = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-green-50 text-green-700',
  verified: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
  not_effective: 'bg-red-50 text-red-700',
}

const CAPA_STATUS_LABELS = {
  open: 'Creat',
  in_progress: 'In lucru',
  completed: 'Completat',
  verified: 'Verificat',
  closed: 'Inchis',
  not_effective: 'Neefectiv',
}

const RESULT_COLORS = {
  pass: 'bg-green-50 text-green-700',
  fail: 'bg-red-50 text-red-700',
}

// ════════════════════════════════════════════════════════════════════════
// PLANURI CONTROL TAB
// ════════════════════════════════════════════════════════════════════════

function PlanuriTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['quality-plans', page],
    queryFn: () => api.get('/quality/plans', { params: { page, limit: 25 } }).then(r => r.data),
  })

  const { data: productsData } = useQuery({
    queryKey: ['bom-products-for-plans'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })
  const productsMap = {}
  ;(productsData?.data || []).forEach(p => { productsMap[p.id] = p })

  const createMut = useMutation({
    mutationFn: (body) => api.post('/quality/plans', body),
    onSuccess: () => {
      toast.success('Plan creat cu succes')
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['quality-plans'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'Eroare la creare plan. Incercati din nou.');
    },
  })

  const plans = data?.data || []
  const pagination = data?.pagination || {}

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Planuri de masurare si control calitate</p>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1">
          <Plus size={14} /> Plan nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Nume plan</th>
                <th className="pb-2 pr-4">Produs</th>
                <th className="pb-2 pr-4">Caracteristici</th>
                <th className="pb-2 pr-4">Activ</th>
                <th className="pb-2">Creat</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => {
                const chars = typeof p.characteristics === 'string' ? JSON.parse(p.characteristics) : (p.characteristics || [])
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium">{p.plan_name}</td>
                    <td className="py-2 pr-4 text-xs text-slate-600">
                      {p.product_id && productsMap[p.product_id]
                        ? <span><span className="font-mono text-blue-500">{productsMap[p.product_id].reference}</span> - {productsMap[p.product_id].name}</span>
                        : (p.product_id ? <span className="text-slate-400 font-mono">{p.product_id.substring(0, 8)}</span> : '-')}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{chars.length} caract.</span>
                    </td>
                    <td className="py-2 pr-4">
                      {p.is_active
                        ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Da</span>
                        : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Nu</span>}
                    </td>
                    <td className="py-2 text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('ro-RO')}</td>
                  </tr>
                )
              })}
              {plans.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Niciun plan gasit.</td></tr>
              )}
            </tbody>
          </table>
          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {pagination.total}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={plans.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <CreatePlanModal onClose={() => setShowModal(false)} onSubmit={d => createMut.mutate(d)} loading={createMut.isPending} />}
    </div>
  )
}

function CreatePlanModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ plan_name: '', product_id: '', order_id: '' })
  const [chars, setChars] = useState([{ name: '', nominal: '', upper_tolerance: '', lower_tolerance: '', unit: 'mm', is_critical: false }])

  const { data: productsData } = useQuery({
    queryKey: ['bom-products-select'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })
  const products = productsData?.data || []

  function addChar() {
    setChars(c => [...c, { name: '', nominal: '', upper_tolerance: '', lower_tolerance: '', unit: 'mm', is_critical: false }])
  }

  function removeChar(idx) {
    setChars(c => c.filter((_, i) => i !== idx))
  }

  function updateChar(idx, field, value) {
    setChars(c => c.map((ch, i) => i === idx ? { ...ch, [field]: value } : ch))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.plan_name) return toast.error('Nume plan obligatoriu')
    const validChars = chars.filter(c => c.name)
    if (validChars.length === 0) return toast.error('Adauga cel putin o caracteristica')
    onSubmit({
      ...form,
      product_id: form.product_id || undefined,
      characteristics: validChars.map(c => ({
        ...c,
        nominal: Number(c.nominal) || 0,
        upper_tolerance: Number(c.upper_tolerance) || 0,
        lower_tolerance: Number(c.lower_tolerance) || 0,
      })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Plan de control nou</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Nume plan *</label>
              <input className="input w-full" value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Produs</label>
              <select className="input w-full" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                <option value="">-- Selecteaza produs (optional) --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Comanda de lucru (optional)</label>
            <SearchableSelect
              endpoint="/work-orders"
              labelField="work_order_number"
              valueField="id"
              placeholder="Selecteaza comanda (optional)"
              value={form.order_id}
              onChange={(id) => setForm(f => ({ ...f, order_id: id }))}
              allowCreate={false}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Caracteristici</label>
              <button type="button" onClick={addChar} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus size={12} /> Adauga
              </button>
            </div>
            {/* Column headers */}
            <div className="flex gap-2 items-center text-[10px] font-medium text-slate-500 mb-1">
              <div className="flex-1">Nume *</div>
              <div className="w-20">Nominal</div>
              <div className="w-16">+Tol</div>
              <div className="w-16">-Tol</div>
              <div className="w-14">UM</div>
              <div className="w-14">Critic</div>
              <div className="w-6" /> {/* delete */}
            </div>
            <div className="space-y-2">
              {chars.map((ch, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <input className="input flex-1 text-xs" placeholder="Ex: Diametru exterior" value={ch.name} onChange={e => updateChar(idx, 'name', e.target.value)} />
                  <input type="number" step="any" className="input w-20 text-xs" placeholder="42" value={ch.nominal} onChange={e => updateChar(idx, 'nominal', e.target.value)} />
                  <input type="number" step="any" className="input w-16 text-xs" placeholder="+0.025" value={ch.upper_tolerance} onChange={e => updateChar(idx, 'upper_tolerance', e.target.value)} />
                  <input type="number" step="any" className="input w-16 text-xs" placeholder="-0.025" value={ch.lower_tolerance} onChange={e => updateChar(idx, 'lower_tolerance', e.target.value)} />
                  <input className="input w-14 text-xs" placeholder="mm" value={ch.unit} onChange={e => updateChar(idx, 'unit', e.target.value)} />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap w-14">
                    <input type="checkbox" checked={ch.is_critical} onChange={e => updateChar(idx, 'is_critical', e.target.checked)} />
                    Critic
                  </label>
                  <button type="button" onClick={() => removeChar(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// MASURARI TAB
// ════════════════════════════════════════════════════════════════════════

function MasurariTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [faiMode, setFaiMode] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [page, setPage] = useState(1)

  const { data: plansData } = useQuery({
    queryKey: ['quality-plans-all'],
    queryFn: () => api.get('/quality/plans', { params: { isActive: true, limit: 200 } }).then(r => r.data),
  })

  const { data: measData, isLoading } = useQuery({
    queryKey: ['quality-measurements', page],
    queryFn: () => api.get('/quality/measurements', { params: { page, limit: 25 } }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body) => api.post('/quality/measurements', body),
    onSuccess: (res) => {
      const result = res.data.overall_result
      if (result === 'pass') toast.success('Masurare inregistrata: PASS')
      else toast.error('Masurare inregistrata: FAIL')
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['quality-measurements'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'Eroare la inregistrare. Incercati din nou.');
    },
  })

  const plans = plansData?.data || []
  const measurements = measData?.data || []
  const pagination = measData?.pagination || {}

  const selectedPlan = plans.find(p => p.id === selectedPlanId)
  const selectedChars = selectedPlan
    ? (typeof selectedPlan.characteristics === 'string' ? JSON.parse(selectedPlan.characteristics) : (selectedPlan.characteristics || []))
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Inregistrare si vizualizare masurari</p>
        <div className="flex gap-2">
          <button onClick={() => { setShowForm(true); setFaiMode(true) }} className="btn-secondary flex items-center gap-1 text-amber-700 border-amber-200 hover:bg-amber-50">
            <ShieldCheck size={14} /> Prima piesa (FAI)
          </button>
          <button onClick={() => { setShowForm(true); setFaiMode(false) }} className="btn-primary flex items-center gap-1">
            <Plus size={14} /> Masurare noua
          </button>
        </div>
      </div>

      {showForm && (
        <MeasurementForm
          plans={plans}
          selectedPlanId={selectedPlanId}
          setSelectedPlanId={setSelectedPlanId}
          selectedChars={selectedChars}
          onSubmit={d => createMut.mutate(d)}
          onClose={() => { setShowForm(false); setFaiMode(false) }}
          loading={createMut.isPending}
          initialType={faiMode ? 'fai' : 'inline'}
        />
      )}

      {isLoading ? (
        <p className="text-slate-400 text-sm mt-4">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Tip</th>
                <th className="pb-2 pr-4">Plan ID</th>
                <th className="pb-2 pr-4">Rezultat</th>
                <th className="pb-2 pr-4">Valori</th>
                <th className="pb-2 pr-4">Calibrare</th>
                <th className="pb-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map(m => {
                const vals = typeof m.values === 'string' ? JSON.parse(m.values) : (m.values || [])
                const failCount = vals.filter(v => v.result === 'fail').length
                return (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium uppercase">{m.measurement_type}</span>
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-400 font-mono">{m.plan_id?.substring(0, 8)}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[m.overall_result] || ''}`}>
                        {m.overall_result === 'pass' ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {vals.length} val. {failCount > 0 && <span className="text-red-600">({failCount} fail)</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {m.instrument_calibration_valid
                        ? <Check size={14} className="text-green-600" />
                        : <XCircle size={14} className="text-red-500" />}
                    </td>
                    <td className="py-2 text-xs text-slate-400">{new Date(m.created_at).toLocaleDateString('ro-RO')}</td>
                  </tr>
                )
              })}
              {measurements.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Nicio masurare gasita.</td></tr>
              )}
            </tbody>
          </table>
          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {pagination.total}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={measurements.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MeasurementForm({ plans, selectedPlanId, setSelectedPlanId, selectedChars, onSubmit, onClose, loading, initialType }) {
  const [measValues, setMeasValues] = useState([])
  const [measurementType, setMeasurementType] = useState(initialType || 'inline')
  const [notes, setNotes] = useState('')
  const [productDocs, setProductDocs] = useState([])

  function handlePlanChange(planId) {
    setSelectedPlanId(planId)
    const plan = plans.find(p => p.id === planId)
    if (plan) {
      const chars = typeof plan.characteristics === 'string' ? JSON.parse(plan.characteristics) : (plan.characteristics || [])
      setMeasValues(chars.map(c => ({ name: c.name, measured: '' })))
      // Fetch documents for the product if available
      if (plan.product_id) {
        api.get(`/documents/for/product/${plan.product_id}`).then(r => {
          setProductDocs(r.data?.data || r.data || [])
        }).catch(() => setProductDocs([]))
      } else {
        setProductDocs([])
      }
    } else {
      setMeasValues([])
      setProductDocs([])
    }
  }

  function updateValue(idx, measured) {
    setMeasValues(v => v.map((mv, i) => i === idx ? { ...mv, measured } : mv))
  }

  function getRowResult(mv) {
    if (!mv.measured && mv.measured !== 0) return null
    const charDef = selectedChars.find(c => c.name === mv.name)
    if (!charDef) return null
    const nominal = Number(charDef.nominal)
    const upper = nominal + Number(charDef.upper_tolerance || 0)
    const lower = nominal - Math.abs(Number(charDef.lower_tolerance || 0))
    const val = Number(mv.measured)
    return val >= lower && val <= upper ? 'pass' : 'fail'
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedPlanId) return toast.error('Selecteaza un plan')
    const filledValues = measValues.filter(v => v.measured !== '' && v.measured !== undefined)
    if (filledValues.length === 0) return toast.error('Completeaza cel putin o valoare')
    onSubmit({
      plan_id: selectedPlanId,
      measurement_type: measurementType,
      values: filledValues.map(v => ({ name: v.name, measured: Number(v.measured) })),
      notes: notes || undefined,
    })
  }

  return (
    <div className="border rounded-xl p-4 bg-white mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-700">Masurare noua</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Plan de control *</label>
            <select className="input w-full" value={selectedPlanId} onChange={e => handlePlanChange(e.target.value)}>
              <option value="">Selecteaza plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.plan_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Tip masurare</label>
            <select className="input w-full" value={measurementType} onChange={e => setMeasurementType(e.target.value)}>
              <option value="inline">Inline</option>
              <option value="fai">FAI</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Note</label>
            <input className="input w-full" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {productDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 flex-wrap">
            <FileText size={16} className="text-amber-600" />
            <span className="text-sm text-amber-800 font-medium">Desen tehnic:</span>
            {productDocs.map(doc => (
              <a key={doc.id} href={doc.file_url || doc.url || '#'} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                {doc.title || doc.file_name || doc.name || 'Document'} [Deschide]
              </a>
            ))}
          </div>
        )}

        {selectedChars.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Valori masurate</label>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">Caracteristica</th>
                    <th className="pb-2 pr-3">Nominal</th>
                    <th className="pb-2 pr-3">Tol+</th>
                    <th className="pb-2 pr-3">Tol-</th>
                    <th className="pb-2 pr-3">UM</th>
                    <th className="pb-2 pr-3">Masurat</th>
                    <th className="pb-2">Rezultat</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChars.map((ch, idx) => {
                    const mv = measValues[idx] || { name: ch.name, measured: '' }
                    const result = getRowResult(mv)
                    return (
                      <tr key={idx} className={`border-b border-slate-100 ${ch.is_critical ? 'bg-red-50/30' : ''}`}>
                        <td className="py-1.5 pr-3 font-medium text-xs">
                          {ch.name} {ch.is_critical && <span className="text-red-500">*</span>}
                        </td>
                        <td className="py-1.5 pr-3 text-xs">{ch.nominal}</td>
                        <td className="py-1.5 pr-3 text-xs text-green-600">+{ch.upper_tolerance}</td>
                        <td className="py-1.5 pr-3 text-xs text-red-600">-{Math.abs(ch.lower_tolerance)}</td>
                        <td className="py-1.5 pr-3 text-xs text-slate-400">{ch.unit}</td>
                        <td className="py-1.5 pr-3">
                          <input
                            type="number"
                            step="any"
                            className="input w-24 text-xs"
                            value={mv.measured}
                            onChange={e => updateValue(idx, e.target.value)}
                          />
                        </td>
                        <td className="py-1.5">
                          {result && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${RESULT_COLORS[result]}`}>
                              {result === 'pass' ? 'OK' : 'NOK'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Se salveaza...' : 'Inregistreaza masurare'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// SPC TAB — Fixed: characteristic dropdown from measurement plan
// ════════════════════════════════════════════════════════════════════════

function SPCTab() {
  const [productId, setProductId] = useState('')
  const [characteristic, setCharacteristic] = useState('')
  const [spcData, setSpcData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [planCharacteristics, setPlanCharacteristics] = useState([])
  const [loadingChars, setLoadingChars] = useState(false)

  // When product changes, fetch its measurement plan and extract characteristics
  useEffect(() => {
    if (!productId) {
      setPlanCharacteristics([])
      setCharacteristic('')
      return
    }
    setLoadingChars(true)
    setPlanCharacteristics([])
    setCharacteristic('')
    api.get('/quality/plans', { params: { productId, limit: 50 } })
      .then(r => {
        const plans = r.data?.data || r.data || []
        const allChars = []
        const seen = new Set()
        plans.forEach(plan => {
          const chars = typeof plan.characteristics === 'string'
            ? JSON.parse(plan.characteristics)
            : (plan.characteristics || [])
          chars.forEach(ch => {
            if (ch.name && !seen.has(ch.name)) {
              seen.add(ch.name)
              allChars.push(ch)
            }
          })
        })
        setPlanCharacteristics(allChars)
      })
      .catch(() => setPlanCharacteristics([]))
      .finally(() => setLoadingChars(false))
  }, [productId])

  async function handleCalculate() {
    if (!productId || !characteristic) return toast.error('Selecteaza produs si caracteristica')
    setLoading(true)
    setSpcData(null)
    try {
      const res = await api.get('/quality/spc', { params: { productId, characteristic } })
      setSpcData(res.data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Eroare la calculul SPC')
    } finally {
      setLoading(false)
    }
  }

  function getCpColor(val) {
    if (val === null || val === undefined) return 'text-slate-400'
    if (val >= 1.33) return 'text-green-600'
    if (val >= 1.0) return 'text-amber-600'
    return 'text-red-600'
  }

  function getCpBg(val) {
    if (val === null || val === undefined) return 'bg-slate-50'
    if (val >= 1.33) return 'bg-green-50'
    if (val >= 1.0) return 'bg-amber-50'
    return 'bg-red-50'
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">Analiza statistica a procesului (Control Chart, Cp, Cpk)</p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="w-64">
          <label className="block text-sm text-slate-600 mb-1">Produs</label>
          <SearchableSelect
            endpoint="/bom/products"
            labelField="name"
            valueField="id"
            placeholder="Cauta produs..."
            value={productId}
            onChange={(id) => setProductId(id || '')}
            allowCreate={false}
          />
        </div>
        <div className="w-56">
          <label className="block text-sm text-slate-600 mb-1">Caracteristica</label>
          {loadingChars ? (
            <div className="input w-full flex items-center text-slate-400 text-sm">Se incarca...</div>
          ) : planCharacteristics.length > 0 ? (
            <select
              className="input w-full"
              value={characteristic}
              onChange={e => setCharacteristic(e.target.value)}
            >
              <option value="">-- Selecteaza caracteristica --</option>
              {planCharacteristics.map(ch => (
                <option key={ch.name} value={ch.name}>
                  {ch.name} ({ch.nominal}{ch.unit ? ` ${ch.unit}` : ''})
                </option>
              ))}
            </select>
          ) : (
            <div className="input w-full flex items-center text-slate-400 text-sm">
              {productId ? 'Niciun plan gasit' : 'Selecteaza produs mai intai'}
            </div>
          )}
        </div>
        <button onClick={handleCalculate} disabled={loading || !productId || !characteristic} className="btn-primary flex items-center gap-1">
          <BarChart3 size={14} /> {loading ? 'Se calculeaza...' : 'Calculeaza SPC'}
        </button>
      </div>

      {/* Selected characteristic info */}
      {characteristic && planCharacteristics.length > 0 && (() => {
        const sel = planCharacteristics.find(c => c.name === characteristic)
        if (!sel) return null
        return (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-4 text-sm">
            <span className="font-medium text-blue-800">{sel.name}</span>
            <span className="text-blue-600">Nominal: {sel.nominal} {sel.unit}</span>
            <span className="text-green-600">+{sel.upper_tolerance}</span>
            <span className="text-red-600">-{Math.abs(sel.lower_tolerance)}</span>
            {sel.is_critical && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">CRITIC</span>}
          </div>
        )
      })()}

      {spcData && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-xl p-4 ${getCpBg(spcData.cp)}`}>
              <p className="text-xs text-slate-500 mb-1">Cp</p>
              <p className={`text-2xl font-bold ${getCpColor(spcData.cp)}`}>
                {spcData.cp !== null ? spcData.cp.toFixed(4) : 'N/A'}
              </p>
            </div>
            <div className={`rounded-xl p-4 ${getCpBg(spcData.cpk)}`}>
              <p className="text-xs text-slate-500 mb-1">Cpk</p>
              <p className={`text-2xl font-bold ${getCpColor(spcData.cpk)}`}>
                {spcData.cpk !== null ? spcData.cpk.toFixed(4) : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl p-4 bg-blue-50">
              <p className="text-xs text-slate-500 mb-1">Media</p>
              <p className="text-2xl font-bold text-blue-700">{spcData.mean !== null ? spcData.mean.toFixed(4) : 'N/A'}</p>
            </div>
            <div className="rounded-xl p-4 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">Std Dev</p>
              <p className="text-2xl font-bold text-slate-700">{spcData.stdDev !== null ? spcData.stdDev.toFixed(4) : 'N/A'}</p>
            </div>
          </div>

          {/* Control limits */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-red-50 rounded-lg p-3">
              <span className="text-xs text-slate-500">UCL</span>
              <p className="font-mono font-medium text-red-700">{spcData.ucl !== null ? spcData.ucl.toFixed(4) : '-'}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <span className="text-xs text-slate-500">LCL</span>
              <p className="font-mono font-medium text-red-700">{spcData.lcl !== null ? spcData.lcl.toFixed(4) : '-'}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <span className="text-xs text-slate-500">USL</span>
              <p className="font-mono font-medium text-green-700">{spcData.usl !== null ? spcData.usl.toFixed(4) : '-'}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <span className="text-xs text-slate-500">LSL</span>
              <p className="font-mono font-medium text-green-700">{spcData.lsl !== null ? spcData.lsl.toFixed(4) : '-'}</p>
            </div>
          </div>

          {/* Control Chart as CSS bars */}
          {spcData.dataPoints && spcData.dataPoints.length > 0 && spcData.ucl !== null && (
            <div className="border rounded-xl p-4 bg-white">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Control Chart ({spcData.sampleCount} puncte)</h4>
              <div className="relative" style={{ height: '240px' }}>
                <ControlChart
                  dataPoints={spcData.dataPoints}
                  ucl={spcData.ucl}
                  lcl={spcData.lcl}
                  mean={spcData.mean}
                  usl={spcData.usl}
                  lsl={spcData.lsl}
                />
              </div>
              {spcData.outOfControlCount > 0 && (
                <p className="mt-2 text-xs text-red-600">
                  {spcData.outOfControlCount} punct(e) in afara limitelor de control
                </p>
              )}
              {spcData.inControl && (
                <p className="mt-2 text-xs text-green-600">Proces in control statistic</p>
              )}
            </div>
          )}

          {spcData.sampleCount < 2 && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Insuficiente date pentru analiza SPC (minim 2 masurari necesare).</p>
              <p className="text-xs mt-1">Masurari gasite: {spcData.sampleCount}</p>
            </div>
          )}
        </div>
      )}

      {!spcData && !loading && (
        <div className="text-center py-12 text-slate-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecteaza un produs si o caracteristica pentru a calcula SPC.</p>
        </div>
      )}
    </div>
  )
}

function ControlChart({ dataPoints, ucl, lcl, mean }) {
  if (!dataPoints || dataPoints.length === 0) return null

  const allValues = [...dataPoints, ucl, lcl, mean].filter(v => v !== null && v !== undefined)
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1
  const padding = range * 0.1
  const chartMin = minVal - padding
  const chartMax = maxVal + padding
  const chartRange = chartMax - chartMin

  function yPos(val) {
    return 100 - ((val - chartMin) / chartRange) * 100
  }

  const n = dataPoints.length
  const barWidth = Math.max(4, Math.min(20, (100 / n) * 0.6))
  const gap = 100 / n

  return (
    <div className="relative w-full h-full">
      {/* UCL line */}
      <div
        className="absolute left-0 right-0 border-t-2 border-dashed border-red-400"
        style={{ top: `${yPos(ucl)}%` }}
      >
        <span className="absolute -top-4 right-0 text-xs text-red-500 bg-white px-1">UCL</span>
      </div>

      {/* Mean line */}
      <div
        className="absolute left-0 right-0 border-t-2 border-blue-400"
        style={{ top: `${yPos(mean)}%` }}
      >
        <span className="absolute -top-4 right-0 text-xs text-blue-500 bg-white px-1">X&#772;</span>
      </div>

      {/* LCL line */}
      <div
        className="absolute left-0 right-0 border-t-2 border-dashed border-red-400"
        style={{ top: `${yPos(lcl)}%` }}
      >
        <span className="absolute -top-4 right-0 text-xs text-red-500 bg-white px-1">LCL</span>
      </div>

      {/* Data points */}
      {dataPoints.map((v, i) => {
        const inControl = v >= lcl && v <= ucl
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${gap * i + gap * 0.2}%`,
              width: `${barWidth}%`,
              bottom: '0',
              height: '100%',
            }}
          >
            {/* Dot */}
            <div
              className={`absolute w-2.5 h-2.5 rounded-full -ml-1 ${inControl ? 'bg-blue-600' : 'bg-red-600'}`}
              style={{ top: `${yPos(v)}%`, left: '50%', transform: 'translate(-50%, -50%)' }}
              title={`#${i + 1}: ${v.toFixed(4)}`}
            />
            {/* Connecting line to next point */}
            {i < dataPoints.length - 1 && (
              <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
                <line
                  x1="50%"
                  y1={`${yPos(v)}%`}
                  x2={`${gap / barWidth * 100 + 50}%`}
                  y2={`${yPos(dataPoints[i + 1])}%`}
                  stroke={inControl ? '#3b82f6' : '#ef4444'}
                  strokeWidth="1"
                  opacity="0.4"
                />
              </svg>
            )}
          </div>
        )
      })}

      {/* X-axis labels (sample numbers) */}
      {dataPoints.length <= 30 && dataPoints.map((_, i) => (
        <span
          key={i}
          className="absolute text-xs text-slate-400"
          style={{ left: `${gap * i + gap * 0.2}%`, bottom: '-16px' }}
        >
          {i + 1}
        </span>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// NCR TAB — Fixed: order-based product filtering + full detail view
// ════════════════════════════════════════════════════════════════════════

function NCRTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selectedNCR, setSelectedNCR] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['quality-ncr', filterStatus, page],
    queryFn: () => api.get('/quality/ncr', { params: { status: filterStatus || undefined, page, limit: 25 } }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body) => api.post('/quality/ncr', body),
    onSuccess: () => {
      toast.success('NCR creat cu succes')
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['quality-ncr'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else toast.error(msg || 'Eroare la creare NCR. Incercati din nou.');
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/quality/ncr/${id}`, body),
    onSuccess: () => {
      toast.success('NCR actualizat')
      qc.invalidateQueries({ queryKey: ['quality-ncr'] })
      setSelectedNCR(null)
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la actualizare. Incercati din nou.'); },
  })

  const closeMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/quality/ncr/${id}/close`, body),
    onSuccess: () => {
      toast.success('NCR inchis')
      qc.invalidateQueries({ queryKey: ['quality-ncr'] })
      setSelectedNCR(null)
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la inchidere. Incercati din nou.'); },
  })

  const ncrList = data?.data || []
  const pagination = data?.pagination || {}

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="input w-48" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">Toate statusurile</option>
          <option value="open">Deschis</option>
          <option value="investigation">Investigatie</option>
          <option value="root_cause">Cauza radacina</option>
          <option value="disposition">Dispozitie</option>
          <option value="closed">Inchis</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1 ml-auto">
          <Plus size={14} /> NCR nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Nr. NCR</th>
                <th className="pb-2 pr-4">Titlu</th>
                <th className="pb-2 pr-4">Tip</th>
                <th className="pb-2 pr-4">Severitate</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Cant. afectata</th>
                <th className="pb-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {ncrList.map(n => (
                <tr
                  key={n.id}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedNCR(n)}
                >
                  <td className="py-2 pr-4 font-mono font-medium text-xs">{n.ncr_number}</td>
                  <td className="py-2 pr-4">{n.title}</td>
                  <td className="py-2 pr-4">
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{n.ncr_type}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[n.severity] || ''}`}>
                      {n.severity}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${NCR_STATUS_COLORS[n.status] || ''}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{n.affected_qty || '-'}</td>
                  <td className="py-2 text-xs text-slate-400">{new Date(n.created_at).toLocaleDateString('ro-RO')}</td>
                </tr>
              ))}
              {ncrList.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Niciun NCR gasit.</td></tr>
              )}
            </tbody>
          </table>
          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {pagination.total}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={ncrList.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <CreateNCRModal onClose={() => setShowModal(false)} onSubmit={d => createMut.mutate(d)} loading={createMut.isPending} />}

      {selectedNCR && (
        <NCRDetailModal
          ncr={selectedNCR}
          onClose={() => setSelectedNCR(null)}
          onUpdate={(body) => updateMut.mutate({ id: selectedNCR.id, body })}
          onCloseNCR={(body) => closeMut.mutate({ id: selectedNCR.id, body })}
          loadingUpdate={updateMut.isPending}
          loadingClose={closeMut.isPending}
        />
      )}
    </div>
  )
}

function CreateNCRModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    title: '', ncr_type: 'internal', severity: 'minor', description: '',
    product_id: '', order_id: '', affected_qty: '',
  })
  const [orderProduct, setOrderProduct] = useState(null)

  // When order is selected, fetch order details to filter product
  useEffect(() => {
    if (!form.order_id) {
      setOrderProduct(null)
      return
    }
    api.get(`/work-orders/${form.order_id}`)
      .then(r => {
        const wo = r.data
        if (wo.product_id) {
          setOrderProduct({ id: wo.product_id, name: wo.product_name || wo.product || '', reference: wo.product_reference || '' })
          setForm(f => ({ ...f, product_id: wo.product_id }))
        } else {
          setOrderProduct(null)
        }
      })
      .catch(() => setOrderProduct(null))
  }, [form.order_id])

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title) return toast.error('Titlu obligatoriu')
    onSubmit({
      ...form,
      product_id: form.product_id || undefined,
      order_id: form.order_id || undefined,
      affected_qty: form.affected_qty ? Number(form.affected_qty) : undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">NCR nou</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Titlu *</label>
            <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Tip</label>
              <select className="input w-full" value={form.ncr_type} onChange={e => setForm(f => ({ ...f, ncr_type: e.target.value }))}>
                <option value="internal">Intern</option>
                <option value="supplier">Furnizor</option>
                <option value="customer">Client</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Severitate</label>
              <select className="input w-full" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critic</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Descriere</label>
            <textarea className="input w-full" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Comanda</label>
              <SearchableSelect
                endpoint="/work-orders"
                labelField="work_order_number"
                valueField="id"
                placeholder="Cauta comanda..."
                value={form.order_id}
                onChange={(id) => setForm(f => ({ ...f, order_id: id || '', product_id: id ? f.product_id : '' }))}
                allowCreate={false}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Produs</label>
              {orderProduct ? (
                <div className="input w-full flex items-center justify-between bg-slate-50">
                  <span className="text-xs text-slate-700 truncate">
                    {orderProduct.reference ? `${orderProduct.reference} - ` : ''}{orderProduct.name || 'Produs din comanda'}
                  </span>
                  <button type="button" onClick={() => { setOrderProduct(null); setForm(f => ({ ...f, product_id: '', order_id: '' })) }}
                    className="text-slate-400 hover:text-slate-600 ml-1 shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  endpoint="/bom/products"
                  labelField="name"
                  valueField="id"
                  placeholder="Cauta produs..."
                  value={form.product_id}
                  onChange={(id) => setForm(f => ({ ...f, product_id: id || '' }))}
                  allowCreate={false}
                />
              )}
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Cant. afectata</label>
              <input type="number" className="input w-full" value={form.affected_qty} onChange={e => setForm(f => ({ ...f, affected_qty: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NCRDetailModal({ ncr, onClose, onUpdate, onCloseNCR, loadingUpdate, loadingClose }) {
  const [rootCause, setRootCause] = useState(ncr.root_cause || '')
  const [disposition, setDisposition] = useState(ncr.disposition || '')
  const [status, setStatus] = useState(ncr.status)

  // Fetch full NCR detail with order/product info
  const { data: ncrDetail } = useQuery({
    queryKey: ['ncr-detail', ncr.id],
    queryFn: () => api.get(`/quality/ncr/${ncr.id}`).then(r => r.data),
  })

  // Fetch order details if available
  const orderId = ncrDetail?.order_id || ncr.order_id
  const { data: orderDetail } = useQuery({
    queryKey: ['work-order-for-ncr', orderId],
    queryFn: () => api.get(`/work-orders/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  // Fetch product details if available
  const productId = ncrDetail?.product_id || ncr.product_id
  const { data: productDetail } = useQuery({
    queryKey: ['product-for-ncr', productId],
    queryFn: () => api.get(`/bom/products/${productId}`).then(r => r.data),
    enabled: !!productId,
  })

  const detail = ncrDetail || ncr
  const isClosed = ncr.status === 'closed'
  const clientName = orderDetail?.client_name || orderDetail?.client || orderDetail?.company_name || ''

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{ncr.ncr_number}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[ncr.severity]}`}>{ncr.severity}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${NCR_STATUS_COLORS[ncr.status]}`}>{ncr.status}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-100">{ncr.ncr_type}</span>
          </div>

          {/* Title and description */}
          <div>
            <p className="font-medium text-base">{detail.title}</p>
            {detail.description && <p className="text-slate-500 mt-1">{detail.description}</p>}
          </div>

          {/* Full information grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-4">
            {clientName && (
              <div>
                <span className="text-xs text-slate-400 block">Client</span>
                <p className="font-medium text-slate-800">{clientName}</p>
              </div>
            )}
            {orderDetail && (
              <div>
                <span className="text-xs text-slate-400 block">Comanda</span>
                <p className="font-medium text-slate-800 font-mono">
                  {orderDetail.work_order_number || orderDetail.order_number || orderDetail.wo_number || '-'}
                </p>
              </div>
            )}
            {productDetail && (
              <div>
                <span className="text-xs text-slate-400 block">Reper</span>
                <p className="font-medium text-slate-800">
                  {productDetail.reference && <span className="text-blue-600 font-mono">{productDetail.reference}</span>}
                  {productDetail.reference && productDetail.name && ' - '}
                  {productDetail.name}
                </p>
              </div>
            )}
            {detail.lot_number && (
              <div>
                <span className="text-xs text-slate-400 block">Lot</span>
                <p className="font-medium text-slate-800">{detail.lot_number}</p>
              </div>
            )}
            {detail.affected_qty && (
              <div>
                <span className="text-xs text-slate-400 block">Cantitate afectata</span>
                <p className="font-medium text-slate-800">{detail.affected_qty}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-400 block">Data creare</span>
              <p className="font-medium text-slate-800">{new Date(detail.created_at).toLocaleString('ro-RO')}</p>
            </div>
          </div>

          {/* Root cause and disposition (always show if available) */}
          {(detail.root_cause || detail.disposition) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              {detail.root_cause && (
                <div>
                  <span className="text-xs font-medium text-amber-700 block">Cauza radacina</span>
                  <p className="text-slate-800">{detail.root_cause}</p>
                </div>
              )}
              {detail.disposition && (
                <div>
                  <span className="text-xs font-medium text-amber-700 block">Dispozitie</span>
                  <p className="text-slate-800">{detail.disposition}</p>
                </div>
              )}
            </div>
          )}

          {!isClosed && (
            <>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Status</label>
                <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="open">Deschis</option>
                  <option value="investigation">Investigatie</option>
                  <option value="root_cause">Cauza radacina</option>
                  <option value="disposition">Dispozitie</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Cauza radacina</label>
                <textarea className="input w-full" rows={3} value={rootCause} onChange={e => setRootCause(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Dispozitie</label>
                <select className="input w-full" value={disposition} onChange={e => setDisposition(e.target.value)}>
                  <option value="">Selecteaza</option>
                  <option value="use_as_is">Folosire ca atare</option>
                  <option value="rework">Reprelucrare</option>
                  <option value="scrap">Rebut</option>
                  <option value="return_supplier">Returnare furnizor</option>
                  <option value="concession">Concesie</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onUpdate({ status, root_cause: rootCause, disposition: disposition || undefined })}
                  disabled={loadingUpdate}
                  className="btn-primary flex-1"
                >
                  {loadingUpdate ? 'Se salveaza...' : 'Actualizeaza'}
                </button>
                <button
                  onClick={() => onCloseNCR({ root_cause: rootCause, disposition: disposition || undefined })}
                  disabled={loadingClose}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700"
                >
                  {loadingClose ? 'Se inchide...' : 'Inchide NCR'}
                </button>
              </div>
            </>
          )}

          {isClosed && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              {ncr.closed_at && <p className="text-xs text-slate-400">Inchis la: {new Date(ncr.closed_at).toLocaleString('ro-RO')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// CAPA TAB — Fixed: actionable buttons, NCR context, timeline
// ════════════════════════════════════════════════════════════════════════

const CAPA_TIMELINE_STEPS = [
  { key: 'open', label: 'Creat' },
  { key: 'in_progress', label: 'In lucru' },
  { key: 'completed', label: 'Completat' },
  { key: 'verified', label: 'Verificat' },
  { key: 'closed', label: 'Inchis' },
]

function CAPATimeline({ status }) {
  const statusOrder = ['open', 'in_progress', 'completed', 'verified', 'closed']
  const currentIdx = statusOrder.indexOf(status)
  const isNotEffective = status === 'not_effective'

  return (
    <div className="flex items-center gap-1 py-2">
      {CAPA_TIMELINE_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx
        const isCurrent = idx === currentIdx
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              isCurrent ? 'bg-blue-600 text-white' :
              isCompleted ? 'bg-green-100 text-green-700' :
              'bg-slate-100 text-slate-400'
            }`}>
              {isCompleted && !isCurrent && <CheckCircle2 size={12} />}
              {isCurrent && <Clock size={12} />}
              {step.label}
            </div>
            {idx < CAPA_TIMELINE_STEPS.length - 1 && (
              <ArrowRight size={12} className={`${isCompleted ? 'text-green-400' : 'text-slate-300'}`} />
            )}
          </div>
        )
      })}
      {isNotEffective && (
        <div className="flex items-center gap-1 ml-2">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Neefectiv</span>
        </div>
      )}
    </div>
  )
}

function CAPADetailPanel({ capa, ncrList, onUpdate, onVerify, loadingUpdate, loadingVerify }) {
  // Find linked NCR
  const linkedNCR = ncrList.find(n => n.id === capa.ncr_id)

  // Fetch full NCR detail if linked
  const { data: ncrDetail } = useQuery({
    queryKey: ['ncr-for-capa', capa.ncr_id],
    queryFn: () => api.get(`/quality/ncr/${capa.ncr_id}`).then(r => r.data),
    enabled: !!capa.ncr_id,
  })

  const ncrInfo = ncrDetail || linkedNCR

  return (
    <div className="border-t border-slate-200 mt-2 pt-3 space-y-3">
      {/* Timeline */}
      <CAPATimeline status={capa.status} />

      {/* NCR context */}
      {ncrInfo && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-xs font-medium text-orange-600 mb-1">Problema gasita (NCR):</p>
          <p className="text-sm font-medium text-slate-800">
            {ncrInfo.ncr_number && <span className="font-mono text-orange-700">{ncrInfo.ncr_number}</span>}
            {' '}{ncrInfo.title}
          </p>
          {ncrInfo.description && (
            <p className="text-xs text-slate-600 mt-1">{ncrInfo.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            {ncrInfo.severity && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[ncrInfo.severity]}`}>{ncrInfo.severity}</span>
            )}
            {ncrInfo.root_cause && (
              <span className="text-xs text-slate-500">Cauza: {ncrInfo.root_cause}</span>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {capa.description && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Descriere actiune:</p>
          <p className="text-sm text-slate-700">{capa.description}</p>
        </div>
      )}

      {/* Action buttons with helper text */}
      <div className="space-y-2">
        {capa.status === 'open' && (
          <button
            onClick={() => onUpdate({ id: capa.id, body: { status: 'in_progress' } })}
            disabled={loadingUpdate}
            className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <Play size={18} className="text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Incepe actiunea</p>
              <p className="text-xs text-amber-600">Marcheaza ca ai inceput sa lucrezi la aceasta actiune corectiva/preventiva</p>
            </div>
          </button>
        )}
        {capa.status === 'in_progress' && (
          <button
            onClick={() => onUpdate({ id: capa.id, body: { status: 'completed' } })}
            disabled={loadingUpdate}
            className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-left"
          >
            <CheckCircle2 size={18} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Finalizeaza</p>
              <p className="text-xs text-green-600">Actiunea a fost implementata si asteapta verificarea eficacitatii</p>
            </div>
          </button>
        )}
        {capa.status === 'completed' && (
          <div className="space-y-2">
            <button
              onClick={() => onVerify({ id: capa.id, body: { is_effective: true } })}
              disabled={loadingVerify}
              className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
            >
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Verifica eficacitate - EFICACE</p>
                <p className="text-xs text-emerald-600">Confirma ca actiunea implementata a rezolvat problema si este eficace</p>
              </div>
            </button>
            <button
              onClick={() => onVerify({ id: capa.id, body: { is_effective: false } })}
              disabled={loadingVerify}
              className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors text-left"
            >
              <XCircle size={18} className="text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Verifica eficacitate - NEEFICACE</p>
                <p className="text-xs text-red-600">Actiunea nu a rezolvat problema, necesita re-deschidere sau actiune noua</p>
              </div>
            </button>
          </div>
        )}
        {capa.status === 'verified' && (
          <button
            onClick={() => onUpdate({ id: capa.id, body: { status: 'closed' } })}
            disabled={loadingUpdate}
            className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <Flag size={18} className="text-slate-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">Inchide CAPA</p>
              <p className="text-xs text-slate-600">Actiunea este verificata si poate fi inchisa definitiv</p>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

function CAPATab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['quality-capa', filterStatus, page],
    queryFn: () => api.get('/quality/capa', { params: { status: filterStatus || undefined, page, limit: 25 } }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body) => api.post('/quality/capa', body),
    onSuccess: () => {
      toast.success('CAPA creat cu succes')
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['quality-capa'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else toast.error(msg || 'Eroare la creare CAPA. Incercati din nou.');
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/quality/capa/${id}`, body),
    onSuccess: () => {
      toast.success('CAPA actualizat')
      qc.invalidateQueries({ queryKey: ['quality-capa'] })
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la actualizare. Incercati din nou.'); },
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/quality/capa/${id}/verify`, body),
    onSuccess: () => {
      toast.success('CAPA verificat')
      qc.invalidateQueries({ queryKey: ['quality-capa'] })
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la verificare. Incercati din nou.'); },
  })

  const { data: ncrData } = useQuery({
    queryKey: ['quality-ncr-for-capa'],
    queryFn: () => api.get('/quality/ncr', { params: { limit: 200 } }).then(r => r.data),
  })

  const capaList = data?.data || []
  const pagination = data?.pagination || {}
  const ncrList = ncrData?.data || []

  function isOverdue(capa) {
    if (!capa.deadline) return false
    if (['verified', 'closed'].includes(capa.status)) return false
    return new Date(capa.deadline) < new Date()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="input w-48" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">Toate statusurile</option>
          <option value="open">Deschis</option>
          <option value="in_progress">In progres</option>
          <option value="completed">Completat</option>
          <option value="verified">Verificat</option>
          <option value="closed">Inchis</option>
          <option value="not_effective">Neefectiv</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1 ml-auto">
          <Plus size={14} /> CAPA nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="space-y-2">
          {capaList.map(c => {
            const overdue = isOverdue(c)
            const isExpanded = expandedId === c.id
            const linkedNCR = ncrList.find(n => n.id === c.ncr_id)
            return (
              <div key={c.id} className={`border rounded-xl p-4 transition-colors ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'} ${isExpanded ? 'ring-1 ring-blue-200' : ''}`}>
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-medium text-xs text-slate-500">{c.capa_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${c.capa_type === 'corrective' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.capa_type === 'corrective' ? 'Corectiva' : 'Preventiva'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${CAPA_STATUS_COLORS[c.status] || ''}`}>
                        {CAPA_STATUS_LABELS[c.status] || c.status}
                      </span>
                      {overdue && <span className="text-xs text-red-600 font-medium">DEPASIT!</span>}
                    </div>
                    <p className="font-medium text-slate-800 text-sm">{c.title}</p>
                    {linkedNCR && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        NCR: {linkedNCR.ncr_number} - {linkedNCR.title}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c.deadline && (
                      <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                        Deadline: {new Date(c.deadline).toLocaleDateString('ro-RO')}
                      </p>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 ml-auto mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <CAPADetailPanel
                    capa={c}
                    ncrList={ncrList}
                    onUpdate={({ id, body }) => updateMut.mutate({ id, body })}
                    onVerify={({ id, body }) => verifyMut.mutate({ id, body })}
                    loadingUpdate={updateMut.isPending}
                    loadingVerify={verifyMut.isPending}
                  />
                )}
              </div>
            )
          })}
          {capaList.length === 0 && (
            <div className="py-8 text-center text-slate-400">Niciun CAPA gasit.</div>
          )}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {pagination.total}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={capaList.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <CreateCAPAModal ncrList={ncrList} onClose={() => setShowModal(false)} onSubmit={d => createMut.mutate(d)} loading={createMut.isPending} />}
    </div>
  )
}

function CreateCAPAModal({ ncrList, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    ncr_id: '', capa_type: 'corrective', title: '', description: '',
    responsible_user_id: '', deadline: '',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title) return toast.error('Titlu obligatoriu')
    onSubmit({
      ...form,
      ncr_id: form.ncr_id || undefined,
      responsible_user_id: form.responsible_user_id || undefined,
      deadline: form.deadline || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">CAPA nou</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">NCR asociat</label>
            <select className="input w-full" value={form.ncr_id} onChange={e => setForm(f => ({ ...f, ncr_id: e.target.value }))}>
              <option value="">Fara NCR (optional)</option>
              {ncrList.map(n => <option key={n.id} value={n.id}>{n.ncr_number} - {n.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Tip CAPA</label>
              <select className="input w-full" value={form.capa_type} onChange={e => setForm(f => ({ ...f, capa_type: e.target.value }))}>
                <option value="corrective">Actiune corectiva</option>
                <option value="preventive">Actiune preventiva</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Deadline</label>
              <input type="date" className="input w-full" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Titlu *</label>
            <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Descriere</label>
            <textarea className="input w-full" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Responsabil</label>
            <SearchableSelect
              endpoint="/auth/users"
              labelField="full_name"
              valueField="id"
              placeholder="Cauta responsabil..."
              value={form.responsible_user_id}
              onChange={(id) => setForm(f => ({ ...f, responsible_user_id: id }))}
              allowCreate={false}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════

export default function QualityPage() {
  const [tab, setTab] = useState('plans')

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <ClipboardCheck size={22} /> Calitate
      </h1>
      <p className="text-sm text-slate-500 mb-6">Planuri de control, masurari, SPC, NCR si actiuni corective/preventive.</p>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlanuriTab />}
      {tab === 'measurements' && <MasurariTab />}
      {tab === 'spc' && <SPCTab />}
      {tab === 'ncr' && <NCRTab />}
      {tab === 'capa' && <CAPATab />}
    </div>
  )
}
