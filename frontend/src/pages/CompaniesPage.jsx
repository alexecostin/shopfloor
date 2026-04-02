import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Building2, ChevronRight, Pencil, Trash2, FileText, ShoppingCart,
  Truck, Package, Star, X, Phone, ClipboardList, Users, ArrowLeft
} from 'lucide-react'

const TYPE_LABELS = { client: 'Client', supplier: 'Furnizor', prospect: 'Prospect', both: 'Client & Furnizor' }
const TYPE_COLORS = {
  client: 'bg-blue-100 text-blue-700',
  supplier: 'bg-orange-100 text-orange-700',
  prospect: 'bg-slate-100 text-slate-600',
  both: 'bg-purple-100 text-purple-700',
}

// company_types is stored as JSONB array in DB; extract display-friendly list
function getCompanyTypes(company) {
  if (Array.isArray(company.company_types)) return company.company_types
  if (typeof company.company_types === 'string') {
    try { return JSON.parse(company.company_types) } catch { /* fall through */ }
  }
  if (company.company_type) return [company.company_type]
  return ['client']
}

function CompanyModal({ onClose, editCompany }) {
  const qc = useQueryClient()
  const isEdit = !!editCompany
  const initType = isEdit
    ? (Array.isArray(editCompany.company_types)
        ? editCompany.company_types[0]
        : (editCompany.company_type || 'client'))
    : 'client'
  const [form, setForm] = useState(
    isEdit
      ? {
          name: editCompany.name || '',
          companyType: initType,
          fiscalCode: editCompany.fiscal_code || '',
          tradeRegister: editCompany.trade_register || '',
          city: editCompany.city || '',
          address: editCompany.address || '',
          phone: editCompany.phone || '',
          email: editCompany.email || '',
          website: editCompany.website || '',
          paymentTermsDays: editCompany.payment_terms_days || '',
        }
      : { name: '', companyType: 'client', fiscalCode: '', tradeRegister: '', city: '', address: '', phone: '', email: '', website: '', paymentTermsDays: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        name: data.name,
        companyTypes: [data.companyType],
        fiscalCode: data.fiscalCode,
        tradeRegister: data.tradeRegister,
        city: data.city,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        paymentTermsDays: data.paymentTermsDays ? Number(data.paymentTermsDays) : null,
      }
      return isEdit ? api.put(`/companies/${editCompany.id}`, payload) : api.post('/companies', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['companies'])
      if (isEdit) qc.invalidateQueries(['company', editCompany.id])
      toast.success(isEdit ? 'Companie actualizata.' : 'Companie creata.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza companie' : 'Companie noua'}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Denumire companie *</label>
              <input className="input" placeholder="Ex: SC Exemplu SRL" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tip companie</label>
              <select className="input" value={form.companyType} onChange={f('companyType')}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">CIF / Cod fiscal</label>
              <input className="input" placeholder="Ex: RO12345678" value={form.fiscalCode} onChange={f('fiscalCode')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Reg. comertului</label>
              <input className="input" placeholder="Ex: J12/345/2020" value={form.tradeRegister} onChange={f('tradeRegister')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Oras</label>
              <input className="input" placeholder="Ex: Cluj-Napoca" value={form.city} onChange={f('city')} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Adresa</label>
              <input className="input" placeholder="Ex: Str. Fabricii nr. 10" value={form.address} onChange={f('address')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Telefon</label>
              <input className="input" placeholder="Ex: 0740123456" value={form.phone} onChange={f('phone')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
              <input className="input" type="email" placeholder="Ex: contact@exemplu.ro" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Website</label>
              <input className="input" placeholder="Ex: www.exemplu.ro" value={form.website} onChange={f('website')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Termen plata (zile)</label>
              <input className="input" type="number" placeholder="Ex: 30" value={form.paymentTermsDays} onChange={f('paymentTermsDays')} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditContactModal({ contact, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    fullName: contact.full_name || '',
    role: contact.role || '',
    department: contact.department || '',
    phone: contact.phone || '',
    email: contact.email || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/companies/contacts/${contact.id}`, data),
    onSuccess: () => { qc.invalidateQueries(['company']); toast.success('Contact actualizat.'); onClose() },
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
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Editeaza contact</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nume complet *</label>
            <input className="input" placeholder="Ex: Ion Popescu" value={form.fullName} onChange={f('fullName')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Functie</label>
            <input className="input" placeholder="Ex: Director achizitii" value={form.role} onChange={f('role')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Departament</label>
            <input className="input" placeholder="Ex: Achizitii" value={form.department} onChange={f('department')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
            <input className="input" placeholder="Ex: 0740123456" value={form.phone} onChange={f('phone')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input className="input" type="email" placeholder="Ex: ion@exemplu.ro" value={form.email} onChange={f('email')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.fullName} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---- Client-specific sections ---- */
function ClientSection({ companyId, contacts }) {
  const { data: workOrders, isLoading: woLoading } = useQuery({
    queryKey: ['company-work-orders', companyId],
    queryFn: () => api.get('/work-orders', { params: { client_id: companyId, limit: 50 } }).then(r => r.data),
  })

  const woList = workOrders?.data || workOrders || []
  const inProgressCount = woList.filter(wo => wo.status === 'in_progress').length
  const deliveredCount = woList.reduce((sum, wo) => sum + (Number(wo.delivered_qty) || 0), 0)
  const completedCount = woList.filter(wo => wo.status === 'completed').length
  const totalValue = woList.reduce((sum, wo) => sum + ((Number(wo.quantity) || 0) * (Number(wo.unit_price) || 0)), 0)

  // Find primary contact
  const primaryContact = contacts?.find(c => c.is_primary) || contacts?.[0]

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-500 font-medium">Total comenzi</p>
          <p className="text-xl font-bold text-blue-700">{woList.length}</p>
          <p className="text-[10px] text-blue-400">comenzi primite</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-xs text-amber-500 font-medium">In productie</p>
          <p className="text-xl font-bold text-amber-700">{inProgressCount}</p>
          <p className="text-[10px] text-amber-400">comenzi active</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-green-500 font-medium">Livrate</p>
          <p className="text-xl font-bold text-green-700">{completedCount}</p>
          <p className="text-[10px] text-green-400">comenzi finalizate</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <p className="text-xs text-purple-500 font-medium">Valoare totala</p>
          <p className="text-xl font-bold text-purple-700">{totalValue.toLocaleString('ro-RO', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-purple-400">EUR total</p>
        </div>
      </div>

      {/* Work orders table */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
          <ShoppingCart size={14} /> Comenzi primite
        </h4>
        {woLoading ? (
          <p className="text-sm text-slate-400">Se incarca...</p>
        ) : woList.length > 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Comanda</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Produs</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cant.</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Deadline</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {woList.map(wo => {
                  const statusColors = {
                    draft: 'bg-slate-100 text-slate-600',
                    confirmed: 'bg-blue-100 text-blue-700',
                    in_progress: 'bg-amber-100 text-amber-700',
                    completed: 'bg-green-100 text-green-700',
                    cancelled: 'bg-red-100 text-red-600',
                  }
                  return (
                    <tr key={wo.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{wo.order_number || wo.wo_number || `#${wo.id}`}</td>
                      <td className="px-3 py-2 text-slate-700 text-xs">{wo.product_name || wo.product || '-'}</td>
                      <td className="px-3 py-2 text-right text-xs">{wo.quantity?.toLocaleString('ro-RO') || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[wo.status] || 'bg-slate-100 text-slate-600'}`}>
                          {wo.status || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {wo.deadline ? new Date(wo.deadline).toLocaleDateString('ro-RO') : 'Fara termen'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {wo.contact_person || (primaryContact ? primaryContact.full_name : '-')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-3 py-2 text-xs font-medium text-slate-700" colSpan={2}>Total: {woList.length} comenzi</td>
                  <td className="px-3 py-2 text-right text-xs font-medium text-slate-700">
                    {woList.reduce((s, wo) => s + (Number(wo.quantity) || 0), 0).toLocaleString('ro-RO')}
                  </td>
                  <td className="px-3 py-2" colSpan={3}>
                    <span className="text-xs font-medium text-slate-600">
                      Valoare: {totalValue.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} EUR
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nicio comanda de la acest client.</p>
        )}
      </div>
    </div>
  )
}

/* ---- Supplier-specific sections ---- */
function SupplierSection({ companyId }) {
  const { data: purchaseOrders, isLoading: poLoading } = useQuery({
    queryKey: ['company-purchase-orders', companyId],
    queryFn: () => api.get('/purchasing/orders', { params: { supplierId: companyId, limit: 50 } }).then(r => r.data),
  })

  const { data: suppliedItems } = useQuery({
    queryKey: ['company-supplied-items', companyId],
    queryFn: () => api.get('/inventory/items', { params: { supplierId: companyId, limit: 50 } }).then(r => r.data),
  })

  const { data: scorecard } = useQuery({
    queryKey: ['company-scorecard', companyId],
    queryFn: () => api.get(`/purchasing/suppliers/${companyId}/scorecard`).then(r => r.data),
  })

  const poList = purchaseOrders?.data || purchaseOrders || []
  const itemsList = suppliedItems?.data || suppliedItems || []

  const pendingCount = poList.filter(po => ['draft', 'sent', 'confirmed'].includes(po.status)).length
  const receivedCount = poList.filter(po => po.status === 'received').length
  const totalPOValue = poList.reduce((sum, po) => sum + (Number(po.total) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-500 font-medium">Total PO-uri</p>
          <p className="text-xl font-bold text-blue-700">{poList.length}</p>
          <p className="text-[10px] text-blue-400">comenzi achizitie</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-xs text-amber-500 font-medium">In asteptare</p>
          <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-[10px] text-amber-400">livrare asteptata</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-green-500 font-medium">Livrate</p>
          <p className="text-xl font-bold text-green-700">{receivedCount}</p>
          <p className="text-[10px] text-green-400">receptionate</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <p className="text-xs text-purple-500 font-medium">Valoare achizitii</p>
          <p className="text-xl font-bold text-purple-700">{totalPOValue.toLocaleString('ro-RO', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-purple-400">EUR total</p>
        </div>
      </div>

      {/* Scorecard */}
      {scorecard && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Star size={14} /> Evaluare furnizor
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Calitate', value: scorecard.quality_score ?? scorecard.qualityScore, color: 'blue' },
              { label: 'Livrare', value: scorecard.delivery_score ?? scorecard.deliveryScore, color: 'green' },
              { label: 'Pret', value: scorecard.price_score ?? scorecard.priceScore, color: 'purple' },
            ].map(s => (
              <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-lg p-3 text-center`}>
                <p className={`text-xs text-${s.color}-500 font-medium`}>{s.label}</p>
                <p className={`text-xl font-bold text-${s.color}-700`}>{s.value != null ? `${s.value}/10` : 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase orders */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
          <ShoppingCart size={14} /> Comenzi de achizitie
        </h4>
        {poLoading ? (
          <p className="text-sm text-slate-400">Se incarca...</p>
        ) : poList.length > 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Nr. PO</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Total</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {poList.map(po => {
                  const statusColors = {
                    draft: 'bg-slate-100 text-slate-600',
                    sent: 'bg-blue-100 text-blue-700',
                    confirmed: 'bg-amber-100 text-amber-700',
                    received: 'bg-green-100 text-green-700',
                    cancelled: 'bg-red-100 text-red-600',
                  }
                  return (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{po.po_number || po.order_number || `#${po.id}`}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">{po.total != null ? `${Number(po.total).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${po.currency || 'EUR'}` : '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[po.status] || 'bg-slate-100 text-slate-600'}`}>
                          {po.status || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{po.created_at ? new Date(po.created_at).toLocaleDateString('ro-RO') : po.date ? new Date(po.date).toLocaleDateString('ro-RO') : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nicio comanda de achizitie.</p>
        )}
      </div>

      {/* Supplied items — proper table instead of tag cloud */}
      {itemsList.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Package size={14} /> Articole furnizate ({itemsList.length})
          </h4>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Cod</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Denumire</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret unitar</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Ultima comanda</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Data livrare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemsList.map(item => {
                  const lastPurchase = item.purchase_history?.[0] || item.last_purchase || null
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{item.code || '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{item.name || '-'}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium">
                        {item.unit_price != null
                          ? `${Number(item.unit_price).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency || item.unit || 'EUR'}`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                        {lastPurchase?.po_number || lastPurchase?.order_number || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {lastPurchase?.delivery_date
                          ? new Date(lastPurchase.delivery_date).toLocaleDateString('ro-RO')
                          : lastPurchase?.date
                            ? new Date(lastPurchase.date).toLocaleDateString('ro-RO')
                            : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CompanyDetail({ company, onClose }) {
  const qc = useQueryClient()
  const [addContact, setAddContact] = useState(false)
  const [editCompany, setEditCompany] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [detailTab, setDetailTab] = useState('info')
  const [contactForm, setContactForm] = useState({ fullName: '', role: '', department: '', phone: '', email: '' })
  const fc = (k) => (e) => setContactForm({ ...contactForm, [k]: e.target.value })

  const types = getCompanyTypes(company)
  const isClient = types.includes('client') || types.includes('both')
  const isSupplier = types.includes('supplier') || types.includes('furnizor') || types.includes('both')

  const contactMutation = useMutation({
    mutationFn: (data) => api.post(`/companies/${company.id}/contacts`, data),
    onSuccess: () => { qc.invalidateQueries(['company', company.id]); toast.success('Contact adaugat.'); setAddContact(false) },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteCompanyMut = useMutation({
    mutationFn: () => api.delete(`/companies/${company.id}`),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Companie stearsa.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteContactMut = useMutation({
    mutationFn: (contactId) => api.delete(`/companies/contacts/${contactId}`),
    onSuccess: () => { qc.invalidateQueries(['company', company.id]); toast.success('Contact sters.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  // Count data for tab badges
  const contactsCount = company.contacts?.length || 0

  // Build tabs dynamically with icons and counts
  const tabDefs = [
    { key: 'info', label: 'Informatii', icon: ClipboardList },
  ]
  if (isClient) tabDefs.push({ key: 'client', label: 'Comenzi', icon: ShoppingCart })
  if (isSupplier) tabDefs.push({ key: 'supplier', label: 'Achizitii', icon: Truck })
  tabDefs.push({ key: 'contacts', label: 'Contacte', icon: Users, count: contactsCount })
  tabDefs.push({ key: 'documents', label: 'Documente', icon: FileText })

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 text-xl">{company.name}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {types.map(t => (
                  <span key={t} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[t] || 'bg-slate-100 text-slate-600'}`}>
                    {TYPE_LABELS[t] || t}
                  </span>
                ))}
                {company.city && (
                  <span className="text-xs text-slate-400 ml-2">{company.city}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditCompany(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button
              onClick={() => { if (confirm('Sigur doriti sa stergeti compania? Aceasta actiune este ireversibila.')) deleteCompanyMut.mutate() }}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Tabs with icons and counters */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6 flex-wrap">
          {tabDefs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.key} onClick={() => setDetailTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors
                  ${detailTab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Icon size={14} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    detailTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Info tab */}
        {detailTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {company.fiscal_code && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">CIF / Cod fiscal</span>
                  <p className="font-medium text-slate-800">{company.fiscal_code}</p>
                </div>
              )}
              {company.trade_register && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">Reg. comertului</span>
                  <p className="font-medium text-slate-800">{company.trade_register}</p>
                </div>
              )}
              {(company.city || company.address) && (
                <div className="bg-slate-50 rounded-lg p-4 col-span-2 md:col-span-1">
                  <span className="text-slate-400 text-xs block mb-0.5">Adresa</span>
                  <p className="font-medium text-slate-800">{[company.address, company.city].filter(Boolean).join(', ') || '-'}</p>
                </div>
              )}
              {company.phone && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">Telefon</span>
                  <p className="font-medium text-slate-800">{company.phone}</p>
                </div>
              )}
              {company.email && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">Email</span>
                  <p className="font-medium text-slate-800">{company.email}</p>
                </div>
              )}
              {company.website && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">Website</span>
                  <p className="font-medium text-slate-800">{company.website}</p>
                </div>
              )}
              {company.payment_terms_days && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className="text-slate-400 text-xs block mb-0.5">Termen plata</span>
                  <p className="font-medium text-slate-800">{company.payment_terms_days} zile</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client tab */}
        {detailTab === 'client' && isClient && (
          <ClientSection companyId={company.id} contacts={company.contacts} />
        )}

        {/* Supplier tab */}
        {detailTab === 'supplier' && isSupplier && (
          <SupplierSection companyId={company.id} />
        )}

        {/* Contacts tab */}
        {detailTab === 'contacts' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Contacte</h4>
              <button onClick={() => setAddContact(!addContact)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                <Plus size={12} /> Adauga contact
              </button>
            </div>

            {addContact && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nume *</label>
                    <input className="input text-xs" placeholder="Ex: Ion Popescu" value={contactForm.fullName} onChange={fc('fullName')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Functie</label>
                    <input className="input text-xs" placeholder="Ex: Director" value={contactForm.role} onChange={fc('role')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Departament</label>
                    <input className="input text-xs" placeholder="Ex: Achizitii" value={contactForm.department} onChange={fc('department')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                    <input className="input text-xs" placeholder="Ex: 0740123456" value={contactForm.phone} onChange={fc('phone')} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input className="input text-xs" placeholder="Ex: ion@exemplu.ro" value={contactForm.email} onChange={fc('email')} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddContact(false)} className="btn-secondary text-xs py-1">Anuleaza</button>
                  <button onClick={() => contactMutation.mutate(contactForm)} disabled={!contactForm.fullName} className="btn-primary text-xs py-1">Salveaza</button>
                </div>
              </div>
            )}

            {company.contacts?.length === 0 && <p className="text-slate-400 text-sm">Fara contacte.</p>}
            <div className="space-y-2">
              {company.contacts?.map(c => (
                <div key={c.id} className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3">
                  {c.is_primary && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">principal</span>}
                  <div className="flex-1">
                    <span className="font-medium text-slate-800 text-sm">{c.full_name}</span>
                    {c.role && <span className="text-xs text-slate-400 ml-2">{c.role}</span>}
                    {c.department && <span className="text-xs text-slate-400 ml-1">/ {c.department}</span>}
                  </div>
                  <div className="flex flex-col items-end text-xs text-slate-400">
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                  <button onClick={() => setEditContact(c)} className="text-slate-400 hover:text-blue-500"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm('Sigur doriti sa stergeti contactul? Aceasta actiune este ireversibila.')) deleteContactMut.mutate(c.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents tab */}
        {detailTab === 'documents' && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <FileText size={14} /> Documente asociate
            </h4>
            <p className="text-sm text-slate-400">Niciun document asociat acestei companii.</p>
          </div>
        )}
      </div>

      {editCompany && <CompanyModal editCompany={company} onClose={() => setEditCompany(false)} />}
      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} />}
    </div>
  )
}

export default function CompaniesPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, typeFilter],
    queryFn: () => api.get('/companies', { params: { search, companyType: typeFilter || undefined, limit: 100 } }).then(r => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['company', selected?.id],
    queryFn: () => api.get(`/companies/${selected.id}`).then(r => r.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Companii</h2>
        {isManager && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Companie noua
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input className="input max-w-xs" placeholder="Cauta..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Toate tipurile</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">CIF</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Oras</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(c => {
              const types = getCompanyTypes(c)
              return (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {types.map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t] || 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.fiscal_code || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{c.city || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="text-slate-300 ml-auto" />
                  </td>
                </tr>
              )
            })}
            {data?.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Nicio companie</p>
                <p className="text-slate-400 text-sm mt-1">Apasa butonul "Companie noua" pentru a adauga prima companie.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <CompanyModal onClose={() => setModal(false)} />}
      {selected && detail && <CompanyDetail company={detail} onClose={() => setSelected(null)} />}
    </div>
  )
}
