import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  Truck, Plus, Package, Eye, X, Send, CheckCircle2,
  ChevronRight, Ban, FileText, Box
} from 'lucide-react'

const STATUS_META = {
  preparing:  { label: 'In pregatire',  color: '#F59E0B', bg: 'bg-amber-100 text-amber-700' },
  dispatched: { label: 'Expediat',      color: '#3B82F6', bg: 'bg-blue-100 text-blue-700' },
  in_transit: { label: 'In tranzit',    color: '#8B5CF6', bg: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Livrat',        color: '#10B981', bg: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Anulat',        color: '#EF4444', bg: 'bg-red-100 text-red-400' },
}

const TRANSPORT_LABELS = {
  own: 'Transport propriu',
  courier: 'Curier',
  client_pickup: 'Ridicare client',
}

const PACKAGE_TYPES = [
  { value: 'palet', label: 'Palet' },
  { value: 'cutie', label: 'Cutie' },
  { value: 'vrac', label: 'Vrac' },
  { value: 'container', label: 'Container' },
]

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg}`}>
      {meta.label}
    </span>
  )
}

// ─── Status Flow Visualization ──────────────────────────────────────────

function StatusFlow({ current }) {
  const steps = ['preparing', 'dispatched', 'delivered']
  const currentIdx = steps.indexOf(current)
  const isCancelled = current === 'cancelled'

  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((step, i) => {
        const meta = STATUS_META[step]
        const isActive = !isCancelled && i <= currentIdx
        const isCurrent = step === current
        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <ChevronRight size={14} className={isActive ? 'text-slate-600' : 'text-slate-300'} />
            )}
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? 'text-white'
                  : isActive
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-50 text-slate-300'
              }`}
              style={isCurrent ? { backgroundColor: meta.color } : undefined}
            >
              {meta.label}
            </div>
          </div>
        )
      })}
      {isCancelled && (
        <>
          <ChevronRight size={14} className="text-red-300" />
          <div className="px-3 py-1.5 rounded-full text-xs font-medium text-white bg-red-500">
            Anulat
          </div>
        </>
      )}
    </div>
  )
}

// ─── New Shipment Modal ─────────────────────────────────────────────────

function NewShipmentModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    order_id: '', quantity_shipped: '', delivery_address: '',
    transport_type: 'own', transporter_company_id: '',
    vehicle_number: '', driver_name: '', is_partial: false, notes: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // Load work orders for selection
  const { data: ordersData } = useQuery({
    queryKey: ['work-orders-for-shipment'],
    queryFn: () => api.get('/work-orders', { params: { limit: 200 } }).then(r => r.data),
  })
  const orders = ordersData?.data || ordersData || []

  // Load companies for transporter selection
  const { data: companiesData } = useQuery({
    queryKey: ['companies-for-shipment'],
    queryFn: () => api.get('/companies', { params: { limit: 200 } }).then(r => r.data),
  })
  const companies = companiesData?.data || companiesData || []

  function handleOrderSelect(e) {
    const orderId = e.target.value
    const order = orders.find(o => o.id === orderId)
    setForm(prev => ({
      ...prev,
      order_id: orderId,
      client_company_id: order?.client_company_id || order?.company_id || '',
      delivery_address: order?.delivery_address || order?.address || '',
      quantity_shipped: order?.quantity || order?.qty_planned || '',
    }))
  }

  const mutation = useMutation({
    mutationFn: (data) => api.post('/shipments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      toast.success('Expeditie creata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare la creare.'),
  })

  function submit() {
    if (!form.quantity_shipped || Number(form.quantity_shipped) <= 0) {
      return toast.error('Cantitatea este obligatorie.')
    }
    mutation.mutate({
      ...form,
      quantity_shipped: Number(form.quantity_shipped),
      order_id: form.order_id || null,
      client_company_id: form.client_company_id || null,
      transporter_company_id: form.transporter_company_id || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Truck size={18} /> Expeditie noua
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Comanda asociata</label>
            <select className="input" value={form.order_id} onChange={handleOrderSelect}>
              <option value="">Fara comanda asociata</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.work_order_number || o.order_number} — {o.product_name || o.product_reference || ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cantitate de expediat *</label>
              <input className="input" type="number" min="1" value={form.quantity_shipped} onChange={f('quantity_shipped')} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_partial}
                  onChange={e => setForm({ ...form, is_partial: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Livrare partiala
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Adresa de livrare</label>
            <textarea className="input" rows={2} value={form.delivery_address} onChange={f('delivery_address')} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip transport</label>
            <select className="input" value={form.transport_type} onChange={f('transport_type')}>
              <option value="own">Transport propriu</option>
              <option value="courier">Curier</option>
              <option value="client_pickup">Ridicare client</option>
            </select>
          </div>
          {form.transport_type === 'courier' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Firma transportator</label>
              <select className="input" value={form.transporter_company_id} onChange={f('transporter_company_id')}>
                <option value="">Selecteaza...</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.company_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nr. vehicul</label>
              <input className="input" value={form.vehicle_number} onChange={f('vehicle_number')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Nume sofer</label>
              <input className="input" value={form.driver_name} onChange={f('driver_name')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Observatii</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza expeditia'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Package Modal ──────────────────────────────────────────────────

function AddPackageModal({ shipmentId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    package_type: 'cutie', quantity_in_package: '',
    gross_weight_kg: '', net_weight_kg: '', dimensions: '', notes: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/shipments/${shipmentId}/packages`, data),
    onSuccess: () => { toast.success('Colet adaugat.'); onSuccess?.(); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  function submit() {
    mutation.mutate({
      ...form,
      quantity_in_package: Number(form.quantity_in_package) || 0,
      gross_weight_kg: form.gross_weight_kg ? Number(form.gross_weight_kg) : null,
      net_weight_kg: form.net_weight_kg ? Number(form.net_weight_kg) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Box size={18} /> Adauga colet
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip ambalaj</label>
            <select className="input" value={form.package_type} onChange={f('package_type')}>
              {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Cantitate in colet</label>
            <input className="input" type="number" min="0" value={form.quantity_in_package} onChange={f('quantity_in_package')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Greutate bruta (kg)</label>
              <input className="input" type="number" step="0.001" value={form.gross_weight_kg} onChange={f('gross_weight_kg')} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Greutate neta (kg)</label>
              <input className="input" type="number" step="0.001" value={form.net_weight_kg} onChange={f('net_weight_kg')} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Dimensiuni (ex: 120x80x100)</label>
            <input className="input" value={form.dimensions} onChange={f('dimensions')} placeholder="LxlxH" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Observatii</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se adauga...' : 'Adauga'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shipment Detail Modal ──────────────────────────────────────────────

function ShipmentDetailModal({ shipmentId, onClose }) {
  const qc = useQueryClient()
  const [showAddPkg, setShowAddPkg] = useState(false)

  const { data: shipment, isLoading, refetch } = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: () => api.get(`/shipments/${shipmentId}`).then(r => r.data),
    enabled: !!shipmentId,
  })

  const dispatchMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${shipmentId}/dispatch`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      refetch()
      toast.success('Expeditia a fost expediata.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const deliverMutation = useMutation({
    mutationFn: () => api.put(`/shipments/${shipmentId}/deliver`, {
      confirmedBy: 'Operator',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      refetch()
      toast.success('Livrare confirmata.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/shipments/${shipmentId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      refetch()
      toast.success('Expeditia a fost anulata.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
        <p className="text-slate-400 text-sm">Se incarca...</p>
      </div>
    </div>
  )

  if (!shipment) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Truck size={18} /> {shipment.shipment_number}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Status Flow */}
        <StatusFlow current={shipment.status} />

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <span className="text-xs text-slate-400">Cantitate expediata</span>
            <p className="font-medium">{shipment.quantity_shipped}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Transport</span>
            <p className="font-medium">{TRANSPORT_LABELS[shipment.transport_type] || shipment.transport_type}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Nr. vehicul</span>
            <p className="font-medium">{shipment.vehicle_number || '-'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">Sofer</span>
            <p className="font-medium">{shipment.driver_name || '-'}</p>
          </div>
          {shipment.delivery_address && (
            <div className="col-span-2">
              <span className="text-xs text-slate-400">Adresa livrare</span>
              <p className="font-medium">{shipment.delivery_address}</p>
            </div>
          )}
          {shipment.dispatched_at && (
            <div>
              <span className="text-xs text-slate-400">Data expediere</span>
              <p className="font-medium">{new Date(shipment.dispatched_at).toLocaleString('ro-RO')}</p>
            </div>
          )}
          {shipment.delivered_at && (
            <div>
              <span className="text-xs text-slate-400">Data livrare</span>
              <p className="font-medium">{new Date(shipment.delivered_at).toLocaleString('ro-RO')}</p>
            </div>
          )}
          {shipment.delivery_confirmed_by && (
            <div>
              <span className="text-xs text-slate-400">Confirmat de</span>
              <p className="font-medium">{shipment.delivery_confirmed_by}</p>
            </div>
          )}
          {shipment.notes && (
            <div className="col-span-2">
              <span className="text-xs text-slate-400">Observatii</span>
              <p className="font-medium">{shipment.notes}</p>
            </div>
          )}
        </div>

        {/* Packages Section */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <Package size={14} /> Colete ({shipment.packages?.length || 0})
            </h4>
            {shipment.status === 'preparing' && (
              <button
                onClick={() => setShowAddPkg(true)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={12} /> Adauga colet
              </button>
            )}
          </div>
          {shipment.packages?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Tip</th>
                    <th className="pb-2 pr-3">Cantitate</th>
                    <th className="pb-2 pr-3">Brut (kg)</th>
                    <th className="pb-2 pr-3">Net (kg)</th>
                    <th className="pb-2 pr-3">Dimensiuni</th>
                    <th className="pb-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.packages.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1.5 pr-3">{p.package_number}</td>
                      <td className="py-1.5 pr-3 capitalize">{p.package_type}</td>
                      <td className="py-1.5 pr-3">{p.quantity_in_package}</td>
                      <td className="py-1.5 pr-3">{p.gross_weight_kg || '-'}</td>
                      <td className="py-1.5 pr-3">{p.net_weight_kg || '-'}</td>
                      <td className="py-1.5 pr-3">{p.dimensions || '-'}</td>
                      <td className="py-1.5 text-slate-400">{p.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Niciun colet adaugat.</p>
          )}
        </div>

        {/* Documents Section */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1 mb-2">
            <FileText size={14} /> Documente ({shipment.documents?.length || 0})
          </h4>
          {shipment.documents?.length > 0 ? (
            <div className="space-y-1">
              {shipment.documents.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded">
                  <FileText size={12} className="text-slate-400" />
                  <span className="uppercase font-medium text-slate-600">{d.document_type}</span>
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-auto">
                      Descarca
                    </a>
                  )}
                  <span className="text-slate-400">{new Date(d.generated_at).toLocaleDateString('ro-RO')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Documentele vor fi generate automat (aviz, CMR, packing list).</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
          {shipment.status === 'preparing' && (
            <>
              <button
                onClick={() => { if (confirm('Anulezi expeditia?')) cancelMutation.mutate() }}
                disabled={cancelMutation.isPending}
                className="btn-secondary flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Ban size={14} /> Anuleaza
              </button>
              <button
                onClick={() => dispatchMutation.mutate()}
                disabled={dispatchMutation.isPending}
                className="btn-primary flex items-center gap-1"
              >
                <Send size={14} /> {dispatchMutation.isPending ? 'Se expediaza...' : 'Expediaza'}
              </button>
            </>
          )}
          {(shipment.status === 'dispatched' || shipment.status === 'in_transit') && (
            <>
              <button
                onClick={() => { if (confirm('Anulezi expeditia?')) cancelMutation.mutate() }}
                disabled={cancelMutation.isPending}
                className="btn-secondary flex items-center gap-1 text-red-600 hover:text-red-700"
              >
                <Ban size={14} /> Anuleaza
              </button>
              <button
                onClick={() => deliverMutation.mutate()}
                disabled={deliverMutation.isPending}
                className="btn-primary flex items-center gap-1"
              >
                <CheckCircle2 size={14} /> {deliverMutation.isPending ? 'Se confirma...' : 'Confirma livrare'}
              </button>
            </>
          )}
          <button onClick={onClose} className="btn-secondary">Inchide</button>
        </div>
      </div>

      {showAddPkg && (
        <AddPackageModal
          shipmentId={shipmentId}
          onClose={() => setShowAddPkg(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['shipments', filterStatus],
    queryFn: () => api.get('/shipments', { params: filterStatus ? { status: filterStatus } : {} }).then(r => r.data),
  })

  const shipments = data?.data || []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck size={22} /> Expeditii & Livrari
          </h1>
          <p className="text-sm text-slate-400 mt-1">Gestioneaza expeditiile si livrarile catre clienti</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1">
          <Plus size={16} /> Expeditie noua
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input w-48"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Toate statusurile</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {data?.total !== undefined && (
          <span className="text-xs text-slate-400">Total: {data.total} expeditii</span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3">Nr. Expeditie</th>
                <th className="px-4 py-3">Comanda</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Cantitate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data expediere</th>
                <th className="px-4 py-3">Transport</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => (
                <tr
                  key={s.id}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedId(s.id)}
                >
                  <td className="px-4 py-3 font-medium text-slate-700">{s.shipment_number}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.order_id ? s.order_id.substring(0, 8) + '...' : '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.client_company_id ? s.client_company_id.substring(0, 8) + '...' : '-'}</td>
                  <td className="px-4 py-3">
                    {s.quantity_shipped}
                    {s.is_partial && <span className="ml-1 text-xs text-amber-500">(partial)</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {s.dispatched_at ? new Date(s.dispatched_at).toLocaleDateString('ro-RO') : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">{TRANSPORT_LABELS[s.transport_type] || s.transport_type}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedId(s.id) }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nicio expeditie gasita.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewShipmentModal onClose={() => setShowNew(false)} />}
      {selectedId && <ShipmentDetailModal shipmentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
