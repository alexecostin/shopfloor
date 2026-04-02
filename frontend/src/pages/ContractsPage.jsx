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

function calcDeliveriesInPeriod(frequency, startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end - start
  if (diffMs <= 0) return 0
  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000)
  if (frequency === 'weekly') return Math.ceil(diffWeeks)
  if (frequency === 'biweekly') return Math.ceil(diffWeeks / 2)
  // monthly
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return Math.max(months, 1)
}

function CreateContractModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    clientId: null,
    contractNumber: '',
    products: [{ productId: null, productReference: '', productName: '', quantityPerDelivery: '', deliveryFrequency: 'monthly', unitPrice: '' }],
    currency: 'RON',
    startDate: '',
    endDate: '',
    notes: '',
  })

  // Fetch BOM products for SearchableSelect
  const { data: bomProductsData } = useQuery({
    queryKey: ['bom-products-contract'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })
  const bomProducts = bomProductsData?.data || []

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

  const addProduct = () => setForm(f => ({
    ...f,
    products: [...f.products, { productId: null, productReference: '', productName: '', quantityPerDelivery: '', deliveryFrequency: 'monthly', unitPrice: '' }]
  }))

  const removeProduct = (idx) => setForm(f => ({
    ...f,
    products: f.products.filter((_, i) => i !== idx)
  }))

  const updateProduct = (idx, field, value) => setForm(f => ({
    ...f,
    products: f.products.map((p, i) => i === idx ? { ...p, [field]: value } : p)
  }))

  const selectBomProduct = (idx, productId) => {
    const bp = bomProducts.find(p => p.id === productId)
    if (bp) {
      updateProduct(idx, 'productId', bp.id)
      updateProduct(idx, 'productReference', bp.reference || '')
      // Need to set both at once to avoid race
      setForm(f => ({
        ...f,
        products: f.products.map((p, i) => i === idx ? { ...p, productId: bp.id, productReference: bp.reference || '', productName: bp.name || '' } : p)
      }))
    } else {
      setForm(f => ({
        ...f,
        products: f.products.map((p, i) => i === idx ? { ...p, productId: null, productReference: '', productName: '' } : p)
      }))
    }
  }

  // Calculate totals from products
  const totalQtyPerDelivery = form.products.reduce((sum, p) => sum + (Number(p.quantityPerDelivery) || 0), 0)

  // Auto-calculate total contract quantity per product
  const autoTotalQty = form.products.reduce((sum, p) => {
    const qty = Number(p.quantityPerDelivery) || 0
    const deliveries = calcDeliveriesInPeriod(p.deliveryFrequency, form.startDate, form.endDate)
    return sum + (qty * deliveries)
  }, 0)

  const canSave = form.clientId && form.contractNumber && totalQtyPerDelivery > 0 && form.startDate && form.endDate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
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
              <label className="block text-xs text-slate-500 mb-1">Moneda</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['RON', 'EUR', 'USD', 'GBP', 'HUF'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Dates first — needed for auto-calc */}
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

          {/* Multi-product section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Produse in contract</label>
              <button type="button" onClick={addProduct} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus size={12} /> Adauga produs
              </button>
            </div>
            <div className="space-y-2">
              {form.products.map((p, idx) => {
                const deliveries = calcDeliveriesInPeriod(p.deliveryFrequency, form.startDate, form.endDate)
                const prodTotal = (Number(p.quantityPerDelivery) || 0) * deliveries
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-0.5">Produs (selecteaza din BOM sau scrie manual)</label>
                        <select
                          className="input w-full"
                          value={p.productId || ''}
                          onChange={e => selectBomProduct(idx, e.target.value || null)}
                        >
                          <option value="">-- Selecteaza produs sau scrie manual --</option>
                          {bomProducts.map(bp => (
                            <option key={bp.id} value={bp.id}>{bp.reference} - {bp.name}</option>
                          ))}
                        </select>
                      </div>
                      {form.products.length > 1 && (
                        <button type="button" onClick={() => removeProduct(idx)} className="text-slate-400 hover:text-red-500 mb-1">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {!p.productId && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-0.5">Referinta produs</label>
                          <input className="input w-full" placeholder="Ex: AXL-500" value={p.productReference}
                            onChange={e => updateProduct(idx, 'productReference', e.target.value)} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-0.5">Denumire produs</label>
                          <input className="input w-full" placeholder="Ex: Ax principal" value={p.productName}
                            onChange={e => updateProduct(idx, 'productName', e.target.value)} />
                        </div>
                      </div>
                    )}
                    {p.productId && (
                      <p className="text-xs text-slate-500">
                        <span className="font-mono text-blue-500">{p.productReference}</span> — {p.productName}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <div className="w-28">
                        <label className="block text-xs text-slate-400 mb-0.5">Cant./livrare *</label>
                        <input className="input w-full" type="number" placeholder="1000" value={p.quantityPerDelivery}
                          onChange={e => updateProduct(idx, 'quantityPerDelivery', e.target.value)} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-0.5">Frecventa</label>
                        <select className="input w-full" value={p.deliveryFrequency}
                          onChange={e => updateProduct(idx, 'deliveryFrequency', e.target.value)}>
                          <option value="weekly">Saptamanal</option>
                          <option value="biweekly">Bisaptamanal</option>
                          <option value="monthly">Lunar</option>
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="block text-xs text-slate-400 mb-0.5">Pret unitar</label>
                        <input className="input w-full" type="number" step="0.01" placeholder="45.00" value={p.unitPrice}
                          onChange={e => updateProduct(idx, 'unitPrice', e.target.value)} />
                      </div>
                    </div>
                    {deliveries > 0 && Number(p.quantityPerDelivery) > 0 && (
                      <p className="text-[11px] text-slate-400">
                        {deliveries} livrari x {Number(p.quantityPerDelivery).toLocaleString('ro-RO')} = <strong className="text-slate-600">{prodTotal.toLocaleString('ro-RO')} total</strong>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Auto-calculated total */}
            {autoTotalQty > 0 && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Cantitate totala contract (auto-calculat): <strong>{autoTotalQty.toLocaleString('ro-RO')}</strong>
                  {form.products.length > 1 && ` (${form.products.length} produse)`}
                </p>
              </div>
            )}
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
            onClick={() => {
              // Use first product's frequency as contract-level fallback
              const mainFreq = form.products[0]?.deliveryFrequency || 'monthly'
              mutation.mutate({
                ...form,
                deliveryFrequency: mainFreq,
                totalQuantity: autoTotalQty || totalQtyPerDelivery * 12,
                quantityPerDelivery: totalQtyPerDelivery,
                products: form.products
                  .filter(p => p.productReference || p.productName || p.productId)
                  .map(p => ({
                    productReference: p.productReference,
                    productName: p.productName,
                    quantityPerDelivery: Number(p.quantityPerDelivery) || 0,
                    deliveryFrequency: p.deliveryFrequency,
                    unitPrice: p.unitPrice ? Number(p.unitPrice) : null,
                  })),
                // Backward compat for single product
                productReference: form.products.length === 1 ? form.products[0].productReference : undefined,
                productName: form.products.length === 1 ? form.products[0].productName : undefined,
                unitPrice: form.products.length === 1 && form.products[0].unitPrice ? Number(form.products[0].unitPrice) : null,
              })
            }}
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
      const data = res.data
      if (Array.isArray(data)) {
        const numbers = data.map(wo => wo.work_order_number).join(', ')
        toast.success(`${data.length} comenzi de lucru generate: ${numbers}`)
      } else {
        toast.success(`Comanda de lucru ${data.work_order_number} generata cu succes.`)
      }
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

        {/* Multi-product list */}
        {(() => {
          let prods = []
          try { prods = typeof contract.products === 'string' ? JSON.parse(contract.products) : (contract.products || []) } catch {}
          if (prods.length > 1) return (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Produse in contract ({prods.length})</h4>
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Referinta</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Denumire</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cant./livrare</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret unitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prods.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-blue-500">{p.productReference || '-'}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{p.productName || '-'}</td>
                        <td className="px-3 py-2 text-right text-xs">{Number(p.quantityPerDelivery || 0).toLocaleString('ro-RO')}</td>
                        <td className="px-3 py-2 text-right text-xs">{p.unitPrice ? formatMoney(Number(p.unitPrice), contract.currency || 'RON') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
          return null
        })()}

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
                  {(() => {
                    let prods = []
                    try { prods = typeof c.products === 'string' ? JSON.parse(c.products) : (c.products || []) } catch {}
                    if (prods.length > 1) return <span>{prods.length} produse</span>
                    return <>
                      {c.product_reference && <span className="font-mono text-blue-500 mr-1">{c.product_reference}</span>}
                      {c.product_name || '-'}
                    </>
                  })()}
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
