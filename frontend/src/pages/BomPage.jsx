import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo, Fragment } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, ChevronRight, Package, Trash2, X, Search,
  AlertTriangle, Check, ChevronDown, ChevronUp, Save, Settings2,
  Wrench, Gauge, ArrowLeft, FileCheck, GripVertical,
  Factory, Layers, Box, Clock, FileText, Cpu, Eye,
  Download, CheckCircle2, CircleDot, ArrowRight, Copy, LayoutTemplate,
} from 'lucide-react'

// ─── Constants ──────────────────────────────────────────────────────────────────

const OPERATION_TYPES = [
  'cutting', 'bending', 'welding', 'machining', 'assembly', 'painting',
  'inspection', 'packaging', 'turning', 'milling', 'grinding', 'drilling',
  'heat_treatment', 'deburring', 'surface_treatment',
]

const OP_TYPE_LABELS = {
  cutting: 'Debitare', bending: 'Indoire', welding: 'Sudura',
  machining: 'Prelucrare', assembly: 'Asamblare', painting: 'Vopsire',
  inspection: 'Inspectie', packaging: 'Ambalare', turning: 'Strunjire',
  milling: 'Frezare', grinding: 'Rectificare', drilling: 'Gaurire',
  heat_treatment: 'Trat. termic', deburring: 'Debavurare',
  surface_treatment: 'Trat. suprafata',
}

const TIME_UNITS = [
  { value: 'seconds', label: 'sec', short: 's' },
  { value: 'minutes', label: 'min', short: 'm' },
  { value: 'hours', label: 'ore', short: 'h' },
]

const REJECT_ACTIONS = [
  { value: 'rework', label: 'Reprelucrare' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'inspector_decision', label: 'Decizie inspector' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseJsonArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
  return []
}

function formatTime(seconds, unit) {
  if (!seconds && seconds !== 0) return '-'
  const n = Number(seconds)
  if (unit === 'minutes') return `${(n / 60).toFixed(1)}m`
  if (unit === 'hours') return `${(n / 3600).toFixed(2)}h`
  if (n >= 3600) return `${(n / 3600).toFixed(1)}h`
  if (n >= 60) return `${(n / 60).toFixed(1)}m`
  return `${n}s`
}

function timeToSeconds(value, unit) {
  const n = Number(value) || 0
  if (unit === 'minutes') return n * 60
  if (unit === 'hours') return n * 3600
  return n
}

function secondsToUnit(seconds, unit) {
  const n = Number(seconds) || 0
  if (unit === 'minutes') return +(n / 60).toFixed(2)
  if (unit === 'hours') return +(n / 3600).toFixed(4)
  return n
}

// ─── MBOM Status Badge ──────────────────────────────────────────────────────────

function MBOMStatusBadge({ status }) {
  const map = {
    active: { label: 'Validat', cls: 'bg-green-100 text-green-700' },
    pending_approval: { label: 'In aprobare', cls: 'bg-amber-100 text-amber-700' },
    draft: { label: 'Ciorna', cls: 'bg-amber-100 text-amber-700' },
  }
  const m = map[status] || { label: 'Nedefinit', cls: 'bg-red-100 text-red-700' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER LIST (default view)
// ═══════════════════════════════════════════════════════════════════════════════

function OrderList({ onSelectOrder }) {
  const [search, setSearch] = useState('')

  const { data: woData, isLoading } = useQuery({
    queryKey: ['work-orders', 'all'],
    queryFn: () => api.get('/work-orders', { params: { limit: 200 } }).then(r => r.data),
  })

  const { data: productsData } = useQuery({
    queryKey: ['bom-products-all'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })

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
      || (wo.client_name || '').toLowerCase().includes(s)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">BOM / MBOM - Comenzi</h2>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Cauta comenzi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Comanda</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Client</th>
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
                <tr key={wo.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onSelectOrder(wo.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{wo.work_order_number}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{wo.client_name || '-'}</td>
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

// ═══════════════════════════════════════════════════════════════════════════════
// DND COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// --- Draggable material item (left panel) ---
function DraggableMaterial({ item }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `material-${item.id}`,
    data: { type: 'material', item },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-30 border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <CircleDot size={14} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">
          {item.material_code || item.code || item.name}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {item.raw_dimensions || item.dimensions || item.description || ''}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {item.current_stock != null && (
            <span className={`text-xs font-medium ${item.current_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              Stoc: {item.current_stock} {item.current_stock > 0 ? '\u2705' : '\u26A0\uFE0F'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Draggable machine item (right panel) ---
function DraggableMachine({ machine, loadPercent }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `machine-${machine.id}`,
    data: { type: 'machine', machine },
  })

  const loadColor = loadPercent > 80 ? 'bg-red-500' : loadPercent > 50 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-30 border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700">{machine.code}</p>
        <p className="text-xs text-slate-400 truncate">{machine.name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${loadColor}`} style={{ width: `${Math.min(loadPercent, 100)}%` }} />
        </div>
        <span className="text-xs text-slate-400 w-8 text-right">{loadPercent}%</span>
      </div>
    </div>
  )
}

// --- Sortable operation card ---
function SortableOperationCard({ op, onClick, isOver }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: op.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hasTools = parseJsonArray(op.tools_config).length > 0
  const hasCnc = !!op.cnc_program
  const hasDrawing = !!op.drawing_url

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex-shrink-0 w-36 rounded-lg border-2 p-2.5 cursor-pointer transition-all select-none ${
        isDragging ? 'opacity-40 border-blue-400 shadow-lg z-50' :
        isOver ? 'border-blue-400 bg-blue-50 shadow-md' :
        'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={12} className="text-slate-400" />
      </div>

      {/* Sequence badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
          Op{op.sequence}
        </span>
        <div className="flex items-center gap-0.5">
          {hasTools && <Wrench size={10} className="text-slate-400" />}
          {hasCnc && <Cpu size={10} className="text-slate-400" />}
          {hasDrawing && <FileText size={10} className="text-slate-400" />}
        </div>
      </div>

      {/* Op name */}
      <p className="text-xs font-semibold text-slate-700 truncate mb-1">
        {OP_TYPE_LABELS[op.operation_type] || op.operation_name || 'Operatie'}
      </p>

      {/* Machine */}
      <p className={`text-[10px] truncate mb-1 ${op.machine_code ? 'text-slate-500' : 'text-orange-400 italic'}`}>
        {op.machine_code || 'Trage masina'}
      </p>

      {/* Time */}
      <p className="text-[10px] text-slate-400">
        {formatTime(op.cycle_time_seconds, op.time_unit)}
        {op.setup_time_minutes ? ` + ${op.setup_time_minutes}m setup` : ''}
      </p>

      {/* Drop indicator for machine */}
      <OperationDropZone operationId={op.id} />
    </div>
  )
}

// --- Drop zone overlay on operation card (for machines/materials) ---
function OperationDropZone({ operationId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-op-${operationId}`,
    data: { type: 'operation', operationId },
  })

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 rounded-lg transition-colors pointer-events-none ${
        isOver ? 'bg-blue-200/30 ring-2 ring-blue-400' : ''
      }`}
    />
  )
}

// --- Arrow connector between cards ---
function FlowArrow() {
  return (
    <div className="flex items-center justify-center flex-shrink-0 w-6 self-center">
      <ArrowRight size={14} className="text-slate-300" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE ARRAY EDITORS
// ═══════════════════════════════════════════════════════════════════════════════

function ToolsEditor({ items, onChange }) {
  const add = () => onChange([...items, { toolName: '', position: '', toolCode: '' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Scule</label>
      {items.map((t, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <input className="input flex-1 text-sm" placeholder="Denumire scula" value={t.toolName || ''} onChange={e => update(i, 'toolName', e.target.value)} />
          <input className="input w-16 text-sm" placeholder="Pos" value={t.position || ''} onChange={e => update(i, 'position', e.target.value)} />
          <input className="input w-28 text-sm" placeholder="Cod scula" value={t.toolCode || ''} onChange={e => update(i, 'toolCode', e.target.value)} />
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
          <input className="input flex-1 text-sm" placeholder="Parametru" value={p.name || ''} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input w-24 text-sm" placeholder="Valoare" value={p.value || ''} onChange={e => update(i, 'value', e.target.value)} />
          <input className="input w-20 text-sm" placeholder="UM" value={p.unit || ''} onChange={e => update(i, 'unit', e.target.value)} />
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
          <input className="input flex-1 text-sm" placeholder="Denumire" value={c2.name || ''} onChange={e => update(i, 'name', e.target.value)} />
          <input className="input w-20 text-sm" type="number" placeholder="Cant." value={c2.quantity || ''} onChange={e => update(i, 'quantity', e.target.value)} />
          <input className="input w-16 text-sm" placeholder="UM" value={c2.unit || ''} onChange={e => update(i, 'unit', e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga consumabil</button>
    </div>
  )
}

function VerificationsEditor({ items, onChange }) {
  const add = () => onChange([...items, { text: '', tolerance: '', frequency: '' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i, field, val) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c) }
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">Verificari</label>
      {items.map((v, i) => (
        <div key={i} className="flex gap-2 mb-1.5 items-center">
          <input className="input flex-1 text-sm" placeholder="Ce se verifica" value={v.text || ''} onChange={e => update(i, 'text', e.target.value)} />
          <input className="input w-24 text-sm" placeholder="Toleranta" value={v.tolerance || ''} onChange={e => update(i, 'tolerance', e.target.value)} />
          <input className="input w-24 text-sm" placeholder="Frecventa" value={v.frequency || ''} onChange={e => update(i, 'frequency', e.target.value)} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Plus size={12} /> Adauga verificare</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATION DETAIL DRAWER (modal/side panel)
// ═══════════════════════════════════════════════════════════════════════════════

function OperationDetailDrawer({ operation, machines, onSaved, onClose, onDelete }) {
  const [form, setForm] = useState({
    operation_name: operation.operation_name || '',
    operation_type: operation.operation_type || '',
    machine_type: operation.machine_type || '',
    machine_id: operation.machine_id || '',
    cycle_time_seconds: operation.cycle_time_seconds || '',
    time_unit: operation.time_unit || 'seconds',
    setup_time_minutes: operation.setup_time_minutes || '',
    sequence: operation.sequence || '',
    cnc_program: operation.cnc_program || '',
    raw_material_spec: operation.raw_material_spec || '',
    drawing_url: operation.drawing_url || '',
    tools_config: parseJsonArray(operation.tools_config),
    machine_parameters: parseJsonArray(operation.machine_parameters),
    consumables: parseJsonArray(operation.consumables),
    attention_points: parseJsonArray(operation.attention_points),
    min_batch_before_next: operation.min_batch_before_next || '',
    transport_time_minutes: operation.transport_time_minutes || '',
    deposit_location: operation.deposit_location || '',
    reject_action: operation.reject_action || 'scrap',
    transfer_type: operation.transfer_type || '',
    description: operation.description || '',
  })

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  // Computed display time in user's chosen unit
  const displayTime = form.cycle_time_seconds ? secondsToUnit(form.cycle_time_seconds, form.time_unit) : ''

  const handleTimeChange = (e) => {
    const val = e.target.value
    if (val === '' || val === null) {
      setForm(prev => ({ ...prev, cycle_time_seconds: '' }))
    } else {
      setForm(prev => ({ ...prev, cycle_time_seconds: timeToSeconds(val, prev.time_unit) }))
    }
  }

  const handleUnitChange = (e) => {
    setForm(prev => ({ ...prev, time_unit: e.target.value }))
  }

  const saveMut = useMutation({
    mutationFn: (data) => api.put(`/bom/operations/${operation.id}`, data),
    onSuccess: () => { toast.success('Operatie salvata.'); onSaved?.() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la salvare.'),
  })

  function handleSave() {
    saveMut.mutate({
      ...form,
      cycle_time_seconds: form.cycle_time_seconds ? Number(form.cycle_time_seconds) : null,
      setup_time_minutes: form.setup_time_minutes ? Number(form.setup_time_minutes) : null,
      sequence: form.sequence ? Number(form.sequence) : null,
      min_batch_before_next: form.min_batch_before_next ? Number(form.min_batch_before_next) : null,
      transport_time_minutes: form.transport_time_minutes ? Number(form.transport_time_minutes) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Settings2 size={16} />
              Op{form.sequence} - {form.operation_name || 'Operatie'}
            </h3>
            <p className="text-xs text-slate-400">{operation.machine_code || 'Fara masina alocata'}</p>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => { if (confirm('Stergi operatia?')) onDelete(operation.id) }}
                className="btn-secondary text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={13} /> Sterge
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nume operatie</label>
              <input className="input text-sm" value={form.operation_name} onChange={f('operation_name')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tip operatie</label>
              <select className="input text-sm" value={form.operation_type} onChange={f('operation_type')}>
                <option value="">Selecteaza</option>
                {OPERATION_TYPES.map(t => <option key={t} value={t}>{OP_TYPE_LABELS[t] || t}</option>)}
              </select>
            </div>
          </div>

          {/* Machine */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Masina (sau trage din panoul drept)</label>
              <select className="input text-sm" value={form.machine_id} onChange={f('machine_id')}>
                <option value="">Nealocata</option>
                {(machines || []).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tip masina</label>
              <input className="input text-sm" value={form.machine_type} onChange={f('machine_type')} />
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Timp ciclu</label>
              <input className="input text-sm" type="number" step="any" value={displayTime} onChange={handleTimeChange} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Unitate</label>
              <select className="input text-sm" value={form.time_unit} onChange={handleUnitChange}>
                {TIME_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Setup (min)</label>
              <input className="input text-sm" type="number" value={form.setup_time_minutes} onChange={f('setup_time_minutes')} />
            </div>
            <div className="flex items-end pb-1">
              {form.cycle_time_seconds > 0 && (
                <span className="text-xs text-slate-400">= {Math.round(3600 / Number(form.cycle_time_seconds))} buc/h</span>
              )}
            </div>
          </div>

          {/* Material + output */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Semifabricat / materie prima</label>
              <input className="input text-sm" placeholder="ex: Bara rotunda O45 L=120mm" value={form.raw_material_spec} onChange={f('raw_material_spec')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Program CNC</label>
              <input className="input text-sm" placeholder="ex: PRG-ARB42-STRUNJ-V3.nc" value={form.cnc_program} onChange={f('cnc_program')} />
            </div>
          </div>

          {/* Drawing */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Desen tehnic (URL)</label>
            <input className="input text-sm" placeholder="URL desen tehnic sau referinta fisier" value={form.drawing_url} onChange={f('drawing_url')} />
          </div>

          {/* Tools */}
          <ToolsEditor items={form.tools_config} onChange={v => setForm(prev => ({ ...prev, tools_config: v }))} />

          {/* Machine Parameters */}
          <MachineParamsEditor items={form.machine_parameters} onChange={v => setForm(prev => ({ ...prev, machine_parameters: v }))} />

          {/* Consumables */}
          <ConsumablesEditor items={form.consumables} onChange={v => setForm(prev => ({ ...prev, consumables: v }))} />

          {/* Verifications (stored in attention_points) */}
          <VerificationsEditor items={form.attention_points} onChange={v => setForm(prev => ({ ...prev, attention_points: v }))} />

          {/* Transfer / logistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Lot transfer</label>
              <input className="input text-sm" type="number" placeholder="piese" value={form.min_batch_before_next} onChange={f('min_batch_before_next')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Transport (min)</label>
              <input className="input text-sm" type="number" value={form.transport_time_minutes} onChange={f('transport_time_minutes')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Depozit</label>
              <input className="input text-sm" placeholder="Locatie" value={form.deposit_location} onChange={f('deposit_location')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Actiune rebut</label>
              <select className="input text-sm" value={form.reject_action} onChange={f('reject_action')}>
                {REJECT_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descriere / observatii</label>
            <textarea className="input text-sm" rows={3} value={form.description} onChange={f('description')} />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Inchide</button>
          <button onClick={handleSave} disabled={saveMut.isPending} className="btn-primary text-sm flex items-center gap-1.5">
            <Save size={14} /> {saveMut.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW OPERATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function NewOperationModal({ productId, nextSequence, onClose, onCreated }) {
  const [form, setForm] = useState({
    operation_name: '',
    operation_type: '',
    sequence: nextSequence || 10,
    cycle_time_seconds: '',
    time_unit: 'seconds',
    setup_time_minutes: '',
    machine_type: '',
    reject_action: 'scrap',
    tools_config: [],
    machine_parameters: [],
    consumables: [],
    attention_points: [],
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Fetch operation templates
  const { data: templates } = useQuery({
    queryKey: ['operation-templates'],
    queryFn: () => api.get('/bom/operation-templates').then(r => r.data),
  })

  const handleTemplateSelect = (e) => {
    const tplId = e.target.value
    if (!tplId) return
    const tpl = (templates || []).find(t => t.id === tplId)
    if (!tpl) return
    setForm(prev => ({
      ...prev,
      operation_name: tpl.name || prev.operation_name,
      operation_type: tpl.operation_type || prev.operation_type,
      machine_type: tpl.machine_type || prev.machine_type,
      cycle_time_seconds: tpl.default_cycle_time_seconds || prev.cycle_time_seconds,
      time_unit: tpl.default_time_unit || prev.time_unit,
      setup_time_minutes: tpl.default_setup_time_minutes || prev.setup_time_minutes,
      reject_action: tpl.default_reject_action || prev.reject_action,
      tools_config: parseJsonArray(tpl.default_tools_config),
      machine_parameters: parseJsonArray(tpl.default_machine_parameters),
      consumables: parseJsonArray(tpl.default_consumables),
      attention_points: parseJsonArray(tpl.default_attention_points),
    }))
    toast.success(`Template "${tpl.name}" aplicat.`)
  }

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/bom/products/${productId}/operations`, data),
    onSuccess: () => { toast.success('Operatie adaugata.'); onCreated?.(); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-4">Adauga operatie</h3>
        <div className="space-y-3">
          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
                <LayoutTemplate size={12} /> Selecteaza template
              </label>
              <select className="input text-sm" defaultValue="" onChange={handleTemplateSelect}>
                <option value="">-- Fara template (manual) --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({OP_TYPE_LABELS[t.operation_type] || t.operation_type})
                  </option>
                ))}
              </select>
            </div>
          )}
          <input className="input" placeholder="Nume operatie *" value={form.operation_name} onChange={f('operation_name')} />
          <select className="input" value={form.operation_type} onChange={f('operation_type')}>
            <option value="">Selecteaza tip</option>
            {OPERATION_TYPES.map(t => <option key={t} value={t}>{OP_TYPE_LABELS[t] || t}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" type="number" placeholder="Secventa" value={form.sequence} onChange={f('sequence')} />
            <input className="input" type="number" placeholder="Timp ciclu" value={form.cycle_time_seconds} onChange={f('cycle_time_seconds')} />
            <select className="input" value={form.time_unit} onChange={f('time_unit')}>
              {TIME_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => {
              const ct = form.cycle_time_seconds ? timeToSeconds(form.cycle_time_seconds, form.time_unit) : null
              mutation.mutate({
                operationName: form.operation_name,
                operationType: form.operation_type,
                sequence: Number(form.sequence) || nextSequence,
                cycleTimeSeconds: ct,
                timeUnit: form.time_unit,
                setupTimeMinutes: form.setup_time_minutes ? Number(form.setup_time_minutes) : null,
                machineType: form.machine_type || null,
                rejectAction: form.reject_action || 'scrap',
                toolsConfig: form.tools_config,
                machineParameters: form.machine_parameters,
                consumables: form.consumables,
                attentionPoints: form.attention_points,
              })
            }}
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

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT PANEL: MATERIALS
// ═══════════════════════════════════════════════════════════════════════════════

function MaterialsPanel({ components }) {
  const [search, setSearch] = useState('')

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-items-bom'],
    queryFn: () => api.get('/inventory/items', { params: { limit: 500 } }).then(r => r.data),
  })

  const inventoryItems = useMemo(() => {
    const items = inventoryData?.data || inventoryData || []
    return Array.isArray(items) ? items : []
  }, [inventoryData])

  // Separate stock items vs purchased
  const purchasedComponents = useMemo(() => {
    return (components || []).filter(c => c.component_type === 'purchased')
  }, [components])

  const stockItems = useMemo(() => {
    return inventoryItems.filter(item => {
      if (!search) return true
      const s = search.toLowerCase()
      return (item.name || '').toLowerCase().includes(s)
        || (item.code || '').toLowerCase().includes(s)
        || (item.material_code || '').toLowerCase().includes(s)
    })
  }, [inventoryItems, search])

  const filteredPurchased = useMemo(() => {
    return purchasedComponents.filter(c => {
      if (!search) return true
      const s = search.toLowerCase()
      return (c.component_name || '').toLowerCase().includes(s)
        || (c.component_reference || '').toLowerCase().includes(s)
    })
  }, [purchasedComponents, search])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Box size={13} /> Materiale
        </h3>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-xs pl-8 py-1.5"
            placeholder="Cauta materiale..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Stock items */}
        {stockItems.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Din stoc</p>
            <div className="space-y-1.5">
              {stockItems.slice(0, 20).map(item => (
                <DraggableMaterial key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Purchased parts */}
        {filteredPurchased.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Achizitie</p>
            <div className="space-y-1.5">
              {filteredPurchased.map(c => (
                <DraggableMaterial
                  key={c.id}
                  item={{
                    id: c.id,
                    name: c.component_name || c.component_reference,
                    material_code: c.material_code || c.standard_reference,
                    raw_dimensions: c.raw_dimensions,
                    current_stock: null,
                    description: `x${c.qty_per_parent}/asm`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {stockItems.length === 0 && filteredPurchased.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Niciun material gasit.</p>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="p-3 border-t border-slate-200 space-y-2">
        <button className="btn-secondary text-xs w-full flex items-center justify-center gap-1">
          <Plus size={12} /> Material nou
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL: MACHINES
// ═══════════════════════════════════════════════════════════════════════════════

function MachinesPanel({ machineLoad }) {
  const [search, setSearch] = useState('')

  const { data: machinesData } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines', { params: { limit: 500 } }).then(r => r.data?.data || r.data || []),
  })

  const machines = useMemo(() => {
    const list = Array.isArray(machinesData) ? machinesData : machinesData?.data || []
    if (!search) return list
    const s = search.toLowerCase()
    return list.filter(m =>
      (m.code || '').toLowerCase().includes(s)
      || (m.name || '').toLowerCase().includes(s)
      || (m.machine_type || '').toLowerCase().includes(s)
    )
  }, [machinesData, search])

  // Build load map
  const loadMap = useMemo(() => {
    const map = {}
    if (Array.isArray(machineLoad)) {
      for (const ml of machineLoad) {
        // Simple load: allocation count * 10 as rough percentage (capped at 100)
        map[ml.machine_id] = Math.min(100, Math.round((ml.allocation_count || 0) * 15))
      }
    }
    return map
  }, [machineLoad])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Factory size={13} /> Masini
        </h3>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-xs pl-8 py-1.5"
            placeholder="Cauta masini..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {machines.map(m => (
          <DraggableMachine
            key={m.id}
            machine={m}
            loadPercent={loadMap[m.id] || 0}
          />
        ))}
        {machines.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Nicio masina gasita.</p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTER PANEL: FLOW BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function ComponentSection({ component, operations, orderQty, onClickOp, onAddOp, refetch }) {
  const [expanded, setExpanded] = useState(true)
  const compName = component.component_name || component.component_reference || 'Componenta'
  const isFabricated = component.component_type !== 'purchased'

  const totalTime = operations.reduce((s, op) => s + (Number(op.cycle_time_seconds) || 0), 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Component header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {component.position_code || 'Poz'}
          </span>
          <span className="font-semibold text-slate-800 text-sm">{compName}</span>
          {component.material_code && (
            <span className="text-xs text-slate-400">{component.material_code}</span>
          )}
          {component.raw_dimensions && (
            <span className="text-xs text-slate-400">| {component.raw_dimensions}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>x{component.qty_per_parent || 1}/asm</span>
          <span>Total: {(component.qty_per_parent || 1) * (orderQty || 1)}</span>
          <span>{operations.length} op</span>
          <span>{formatTime(totalTime)}</span>
        </div>
      </div>

      {/* Operations flow */}
      {expanded && isFabricated && (
        <div className="px-4 py-4 border-t border-slate-100">
          {operations.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-400">
              Nicio operatie. Adaugati prima operatie.
            </div>
          ) : (
            <SortableContext items={operations.map(o => o.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex items-start gap-0 overflow-x-auto pb-2">
                {operations.map((op, idx) => (
                  <Fragment key={op.id}>
                    {idx > 0 && <FlowArrow />}
                    <SortableOperationCard
                      op={op}
                      onClick={() => onClickOp(op)}
                    />
                  </Fragment>
                ))}
                {/* Add button */}
                <div className="flex items-center ml-2">
                  <FlowArrow />
                  <button
                    onClick={() => onAddOp(component)}
                    className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Plus size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>
            </SortableContext>
          )}

          {operations.length === 0 && (
            <button
              onClick={() => onAddOp(component)}
              className="btn-primary text-xs flex items-center gap-1 mx-auto mt-2"
            >
              <Plus size={12} /> Adauga operatie
            </button>
          )}
        </div>
      )}

      {/* Purchased part (no operations) */}
      {expanded && !isFabricated && (
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-2">
          <Package size={13} />
          Componenta achizitionata - {component.supplier_code || 'fara furnizor'} - {component.standard_reference || ''}
        </div>
      )}
    </div>
  )
}

function AssemblySection({ operations, onClickOp, onAddOp, productId }) {
  return (
    <div className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-white flex items-center gap-2">
        <Layers size={16} className="text-amber-600" />
        <span className="font-bold text-amber-800 text-sm">ASAMBLARE</span>
        <span className="text-xs text-amber-500 ml-auto">{operations.length} op</span>
      </div>
      <div className="px-4 py-4 border-t border-amber-100">
        {operations.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400 mb-2">Nicio operatie de asamblare definita.</p>
            <button
              onClick={() => onAddOp(null)}
              className="btn-primary text-xs flex items-center gap-1 mx-auto"
            >
              <Plus size={12} /> Adauga operatie asamblare
            </button>
          </div>
        ) : (
          <SortableContext items={operations.map(o => o.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-start gap-0 overflow-x-auto pb-2">
              {operations.map((op, idx) => (
                <Fragment key={op.id}>
                  {idx > 0 && <FlowArrow />}
                  <SortableOperationCard op={op} onClick={() => onClickOp(op)} />
                </Fragment>
              ))}
              <div className="flex items-center ml-2">
                <FlowArrow />
                <button
                  onClick={() => onAddOp(null)}
                  className="w-10 h-10 rounded-lg border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 flex items-center justify-center transition-colors shrink-0"
                >
                  <Plus size={16} className="text-amber-500" />
                </button>
              </div>
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MBOM VISUAL EDITOR (main 3-panel interface)
// ═══════════════════════════════════════════════════════════════════════════════

function MBOMVisualEditor({ orderId, onBack }) {
  const qc = useQueryClient()
  const [selectedOp, setSelectedOp] = useState(null)
  const [showNewOp, setShowNewOp] = useState(null) // null or { productId, nextSeq }
  const [activeDrag, setActiveDrag] = useState(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ─── Data fetching ────────────────────────────────────────────────────────

  const { data: mbom, isLoading, refetch } = useQuery({
    queryKey: ['mbom-order', orderId],
    queryFn: () => api.get(`/bom/mbom/order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  const { data: machinesData } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines', { params: { limit: 500 } }).then(r => r.data?.data || r.data || []),
  })
  const machines = useMemo(() => {
    return Array.isArray(machinesData) ? machinesData : machinesData?.data || []
  }, [machinesData])

  // ─── Mutations ────────────────────────────────────────────────────────────

  const updateOpMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/bom/operations/${id}`, data),
    onSuccess: () => { refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la actualizare.'),
  })

  const deleteOpMut = useMutation({
    mutationFn: (opId) => api.delete(`/bom/operations/${opId}`),
    onSuccess: () => { toast.success('Operatie stearsa.'); setSelectedOp(null); refetch() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const validateMut = useMutation({
    mutationFn: () => api.put(`/bom/products/${mbom.product.id}/validate`),
    onSuccess: () => {
      toast.success('MBOM validat cu succes.')
      refetch()
      qc.invalidateQueries({ queryKey: ['work-orders'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la validare.'),
  })

  // ─── MBOM Reuse ───────────────────────────────────────────────────────────

  const reusableProduct = mbom?.reusableProduct || null
  const [reuseDismissed, setReuseDismissed] = useState(false)

  const copyMbomMut = useMutation({
    mutationFn: ({ sourceId, targetId }) => api.post(`/bom/products/${targetId}/copy-mbom-from/${sourceId}`),
    onSuccess: (res) => {
      toast.success(`MBOM reutilizat: ${res.data.copiedOperations} operatii, ${res.data.copiedMaterials} materiale copiate.`)
      refetch()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la copiere MBOM.'),
  })

  // ─── Derived data ─────────────────────────────────────────────────────────

  const order = mbom?.order
  const product = mbom?.product
  const allOperations = mbom?.operations || []
  const components = mbom?.components || []
  const machineLoad = mbom?.machineLoad || []

  // Group operations by component
  const { componentOps, assemblyOps, productOps } = useMemo(() => {
    // Ops directly on the product (not on sub-components)
    const productOps = allOperations.filter(o => o.product_id === product?.id)

    // Separate assembly ops (those with type 'assembly' or 'inspection' at end)
    const assemblyTypes = ['assembly', 'inspection', 'packaging']
    const assemblyOps = productOps.filter(o => assemblyTypes.includes(o.operation_type))
    const mainOps = productOps.filter(o => !assemblyTypes.includes(o.operation_type))

    // Ops per component
    const componentOps = {}
    for (const comp of components) {
      componentOps[comp.id] = comp.operations || []
    }

    return { componentOps, assemblyOps, productOps: mainOps }
  }, [allOperations, product, components])

  // Summary calculations
  const summary = useMemo(() => {
    const allOps = [...allOperations]
    // Also include component sub-operations
    for (const comp of components) {
      if (comp.operations) {
        allOps.push(...comp.operations)
      }
    }

    const totalOps = allOps.length
    const totalCycleSeconds = allOps.reduce((s, op) => s + (Number(op.cycle_time_seconds) || 0), 0)
    const totalSetupMinutes = allOps.reduce((s, op) => s + (Number(op.setup_time_minutes) || 0), 0)
    const orderQty = order?.quantity || 1
    const totalTimeHours = ((totalCycleSeconds * orderQty) + (totalSetupMinutes * 60)) / 3600
    const uniqueMachines = new Set(allOps.filter(o => o.machine_id).map(o => o.machine_code || o.machine_id))
    const missingMaterials = 0 // Would need inventory stock check

    return { totalOps, totalTimeHours, totalSetupMinutes, uniqueMachines: uniqueMachines.size, missingMaterials }
  }, [allOperations, components, order])

  // ─── DnD handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active.data.current)
  }, [])

  const handleDragEnd = useCallback((event) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overId = over.id?.toString() || ''

    // Machine dropped on operation
    if (activeData?.type === 'machine' && overId.startsWith('drop-op-')) {
      const opId = overId.replace('drop-op-', '')
      const machine = activeData.machine
      updateOpMut.mutate({
        id: opId,
        data: { machine_id: machine.id, machine_type: machine.machine_type || machine.type || '' },
      })
      toast.success(`Masina ${machine.code} alocata.`)
      return
    }

    // Material dropped on operation
    if (activeData?.type === 'material' && overId.startsWith('drop-op-')) {
      const opId = overId.replace('drop-op-', '')
      const item = activeData.item
      updateOpMut.mutate({
        id: opId,
        data: {
          raw_material_spec: `${item.material_code || item.code || item.name} ${item.raw_dimensions || item.dimensions || ''}`.trim(),
          input_material_id: item.id,
        },
      })
      toast.success(`Material ${item.name || item.code} alocat.`)
      return
    }

    // Reorder operations within sortable context
    if (active.id !== over.id && !overId.startsWith('drop-op-')) {
      // Find which operations list contains both
      const findOpsContaining = (id) => {
        // Check product ops
        if (productOps.find(o => o.id === id)) return { ops: productOps, type: 'product' }
        // Check assembly ops
        if (assemblyOps.find(o => o.id === id)) return { ops: assemblyOps, type: 'assembly' }
        // Check component ops
        for (const [compId, ops] of Object.entries(componentOps)) {
          if (ops.find(o => o.id === id)) return { ops, type: 'component', compId }
        }
        return null
      }

      const source = findOpsContaining(active.id)
      const target = findOpsContaining(over.id)

      if (source && target && source.type === target.type && (source.type !== 'component' || source.compId === target.compId)) {
        const ops = source.ops
        const oldIndex = ops.findIndex(o => o.id === active.id)
        const newIndex = ops.findIndex(o => o.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(ops, oldIndex, newIndex)
          // Update sequences
          reordered.forEach((op, idx) => {
            const newSeq = (idx + 1) * 10
            if (op.sequence !== newSeq) {
              updateOpMut.mutate({ id: op.id, data: { sequence: newSeq } })
            }
          })
        }
      }
    }
  }, [productOps, assemblyOps, componentOps, updateOpMut])

  // ─── Add operation handler ────────────────────────────────────────────────

  const handleAddOp = useCallback((component) => {
    let targetProductId = product?.id
    let ops = allOperations

    if (component && component.component_product_id) {
      targetProductId = component.component_product_id
      ops = component.operations || []
    }

    const nextSeq = ops.length > 0
      ? Math.max(...ops.map(o => o.sequence || 0)) + 10
      : 10

    setShowNewOp({ productId: targetProductId, nextSeq })
  }, [product, allOperations])

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Se incarca MBOM...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-slate-400">Comanda nu a fost gasita.</p>
        <button onClick={onBack} className="btn-secondary mt-4">Inapoi</button>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft size={18} /></button>
          <h2 className="text-lg font-bold text-slate-800">MBOM Editor</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-amber-500" />
          <p className="font-medium text-amber-800 mb-1">Produs BOM negasit</p>
          <p className="text-sm text-amber-600">
            Produsul <strong>{order.product_reference || order.product_name}</strong> nu exista in catalogul BOM.
          </p>
          <button onClick={onBack} className="btn-secondary mt-4">Inapoi la comenzi</button>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Top header bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 truncate">MBOM Visual Editor</h2>
              <MBOMStatusBadge status={product.approval_status} />
            </div>
            <p className="text-xs text-slate-400 truncate">
              {order.work_order_number} | {product.name} ({product.reference}) | {order.quantity} buc
              {order.client_name && ` | ${order.client_name}`}
              {order.scheduled_end && ` | Deadline: ${new Date(order.scheduled_end).toLocaleDateString('ro-RO')}`}
            </p>
          </div>
        </div>

        {/* MBOM Reuse Banner */}
        {reusableProduct && allOperations.length === 0 && !reuseDismissed && (
          <div className="shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center gap-3">
            <Copy size={18} className="text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                Acest produs a fost fabricat anterior. Doriti sa reutilizati MBOM-ul existent?
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Sursa: {reusableProduct.name} ({reusableProduct.reference})
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyMbomMut.mutate({ sourceId: reusableProduct.id, targetId: product.id })}
                disabled={copyMbomMut.isPending}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Copy size={12} /> {copyMbomMut.isPending ? 'Se copiaza...' : 'Reutilizeaza'}
              </button>
              <button
                onClick={() => setReuseDismissed(true)}
                className="btn-secondary text-xs"
              >
                Defineste de la zero
              </button>
            </div>
          </div>
        )}

        {/* 3-panel layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Materials */}
          <div className="w-full lg:w-64 xl:w-72 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white overflow-hidden flex flex-col max-h-48 lg:max-h-none">
            <MaterialsPanel components={components} />
          </div>

          {/* CENTER: Flow */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
            {/* Component sections */}
            {components.filter(c => c.component_type !== 'purchased').length > 0 ? (
              components
                .filter(c => c.component_type !== 'purchased')
                .map(comp => (
                  <ComponentSection
                    key={comp.id}
                    component={comp}
                    operations={componentOps[comp.id] || []}
                    orderQty={order.quantity}
                    onClickOp={setSelectedOp}
                    onAddOp={handleAddOp}
                    refetch={refetch}
                  />
                ))
            ) : (
              /* If no components, show product operations directly */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" />
                  <span className="font-bold text-slate-800 text-sm">{product.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{productOps.length + assemblyOps.length} operatii</span>
                </div>
                <div className="px-4 py-4 border-t border-slate-100">
                  {productOps.length === 0 && assemblyOps.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-400 mb-2">Nicio operatie definita.</p>
                      <button
                        onClick={() => handleAddOp(null)}
                        className="btn-primary text-xs flex items-center gap-1 mx-auto"
                      >
                        <Plus size={12} /> Adauga prima operatie
                      </button>
                    </div>
                  ) : (
                    <SortableContext items={[...productOps, ...assemblyOps].map(o => o.id)} strategy={horizontalListSortingStrategy}>
                      <div className="flex items-start gap-0 overflow-x-auto pb-2">
                        {[...productOps, ...assemblyOps].map((op, idx) => (
                          <Fragment key={op.id}>
                            {idx > 0 && <FlowArrow />}
                            <SortableOperationCard op={op} onClick={() => setSelectedOp(op)} />
                          </Fragment>
                        ))}
                        <div className="flex items-center ml-2">
                          <FlowArrow />
                          <button
                            onClick={() => handleAddOp(null)}
                            className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0"
                          >
                            <Plus size={16} className="text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </SortableContext>
                  )}
                </div>
              </div>
            )}

            {/* Assembly section (only if there are components) */}
            {components.filter(c => c.component_type !== 'purchased').length > 0 && (
              <AssemblySection
                operations={assemblyOps}
                onClickOp={setSelectedOp}
                onAddOp={() => handleAddOp(null)}
                productId={product.id}
              />
            )}
          </div>

          {/* RIGHT: Machines */}
          <div className="w-full lg:w-56 xl:w-64 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white overflow-hidden flex flex-col max-h-48 lg:max-h-none">
            <MachinesPanel machineLoad={machineLoad} />
          </div>
        </div>

        {/* Footer summary bar */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span className="text-slate-600 font-medium">{summary.totalOps} operatii</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge size={14} className="text-slate-400" />
                <span className="text-slate-600">{summary.totalTimeHours.toFixed(1)}h total estimat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Factory size={14} className="text-slate-400" />
                <span className="text-slate-600">{summary.uniqueMachines} masini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Settings2 size={14} className="text-slate-400" />
                <span className="text-slate-600">{summary.totalSetupMinutes}m setup</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="btn-secondary text-sm flex items-center gap-1.5">
                <ArrowLeft size={14} /> Inapoi
              </button>
              <button className="btn-secondary text-sm flex items-center gap-1.5">
                <Download size={14} /> Export PDF
              </button>
              {product.approval_status !== 'active' && (
                <>
                  <button
                    onClick={() => { refetch(); toast.success('Ciorna salvata.') }}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <Save size={14} /> Salveaza ciorna
                  </button>
                  <button
                    onClick={() => validateMut.mutate()}
                    disabled={validateMut.isPending || (allOperations.length === 0 && components.every(c => !(c.operations?.length)))}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> {validateMut.isPending ? 'Se valideaza...' : 'Valideaza MBOM'}
                  </button>
                </>
              )}
              {product.approval_status === 'active' && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 size={14} /> MBOM Validat
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay ghost */}
      <DragOverlay>
        {activeDrag?.type === 'machine' && (
          <div className="bg-blue-50 border-2 border-blue-400 rounded-lg px-3 py-2 shadow-lg text-sm font-medium text-blue-700 opacity-90">
            <Factory size={14} className="inline mr-1.5" />
            {activeDrag.machine.code} - {activeDrag.machine.name}
          </div>
        )}
        {activeDrag?.type === 'material' && (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg px-3 py-2 shadow-lg text-sm font-medium text-green-700 opacity-90">
            <Box size={14} className="inline mr-1.5" />
            {activeDrag.item.material_code || activeDrag.item.code || activeDrag.item.name}
          </div>
        )}
      </DragOverlay>

      {/* Operation detail drawer */}
      {selectedOp && (
        <OperationDetailDrawer
          operation={selectedOp}
          machines={machines}
          onSaved={() => { refetch(); setSelectedOp(null) }}
          onClose={() => setSelectedOp(null)}
          onDelete={(id) => deleteOpMut.mutate(id)}
        />
      )}

      {/* New operation modal */}
      {showNewOp && (
        <NewOperationModal
          productId={showNewOp.productId}
          nextSequence={showNewOp.nextSeq}
          onClose={() => setShowNewOp(null)}
          onCreated={refetch}
        />
      )}
    </DndContext>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BOM PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BomPage() {
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  if (selectedOrderId) {
    return (
      <MBOMVisualEditor
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
      />
    )
  }

  return <OrderList onSelectOrder={setSelectedOrderId} />
}
