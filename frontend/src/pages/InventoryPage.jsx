import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, ArrowUpDown, Package, Pencil, Trash2, X, TrendingUp } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'
import { useLookup } from '../hooks/useLookup'
import { formatMoney } from '../utils/currency'

const CATEGORIES = [
  { value: 'raw_material', label: 'Materie prima' },
  { value: 'semi_finished', label: 'Semifabricat' },
  { value: 'finished_good', label: 'Produs finit' },
  { value: 'consumable', label: 'Consumabil' },
  { value: 'packaging', label: 'Ambalaj' },
  { value: 'spare_part', label: 'Piesa de schimb' },
  { value: 'tool', label: 'Scularie' },
]

const MOVEMENT_TYPES = [
  { value: 'receipt', label: 'Receptie' },
  { value: 'production_input', label: 'Consum productie' },
  { value: 'production_output', label: 'Iesire productie' },
  { value: 'shipment', label: 'Expeditie' },
  { value: 'adjustment_plus', label: 'Ajustare +" ' },
  { value: 'adjustment_minus', label: 'Ajustare -' },
  { value: 'scrap', label: 'Rebut' },
]

function ItemModal({ onClose, editItem }) {
  const qc = useQueryClient()
  const isEdit = !!editItem
  const [form, setForm] = useState(
    isEdit
      ? {
          code: editItem.code || '',
          name: editItem.name || '',
          category: editItem.category || 'raw_material',
          unit: editItem.unit || 'buc',
          minStock: editItem.min_stock ?? '0',
          costPerUnit: editItem.cost_per_unit ?? '',
        }
      : { code: '', name: '', category: 'raw_material', unit: 'buc', minStock: '0', costPerUnit: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const { values: unitOptions } = useLookup('units_of_measure')

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/inventory/items/${editItem.id}`, data) : api.post('/inventory/items', data),
    onSuccess: () => {
      qc.invalidateQueries(['inventory-items'])
      toast.success(isEdit ? 'Articol actualizat.' : 'Articol creat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza articol' : 'Articol nou'}</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Cod *" value={form.code} onChange={f('code')} />
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.category} onChange={f('category')}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            {unitOptions.length > 0 ? (
              <select className="input" value={form.unit} onChange={f('unit')}>
                <option value="">Selecteaza UM</option>
                {unitOptions.map(u => <option key={u.code} value={u.code}>{u.display_name || u.code}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="UM (buc, kg...)" value={form.unit} onChange={f('unit')} />
            )}
            <input className="input" type="number" placeholder="Stoc minim" value={form.minStock} onChange={f('minStock')} />
          </div>
          <input className="input" type="number" placeholder="Cost / unitate (EUR)" value={form.costPerUnit} onChange={f('costPerUnit')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, minStock: Number(form.minStock), costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : null })}
            disabled={mutation.isPending || !form.code || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MovementModal({ item, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ movementType: 'receipt', qty: '', notes: '', supplierId: null, currency: 'EUR', unitPrice: '' })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const { data: currencies } = useQuery({
    queryKey: ['currencies-list'],
    queryFn: () => api.get('/currencies').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  const currencyList = currencies?.data || currencies || []

  const mutation = useMutation({
    mutationFn: (data) => api.post('/inventory/movements', data),
    onSuccess: () => { qc.invalidateQueries(['inventory-items']); toast.success('Miscare inregistrata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-800 mb-1">Miscare stoc</h3>
        <p className="text-xs text-slate-400 mb-4">{item.code} — {item.name}</p>
        <div className="space-y-3">
          <select className="input" value={form.movementType} onChange={f('movementType')}>
            {MOVEMENT_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {form.movementType === 'receipt' && (
            <>
              <SearchableSelect
                endpoint="/companies"
                filterParams={{ companyType: 'supplier' }}
                labelField="name"
                valueField="id"
                placeholder="Selecteaza furnizor"
                value={form.supplierId}
                onChange={(id) => setForm(prev => ({ ...prev, supplierId: id }))}
                allowCreate={false}
              />
              <div className="grid grid-cols-3 gap-2">
                <input className="input col-span-2" type="number" step="0.01" placeholder="Pret unitar" value={form.unitPrice} onChange={f('unitPrice')} />
                <select className="input" value={form.currency} onChange={f('currency')}>
                  {currencyList.length > 0
                    ? currencyList.map(c => <option key={c.code || c.currency_code} value={c.code || c.currency_code}>{c.code || c.currency_code}</option>)
                    : ['RON', 'EUR', 'USD', 'GBP', 'HUF'].map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>
            </>
          )}
          <input className="input" type="number" placeholder="Cantitate *" value={form.qty} onChange={f('qty')} />
          <input className="input" placeholder="Note" value={form.notes} onChange={f('notes')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              itemId: item.id, movementType: form.movementType, qty: Number(form.qty), notes: form.notes,
              ...(form.supplierId ? { supplierId: form.supplierId } : {}),
              ...(form.movementType === 'receipt' && form.unitPrice ? { unitPrice: Number(form.unitPrice), currency: form.currency } : {}),
            })}
            disabled={mutation.isPending || !form.qty}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SupplierModal({ itemId, editSupplier, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!editSupplier
  const [form, setForm] = useState(
    isEdit
      ? { companyId: editSupplier.company_id || null, price: editSupplier.price || '', leadTime: editSupplier.lead_time || '' }
      : { companyId: null, price: '', leadTime: '' }
  )

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/inventory/items/suppliers/${editSupplier.id}`, data)
      : api.post(`/inventory/items/${itemId}/suppliers`, data),
    onSuccess: () => { qc.invalidateQueries(['item-suppliers', itemId]); toast.success(isEdit ? 'Furnizor actualizat.' : 'Furnizor adaugat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza furnizor' : 'Adauga furnizor'}</h3>
        <div className="space-y-3">
          {!isEdit && (
            <SearchableSelect
              endpoint="/companies"
              filterParams={{ companyType: 'supplier' }}
              labelField="name"
              valueField="id"
              placeholder="Selecteaza companie"
              value={form.companyId}
              onChange={(id) => setForm(prev => ({ ...prev, companyId: id }))}
              allowCreate={false}
            />
          )}
          <input className="input" type="number" step="0.01" placeholder="Pret" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <input className="input" type="number" placeholder="Termen livrare (zile)" value={form.leadTime} onChange={e => setForm({ ...form, leadTime: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              companyId: form.companyId,
              price: form.price ? Number(form.price) : null,
              leadTime: form.leadTime ? Number(form.leadTime) : null,
            })}
            disabled={mutation.isPending || (!isEdit && !form.companyId)}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemDetail({ item, onClose }) {
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState(false)
  const [detailTab, setDetailTab] = useState('info')
  const [supplierModal, setSupplierModal] = useState(null) // null | 'new' | supplier obj

  const { data: suppliers } = useQuery({
    queryKey: ['item-suppliers', item.id],
    queryFn: () => api.get(`/inventory/items/${item.id}/suppliers`).then(r => r.data),
    enabled: detailTab === 'suppliers',
  })

  const { data: purchaseHistory } = useQuery({
    queryKey: ['item-purchases', item.id],
    queryFn: () => api.get(`/inventory/items/${item.id}/purchase-history`).then(r => r.data),
    enabled: detailTab === 'purchases',
  })

  const { data: priceTrend } = useQuery({
    queryKey: ['item-price-trend', item.id],
    queryFn: () => api.get(`/inventory/items/${item.id}/price-trend`).then(r => r.data),
    enabled: detailTab === 'price',
  })

  const deleteSupplierMut = useMutation({
    mutationFn: (suppId) => api.delete(`/inventory/items/suppliers/${suppId}`),
    onSuccess: () => { qc.invalidateQueries(['item-suppliers', item.id]); toast.success('Furnizor sters.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const supplierList = suppliers?.data || suppliers || []
  const purchaseList = purchaseHistory?.data || purchaseHistory || []
  const priceData = priceTrend?.data || priceTrend || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{item.name}</h3>
            <p className="text-xs text-slate-400">{item.code} • {CATEGORIES.find(c => c.value === item.category)?.label || item.category}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditItem(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-4">
          {[['info', 'Info'], ['suppliers', 'Furnizori'], ['purchases', 'Istoric achizitii'], ['price', 'Trend pret']].map(([t, l]) => (
            <button key={t} onClick={() => setDetailTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${detailTab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>

        {detailTab === 'info' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Stoc curent</span>
              <p className="font-bold text-slate-800">{Number(item.current_qty || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {item.unit}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-400 text-xs">Stoc minim</span>
              <p className="font-bold text-slate-800">{item.min_stock} {item.unit}</p>
            </div>
            {item.cost_per_unit && (
              <div className="bg-slate-50 rounded-lg p-3">
                <span className="text-slate-400 text-xs">Cost / unitate</span>
                <p className="font-bold text-slate-800">{Number(item.cost_per_unit).toFixed(2)} EUR</p>
              </div>
            )}
          </div>
        )}

        {detailTab === 'suppliers' && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-slate-700">Furnizori</h4>
              <button onClick={() => setSupplierModal('new')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga furnizor</button>
            </div>
            {supplierList.length > 0 ? (
              <div className="space-y-2">
                {supplierList.map(s => (
                  <div key={s.id} className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{s.company_name || s.name || `Companie #${s.company_id}`}</span>
                      {s.price && <span className="text-slate-400 text-xs ml-2">{Number(s.price).toFixed(2)} EUR</span>}
                      {s.lead_time && <span className="text-slate-400 text-xs ml-2">{s.lead_time} zile</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setSupplierModal(s)} className="text-slate-400 hover:text-blue-500"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm('Stergi furnizorul?')) deleteSupplierMut.mutate(s.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">Niciun furnizor asociat.</p>}
          </div>
        )}

        {detailTab === 'purchases' && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">Istoric achizitii</h4>
            {purchaseList.length > 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Data</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Furnizor</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cantitate</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseList.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-600">{p.date ? new Date(p.date).toLocaleDateString('ro-RO') : '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{p.supplier_name || p.supplier || '—'}</td>
                        <td className="px-3 py-2 text-xs text-right">{p.qty || p.quantity || '—'}</td>
                        <td className="px-3 py-2 text-xs text-right">{p.price || p.unit_price ? `${Number(p.price || p.unit_price).toFixed(2)} EUR` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-400">Nicio achizitie inregistrata.</p>}
          </div>
        )}

        {detailTab === 'price' && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><TrendingUp size={14} /> Trend pret</h4>
            {priceData.length > 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Perioada</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret mediu</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret min</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Pret max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {priceData.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-600">{p.period || p.date || p.month || '—'}</td>
                        <td className="px-3 py-2 text-xs text-right font-medium">{p.avg_price != null ? Number(p.avg_price).toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-right text-green-600">{p.min_price != null ? Number(p.min_price).toFixed(2) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-right text-red-500">{p.max_price != null ? Number(p.max_price).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-400">Nu exista date despre pret.</p>}
          </div>
        )}
      </div>

      {editItem && <ItemModal editItem={item} onClose={() => setEditItem(false)} />}
      {supplierModal && <SupplierModal itemId={item.id} editSupplier={supplierModal === 'new' ? null : supplierModal} onClose={() => setSupplierModal(null)} />}
    </div>
  )
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('items')
  const [modal, setModal] = useState(false)
  const [movementItem, setMovementItem] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [search, setSearch] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory-items', search],
    queryFn: () => api.get('/inventory/items', { params: { search, limit: 100 } }).then(r => r.data),
    enabled: tab === 'items',
  })

  const { data: alerts } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => api.get('/inventory/alerts').then(r => r.data),
    enabled: tab === 'alerts',
  })

  const { data: dashboard } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: () => api.get('/inventory/dashboard').then(r => r.data),
    enabled: tab === 'dashboard',
  })

  const { data: stockLevels, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => api.get('/inventory/stock-levels').then(r => r.data),
    enabled: tab === 'stock-levels',
  })

  const stockLevelList = stockLevels?.data || stockLevels || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Gestiune Stocuri</h2>
        {isManager && tab === 'items' && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Articol nou
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['items', 'Articole'], ['stock-levels', 'Niveluri Stoc'], ['alerts', 'Alerte'], ['dashboard', 'Dashboard']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
            {t === 'alerts' && alerts?.totalAlerts > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{alerts.totalAlerts}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          <input className="input max-w-sm" placeholder="Cauta cod sau denumire..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Categorie</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Stoc</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Minim</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
                {items?.data?.map(item => {
                  const belowMin = Number(item.current_qty || 0) <= Number(item.min_stock)
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 cursor-pointer ${belowMin ? 'bg-red-50' : ''}`} onClick={() => setSelectedItem(item)}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.name}
                        {belowMin && <AlertTriangle size={12} className="inline ml-1.5 text-red-500" />}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={belowMin ? 'text-red-500' : 'text-slate-800'}>
                          {Number(item.current_qty || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden lg:table-cell">{item.min_stock} {item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMovementItem(item) }}
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 ml-auto"
                        >
                          <ArrowUpDown size={12} /> Miscare
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {items?.data?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    Niciun articol.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'stock-levels' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {stockLoading ? (
            <p className="px-4 py-6 text-center text-slate-400">Se incarca...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Stoc curent</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Stoc minim</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Valoare</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockLevelList.map((s, i) => {
                  const belowMin = Number(s.current_qty || 0) <= Number(s.min_stock || 0)
                  return (
                    <tr key={s.id || i} className={`hover:bg-slate-50 ${belowMin ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{s.code}</td>
                      <td className="px-4 py-3 text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-right font-medium">{Number(s.current_qty || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {s.unit}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{s.min_stock || 0} {s.unit}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{s.value != null ? `${Number(s.value).toFixed(2)} EUR` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${belowMin ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {belowMin ? 'Sub minim' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {stockLevelList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio inregistrare.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'alerts' && alerts && (
        <div className="space-y-4">
          {alerts.belowMin.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Sub stoc minim ({alerts.belowMin.length})
              </h3>
              <div className="space-y-2">
                {alerts.belowMin.map(item => (
                  <div key={item.id} className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{item.code}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-red-500 font-bold">{Number(item.current_qty || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}</span>
                      <span className="text-slate-400 text-xs ml-1">/ min {item.min_stock} {item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alerts.belowMin.length === 0 && <p className="text-slate-400 text-sm">Fara alerte de stoc minim.</p>}
        </div>
      )}

      {tab === 'dashboard' && dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total articole', value: dashboard.totalItems },
            { label: 'Alerte stoc', value: dashboard.alertsCount, alert: dashboard.alertsCount > 0 },
            { label: 'Valoare stoc', value: `${Number(dashboard.totalStockValue).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} EUR` },
            { label: 'Miscari recente', value: dashboard.recentMovements?.length || 0 },
          ].map(({ label, value, alert }) => (
            <div key={label} className={`rounded-xl border p-4 ${alert ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`text-xl font-bold mt-1 ${alert ? 'text-red-500' : 'text-slate-800'}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {modal && <ItemModal onClose={() => setModal(false)} />}
      {movementItem && <MovementModal item={movementItem} onClose={() => setMovementItem(null)} />}
      {selectedItem && <ItemDetail item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
