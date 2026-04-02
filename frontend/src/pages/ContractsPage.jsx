import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import SearchableSelect from '../components/SearchableSelect'
import { formatMoney } from '../utils/currency'
import {
  Plus, X, FileText, ChevronRight, Package, CheckCircle,
  Calendar, Loader2, ArrowRight,
} from 'lucide-react'

const STATUS_CFG = {
  draft:     { label: 'Ciorna',    bg: 'bg-slate-100 text-slate-600' },
  active:    { label: 'Activ',     bg: 'bg-green-100 text-green-700' },
  completed: { label: 'Finalizat', bg: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Anulat',    bg: 'bg-red-100 text-red-700' },
}

const FREQ_LABELS = {
  weekly: 'Saptamanal',
  biweekly: 'Bisaptamanal',
  monthly: 'Lunar',
}

const WO_STATUS_CFG = {
  planned:         { label: 'Planificat',       bg: 'bg-slate-100 text-slate-600' },
  released:        { label: 'Lansat',           bg: 'bg-blue-100 text-blue-700' },
  in_progress:     { label: 'In lucru',         bg: 'bg-amber-100 text-amber-700' },
  completed:       { label: 'Finalizat',        bg: 'bg-emerald-100 text-emerald-700' },
  shipped:         { label: 'Livrat',           bg: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Anulat',           bg: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status, cfg }) {
  const c = (cfg || STATUS_CFG)[status] || { label: status, bg: 'bg-slate-100 text-slate-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg}`}>{c.label}</span>
}

/* ── Create Contract Modal ────────────────────────────────────────────────── */

function CreateContractModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    clientId: null,
    contractNumber: '',
    productReference: '',
    productName: '',
    totalQuantity: '',
    unitPrice: '',
    currency: 'RON',
    deliveryFrequency: 'monthly',
    quantityPerDelivery: '',
    startDate: '',
    endDate: '',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/contracts', data),
    onSuccess: () => {
      qc.invalidateQueries(['framework-contracts'])
      toast.success('Contract cadru creat cu succes.')
      onClose()
    },
    onError: (e) => {
      const msg = e.response?.data?.message || ''
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Acest contract exista deja.')
      else toast.error(msg || 'Eroare la crearea contractului.')
    },
  })

  const canSave = form.clientId && form.contractNumber && form.totalQuantity && form.quantityPerDelivery && form.startDate && form.endDate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Contract cadru nou</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Client *</label>
            <SearchableSelect
              endpoint="/companies"
              filterParams={{ companyType: 'client' }}
              labelField="name"
              valueField="id"
              placeholder="Selecteaza client"
              value={form.clientId}
              onChange={(id) => setForm(f => ({ ...f, clientId: id }))}
              allowCreate={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nr. contract *</label>
              <input className="input" placeholder="Ex: CC-2026-001" value={form.contractNumber}
                onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Referinta produs</label>
              <input className="input" placeholder="Ex: AXL-500" value={form.productReference}
                onChange={e => setForm(f => ({ ...f, productReference: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Denumire produs</label>
            <input className="input" placeholder="Ex: Ax principal 500mm" value={form.productName}
              onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cantitate totala *</label>
              <input className="input" type="number" placeholder="Ex: 12000" value={form.totalQuantity}
                onChange={e => setForm(f => ({ ...f, totalQuantity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Pret unitar</label>
              <input className="input" type="number" step="0.01" placeholder="Ex: 45.00" value={form.unitPrice}
                onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Moneda</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['RON', 'EUR', 'USD', 'GBP', 'HUF'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Frecventa livrare *</label>
              <select className="input" value={form.deliveryFrequency} onChange={e => setForm(f => ({ ...f, deliveryFrequency: e.target.value }))}>
                <option value="weekly">Saptamanal</option>
                <option value="biweekly">Bisaptamanal</option>
                <option value="monthly">Lunar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cantitate per livrare *</label>
              <input className="input" type="number" placeholder="Ex: 1000" value={form.quantityPerDelivery}
                onChange={e => setForm(f => ({ ...f, quantityPerDelivery: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data start *</label>
              <input className="input" type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data sfarsit *</label>
              <input className="input" type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note</label>
            <textarea className="input" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              ...form,
              totalQuantity: Number(form.totalQuantity),
              unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
              quantityPerDelivery: Number(form.quantityPerDelivery),
            })}
            disabled={mutation.isPending || !canSave}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza contract'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Contract Detail Modal ────────────────────────────────────────────────── */

function ContractDetailModal({ contractId, onClose }) {
  const qc = useQueryClient()

  const { data: contract, isLoading } = useQuery({
    queryKey: ['framework-contract', contractId],
    queryFn: () => api.get(`/contracts/${contractId}`).then(r => r.data),
  })

  const generateMut = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/generate-delivery`),
    onSuccess: (res) => {
      qc.invalidateQueries(['framework-contract', contractId])
      qc.invalidateQueries(['framework-contracts'])
      const wo = res.data
      toast.success(`Comanda de lucru ${wo.work_order_number} generata cu succes.`)
    },
    onError: (e) => {
      const msg = e.response?.data?.message || ''
      toast.error(msg || 'Eroare la generarea livrarii.')
    },
  })

  const statusMut = useMutation({
    mutationFn: (data) => api.put(`/contracts/${contractId}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['framework-contract', contractId])
      qc.invalidateQueries(['framework-contracts'])
      toast.success('Status contract actualizat.')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare la actualizare.'),
  })

  if (isLoading || !contract) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-3xl mx-4 text-center text-slate-400">
          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
          Se incarca...
        </div>
      </div>
    )
  }

  const totalQty = Number(contract.total_quantity) || 0
  const deliveredQty = contract.delivered_qty || 0
  const progressPct = totalQty > 0 ? Math.round(deliveredQty / totalQty * 100) : 0
  const isActive = contract.status === 'active'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800">{contract.contract_number}</h3>
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{contract.client_name}</p>
            {contract.product_name && <p className="text-xs text-slate-400">{contract.product_reference} - {contract.product_name}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Contract info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Cant. totala</span>
            <p className="font-bold text-slate-800">{totalQty.toLocaleString('ro-RO')}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Per livrare</span>
            <p className="font-bold text-slate-800">{Number(contract.quantity_per_delivery || 0).toLocaleString('ro-RO')}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Frecventa</span>
            <p className="text-sm text-slate-700">{FREQ_LABELS[contract.delivery_frequency] || contract.delivery_frequency}</p>
          </div>
          {contract.unit_price && (
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Pret unitar</span>
              <p className="font-bold text-slate-800">{formatMoney(Number(contract.unit_price), contract.currency || 'RON')}</p>
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <div>
              <span className="text-slate-400 text-xs">Perioada</span>
              <p className="text-sm text-slate-700">
                {contract.start_date ? new Date(contract.start_date).toLocaleDateString('ro-RO') : '-'}
                {' '}<ArrowRight size={12} className="inline text-slate-400" />{' '}
                {contract.end_date ? new Date(contract.end_date).toLocaleDateString('ro-RO') : '-'}
              </p>
            </div>
          </div>
          {contract.unit_price && totalQty > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <span className="text-blue-400 text-xs">Valoare totala contract</span>
              <p className="font-bold text-blue-800">{formatMoney(Number(contract.unit_price) * totalQty, contract.currency || 'RON')}</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-slate-50 rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progres livrari</span>
            <span className="text-sm font-bold text-slate-800">
              {deliveredQty.toLocaleString('ro-RO')} / {totalQty.toLocaleString('ro-RO')} ({progressPct}%)
            </span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : progressPct > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {contract.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-5">{contract.notes}</p>}

        {/* Generated orders */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Comenzi de lucru generate</h4>
          <span className="text-xs text-slate-400">{contract.orders?.length || 0} comenzi</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Nr. CL</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Nr. comanda</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cantitate</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Termen</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contract.orders?.map(wo => (
                <tr key={wo.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-blue-600">{wo.work_order_number}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{wo.order_number}</td>
                  <td className="px-3 py-2 text-right text-xs font-medium">{Number(wo.quantity || 0).toLocaleString('ro-RO')}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{wo.scheduled_end ? new Date(wo.scheduled_end).toLocaleDateString('ro-RO') : '-'}</td>
                  <td className="px-3 py-2"><StatusBadge status={wo.status} cfg={WO_STATUS_CFG} /></td>
                </tr>
              ))}
              {(!contract.orders || contract.orders.length === 0) && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">Nicio comanda generata inca.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
          {isActive && (
            <button
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              {generateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
              {generateMut.isPending ? 'Se genereaza...' : 'Genereaza urmatoarea livrare'}
            </button>
          )}
          {isActive && (
            <button
              onClick={() => { if (confirm('Finalizezi acest contract?')) statusMut.mutate({ status: 'completed' }) }}
              disabled={statusMut.isPending}
              className="btn-secondary text-sm text-blue-600 hover:text-blue-800"
            >
              <CheckCircle size={13} className="inline mr-1" /> Finalizeaza
            </button>
          )}
          {isActive && (
            <button
              onClick={() => { if (confirm('Anulezi acest contract?')) statusMut.mutate({ status: 'cancelled' }) }}
              disabled={statusMut.isPending}
              className="btn-secondary text-sm text-red-500 hover:text-red-700"
            >
              Anuleaza
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Contracts Page ──────────────────────────────────────────────────── */

export default function ContractsPage() {
  const [createModal, setCreateModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['framework-contracts', statusFilter],
    queryFn: () => api.get('/contracts', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  const items = Array.isArray(contracts) ? contracts : contracts?.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Contracte cadru</h2>
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Contract nou
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <select className="input text-sm w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Toate statusurile</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-slate-400">{items.length} contracte</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr. contract</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Cant. totala</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Per livrare</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Frecventa</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {items.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedContract(c.id)}>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{c.contract_number}</td>
                <td className="px-4 py-3 text-slate-800">{c.client_name || '-'}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {c.product_reference && <span className="font-mono text-blue-500 mr-1">{c.product_reference}</span>}
                  {c.product_name || '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">{Number(c.total_quantity || 0).toLocaleString('ro-RO')}</td>
                <td className="px-4 py-3 text-right text-slate-600">{Number(c.quantity_per_delivery || 0).toLocaleString('ro-RO')}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{FREQ_LABELS[c.delivery_frequency] || c.delivery_frequency || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-slate-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                Niciun contract cadru.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {createModal && <CreateContractModal onClose={() => setCreateModal(false)} />}
      {selectedContract && <ContractDetailModal contractId={selectedContract} onClose={() => setSelectedContract(null)} />}
    </div>
  )
}
