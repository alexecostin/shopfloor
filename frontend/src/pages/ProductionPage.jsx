import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { hapticSuccess } from '../utils/haptic'
import { Plus, StopCircle, PlayCircle, Pencil, Eye, Clock, X } from 'lucide-react'
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

const SHIFTS = ['Tura I', 'Tura II', 'Tura III']

function ReportModal({ machines, orders, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', orderId: '', shift: 'Tura I', goodPieces: 0, scrapPieces: 0, scrapReason: '', scrapReasonCode: '', reworkPieces: 0, reworkReasonCode: '', notes: '' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/production/reports', data),
    onSuccess: () => { qc.invalidateQueries(['reports']); toast.success('Raport inregistrat.'); hapticSuccess(); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Raporteaza productie</h3>
        <div className="space-y-3">
          <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <select className="input" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })}>
            <option value="">Fara comanda (optional)</option>
            {orders?.filter(o => o.status === 'active').map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.product_name}</option>)}
          </select>
          <select className="input" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Piese bune</label>
              <input type="number" min={0} className="input" value={form.goodPieces} onChange={e => setForm({ ...form, goodPieces: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Rebuturi</label>
              <input type="number" min={0} className="input" value={form.scrapPieces} onChange={e => setForm({ ...form, scrapPieces: +e.target.value })} />
            </div>
          </div>
          {form.scrapPieces > 0 && (
            <LookupSelect lookupType="scrap_reasons" value={form.scrapReasonCode || form.scrapReason} onChange={v => setForm({ ...form, scrapReasonCode: v, scrapReason: v })} placeholder="Motiv rebuturi" />
          )}
          <div>
            <label className="text-xs text-slate-500">Piese reprelucrare</label>
            <input type="number" min={0} className="input" value={form.reworkPieces} onChange={e => setForm({ ...form, reworkPieces: +e.target.value })} />
          </div>
          {form.reworkPieces > 0 && (
            <LookupSelect lookupType="rework_reasons" value={form.reworkReasonCode} onChange={v => setForm({ ...form, reworkReasonCode: v })} placeholder="Motiv reprelucrare" />
          )}
          <textarea className="input resize-none" rows={2} placeholder="Observatii (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate({ ...form, orderId: form.orderId || null })} disabled={mutation.isPending || !form.machineId} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Raporteaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StopModal({ machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', reason: '', category: '', shift: 'Tura I' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/production/stops', data),
    onSuccess: () => { qc.invalidateQueries(['stops']); toast.success('Oprire inregistrata.'); hapticSuccess(); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-red-600 mb-4">Inregistreaza oprire</h3>
        <div className="space-y-3">
          <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <input className="input" placeholder="Motiv oprire" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <LookupSelect lookupType="stop_categories" value={form.category} onChange={v => setForm({ ...form, category: v })} placeholder="Categorie oprire" />
          <select className="input" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.machineId || !form.reason} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {mutation.isPending ? 'Se salveaza...' : 'Inregistreaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal comanda productie noua ────────────────────────────────────────────

function NewOrderModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    order_number: '', product_reference: '', product_name: '',
    quantity: '', client_name: '', deadline: '', priority: 'normal',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/production/orders', data),
    onSuccess: () => { qc.invalidateQueries(['orders']); toast.success('Comanda creata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Comanda noua</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nr. comanda *</label>
            <input className="input" placeholder="Ex: CMD-001" value={form.order_number} onChange={f('order_number')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referinta produs</label>
              <input className="input" value={form.product_reference} onChange={f('product_reference')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Denumire produs *</label>
              <input className="input" value={form.product_name} onChange={f('product_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate *</label>
              <input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Client</label>
              <input className="input" value={form.client_name} onChange={f('client_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Termen limita</label>
              <input className="input" type="date" value={form.deadline} onChange={f('deadline')} />
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
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, quantity: Number(form.quantity) })}
            disabled={mutation.isPending || !form.order_number || !form.product_name || !form.quantity}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal editare comanda productie ─────────────────────────────────────────

function EditOrderModal({ order, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    product_reference: order.product_reference || order.product_code || '',
    product_name: order.product_name || '',
    quantity: String(order.target_quantity || order.quantity || ''),
    client_name: order.client_name || '',
    deadline: order.deadline ? order.deadline.split('T')[0] : '',
    priority: order.priority || 'normal',
    status: order.status || 'planned',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/production/orders/${order.id}`, data),
    onSuccess: () => { qc.invalidateQueries(['orders']); qc.invalidateQueries(['order-detail', order.id]); toast.success('Comanda actualizata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pencil size={16} /> Editeaza {order.order_number}
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referinta produs</label>
              <input className="input" value={form.product_reference} onChange={f('product_reference')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Denumire produs</label>
              <input className="input" value={form.product_name} onChange={f('product_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate</label>
              <input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Client</label>
              <input className="input" value={form.client_name} onChange={f('client_name')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Termen limita</label>
              <input className="input" type="date" value={form.deadline} onChange={f('deadline')} />
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
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Status</label>
            <select className="input" value={form.status} onChange={f('status')}>
              <option value="planned">Planificat</option>
              <option value="active">Activ</option>
              <option value="completed">Finalizat</option>
              <option value="cancelled">Anulat</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, quantity: Number(form.quantity) })}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal detalii comanda productie ─────────────────────────────────────────

function OrderDetailModal({ orderId, onClose, onEdit }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => api.get(`/production/orders/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  const order = detail?.data || detail || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Eye size={16} /> Detalii comanda
          </h3>
          <div className="flex gap-2">
            {onEdit && (
              <button onClick={() => onEdit(order)} className="btn-secondary text-xs flex items-center gap-1">
                <Pencil size={12} /> Editeaza
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
          </div>
        </div>
        {isLoading ? (
          <p className="text-slate-400 text-sm py-4 text-center">Se incarca...</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Nr. comanda</p>
                <p className="font-medium text-slate-800">{order.order_number || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Status</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  order.status === 'active' ? 'bg-green-100 text-green-700' :
                  order.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  order.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{order.status || '—'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Produs</p>
                <p className="font-medium text-slate-800">{order.product_name || '—'}</p>
                {order.product_reference || order.product_code ? <p className="text-xs text-slate-500">{order.product_reference || order.product_code}</p> : null}
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Cantitate</p>
                <p className="font-medium text-slate-800">{(order.target_quantity || order.quantity || 0).toLocaleString()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Client</p>
                <p className="font-medium text-slate-800">{order.client_name || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Termen limita</p>
                <p className="font-medium text-slate-800">{order.deadline ? new Date(order.deadline).toLocaleDateString('ro-RO') : '—'}</p>
              </div>
            </div>
            {order.priority && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Prioritate</p>
                <p className="font-medium text-slate-800">{order.priority}</p>
              </div>
            )}
            {order.notes && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Note</p>
                <p className="text-slate-700">{order.notes}</p>
              </div>
            )}
            {order.created_at && (
              <div className="text-xs text-slate-400 pt-2">
                Creata la: {new Date(order.created_at).toLocaleString('ro-RO')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shifts management ───────────────────────────────────────────────────────

function ShiftsTab({ machines }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(null)
  const [openForm, setOpenForm] = useState({ machineId: '', shift: 'Tura I', operatorId: '' })
  const [closeForm, setCloseForm] = useState({ endQty: '', scrapQty: '' })

  const { data: shifts, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => api.get('/production/shifts').then(r => r.data),
  })

  const { data: users } = useQuery({
    queryKey: ['users-shifts'],
    queryFn: () => api.get('/auth/users').then(r => r.data.data),
    enabled: openModal,
  })

  const openShift = useMutation({
    mutationFn: (data) => api.post('/production/shifts', data),
    onSuccess: () => { qc.invalidateQueries(['shifts']); toast.success('Tura deschisa.'); setOpenModal(false) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const closeShift = useMutation({
    mutationFn: ({ id, data }) => api.put(`/production/shifts/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['shifts']); toast.success('Tura inchisa.'); setCloseModal(null) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const shiftList = shifts?.data || shifts || []

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setOpenModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <PlayCircle size={15} /> Deschide tura
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tura</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Utilaj</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Start</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {shiftList.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{s.shift}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-600">{s.machine_name || s.machine_id?.slice(0, 8) || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.operator_name || s.operator_id?.slice(0, 8) || '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{s.started_at ? new Date(s.started_at).toLocaleString('ro-RO') : s.created_at ? new Date(s.created_at).toLocaleString('ro-RO') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                    {s.status === 'closed' ? 'Inchisa' : 'Deschisa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {s.status !== 'closed' && (
                    <button onClick={() => { setCloseModal(s); setCloseForm({ endQty: '', scrapQty: '' }) }} className="text-xs text-red-500 hover:underline flex items-center gap-1 ml-auto">
                      <StopCircle size={13} /> Inchide
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {shiftList.length === 0 && !isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio tura.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Open shift modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Deschide tura</h3>
            <div className="space-y-3">
              <select className="input" value={openForm.machineId} onChange={e => setOpenForm({ ...openForm, machineId: e.target.value })}>
                <option value="">Selecteaza utilaj *</option>
                {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
              <select className="input" value={openForm.shift} onChange={e => setOpenForm({ ...openForm, shift: e.target.value })}>
                <option value="Tura I">Tura I</option>
                <option value="Tura II">Tura II</option>
                <option value="Tura III">Tura III</option>
              </select>
              <select className="input" value={openForm.operatorId} onChange={e => setOpenForm({ ...openForm, operatorId: e.target.value })}>
                <option value="">Selecteaza operator</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setOpenModal(false)} className="btn-secondary">Anuleaza</button>
              <button
                onClick={() => openShift.mutate(openForm)}
                disabled={openShift.isPending || !openForm.machineId}
                className="btn-primary"
              >
                {openShift.isPending ? 'Se deschide...' : 'Deschide'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close shift modal */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-red-600 mb-4">Inchide tura</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Cantitate finala</label>
                <input className="input" type="number" min="0" value={closeForm.endQty} onChange={e => setCloseForm({ ...closeForm, endQty: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Rebuturi</label>
                <input className="input" type="number" min="0" value={closeForm.scrapQty} onChange={e => setCloseForm({ ...closeForm, scrapQty: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setCloseModal(null)} className="btn-secondary">Anuleaza</button>
              <button
                onClick={() => closeShift.mutate({ id: closeModal.id, data: { status: 'closed', endQty: Number(closeForm.endQty) || 0, scrapQty: Number(closeForm.scrapQty) || 0 } })}
                disabled={closeShift.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {closeShift.isPending ? 'Se inchide...' : 'Inchide tura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function ProductionPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState('reports')
  const [modal, setModal] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const canReport = ['admin', 'production_manager', 'shift_leader', 'operator'].includes(user?.role)
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/production/orders').then(r => r.data.data) })
  const { data: reports, isLoading: rLoading } = useQuery({ queryKey: ['reports'], queryFn: () => api.get('/production/reports').then(r => r.data), enabled: tab === 'reports' })
  const { data: stops, isLoading: sLoading } = useQuery({ queryKey: ['stops'], queryFn: () => api.get('/production/stops').then(r => r.data), enabled: tab === 'stops' })

  const closeStop = useMutation({
    mutationFn: (id) => api.put(`/production/stops/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries(['stops']); toast.success('Oprire inchisa.'); hapticSuccess() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Productie</h2>
        {canReport && (
          <div className="flex gap-2">
            {tab === 'orders' && isManager && (
              <button onClick={() => setModal('new-order')} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Comanda noua
              </button>
            )}
            {tab !== 'orders' && canReport && (
              <>
                <button onClick={() => setModal('stop')} className="flex items-center gap-2 text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
                  <StopCircle size={15} /> Oprire
                </button>
                <button onClick={() => setModal('report')} className="btn-primary flex items-center gap-2">
                  <Plus size={15} /> Raport
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {['reports', 'stops', 'orders', 'shifts'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'reports' ? 'Rapoarte' : t === 'stops' ? 'Opriri' : t === 'orders' ? 'Comenzi' : 'Ture'}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Utilaj</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tura</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Bune</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
              {reports?.data?.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.machine_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-700">{r.shift}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{r.good_pieces}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-medium">{r.scrap_pieces}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell text-xs">{new Date(r.reported_at).toLocaleString('ro-RO')}</td>
                </tr>
              ))}
              {reports?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Niciun raport.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'stops' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Motiv</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Categorie</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Durata</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                {canReport && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
              {stops?.data?.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{s.reason}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.duration_minutes != null ? `${s.duration_minutes} min` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${s.ended_at ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600 animate-pulse'}`}>
                      {s.ended_at ? 'Inchisa' : 'Deschisa'}
                    </span>
                  </td>
                  {canReport && !s.ended_at && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => closeStop.mutate(s.id)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                        <PlayCircle size={13} /> Inchide
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {stops?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio oprire.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nr. Comanda</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cantitate</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                {isManager && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders?.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setOrderDetail(o)}>
                  <td className="px-4 py-3 font-mono text-slate-800">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-700">{o.product_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{o.target_quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      o.status === 'active' ? 'bg-green-100 text-green-700' :
                      o.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      o.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{o.status}</span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setEditOrder(o) }} className="text-xs text-blue-500 hover:underline flex items-center gap-1 ml-auto">
                        <Pencil size={12} /> Editeaza
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {orders?.length === 0 && <tr><td colSpan={isManager ? 5 : 4} className="px-4 py-8 text-center text-slate-400">Nicio comanda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'shifts' && <ShiftsTab machines={machines} />}

      {modal === 'report' && <ReportModal machines={machines} orders={orders} onClose={() => setModal(null)} />}
      {modal === 'stop' && <StopModal machines={machines} onClose={() => setModal(null)} />}
      {modal === 'new-order' && <NewOrderModal onClose={() => setModal(null)} />}
      {orderDetail && (
        <OrderDetailModal
          orderId={orderDetail.id}
          onClose={() => setOrderDetail(null)}
          onEdit={(o) => { setOrderDetail(null); setEditOrder(o) }}
        />
      )}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} />}
    </div>
  )
}
