import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, ChevronLeft, ChevronRight, ClipboardList, Euro, Clock, User, Pencil, Trash2, DollarSign, Rocket, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Package } from 'lucide-react'
import { formatMoney, getRate, convertDisplay } from '../utils/currency'
import SearchableSelect from '../components/SearchableSelect'

function useTenantCurrency() {
  const [currency, setCurrency] = useState('EUR')
  useEffect(() => {
    api.get('/admin/settings').then(r => {
      const c = r.data?.default_currency || r.data?.defaultCurrency
      if (c) setCurrency(c)
    }).catch(() => {})
  }, [])
  return currency
}

function MoneyWithConversion({ amount, fromCurrency, tenantCurrency }) {
  const [converted, setConverted] = useState(null)
  useEffect(() => {
    if (!fromCurrency || !tenantCurrency || fromCurrency === tenantCurrency) return
    getRate(fromCurrency, tenantCurrency).then(rate => {
      const result = convertDisplay(amount, fromCurrency, tenantCurrency, rate)
      if (result) setConverted(result)
    })
  }, [amount, fromCurrency, tenantCurrency])
  return (
    <span>
      {formatMoney(amount, fromCurrency || 'EUR')}
      {converted && (
        <span className="text-slate-400 text-xs ml-1">
          ({formatMoney(converted.amount, converted.currency)})
        </span>
      )}
    </span>
  )
}

const STATUS_COLORS = {
  planned: 'bg-slate-100 text-slate-600',
  released: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-400',
}

const STATUS_META = {
  draft:            { label: 'Ciorna',              color: '#6B7280' },
  confirmed:        { label: 'Confirmat',            color: '#3B82F6' },
  materials_ready:  { label: 'Materiale pregatite',  color: '#8B5CF6' },
  in_production:    { label: 'In productie',         color: '#F59E0B' },
  quality_check:    { label: 'Control calitate',     color: '#06B6D4' },
  completed:        { label: 'Finalizat',            color: '#10B981' },
  shipped:          { label: 'Livrat',               color: '#6B7280' },
  cancelled:        { label: 'Anulat',               color: '#EF4444' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: '#6B7280' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

function StatusTransitionButtons({ workOrderId, currentStatus, onTransitioned }) {
  const qc = useQueryClient()
  const { data: nextStatuses = [] } = useQuery({
    queryKey: ['wo-next-statuses', workOrderId],
    queryFn: () => api.get(`/work-orders/${workOrderId}/next-statuses`).then(r => r.data),
    enabled: !!workOrderId,
  })

  const transition = useMutation({
    mutationFn: (status) => api.put(`/work-orders/${workOrderId}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] })
      qc.invalidateQueries({ queryKey: ['wo-next-statuses', workOrderId] })
      toast.success('Status actualizat.')
      onTransitioned?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Tranzitie invalida'),
  })

  if (nextStatuses.length === 0) return null

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-2">Avanseaza la:</p>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map(ns => (
          <button
            key={ns.code}
            onClick={() => transition.mutate(ns.code)}
            disabled={transition.isPending}
            className="px-3 py-1 text-xs rounded-full text-white font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: ns.color }}
          >
            {ns.displayName}
          </button>
        ))}
      </div>
    </div>
  )
}
const PRIORITY_COLORS = {
  low: 'text-slate-400', normal: 'text-slate-600',
  high: 'text-orange-500', urgent: 'text-red-500',
}

function getWeekDays(date) {
  const monday = new Date(date)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// ─── Calendar saptamanal ──────────────────────────────────────────────────────

function WeekCalendar({ workOrders, machines }) {
  const [weekDate, setWeekDate] = useState(new Date())
  const days = getWeekDays(weekDate)
  const machineMap = {}
  machines?.forEach(m => { machineMap[m.id] = m })

  function prevWeek() { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }
  function nextWeek() { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }

  // Plaseaza comenzile de lucru in calendar dupa scheduled_start
  const eventsByDay = {}
  days.forEach(d => { eventsByDay[d.toISOString().split('T')[0]] = [] })
  workOrders?.forEach(wo => {
    if (!wo.scheduled_start) return
    const d = wo.scheduled_start.split('T')[0]
    if (eventsByDay[d]) eventsByDay[d].push(wo)
  })

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header calendar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button onClick={prevWeek} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
        <span className="font-medium text-slate-700 text-sm">
          {days[0].toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })} —{' '}
          {days[6].toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextWeek} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
      </div>

      {/* Grid zile */}
      <div className="grid grid-cols-7">
        {days.map(d => {
          const key = d.toISOString().split('T')[0]
          const isToday = key === today
          const dayEvents = eventsByDay[key] || []
          return (
            <div key={key} className={`border-r last:border-r-0 border-slate-100 min-h-24 ${isToday ? 'bg-blue-50' : ''}`}>
              <div className={`px-2 py-1.5 text-center border-b border-slate-100 ${isToday ? 'bg-blue-500' : 'bg-slate-50'}`}>
                <div className={`text-xs font-medium ${isToday ? 'text-white' : 'text-slate-500'}`}>
                  {d.toLocaleDateString('ro-RO', { weekday: 'short' })}
                </div>
                <div className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-700'}`}>
                  {d.getDate()}
                </div>
              </div>
              <div className="p-1 space-y-1">
                {dayEvents.map(wo => (
                  <div key={wo.id} className={`text-xs rounded px-1.5 py-1 ${PRIORITY_COLORS[wo.priority]} bg-white border border-slate-100`}>
                    <div className="font-medium truncate">{wo.work_order_number}</div>
                    <div className="text-slate-400 truncate">{wo.product_name || wo.product_reference}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Modal comanda de lucru ───────────────────────────────────────────────────

function WorkOrderModal({ orders, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    orderId: '', clientId: null, productReference: '', productName: '', quantity: '1',
    priority: 'normal', scheduledStart: '', scheduledEnd: '', notes: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/work-orders', data),
    onSuccess: () => { qc.invalidateQueries(['work-orders']); toast.success('Comanda de lucru creata cu operatii preincarcate.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la crearea comenzii de lucru.'),
  })

  function handleOrderSelect(e) {
    const order = orders?.find(o => o.id === e.target.value)
    setForm(prev => ({
      ...prev, orderId: e.target.value,
      productReference: order?.product_code || '',
      productName: order?.product_name || '',
      quantity: String(order?.target_quantity || 1),
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-1">Comanda de lucru noua</h3>
        <p className="text-xs text-slate-400 mb-4">Operatiile vor fi preincarcate automat din BOM</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Client - selecteaza compania client pentru aceasta comanda</label>
            <SearchableSelect
              endpoint="/companies"
              filterParams={{ companyType: 'client' }}
              labelField="name"
              valueField="id"
              placeholder="Cauta client dupa nume..."
              value={form.clientId}
              onChange={(id) => setForm(f2 => ({ ...f2, clientId: id }))}
              allowCreate={false}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Comanda productie - asociaza cu o comanda existenta (optional)</label>
            <select className="input" value={form.orderId} onChange={handleOrderSelect}>
              <option value="">Fara comanda asociata</option>
              {orders?.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.product_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Referinta produs - codul unic al produsului</label>
              <input className="input" placeholder="Ex: PROD-001" value={form.productReference} onChange={f('productReference')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Denumire produs - numele complet al produsului</label>
              <input className="input" placeholder="Ex: Piesa fata model X" value={form.productName} onChange={f('productName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cantitate * - numarul de bucati de produs</label>
              <input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Prioritate - nivelul de urgenta al comenzii</label>
              <select className="input" value={form.priority} onChange={f('priority')}>
                <option value="low">Scazuta</option>
                <option value="normal">Normala</option>
                <option value="high">Ridicata</option>
                <option value="urgent">Urgenta</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Termen limita (deadline) - data pana la care trebuie finalizat</label>
              <input className="input" type="date" value={form.scheduledEnd} onChange={f('scheduledEnd')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Start planificat - data la care incepe productia</label>
              <input className="input" type="date" value={form.scheduledStart} onChange={f('scheduledStart')} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note - informatii suplimentare, instructiuni speciale</label>
            <textarea className="input resize-none" rows={3} placeholder="Scrie aici orice detaliu relevant pentru aceasta comanda..." value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, quantity: Number(form.quantity), orderId: form.orderId || null })}
            disabled={mutation.isPending || !form.quantity}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal editare comanda de lucru ──────────────────────────────────────────

function EditWorkOrderModal({ wo, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    productReference: wo.product_reference || '',
    productName: wo.product_name || '',
    quantity: String(wo.quantity || 1),
    priority: wo.priority || 'normal',
    scheduledStart: wo.scheduled_start ? wo.scheduled_start.split('T')[0] : '',
    scheduledEnd: wo.scheduled_end ? wo.scheduled_end.split('T')[0] : '',
    notes: wo.notes || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/work-orders/${wo.id}`, data),
    onSuccess: () => { qc.invalidateQueries(['work-orders']); qc.invalidateQueries(['work-order', wo.id]); toast.success('Comanda actualizata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la actualizare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pencil size={16} /> Editeaza {wo.work_order_number}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referinta produs</label>
              <input className="input" value={form.productReference} onChange={f('productReference')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Denumire produs</label>
              <input className="input" value={form.productName} onChange={f('productName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate *</label>
              <input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Prioritate</label>
              <select className="input" value={form.priority} onChange={f('priority')}>
                <option value="low">Scazuta</option>
                <option value="normal">Normala</option>
                <option value="high">Ridicata</option>
                <option value="urgent">Urgenta</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Start planificat</label>
              <input className="input" type="date" value={form.scheduledStart} onChange={f('scheduledStart')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sfarsit planificat</label>
              <input className="input" type="date" value={form.scheduledEnd} onChange={f('scheduledEnd')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Note</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, quantity: Number(form.quantity) })}
            disabled={mutation.isPending || !form.quantity}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── HR Rates Management ─────────────────────────────────────────────────────

function HrRatesSection() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ role: '', hourlyRate: '', currency: 'EUR' })

  const { data: rates, isLoading } = useQuery({
    queryKey: ['hr-rates'],
    queryFn: () => api.get('/work-orders/hr-rates/all').then(r => r.data),
  })

  const createRate = useMutation({
    mutationFn: (data) => api.post('/work-orders/hr-rates', data),
    onSuccess: () => { qc.invalidateQueries(['hr-rates']); toast.success('Tarif adaugat.'); setShowForm(false); setForm({ role: '', hourlyRate: '', currency: 'EUR' }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const ratesList = rates?.data || rates || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <DollarSign size={14} className="text-green-600" /> Tarife personal
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
          <Plus size={12} /> Tarif nou
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Rol *</label>
              <input className="input text-xs" placeholder="Ex: operator" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tarif orar (EUR) *</label>
              <input className="input text-xs" type="number" step="0.01" min="0.01" placeholder="Ex: 12.50" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Moneda</label>
              <select className="input text-xs" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="EUR">EUR</option>
                <option value="RON">RON</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          {(!form.hourlyRate || Number(form.hourlyRate) <= 0) && form.role && (
            <p className="text-xs text-red-500">Tariful orar este obligatoriu si trebuie sa fie un numar pozitiv.</p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs py-1">Anuleaza</button>
            <button
              onClick={() => {
                const rate = Number(form.hourlyRate)
                if (!rate || rate <= 0) { toast.error('Tariful orar este obligatoriu si trebuie sa fie un numar pozitiv.'); return }
                createRate.mutate({ role: form.role, hourlyRateEur: rate, currency: form.currency })
              }}
              disabled={!form.role || !form.hourlyRate || Number(form.hourlyRate) <= 0 || createRate.isPending}
              className="btn-primary text-xs py-1"
            >
              Salveaza
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Rol</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600 text-xs">Tarif orar</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Moneda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs">Se incarca...</td></tr>}
            {ratesList.map(r => (
              <tr key={r.id || r.role} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{r.role}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">{Number(r.hourly_rate || r.hourlyRate).toFixed(2)}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{r.currency || 'EUR'}</td>
              </tr>
            ))}
            {ratesList.length === 0 && !isLoading && <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs">Niciun tarif definit.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Detalii comanda de lucru ─────────────────────────────────────────────────

function WorkOrderDetail({ wo, users, onClose }) {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const [addHr, setAddHr] = useState(false)
  const [hrForm, setHrForm] = useState({ userId: '', allocatedHours: '', notes: '' })
  const [editModal, setEditModal] = useState(false)
  const [launchConfirm, setLaunchConfirm] = useState(false)

  const deleteHr = useMutation({
    mutationFn: (hrId) => api.delete(`/work-orders/hr/${hrId}`),
    onSuccess: () => { qc.invalidateQueries(['work-order', wo.id]); qc.invalidateQueries(['work-order-cost', wo.id]); toast.success('Alocare stearsa.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la stergere.'),
  })

  const { data: detail } = useQuery({
    queryKey: ['work-order', wo.id],
    queryFn: () => api.get(`/work-orders/${wo.id}`).then(r => r.data),
  })

  const { data: cost } = useQuery({
    queryKey: ['work-order-cost', wo.id],
    queryFn: () => api.get(`/work-orders/${wo.id}/cost`).then(r => r.data),
  })

  // Technical checks
  const { data: techChecks = [] } = useQuery({
    queryKey: ['technical-checks', wo.id],
    queryFn: () => api.get(`/work-orders/${wo.id}/technical-checks`).then(r => r.data),
  })

  const updateCheck = useMutation({
    mutationFn: ({ checkId, isPassed, notes }) => api.put(`/work-orders/technical-checks/${checkId}`, { isPassed, notes }),
    onSuccess: () => { qc.invalidateQueries(['technical-checks', wo.id]); toast.success('Verificare actualizata.') },
    onError: () => toast.error('Eroare la actualizarea verificarii.'),
  })

  // Material status
  const { data: materialStatus = [] } = useQuery({
    queryKey: ['material-status', wo.id],
    queryFn: () => api.get(`/work-orders/${wo.id}/material-status`).then(r => r.data),
  })

  // Launch mutation
  const launchMutation = useMutation({
    mutationFn: () => api.post(`/work-orders/${wo.id}/launch`),
    onSuccess: () => {
      qc.invalidateQueries(['work-orders'])
      qc.invalidateQueries(['work-order', wo.id])
      toast.success('Comanda a fost lansata in productie!')
      setLaunchConfirm(false)
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la lansarea in productie.'),
  })

  const allChecksPassed = techChecks.length > 0 && techChecks.every(c => c.is_passed)
  const noMissingMaterials = materialStatus.length === 0 || materialStatus.every(m => m.status !== 'missing')
  const canLaunch = allChecksPassed && noMissingMaterials && wo.status !== 'released' && wo.status !== 'in_progress' && wo.status !== 'completed'

  const updateOp = useMutation({
    mutationFn: ({ id, data }) => api.put(`/work-orders/operations/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['work-order', wo.id]); qc.invalidateQueries(['work-order-cost', wo.id]); toast.success('Actualizat.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const addHrMutation = useMutation({
    mutationFn: (data) => api.post(`/work-orders/${wo.id}/hr`, data),
    onSuccess: () => { qc.invalidateQueries(['work-order', wo.id]); qc.invalidateQueries(['work-order-cost', wo.id]); toast.success('Resursa adaugata.'); setAddHr(false) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const operators = users?.filter(u => ['operator', 'shift_leader'].includes(u.role)) || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ClipboardList size={18} className="text-blue-500" />
              <h3 className="font-bold text-slate-800">{wo.work_order_number}</h3>
              <StatusBadge status={wo.status} />
            </div>
            <p className="text-slate-500 text-sm mt-0.5 ml-7">{wo.product_name || wo.product_reference} — {wo.quantity?.toLocaleString()} buc</p>
            <StatusTransitionButtons
              workOrderId={wo.id}
              currentStatus={wo.status}
              onTransitioned={onClose}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditModal(true)} className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={12} /> Editeaza
            </button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Operatii secventiate */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Operatii secventiate</h4>
            {detail?.operations?.length === 0 && (
              <p className="text-slate-400 text-sm">Nicio operatie. Asociaza produsul cu un BOM care are operatii definite.</p>
            )}
            <div className="space-y-2">
              {detail?.operations?.map(op => (
                <div key={op.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5">{op.sequence}</span>
                      <span className="font-medium text-slate-800 text-sm">{op.operation_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[op.status]}`}>{op.status}</span>
                    </div>
                    {op.planned_cost_eur && (
                      <span className="text-xs text-green-600 font-medium">
                        <Euro size={10} className="inline" />{Number(op.planned_cost_eur).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="text-xs text-slate-400">
                      <Clock size={10} className="inline mr-1" />
                      {op.planned_hours}h planificate
                    </div>
                    {op.machine_name && (
                      <div className="text-xs text-blue-600">{op.machine_code} — {op.machine_name}</div>
                    )}
                    {op.operator_name && (
                      <div className="text-xs text-slate-500"><User size={10} className="inline mr-1" />{op.operator_name}</div>
                    )}
                    {op.hourly_rate_eur > 0 && (
                      <div className="text-xs text-slate-400">{Number(op.hourly_rate_eur).toFixed(2)} EUR/h</div>
                    )}
                  </div>
                  {/* Operator assignment */}
                  {['planned', 'in_progress'].includes(op.status) && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <select
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                        value={op.operator_id || ''}
                        onChange={e => updateOp.mutate({ id: op.id, data: { operatorId: e.target.value || null } })}
                      >
                        <option value="">Fara operator</option>
                        {operators.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                      <select
                        className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                        value={op.status}
                        onChange={e => updateOp.mutate({ id: op.id, data: { status: e.target.value } })}
                      >
                        <option value="planned">Planificat</option>
                        <option value="in_progress">In executie</option>
                        <option value="completed">Finalizat</option>
                      </select>
                      {op.status === 'completed' && (
                        <input
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-24"
                          type="number" step="0.25" placeholder="Ore reale"
                          onBlur={e => { if (e.target.value) updateOp.mutate({ id: op.id, data: { actualHours: Number(e.target.value) } }) }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resurse umane */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Resurse umane alocate</h4>
              <button onClick={() => setAddHr(!addHr)} className="text-xs text-blue-500 hover:text-blue-700">+ Adauga</button>
            </div>
            {addHr && (
              <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select className="input text-xs" value={hrForm.userId} onChange={e => setHrForm({ ...hrForm, userId: e.target.value })}>
                    <option value="">Selecteaza angajat *</option>
                    {users?.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                  </select>
                  <input className="input text-xs" type="number" step="0.5" placeholder="Ore alocate *" value={hrForm.allocatedHours} onChange={e => setHrForm({ ...hrForm, allocatedHours: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddHr(false)} className="btn-secondary text-xs py-1">Anuleaza</button>
                  <button onClick={() => addHrMutation.mutate({ ...hrForm, allocatedHours: Number(hrForm.allocatedHours) })} disabled={!hrForm.userId || !hrForm.allocatedHours} className="btn-primary text-xs py-1">Salveaza</button>
                </div>
              </div>
            )}
            {detail?.hrAllocations?.length === 0 && !addHr && <p className="text-slate-400 text-xs">Nicio resursa umana alocata.</p>}
            <div className="space-y-1">
              {detail?.hrAllocations?.map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-3 py-2">
                  <span className="font-medium text-slate-700"><User size={12} className="inline mr-1" />{h.user_name}</span>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{h.allocated_hours}h planificate</span>
                    {h.hourly_rate_eur > 0 && <span>{Number(h.hourly_rate_eur).toFixed(2)} EUR/h</span>}
                    {h.planned_cost_eur > 0 && <span className="text-green-600 font-medium"><Euro size={10} className="inline" />{Number(h.planned_cost_eur).toFixed(2)}</span>}
                    <button
                      onClick={() => { if (window.confirm('Stergi aceasta alocare?')) deleteHr.mutate(h.id) }}
                      className="text-red-400 hover:text-red-600 ml-1"
                      title="Sterge alocare"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost total */}
          {cost && (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-100">
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Euro size={14} className="text-green-600" /> Sumar costuri
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Cost masini', value: cost.summary.totalMachinePlanned },
                  { label: 'Cost manopera', value: cost.summary.totalLaborPlanned },
                  { label: 'Total planificat', value: cost.summary.totalPlanned, bold: true },
                  { label: 'Cost / piesa', value: cost.summary.costPerPiece, bold: true, highlight: true },
                ].map(({ label, value, bold, highlight }) => (
                  <div key={label} className={`rounded-lg p-2.5 ${highlight ? 'bg-green-100' : 'bg-white'}`}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className={`text-sm mt-0.5 ${bold ? 'font-bold' : ''} ${highlight ? 'text-green-700' : 'text-slate-800'}`}>
                      {Number(value).toFixed(4)} EUR
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verificare Tehnica */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-indigo-600" /> Verificare Tehnica
              {allChecksPassed && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Complet</span>}
            </h4>
            <div className="space-y-2">
              {techChecks.map(check => (
                <div key={check.id} className={`flex items-start gap-3 rounded-lg p-3 border ${check.is_passed ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                  <input
                    type="checkbox"
                    checked={!!check.is_passed}
                    onChange={e => updateCheck.mutate({ checkId: check.id, isPassed: e.target.checked, notes: check.notes || '' })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${check.is_passed ? 'text-green-700 line-through' : 'text-slate-700'}`}>{check.check_item}</p>
                    <input
                      className="mt-1 w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white placeholder-slate-300"
                      placeholder="Note / observatii..."
                      defaultValue={check.notes || ''}
                      onBlur={e => {
                        if (e.target.value !== (check.notes || '')) {
                          updateCheck.mutate({ checkId: check.id, isPassed: check.is_passed, notes: e.target.value })
                        }
                      }}
                    />
                  </div>
                  {check.is_passed
                    ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    : <XCircle size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Status materiale */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Package size={14} className="text-amber-600" /> Status materiale
            </h4>
            {materialStatus.length === 0 ? (
              <p className="text-xs text-slate-400">Niciun material definit in BOM sau produsul nu este asociat.</p>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Material</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600 text-xs">Necesar</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-600 text-xs">In stoc</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialStatus.map((mat, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-700 text-xs">{mat.materialName}</div>
                          {mat.materialCode && <div className="text-[10px] text-slate-400">{mat.materialCode}</div>}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-medium">{mat.qtyNeeded} {mat.unit || ''}</td>
                        <td className="px-3 py-2 text-right text-xs font-medium">{mat.qtyAvailable} {mat.unit || ''}</td>
                        <td className="px-3 py-2 text-center">
                          {mat.status === 'available' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={12} /> Disponibil</span>
                          )}
                          {mat.status === 'partial' && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={12} /> Partial</span>
                          )}
                          {mat.status === 'missing' && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle size={12} /> Lipsa</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lanseaza in productie */}
          {canLaunch && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                    <Rocket size={14} /> Lansare in productie
                  </h4>
                  <p className="text-xs text-indigo-600 mt-1">Toate verificarile tehnice sunt complete.</p>
                </div>
                <button
                  onClick={() => setLaunchConfirm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Rocket size={14} /> Lanseaza in productie
                </button>
              </div>
            </div>
          )}

          {/* Launch confirmation dialog */}
          {launchConfirm && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Rocket size={16} className="text-indigo-600" /> Confirmare lansare
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Comanda va fi trimisa in productie. Operatorii vor fi notificati.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setLaunchConfirm(false)} className="btn-secondary text-sm">Anuleaza</button>
                  <button
                    onClick={() => launchMutation.mutate()}
                    disabled={launchMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {launchMutation.isPending ? 'Se lanseaza...' : 'Confirma lansarea'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editModal && <EditWorkOrderModal wo={wo} onClose={() => setEditModal(false)} />}
    </div>
  )
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('list')
  const [statusFilter, setStatusFilter] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work-orders', statusFilter],
    queryFn: () => api.get('/work-orders', { params: { status: statusFilter || undefined, limit: 200 } }).then(r => r.data),
  })

  const { data: orders } = useQuery({
    queryKey: ['production-orders-active'],
    queryFn: () => api.get('/production/orders', { params: { status: 'active', limit: 100 } }).then(r => r.data),
    enabled: modal,
  })

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get('/machines').then(r => r.data.data),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users').then(r => r.data.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Comenzi de Lucru</h2>
        {isManager && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Comanda noua
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['list', 'Lista'], ['calendar', 'Calendar'], ['rates', 'Tarife personal']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <div className="flex gap-2">
            <select className="input w-48" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Toate</option>
              <option value="draft">Ciorna</option>
              <option value="confirmed">Confirmat</option>
              <option value="materials_ready">Materiale pregatite</option>
              <option value="in_production">In productie</option>
              <option value="quality_check">Control calitate</option>
              <option value="completed">Finalizat</option>
              <option value="shipped">Livrat</option>
              <option value="cancelled">Anulat</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nr.</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Cant.</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Start plan.</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Prioritate</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
                {workOrders?.data?.map(wo => (
                  <tr key={wo.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(wo)}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{wo.work_order_number}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {wo.product_name || wo.product_reference || '—'}
                      {wo.order_number && <span className="text-xs text-slate-400 ml-2">{wo.order_number}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{wo.quantity?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                      {wo.scheduled_start ? new Date(wo.scheduled_start).toLocaleDateString('ro-RO') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium hidden lg:table-cell ${PRIORITY_COLORS[wo.priority]}`}>
                      {wo.priority}
                    </td>
                    <td className="px-4 py-3"><ChevronRight size={14} className="text-slate-300 ml-auto" /></td>
                  </tr>
                ))}
                {workOrders?.data?.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <ClipboardList size={32} className="mx-auto mb-2 text-slate-300" />
                    Nicio comanda de lucru.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'calendar' && (
        <WeekCalendar workOrders={workOrders?.data} machines={machines} />
      )}

      {tab === 'rates' && <HrRatesSection />}

      {modal && <WorkOrderModal orders={orders?.data} onClose={() => setModal(false)} />}
      {selected && <WorkOrderDetail wo={selected} users={users} onClose={() => setSelected(null)} />}
    </div>
  )
}
