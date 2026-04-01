import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import SearchableSelect from '../components/SearchableSelect'
import { formatMoney } from '../utils/currency'
import {
  Plus, ShoppingCart, X, Send, CheckCircle, Package,
  Trash2, AlertTriangle, FileText, ChevronRight,
} from 'lucide-react'

const STATUS_CFG = {
  draft:              { label: 'Ciorna',              bg: 'bg-slate-100 text-slate-600' },
  sent:               { label: 'Trimis',              bg: 'bg-blue-100 text-blue-700' },
  confirmed:          { label: 'Confirmat',           bg: 'bg-green-100 text-green-700' },
  partially_received: { label: 'Partial receptionat', bg: 'bg-amber-100 text-amber-700' },
  received:           { label: 'Receptionat',         bg: 'bg-emerald-100 text-emerald-700' },
  cancelled:          { label: 'Anulat',              bg: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg}`}>{c.label}</span>
}

/* ─── Create PO Modal ──────────────────────────────────────────────────────── */

function CreatePOModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ supplierId: null, currency: 'RON', notes: '' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/purchasing/orders', data),
    onSuccess: () => { qc.invalidateQueries(['purchasing-orders']); toast.success('Comanda de achizitie creata cu succes.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta comanda exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'Eroare la crearea comenzii de achizitie. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">PO Nou</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Furnizor *</label>
            <SearchableSelect
              endpoint="/companies"
              filterParams={{ companyType: 'supplier' }}
              labelField="name"
              valueField="id"
              placeholder="Selecteaza furnizor"
              value={form.supplierId}
              onChange={(id) => setForm(f => ({ ...f, supplierId: id }))}
              allowCreate={false}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Moneda</label>
            <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {['RON', 'EUR', 'USD', 'GBP', 'HUF'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.supplierId}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Add / Edit Line Modal ────────────────────────────────────────────────── */

function LineModal({ poId, editLine, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!editLine
  const [form, setForm] = useState(
    isEdit
      ? { itemId: editLine.item_id || null, description: editLine.description || '', quantity: editLine.quantity || '', unit: editLine.unit || 'buc', unitPrice: editLine.unit_price || '' }
      : { itemId: null, description: '', quantity: '', unit: 'buc', unitPrice: '' }
  )

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/purchasing/orders/lines/${editLine.id}`, data)
      : api.post(`/purchasing/orders/${poId}/lines`, data),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', poId]); toast.success(isEdit ? 'Linie actualizata.' : 'Linie adaugata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza linie' : 'Adauga linie'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Articol din inventar - cauta si selecteaza un material existent</label>
            <SearchableSelect
              endpoint="/inventory/items"
              labelField="name"
              valueField="id"
              placeholder="Cauta articol dupa cod sau denumire..."
              value={form.itemId}
              onChange={(id, item) => setForm(f => ({
                ...f,
                itemId: id,
                description: item ? `${item.code} - ${item.name}` : f.description,
                unit: item?.unit || f.unit,
              }))}
              allowCreate={false}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descriere - detalii suplimentare despre articol</label>
            <input className="input" placeholder="Descriere articol" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantitate *</label>
              <input className="input" type="number" placeholder="Ex: 100" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unitate masura</label>
              <input className="input" placeholder="Ex: buc, kg" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pret unitar *</label>
              <input className="input" type="number" step="0.01" placeholder="Ex: 10.50" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) })}
            disabled={mutation.isPending || !form.quantity || !form.unitPrice}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Receipt Modal ────────────────────────────────────────────────────────── */

function ReceiptModal({ po, onClose }) {
  const qc = useQueryClient()
  const [receipts, setReceipts] = useState(
    po.lines
      .filter(l => Number(l.quantity_received) < Number(l.quantity))
      .map(l => ({ poLineId: l.id, receivedQty: '', description: l.description || l.item_name || '', max: Number(l.quantity) - Number(l.quantity_received) }))
  )

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/purchasing/orders/${po.id}/receive`, data),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', po.id]); qc.invalidateQueries(['purchasing-orders']); toast.success('Receptie inregistrata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const validReceipts = receipts.filter(r => Number(r.receivedQty) > 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Receptie PO {po.po_number}</h3>
        {receipts.length === 0 ? (
          <p className="text-sm text-slate-400">Toate liniile au fost complet receptionate.</p>
        ) : (
          <div className="space-y-3">
            {receipts.map((r, i) => (
              <div key={r.poLineId} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1.5">{r.description}</p>
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    type="number"
                    step="0.01"
                    min="0"
                    max={r.max}
                    placeholder={`Max: ${r.max}`}
                    value={r.receivedQty}
                    onChange={e => {
                      const arr = [...receipts]
                      arr[i] = { ...arr[i], receivedQty: e.target.value }
                      setReceipts(arr)
                    }}
                  />
                  <span className="text-xs text-slate-400 whitespace-nowrap">/ {r.max} ramas</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ receipts: validReceipts.map(r => ({ poLineId: r.poLineId, receivedQty: Number(r.receivedQty) })) })}
            disabled={mutation.isPending || validReceipts.length === 0}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : `Receptioneaza (${validReceipts.length} linii)`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── PO Detail Modal ──────────────────────────────────────────────────────── */

function PODetailModal({ poId, onClose }) {
  const qc = useQueryClient()
  const [lineModal, setLineModal] = useState(null) // null | 'new' | line obj
  const [receiptModal, setReceiptModal] = useState(false)

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchasing-po', poId],
    queryFn: () => api.get(`/purchasing/orders/${poId}`).then(r => r.data),
  })

  const sendMut = useMutation({
    mutationFn: () => api.post(`/purchasing/orders/${poId}/send`),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', poId]); qc.invalidateQueries(['purchasing-orders']); toast.success('PO trimis.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const confirmMut = useMutation({
    mutationFn: (data) => api.put(`/purchasing/orders/${poId}/confirm`, data),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', poId]); qc.invalidateQueries(['purchasing-orders']); toast.success('PO confirmat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const cancelMut = useMutation({
    mutationFn: () => api.put(`/purchasing/orders/${poId}/cancel`),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', poId]); qc.invalidateQueries(['purchasing-orders']); toast.success('PO anulat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteLineMut = useMutation({
    mutationFn: (lineId) => api.delete(`/purchasing/orders/lines/${lineId}`),
    onSuccess: () => { qc.invalidateQueries(['purchasing-po', poId]); toast.success('Linie stearsa.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  if (isLoading || !po) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-3xl mx-4 text-center text-slate-400">Se incarca...</div>
      </div>
    )
  }

  const isDraft = po.status === 'draft'
  const isSent = po.status === 'sent'
  const canReceive = ['confirmed', 'partially_received'].includes(po.status)
  const canCancel = !['received', 'cancelled'].includes(po.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800">{po.po_number}</h3>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{po.supplier_name}</p>
            {po.contact_name && <p className="text-xs text-slate-400">Contact: {po.contact_name}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Dates & total */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Total</span>
            <p className="font-bold text-slate-800">{formatMoney(Number(po.total_amount || 0), po.currency || 'RON')}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Creat</span>
            <p className="text-sm text-slate-700">{po.created_at ? new Date(po.created_at).toLocaleDateString('ro-RO') : '-'}</p>
          </div>
          {po.sent_at && (
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Trimis</span>
              <p className="text-sm text-slate-700">{new Date(po.sent_at).toLocaleDateString('ro-RO')}</p>
            </div>
          )}
          {po.confirmed_delivery_date && (
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Livrare confirmata</span>
              <p className="text-sm text-slate-700">{new Date(po.confirmed_delivery_date).toLocaleDateString('ro-RO')}</p>
            </div>
          )}
        </div>

        {po.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-5">{po.notes}</p>}

        {/* Lines table */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Linii comanda</h4>
          {isDraft && (
            <button onClick={() => setLineModal('new')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
              <Plus size={12} /> Adauga linie
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Articol</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cantitate</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret unitar</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Total</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Primit</th>
                {isDraft && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.lines?.map(line => {
                const lineTotal = Number(line.quantity) * Number(line.unit_price)
                const pct = Number(line.quantity) > 0 ? Math.round(Number(line.quantity_received) / Number(line.quantity) * 100) : 0
                return (
                  <tr key={line.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="text-slate-800 text-xs">{line.item_name || line.item_code || line.description || '-'}</span>
                      {line.description && line.item_name && <p className="text-[10px] text-slate-400 truncate">{line.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{Number(line.quantity).toLocaleString('ro-RO')} {line.unit}</td>
                    <td className="px-3 py-2 text-right text-xs">{Number(line.unit_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-xs font-medium">{lineTotal.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                    {isDraft && (
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => { if (confirm('Stergi linia?')) deleteLineMut.mutate(line.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {(!po.lines || po.lines.length === 0) && (
                <tr><td colSpan={isDraft ? 6 : 5} className="px-3 py-6 text-center text-xs text-slate-400">Nicio linie.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Receipts */}
        {po.receipts && po.receipts.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Receptii</h4>
            <div className="space-y-1.5">
              {po.receipts.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-700">{r.received_at ? new Date(r.received_at).toLocaleDateString('ro-RO') : '-'}</span>
                  <span className="font-medium text-emerald-700">+{Number(r.received_qty).toLocaleString('ro-RO')}</span>
                  {r.notes && <span className="text-slate-400 truncate ml-2 max-w-[200px]">{r.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
          {isDraft && (
            <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !po.lines?.length}
              className="btn-primary flex items-center gap-1.5 text-sm">
              <Send size={13} /> {sendMut.isPending ? 'Se trimite...' : 'Trimite'}
            </button>
          )}
          {isSent && (
            <button onClick={() => {
              const date = prompt('Data livrare confirmata (YYYY-MM-DD):')
              confirmMut.mutate({ confirmedDeliveryDate: date || null })
            }} disabled={confirmMut.isPending}
              className="btn-primary flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700">
              <CheckCircle size={13} /> {confirmMut.isPending ? 'Se confirma...' : 'Confirma'}
            </button>
          )}
          {canReceive && (
            <button onClick={() => setReceiptModal(true)} className="btn-primary flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700">
              <Package size={13} /> Receptie
            </button>
          )}
          {canCancel && (
            <button onClick={() => { if (confirm('Anulezi aceasta comanda?')) cancelMut.mutate() }} disabled={cancelMut.isPending}
              className="btn-secondary text-sm text-red-500 hover:text-red-700">
              {cancelMut.isPending ? 'Se anuleaza...' : 'Anuleaza PO'}
            </button>
          )}
        </div>
      </div>

      {lineModal && (
        <LineModal poId={po.id} editLine={lineModal === 'new' ? null : lineModal} onClose={() => setLineModal(null)} />
      )}
      {receiptModal && (
        <ReceiptModal po={po} onClose={() => setReceiptModal(false)} />
      )}
    </div>
  )
}

/* ─── PO Orders List tab ───────────────────────────────────────────────────── */

function POOrdersTab() {
  const [createModal, setCreateModal] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['purchasing-orders', statusFilter, page],
    queryFn: () => api.get('/purchasing/orders', { params: { status: statusFilter || undefined, page, limit: 25 } }).then(r => r.data),
  })

  const orders = data?.data || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 25)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2 items-center">
          <select className="input text-sm w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">Toate statusurile</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-slate-400">{total} comenzi</span>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> PO Nou
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr. PO</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Furnizor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Data</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {orders.map(po => (
              <tr key={po.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPO(po.id)}>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{po.po_number}</td>
                <td className="px-4 py-3 text-slate-800">{po.supplier_name || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">{formatMoney(Number(po.total_amount || 0), po.currency || 'RON')}</td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{po.created_at ? new Date(po.created_at).toLocaleDateString('ro-RO') : '-'}</td>
                <td className="px-4 py-3 text-slate-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
            {!isLoading && orders.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                <ShoppingCart size={32} className="mx-auto mb-2 text-slate-300" />
                Nicio comanda de achizitie.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs">Inapoi</button>
          <span className="text-xs text-slate-500">Pagina {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs">Inainte</button>
        </div>
      )}

      {createModal && <CreatePOModal onClose={() => setCreateModal(false)} />}
      {selectedPO && <PODetailModal poId={selectedPO} onClose={() => setSelectedPO(null)} />}
    </>
  )
}

/* ─── Deficit / Necesar tab ────────────────────────────────────────────────── */

function DeficitTab() {
  const qc = useQueryClient()

  const { data: deficitItems, isLoading } = useQuery({
    queryKey: ['purchasing-deficit'],
    queryFn: () => api.get('/purchasing/deficit-items').then(r => r.data),
  })

  const items = Array.isArray(deficitItems) ? deficitItems : deficitItems?.data || []

  // Group items by supplier for PO generation
  const bySupplier = {}
  for (const item of items) {
    const key = item.supplier_id || '__no_supplier__'
    if (!bySupplier[key]) bySupplier[key] = { supplierId: item.supplier_id, supplierName: item.supplier_name || 'Fara furnizor', items: [] }
    bySupplier[key].items.push(item)
  }

  const generateMut = useMutation({
    mutationFn: (data) => api.post('/purchasing/orders', data),
    onSuccess: () => { qc.invalidateQueries(['purchasing-orders']); qc.invalidateQueries(['purchasing-deficit']); toast.success('PO generat din necesar.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  function handleGenerate(group) {
    if (!group.supplierId) {
      toast.error('Articolele nu au furnizor principal definit.')
      return
    }
    generateMut.mutate({
      supplierId: group.supplierId,
      currency: group.items[0]?.currency || 'RON',
      notes: 'Generat automat din necesar',
      lines: group.items.map(it => ({
        itemId: it.item_id,
        description: `${it.item_code} - ${it.item_name}`,
        quantity: Number(it.suggested_qty),
        unit: it.unit || 'buc',
        unitPrice: Number(it.unit_cost) || 0,
      })),
    })
  }

  return (
    <>
      {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}

      {!isLoading && items.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400" />
          <p className="text-sm">Toate stocurile sunt la nivel optim.</p>
        </div>
      )}

      {Object.values(bySupplier).map(group => (
        <div key={group.supplierId || 'none'} className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="font-medium text-sm text-slate-700">{group.supplierName}</span>
              <span className="text-xs text-slate-400">({group.items.length} articole)</span>
            </div>
            {group.supplierId && (
              <button
                onClick={() => handleGenerate(group)}
                disabled={generateMut.isPending}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <FileText size={12} /> {generateMut.isPending ? 'Se genereaza...' : 'Genereaza PO'}
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-white">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Cod</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Denumire</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Stoc curent</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Stoc minim</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Deficit</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Cantitate sugerata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {group.items.map(it => (
                <tr key={it.item_id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-blue-600">{it.item_code}</td>
                  <td className="px-4 py-2 text-xs text-slate-800">{it.item_name}</td>
                  <td className="px-4 py-2 text-right text-xs text-red-500 font-medium">{Number(it.current_qty).toLocaleString('ro-RO')} {it.unit}</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-400">{Number(it.min_stock).toLocaleString('ro-RO')} {it.unit}</td>
                  <td className="px-4 py-2 text-right text-xs text-red-600 font-medium">{Number(it.deficit).toLocaleString('ro-RO')}</td>
                  <td className="px-4 py-2 text-right text-xs font-bold text-slate-800">{Number(it.suggested_qty).toLocaleString('ro-RO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */

export default function PurchasingPage() {
  const [tab, setTab] = useState('orders')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Achizitii</h2>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['orders', 'Comenzi furnizor'], ['deficit', 'De la Necesar']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'orders' && <POOrdersTab />}
      {tab === 'deficit' && <DeficitTab />}
    </div>
  )
}
