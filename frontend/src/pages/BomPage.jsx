import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, ChevronRight, Package, Pencil, Trash2, X, Search,
  AlertTriangle, Check, ChevronDown, ChevronUp, Save, Settings2,
  Wrench, Gauge, FlaskConical, ShieldAlert, ArrowLeft, FileCheck,
} from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

const TYPE_LABELS = {
  raw_material: 'Materie prima',
  semi_finished: 'Semifabricat',
  finished: 'Produs finit',
  component: 'Componenta',
}

const OPERATION_TYPES = ['cutting', 'bending', 'welding', 'machining', 'assembly', 'painting', 'inspection', 'packaging', 'turning', 'milling', 'grinding', 'drilling', 'heat_treatment']

// ─── MBOM Status Badge ────────────────────────────────────────────────────────

function MBOMStatusBadge({ status }) {
  const map = {
    active:            { label: 'Validat',    cls: 'bg-green-100 text-green-700' },
    pending_approval:  { label: 'In aprobare', cls: 'bg-amber-100 text-amber-700' },
    draft:             { label: 'Ciorna',     cls: 'bg-amber-100 text-amber-700' },
  }
  const m = map[status] || { label: 'Nedefinit', cls: 'bg-red-100 text-red-700' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

// ─── Product Modal (create/edit) ──────────────────────────────────────────────

function ProductModal({ onClose, editProduct }) {
  const qc = useQueryClient()
  const isEdit = !!editProduct
  const [form, setForm] = useState(
    isEdit
      ? {
          reference: editProduct.reference || '',
          name: editProduct.name || '',
          productType: editProduct.product_type || 'finished',
          clientName: editProduct.client_name || '',
          clientId: editProduct.client_id || null,
          materialType: editProduct.material_type || '',
          weightPieceKg: editProduct.weight_piece_kg || '',
        }
      : { reference: '', name: '', productType: 'finished', clientName: '', clientId: null, materialType: '', weightPieceKg: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/bom/products/${editProduct.id}`, data) : api.post('/bom/products', data),
    onSuccess: () => {
      qc.invalidateQueries(['bom-products'])
      if (isEdit) qc.invalidateQueries(['bom-product', editProduct.id])
      toast.success(isEdit ? 'Produs actualizat.' : 'Produs creat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza produs' : 'Produs nou'}</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Referinta *" value={form.reference} onChange={f('reference')} />
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.productType} onChange={f('productType')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <SearchableSelect
            endpoint="/companies"
            filterParams={{ companyType: 'client' }}
            labelField="name"
            valueField="id"
            placeholder="Selecteaza client"
            value={form.clientId}
            onChange={(id, item) => setForm(prev => ({ ...prev, clientId: id, clientName: item?.name || '' }))}
            allowCreate={false}
          />
          <input className="input" placeholder="Tip material" value={form.materialType} onChange={f('materialType')} />
          <input className="input" type="number" placeholder="Masa piesa (kg)" value={form.weightPieceKg} onChange={f('weightPieceKg')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, weightPieceKg: form.weightPieceKg ? Number(form.weightPieceKg) : null })}
            disabled={mutation.isPending || !form.reference || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers: parse JSONB arrays ──────────────────────────────────────────────

function parseJsonArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
  return []
}

// ─── Inline list editors ──────────────────────────────────────────────────────

function ToolsEditor({ items, onChange }) {
  const add = () => onChange([...items, { toolName: '', position: '', toolCode: '' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Scule</label>
      {items.map((t, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <input className="input flex-1 text-sm" placeholder="Denumire scula" value={t.toolName} onChange={e => update(i, 'toolName', e.target.value)} />
          <input className="input w-16 text-sm" placeholder="Pos" value={t.position} onChange={e => update(i, 'position', e.target.value)} />
          <input className="input w-28 text-sm" placeholder="Cod scula" value={t.toolCode} onChange={e => update(i, 'toolCode', e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga scula</button>
    </div>
  )
}

function MachineParamsEditor({ items, onChange }) {
  const add = () => onChange([...items, { name: '', value: '', unit: '' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Parametri masina</label>
      {items.map((p, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <input className="input flex-1 text-sm" placeholder="Parametru" value={p.name} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input w-24 text-sm" placeholder="Valoare" value={p.value} onChange={e => update(i, 'value', e.target.value)} />
          <input className="input w-20 text-sm" placeholder="UM" value={p.unit} onChange={e => update(i, 'unit', e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga parametru</button>
    </div>
  )
}

function ConsumablesEditor({ items, onChange }) {
  const add = () => onChange([...items, { name: '', quantity: '', unit: 'buc' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Consumabile</label>
      {items.map((c2, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <input className="input flex-1 text-sm" placeholder="Denumire" value={c2.name} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input w-20 text-sm" type="number" placeholder="Cant." value={c2.quantity} onChange={e => update(i, 'quantity', e.target.value)} />
          <input className="input w-16 text-sm" placeholder="UM" value={c2.unit} onChange={e => update(i, 'unit', e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga consumabil</button>
    </div>
  )
}

function AttentionPointsEditor({ items, onChange }) {
  const add = () => onChange([...items, { text: '', frequency: '', severity: 'medium' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Puncte atentie</label>
      {items.map((a, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <span className="text-amber-500 shrink-0"><AlertTriangle size={14} /></span>
          <input className="input flex-1 text-sm" placeholder="Descriere atentionare" value={a.text} onChange={e => update(i, 'text', e.target.value)} />
          <input className="input w-28 text-sm" placeholder="Frecventa" value={a.frequency} onChange={e => update(i, 'frequency', e.target.value)} />
          <select className="input w-24 text-sm" value={a.severity} onChange={e => update(i, 'severity', e.target.value)}>
            <option value="low">Scazut</option>
            <option value="medium">Mediu</option>
            <option value="high">Ridicat</option>
          </select>
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga atentionare</button>
    </div>
  )
}

// ─── Operation Detail Editor (expanded row) ──────────────────────────────────

function OperationDetailEditor({ operation, machines, onSaved, onCancel }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    operation_name: operation.operation_name || '',
    operation_type: operation.operation_type || '',
    machine_type: operation.machine_type || '',
    machine_id: operation.machine_id || '',
    cycle_time_seconds: operation.cycle_time_seconds || '',
    setup_time_minutes: operation.setup_time_minutes || '',
    sequence: operation.sequence || '',
    cnc_program: operation.cnc_program || '',
    raw_material_spec: operation.raw_material_spec || '',
    tools_config: parseJsonArray(operation.tools_config),
    machine_parameters: parseJsonArray(operation.machine_parameters),
    consumables: parseJsonArray(operation.consumables),
    attention_points: parseJsonArray(operation.attention_points),
    min_batch_before_next: operation.min_batch_before_next || '',
    description: operation.description || '',
    transfer_type: operation.transfer_type || '',
  })

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const saveMut = useMutation({
    mutationFn: (data) => api.put(`/bom/operations/${operation.id}`, data),
    onSuccess: () => {
      toast.success('Operatie salvata.')
      onSaved?.()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la salvare.'),
  })

  const addAltMut = useMutation({
    mutationFn: (data) => api.post(`/bom/operations/${operation.id}/alternatives`, data),
    onSuccess: () => { toast.success('Alternativa adaugata.'); onSaved?.() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const removeAltMut = useMutation({
    mutationFn: (altId) => api.delete(`/bom/alternatives/${altId}`),
    onSuccess: () => { toast.success('Alternativa stearsa.'); onSaved?.() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const [addingAlt, setAddingAlt] = useState(false)
  const [altMachineId, setAltMachineId] = useState('')

  function handleSave() {
    saveMut.mutate({
      ...form,
      cycle_time_seconds: form.cycle_time_seconds ? Number(form.cycle_time_seconds) : null,
      setup_time_minutes: form.setup_time_minutes ? Number(form.setup_time_minutes) : null,
      sequence: form.sequence ? Number(form.sequence) : null,
      min_batch_before_next: form.min_batch_before_next ? Number(form.min_batch_before_next) : null,
    })
  }

  // Filter machines for dropdown
  const machineOptions = machines || []

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <Settings2 size={15} />
          OP{form.sequence} {form.operation_name}
        </h4>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      {/* Basic fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Nume operatie</label>
          <input className="input text-sm" value={form.operation_name} onChange={f('operation_name')} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Tip operatie</label>
          <select className="input text-sm" value={form.operation_type} onChange={f('operation_type')}>
            <option value="">Selecteaza</option>
            {OPERATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Secventa</label>
          <input className="input text-sm" type="number" value={form.sequence} onChange={f('sequence')} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Transfer lot</label>
          <select className="input text-sm" value={form.transfer_type} onChange={f('transfer_type')}>
            <option value="">-</option>
            <option value="batch">Lot complet</option>
            <option value="transfer_batch">Lot transfer</option>
            <option value="piece">Piesa cu piesa</option>
          </select>
        </div>
      </div>

      {/* Machine + Alternatives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Masina principala</label>
          <select className="input text-sm" value={form.machine_id} onChange={f('machine_id')}>
            <option value="">Nealocata</option>
            {machineOptions.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Tip masina</label>
          <input className="input text-sm" value={form.machine_type} onChange={f('machine_type')} />
        </div>
      </div>

      {/* Alternatives */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Masini alternative</label>
        {operation.alternatives?.length > 0 ? (
          <div className="space-y-1 mb-2">
            {operation.alternatives.map(alt => (
              <div key={alt.id} className="flex items-center gap-2 text-sm bg-white rounded px-3 py-1.5 border border-slate-100">
                <span className="flex-1 text-slate-700">{alt.machine_code || ''} {alt.machine_name || `Masina ${alt.machine_id?.slice(0,8)}`}</span>
                {alt.cycle_time_seconds_override && <span className="text-xs text-slate-400">{alt.cycle_time_seconds_override}s</span>}
                {alt.is_preferred && <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded">preferata</span>}
                <button onClick={() => removeAltMut.mutate(alt.id)} className="text-red-400 hover:text-red-600"><X size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-slate-400 mb-2">Nicio alternativa.</p>}
        {addingAlt ? (
          <div className="flex gap-2 items-center">
            <select className="input text-sm flex-1" value={altMachineId} onChange={e => setAltMachineId(e.target.value)}>
              <option value="">Selecteaza masina</option>
              {machineOptions.filter(m => m.id !== form.machine_id).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
            </select>
            <button
              onClick={() => { if (altMachineId) { addAltMut.mutate({ machineId: altMachineId }); setAddingAlt(false); setAltMachineId('') } }}
              className="btn-primary text-xs"
              disabled={!altMachineId}
            >Adauga</button>
            <button onClick={() => setAddingAlt(false)} className="btn-secondary text-xs">Anuleaza</button>
          </div>
        ) : (
          <button onClick={() => setAddingAlt(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga alternativa</button>
        )}
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Timp ciclu (sec)</label>
          <input className="input text-sm" type="number" value={form.cycle_time_seconds} onChange={f('cycle_time_seconds')} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Setup (min)</label>
          <input className="input text-sm" type="number" value={form.setup_time_minutes} onChange={f('setup_time_minutes')} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Lot transfer minim</label>
          <input className="input text-sm" type="number" placeholder="piese" value={form.min_batch_before_next} onChange={f('min_batch_before_next')} />
        </div>
        <div className="flex items-end">
          {form.cycle_time_seconds > 0 && (
            <span className="text-xs text-slate-400">
              = {Math.round(3600 / Number(form.cycle_time_seconds))} buc/h
            </span>
          )}
        </div>
      </div>

      {/* CNC Program + Raw material */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Program CNC</label>
          <input className="input text-sm" placeholder="ex: PRG-ARB42-STRUNJ-V3.nc" value={form.cnc_program} onChange={f('cnc_program')} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Semifabricat / materie prima</label>
          <input className="input text-sm" placeholder="ex: Bara rotunda O45 L=120mm, Otel 42CrMo4" value={form.raw_material_spec} onChange={f('raw_material_spec')} />
        </div>
      </div>

      {/* Tools */}
      <ToolsEditor items={form.tools_config} onChange={v => setForm(prev => ({ ...prev, tools_config: v }))} />

      {/* Machine Parameters */}
      <MachineParamsEditor items={form.machine_parameters} onChange={v => setForm(prev => ({ ...prev, machine_parameters: v }))} />

      {/* Consumables */}
      <ConsumablesEditor items={form.consumables} onChange={v => setForm(prev => ({ ...prev, consumables: v }))} />

      {/* Attention Points */}
      <AttentionPointsEditor items={form.attention_points} onChange={v => setForm(prev => ({ ...prev, attention_points: v }))} />

      {/* Description */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Descriere / observatii</label>
        <textarea className="input text-sm" rows={2} value={form.description} onChange={f('description')} />
      </div>

      {/* Save */}
      <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
        <button onClick={onCancel} className="btn-secondary text-sm">Inchide</button>
        <button onClick={handleSave} disabled={saveMut.isPending} className="btn-primary text-sm flex items-center gap-1">
          <Save size={14} /> {saveMut.isPending ? 'Se salveaza...' : 'Salveaza'}
        </button>
      </div>
    </div>
  )
}

// ─── New Operation Modal ──────────────────────────────────────────────────────

function NewOperationModal({ productId, nextSequence, onClose, onCreated }) {
  const [form, setForm] = useState({
    operation_name: '',
    operation_type: '',
    machine_type: '',
    sequence: nextSequence || 10,
    cycle_time_seconds: '',
    setup_time_minutes: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/bom/products/${productId}/operations`, data),
    onSuccess: () => { toast.success('Operatie adaugata.'); onCreated?.(); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga operatie</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume operatie *" value={form.operation_name} onChange={f('operation_name')} />
          <select className="input" value={form.operation_type} onChange={f('operation_type')}>
            <option value="">Selecteaza tip</option>
            {OPERATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input" placeholder="Tip masina" value={form.machine_type} onChange={f('machine_type')} />
          <div className="grid grid-cols-3 gap-3">
            <input className="input" type="number" placeholder="Secventa" value={form.sequence} onChange={f('sequence')} />
            <input className="input" type="number" placeholder="Ciclu (sec)" value={form.cycle_time_seconds} onChange={f('cycle_time_seconds')} />
            <input className="input" type="number" placeholder="Setup (min)" value={form.setup_time_minutes} onChange={f('setup_time_minutes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              operationName: form.operation_name,
              operationType: form.operation_type,
              machineType: form.machine_type,
              sequence: Number(form.sequence) || nextSequence,
              cycleTimeSeconds: form.cycle_time_seconds ? Number(form.cycle_time_seconds) : null,
              setupTimeMinutes: form.setup_time_minutes ? Number(form.setup_time_minutes) : null,
            })}
            disabled={mutation.isPending || !form.operation_name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Adauga'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MBOM Editor (Tab 3) ─────────────────────────────────────────────────────

function MBOMEditor({ orderId, onBack }) {
  const qc = useQueryClient()
  const [expandedOp, setExpandedOp] = useState(null)
  const [showNewOp, setShowNewOp] = useState(false)

  const { data: mbom, isLoading, refetch } = useQuery({
    queryKey: ['mbom-order', orderId],
    queryFn: () => api.get(`/bom/mbom/order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  const { data: machinesData } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines', { params: { limit: 500 } }).then(r => r.data?.data || r.data || []),
  })
  const machines = Array.isArray(machinesData) ? machinesData : machinesData?.data || []

  const validateMut = useMutation({
    mutationFn: () => api.put(`/bom/products/${mbom.product.id}/validate`),
    onSuccess: () => {
      toast.success('MBOM validat cu succes.')
      refetch()
      qc.invalidateQueries(['work-orders'])
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la validare.'),
  })

  const deleteOpMut = useMutation({
    mutationFn: (opId) => api.delete(`/bom/operations/${opId}`),
    onSuccess: () => { toast.success('Operatie stearsa.'); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  if (isLoading) return <div className="text-center py-12 text-slate-400">Se incarca MBOM...</div>

  const order = mbom?.order
  const product = mbom?.product
  const operations = mbom?.operations || []
  const components = mbom?.components || []

  if (!order) return <div className="text-center py-12 text-slate-400">Comanda nu a fost gasita.</div>

  const nextSeq = operations.length > 0
    ? Math.max(...operations.map(o => o.sequence || 0)) + 10
    : 10

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">MBOM Editor</h2>
          <p className="text-sm text-slate-500">
            {order.work_order_number} - {order.product_name || order.product_reference} - {order.quantity} buc
            {order.scheduled_end && <span className="ml-2 text-slate-400">Deadline: {new Date(order.scheduled_end).toLocaleDateString('ro-RO')}</span>}
          </p>
        </div>
        {product && (
          <MBOMStatusBadge status={product.approval_status} />
        )}
      </div>

      {/* Product not found warning */}
      {!product && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Produs BOM negasit</p>
            <p className="text-amber-600">Produsul <strong>{order.product_reference || order.product_name}</strong> nu exista in catalogul BOM. Creati-l mai intai in tab-ul "Catalog Produse".</p>
          </div>
        </div>
      )}

      {product && (
        <>
          {/* Product info card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{product.name}</h3>
                <p className="text-xs text-slate-400">{product.reference} - {TYPE_LABELS[product.product_type] || product.product_type} {product.client_name && <span>- {product.client_name}</span>}</p>
              </div>
              <div className="text-right text-xs text-slate-400">
                {product.current_version && <span>v{product.current_version}</span>}
              </div>
            </div>
          </div>

          {/* Components (if assembly) */}
          {components.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><Package size={14} /> Componente</h4>
              <div className="flex flex-wrap gap-2">
                {components.map(c => (
                  <span key={c.id} className="text-xs bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">
                    {c.component_name || c.component_reference || `#${c.component_product_id?.slice(0,8)}`} x{c.qty_per_parent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Operations table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h4 className="text-sm font-medium text-slate-700">Operatii ({operations.length})</h4>
              <button onClick={() => setShowNewOp(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus size={12} /> Adauga operatie
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {operations.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-400 text-sm">
                  Nicio operatie definita. Adaugati prima operatie.
                </div>
              )}
              {operations.map(op => (
                <div key={op.id}>
                  {/* Summary row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${expandedOp === op.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedOp(expandedOp === op.id ? null : op.id)}
                  >
                    <span className="text-xs text-slate-400 w-8 font-mono">{op.sequence}</span>
                    <span className="font-medium text-slate-700 flex-1 text-sm">{op.operation_name}</span>
                    <span className="text-xs text-slate-400 hidden md:inline">{op.machine_name || op.machine_code || '-'}</span>
                    {op.alternatives?.length > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded hidden md:inline">+{op.alternatives.length} alt</span>
                    )}
                    <span className="text-xs text-slate-400 w-16 text-right hidden sm:inline">{op.cycle_time_seconds ? `${op.cycle_time_seconds}s` : '-'}</span>
                    <span className="text-xs text-slate-400 w-16 text-right hidden sm:inline">{op.setup_time_minutes ? `${op.setup_time_minutes}m` : '-'}</span>
                    <span className="text-xs text-slate-400 hidden lg:inline w-32 truncate">{op.cnc_program || ''}</span>
                    <span className="text-xs text-slate-400 hidden lg:inline w-12 text-right">{op.min_batch_before_next || '-'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm('Stergi operatia?')) deleteOpMut.mutate(op.id) }}
                      className="text-slate-300 hover:text-red-500 ml-1"
                    >
                      <Trash2 size={13} />
                    </button>
                    {expandedOp === op.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>

                  {/* Expanded detail */}
                  {expandedOp === op.id && (
                    <div className="px-4 pb-4 pt-1">
                      <OperationDetailEditor
                        operation={op}
                        machines={machines}
                        onSaved={() => { refetch(); }}
                        onCancel={() => setExpandedOp(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Column header for reference */}
            {operations.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                <span className="w-8">Seq</span>
                <span className="flex-1">Operatie</span>
                <span className="hidden md:inline">Masina</span>
                <span className="hidden md:inline w-12"></span>
                <span className="w-16 text-right hidden sm:inline">Ciclu</span>
                <span className="w-16 text-right hidden sm:inline">Setup</span>
                <span className="hidden lg:inline w-32">CNC</span>
                <span className="hidden lg:inline w-12 text-right">Lot</span>
                <span className="w-4"></span>
                <span className="w-4"></span>
              </div>
            )}
          </div>

          {/* Bottom buttons */}
          <div className="flex gap-3 justify-end">
            <button onClick={onBack} className="btn-secondary flex items-center gap-1.5">
              <ArrowLeft size={14} /> Inapoi
            </button>
            {product.approval_status !== 'active' && (
              <button
                onClick={() => validateMut.mutate()}
                disabled={validateMut.isPending || operations.length === 0}
                className="btn-primary flex items-center gap-1.5"
              >
                <FileCheck size={14} /> {validateMut.isPending ? 'Se valideaza...' : 'Valideaza MBOM'}
              </button>
            )}
          </div>
        </>
      )}

      {showNewOp && product && (
        <NewOperationModal
          productId={product.id}
          nextSequence={nextSeq}
          onClose={() => setShowNewOp(false)}
          onCreated={refetch}
        />
      )}
    </div>
  )
}

// ─── Tab 1: Orders needing MBOM ──────────────────────────────────────────────

function OrdersTab({ onSelectOrder }) {
  const [search, setSearch] = useState('')

  const { data: woData, isLoading } = useQuery({
    queryKey: ['work-orders', 'all'],
    queryFn: () => api.get('/work-orders', { params: { limit: 200 } }).then(r => r.data),
  })

  const { data: productsData } = useQuery({
    queryKey: ['bom-products-all'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })

  // Build product lookup for MBOM status
  const productMap = useMemo(() => {
    const map = {}
    const list = productsData?.data || []
    for (const p of list) {
      if (p.reference) map[p.reference] = p
      if (p.name) map[p.name.toLowerCase()] = p
    }
    return map
  }, [productsData])

  function getMBOMStatus(wo) {
    const product = productMap[wo.product_reference] || productMap[wo.product_name?.toLowerCase()]
    if (!product) return null
    return product.approval_status
  }

  const orders = (woData?.data || []).filter(wo => {
    if (!search) return true
    const s = search.toLowerCase()
    return (wo.work_order_number || '').toLowerCase().includes(s)
      || (wo.product_name || '').toLowerCase().includes(s)
      || (wo.product_reference || '').toLowerCase().includes(s)
      || (wo.order_number || '').toLowerCase().includes(s)
  })

  return (
    <div className="space-y-3">
      <input
        className="input max-w-sm"
        placeholder="Cauta comenzi..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Comanda</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Comanda prod.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Cantitate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Deadline</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status MBOM</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {orders.map(wo => {
              const mbomStatus = getMBOMStatus(wo)
              return (
                <tr key={wo.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelectOrder(wo.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{wo.work_order_number}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{wo.order_number || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{wo.product_name || wo.product_reference || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{wo.quantity} buc</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {wo.scheduled_end ? new Date(wo.scheduled_end).toLocaleDateString('ro-RO') : '-'}
                  </td>
                  <td className="px-4 py-3"><MBOMStatusBadge status={mbomStatus} /></td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={14} className="text-slate-300 ml-auto" /></td>
                </tr>
              )
            })}
            {orders.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-2 text-slate-300" />
                Nicio comanda de lucru gasita.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab 2: Product Catalog ──────────────────────────────────────────────────

function ProductCatalogTab() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['bom-products', search],
    queryFn: () => api.get('/bom/products', { params: { search, limit: 100 } }).then(r => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['bom-product', selected?.id],
    queryFn: () => api.get(`/bom/products/${selected.id}`).then(r => r.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <input
          className="input max-w-sm"
          placeholder="Cauta dupa referinta sau denumire..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {isManager && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Produs nou
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Referinta</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Tip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Client</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(p)}>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.reference}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[p.product_type] || p.product_type}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{p.client_name || '-'}</td>
                <td className="px-4 py-3 hidden lg:table-cell"><MBOMStatusBadge status={p.approval_status} /></td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="text-slate-300 ml-auto" />
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-2 text-slate-300" />
                Niciun produs.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <ProductModal onClose={() => setModal(false)} />}
      {selected && detail && <ProductDetailModal product={detail} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Product Detail Modal (for Catalog tab) ──────────────────────────────────

function ProductDetailModal({ product, onClose }) {
  const qc = useQueryClient()
  const [editProduct, setEditProduct] = useState(false)
  const [opModal, setOpModal] = useState(null)

  const deleteOpMut = useMutation({
    mutationFn: (opId) => api.delete(`/bom/operations/${opId}`),
    onSuccess: () => { qc.invalidateQueries(['bom-product', product.id]); toast.success('Operatie stearsa.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const isAssemblyType = ['finished', 'assembly', 'semi_finished'].includes(product.product_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-400">{product.reference} - {TYPE_LABELS[product.product_type] || product.product_type}</p>
          </div>
          <div className="flex gap-2">
            <MBOMStatusBadge status={product.approval_status} />
            <button onClick={() => setEditProduct(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        {/* Operations */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-700">Operatii</h4>
            <button onClick={() => setOpModal('new')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga operatie</button>
          </div>
          {product.operations?.length > 0 ? (
            <div className="space-y-1">
              {product.operations.map(op => (
                <div key={op.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400 w-5">{op.sequence}.</span>
                  <span className="font-medium text-slate-700 flex-1">{op.operation_name}</span>
                  {op.cnc_program && <span className="text-xs text-slate-400 hidden md:inline">{op.cnc_program}</span>}
                  {op.pieces_per_hour && <span className="text-xs text-slate-400">{Math.round(op.pieces_per_hour)} buc/h</span>}
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Stergi operatia?')) deleteOpMut.mutate(op.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Nicio operatie.</p>}
        </div>

        {/* Materials */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Materiale</h4>
          {product.materials?.length > 0 ? (
            <div className="space-y-1">
              {product.materials.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-700 flex-1">{m.material_name}</span>
                  <span className="text-slate-400 text-xs">{m.qty_per_piece} {m.unit}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Niciun material.</p>}
        </div>

        {/* Components */}
        {isAssemblyType && product.components?.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Componente</h4>
            <div className="space-y-1">
              {product.components.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-700">{c.component_name || c.component_reference || `#${c.component_product_id?.slice(0,8)}`}</span>
                  <span className="text-slate-400 text-xs">x {c.qty_per_parent}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editProduct && <ProductModal editProduct={product} onClose={() => setEditProduct(false)} />}
      {opModal && (
        <NewOperationModal
          productId={product.id}
          nextSequence={(product.operations?.length ? Math.max(...product.operations.map(o => o.sequence || 0)) : 0) + 10}
          onClose={() => setOpModal(null)}
          onCreated={() => qc.invalidateQueries(['bom-product', product.id])}
        />
      )}
    </div>
  )
}

// ─── Main BOM Page ───────────────────────────────────────────────────────────

export default function BomPage() {
  const [activeTab, setActiveTab] = useState('comenzi')
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  function handleSelectOrder(orderId) {
    setSelectedOrderId(orderId)
    setActiveTab('mbom-editor')
  }

  function handleBackFromEditor() {
    setSelectedOrderId(null)
    setActiveTab('comenzi')
  }

  // If in MBOM editor mode, show it full-screen
  if (activeTab === 'mbom-editor' && selectedOrderId) {
    return (
      <div className="space-y-4">
        <MBOMEditor orderId={selectedOrderId} onBack={handleBackFromEditor} />
      </div>
    )
  }

  const tabs = [
    { key: 'comenzi', label: 'Comenzi' },
    { key: 'catalog', label: 'Catalog Produse' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">BOM / MBOM</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'comenzi' && <OrdersTab onSelectOrder={handleSelectOrder} />}
      {activeTab === 'catalog' && <ProductCatalogTab />}
    </div>
  )
}
