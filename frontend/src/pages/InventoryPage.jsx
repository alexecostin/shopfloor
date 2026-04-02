import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, ArrowUpDown, Package, Pencil, Trash2, X, TrendingUp, MapPin, Scissors, Search } from 'lucide-react'
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
  const qc = useQueryClient()
  const [tab, setTab] = useState('items')
  const [modal, setModal] = useState(false)
  const [movementItem, setMovementItem] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [search, setSearch] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  // Locations state
  const [locModal, setLocModal] = useState(null) // null | {} for new | location obj for edit
  const [locForm, setLocForm] = useState({ code: '', name: '', locationType: 'raw_material', zone: '', capacity: '', capacityUnit: 'buc' })

  // Remnants state
  const [remModal, setRemModal] = useState(false)
  const [remForm, setRemForm] = useState({ materialCode: '', materialName: '', materialGrade: '', shape: 'bar', length: '', width: '', diameter: '', thickness: '', weightKg: '', locationId: '' })
  const [remFilters, setRemFilters] = useState({ materialGrade: '', shape: '', minDiameter: '', minLength: '' })
  const [matchMode, setMatchMode] = useState(false)
  const [matchParams, setMatchParams] = useState({ materialGrade: '', shape: 'bar', requiredDiameter: '', requiredLength: '' })

  const { data: itemsRaw, isLoading } = useQuery({
    queryKey: ['inventory-items', search],
    queryFn: () => api.get('/inventory/items', { params: { search: search || undefined, limit: 100 } }).then(r => r.data),
    enabled: tab === 'items',
  })
  // API returns { data: [...], total, page, limit } — normalize so itemList is always the array
  const itemList = itemsRaw?.data ?? itemsRaw ?? []

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

  const { data: dashBelowMin } = useQuery({
    queryKey: ['inventory-dashboard-below-min'],
    queryFn: () => api.get('/inventory/items', { params: { belowMin: true, limit: 10 } }).then(r => r.data),
    enabled: tab === 'dashboard',
  })

  const { data: dashPurchaseOrders } = useQuery({
    queryKey: ['inventory-dashboard-po'],
    queryFn: () => api.get('/purchasing/orders', { params: { status: 'active', limit: 5 } }).then(r => r.data),
    enabled: tab === 'dashboard',
  })

  const { data: stockLevels, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-levels'],
    queryFn: () => api.get('/inventory/stock-levels').then(r => r.data),
    enabled: tab === 'stock-levels',
  })

  const stockLevelList = stockLevels?.data || stockLevels || []

  // Locations
  const { data: locations, isLoading: locLoading } = useQuery({
    queryKey: ['inventory-locations'],
    queryFn: () => api.get('/inventory/locations').then(r => r.data),
    enabled: tab === 'locations',
  })
  const locationList = locations?.data || locations || []

  const locMutation = useMutation({
    mutationFn: (data) => data.id ? api.put(`/inventory/locations/${data.id}`, data) : api.post('/inventory/locations', data),
    onSuccess: () => { qc.invalidateQueries(['inventory-locations']); toast.success('Locatie salvata.'); setLocModal(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const locDeleteMut = useMutation({
    mutationFn: (id) => api.delete(`/inventory/locations/${id}`),
    onSuccess: () => { qc.invalidateQueries(['inventory-locations']); toast.success('Locatie dezactivata.') },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  // Remnants
  const { data: remnants, isLoading: remLoading } = useQuery({
    queryKey: ['inventory-remnants', remFilters],
    queryFn: () => api.get('/inventory/remnants', { params: remFilters }).then(r => r.data),
    enabled: tab === 'remnants',
  })
  const remnantList = remnants?.data || remnants || []

  const remCreateMut = useMutation({
    mutationFn: (data) => api.post('/inventory/remnants', data),
    onSuccess: () => { qc.invalidateQueries(['inventory-remnants']); toast.success('Rest adaugat.'); setRemModal(false) },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const remUseMut = useMutation({
    mutationFn: (id) => api.put(`/inventory/remnants/${id}/use`),
    onSuccess: () => { qc.invalidateQueries(['inventory-remnants']); toast.success('Rest marcat ca utilizat.') },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const remScrapMut = useMutation({
    mutationFn: (id) => api.put(`/inventory/remnants/${id}/scrap`),
    onSuccess: () => { qc.invalidateQueries(['inventory-remnants']); toast.success('Rest marcat ca rebut.') },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const { data: matchResults } = useQuery({
    queryKey: ['remnant-match', matchParams],
    queryFn: () => api.get('/inventory/remnants/match', { params: matchParams }).then(r => r.data),
    enabled: matchMode && !!matchParams.materialGrade,
  })
  const matchList = matchResults?.data || matchResults || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Gestiune Stocuri</h2>
        {isManager && tab === 'items' && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Articol nou
          </button>
        )}
        {isManager && tab === 'locations' && (
          <button onClick={() => { setLocForm({ code: '', name: '', locationType: 'raw_material', zone: '', capacity: '', capacityUnit: 'buc' }); setLocModal({}) }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Locatie noua
          </button>
        )}
        {tab === 'remnants' && (
          <button onClick={() => { setRemForm({ materialCode: '', materialName: '', materialGrade: '', shape: 'bar', length: '', width: '', diameter: '', thickness: '', weightKg: '', locationId: '' }); setRemModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Adauga rest
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit flex-wrap">
        {[['items', 'Articole'], ['stock-levels', 'Niveluri Stoc'], ['locations', 'Locatii'], ['remnants', 'Resturi utilizabile'], ['alerts', 'Alerte'], ['dashboard', 'Dashboard']].map(([t, l]) => (
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
                {itemList.map(item => {
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
                {!isLoading && itemList.length === 0 && (
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
          {alerts.belowMin && alerts.belowMin.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} /> Sub stoc minim ({alerts.belowMin.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {alerts.belowMin.map(item => {
                  const currentQty = Number(item.current_qty || 0)
                  const minStock = Number(item.min_stock || 0)
                  const ratio = minStock > 0 ? currentQty / minStock : 0
                  const isCritical = ratio < 0.25
                  return (
                    <div key={item.id} className={`rounded-xl border-2 p-4 ${isCritical ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm">{item.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{item.code}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isCritical ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                          {isCritical ? 'CRITIC' : 'Atentie'}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-slate-500">Stoc curent</p>
                          <p className={`text-lg font-bold ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                            {currentQty.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {item.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Minim necesar</p>
                          <p className="text-sm font-medium text-slate-700">{minStock} {item.unit}</p>
                        </div>
                      </div>
                      {item.cost_per_unit && (
                        <p className="text-xs text-slate-400 mt-2">Cost unitar: {Number(item.cost_per_unit).toFixed(2)} EUR</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {(!alerts.belowMin || alerts.belowMin.length === 0) && <p className="text-slate-400 text-sm">Fara alerte de stoc minim.</p>}
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Total articole</p>
                  <p className="text-2xl font-bold text-blue-700">{dashboard?.totalItems ?? 0}</p>
                </div>
              </div>
              <p className="text-xs text-blue-400">Articole inregistrate in sistem</p>
            </div>

            <div className={`rounded-xl border-2 p-5 ${(dashboard?.alertsCount || 0) > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(dashboard?.alertsCount || 0) > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <AlertTriangle size={20} className={(dashboard?.alertsCount || 0) > 0 ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wide ${(dashboard?.alertsCount || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>Sub stoc minim</p>
                  <p className={`text-2xl font-bold ${(dashboard?.alertsCount || 0) > 0 ? 'text-red-600' : 'text-green-700'}`}>{dashboard?.alertsCount ?? 0}</p>
                </div>
              </div>
              <p className={`text-xs ${(dashboard?.alertsCount || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {(dashboard?.alertsCount || 0) > 0 ? 'Articole sub nivelul minim de stoc' : 'Nicio alerta activa'}
              </p>
            </div>

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Valoare totala stoc</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {Number(dashboard?.totalStockValue || 0).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} EUR
                  </p>
                </div>
              </div>
              <p className="text-xs text-emerald-400">Valoare estimata pe baza costului unitar</p>
            </div>

            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Package size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-purple-500 font-medium uppercase tracking-wide">Comenzi achizitie active</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {(() => { const poData = dashPurchaseOrders?.data || dashPurchaseOrders || []; return Array.isArray(poData) ? poData.length : 0 })()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-purple-400">Comenzi de achizitie in desfasurare</p>
            </div>
          </div>

          {/* Below min stock table */}
          {(() => {
            const belowMinList = dashBelowMin?.data || dashBelowMin || []
            return belowMinList.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} /> Top articole sub stoc minim
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Articol</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Stoc curent</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Stoc minim</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Deficit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {belowMinList.slice(0, 10).map(item => {
                        const currentQty = Number(item.current_qty || 0)
                        const minStock = Number(item.min_stock || 0)
                        const deficit = Math.max(0, minStock - currentQty)
                        return (
                          <tr key={item.id} className="hover:bg-red-50">
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-800">{item.name}</span>
                              <span className="text-xs text-slate-400 ml-2">{item.code}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-red-600">{currentQty.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {item.unit}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{minStock} {item.unit}</td>
                            <td className="px-3 py-2 text-right font-bold text-red-700">{deficit.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} {item.unit}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null
          })()}

          {/* Recent movements */}
          {dashboard?.recentMovements && dashboard.recentMovements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Ultimele 10 miscari de stoc</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Articol</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Tip miscare</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-600">Cantitate</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.recentMovements.slice(0, 10).map((m, i) => {
                      const movementLabels = {
                        receipt: 'Receptie', production_input: 'Consum productie', production_output: 'Iesire productie',
                        shipment: 'Expeditie', adjustment_plus: 'Ajustare +', adjustment_minus: 'Ajustare -', scrap: 'Rebut',
                      }
                      const mType = m.movement_type || m.type || ''
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{m.item_name || m.name || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{movementLabels[mType] || mType}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-600">{m.qty || m.quantity || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{(m.date || m.created_at) ? new Date(m.date || m.created_at).toLocaleDateString('ro-RO') : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!dashboard && (
            <div className="text-center py-12 text-slate-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>Se incarca datele dashboard...</p>
            </div>
          )}
        </div>
      )}

      {tab === 'locations' && (
        <>
          {locLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Zona</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Capacitate</th>
                  {isManager && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locationList.map(loc => {
                  const typeLabels = { raw_material: 'Materie prima', wip: 'WIP', finished_good: 'Produs finit', remnant: 'Resturi', scrap: 'Rebut' }
                  const typeColors = { raw_material: 'bg-blue-100 text-blue-700', wip: 'bg-amber-100 text-amber-700', finished_good: 'bg-green-100 text-green-700', remnant: 'bg-purple-100 text-purple-700', scrap: 'bg-red-100 text-red-700' }
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{loc.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[loc.location_type] || 'bg-slate-100 text-slate-600'}`}>
                          {typeLabels[loc.location_type] || loc.location_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{loc.zone || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">
                        {loc.capacity ? `${loc.capacity} ${loc.capacity_unit || ''}` : '—'}
                      </td>
                      {isManager && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setLocForm({ code: loc.code, name: loc.name, locationType: loc.location_type, zone: loc.zone || '', capacity: loc.capacity || '', capacityUnit: loc.capacity_unit || 'buc' }); setLocModal(loc) }} className="text-slate-300 hover:text-blue-500"><Pencil size={14} /></button>
                            <button onClick={() => { if (confirm('Dezactivezi aceasta locatie?')) locDeleteMut.mutate(loc.id) }} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {!locLoading && locationList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
                    Nicio locatie definita.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'remnants' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input className="input w-40" placeholder="Grad material" value={remFilters.materialGrade} onChange={e => setRemFilters({ ...remFilters, materialGrade: e.target.value })} />
            <select className="input w-32" value={remFilters.shape} onChange={e => setRemFilters({ ...remFilters, shape: e.target.value })}>
              <option value="">Toate formele</option>
              <option value="bar">Bara</option>
              <option value="plate">Tabla</option>
              <option value="tube">Teava</option>
              <option value="profile">Profil</option>
            </select>
            <input className="input w-32" type="number" placeholder="Diam. min (mm)" value={remFilters.minDiameter} onChange={e => setRemFilters({ ...remFilters, minDiameter: e.target.value })} />
            <input className="input w-32" type="number" placeholder="Lung. min (mm)" value={remFilters.minLength} onChange={e => setRemFilters({ ...remFilters, minLength: e.target.value })} />
            <button onClick={() => setMatchMode(!matchMode)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${matchMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Search size={12} className="inline mr-1" /> Cauta rest compatibil
            </button>
          </div>

          {matchMode && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 space-y-2">
              <h5 className="text-xs font-medium text-blue-700">Cauta resturi compatibile cu dimensiunile necesare</h5>
              <div className="flex gap-2 flex-wrap items-end">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Grad material *</label>
                  <input className="input text-sm w-32" value={matchParams.materialGrade} onChange={e => setMatchParams({ ...matchParams, materialGrade: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Forma</label>
                  <select className="input text-sm w-28" value={matchParams.shape} onChange={e => setMatchParams({ ...matchParams, shape: e.target.value })}>
                    <option value="bar">Bara</option>
                    <option value="plate">Tabla</option>
                    <option value="tube">Teava</option>
                    <option value="profile">Profil</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Diametru necesar (mm)</label>
                  <input className="input text-sm w-32" type="number" value={matchParams.requiredDiameter} onChange={e => setMatchParams({ ...matchParams, requiredDiameter: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Lungime necesara (mm)</label>
                  <input className="input text-sm w-32" type="number" value={matchParams.requiredLength} onChange={e => setMatchParams({ ...matchParams, requiredLength: e.target.value })} />
                </div>
              </div>
              {matchParams.materialGrade && (
                <div className="mt-2">
                  {matchList.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-green-700 font-medium">{matchList.length} resturi compatibile gasite:</p>
                      {matchList.map((r, i) => (
                        <div key={r.id || i} className="bg-white rounded px-3 py-2 text-xs flex items-center justify-between border border-green-200">
                          <div>
                            <span className="font-medium text-slate-700">{r.material_name || r.material_code}</span>
                            <span className="text-slate-400 ml-2">{r.material_grade} / {r.shape}</span>
                            <span className="text-slate-400 ml-2">
                              {r.dimension_diameter ? `D${r.dimension_diameter}` : ''}{r.dimension_length ? ` x L${r.dimension_length}` : ''}mm
                            </span>
                            {r.excessLength != null && <span className="text-green-600 ml-2">Exces: {r.excessLength}mm</span>}
                          </div>
                          <button onClick={() => remUseMut.mutate(r.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Utilizeaza</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400">Niciun rest compatibil gasit.</p>}
                </div>
              )}
            </div>
          )}

          {remLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Material</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Grad</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Forma</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Dimensiuni</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Greutate</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {remnantList.map(r => {
                  const dims = [
                    r.dimension_diameter ? `D${r.dimension_diameter}` : null,
                    r.dimension_length ? `L${r.dimension_length}` : null,
                    r.dimension_width ? `W${r.dimension_width}` : null,
                    r.dimension_thickness ? `T${r.dimension_thickness}` : null,
                  ].filter(Boolean).join(' x ')
                  const shapeLabels = { bar: 'Bara', plate: 'Tabla', tube: 'Teava', profile: 'Profil' }
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 text-sm">{r.material_name || r.material_code}</div>
                        <div className="text-xs text-slate-400">{r.material_code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{r.material_grade || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{shapeLabels[r.shape] || r.shape}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{dims || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { if (confirm('Marchezi ca utilizat?')) remUseMut.mutate(r.id) }} className="text-xs text-blue-500 hover:text-blue-700">Utilizeaza</button>
                          <button onClick={() => { if (confirm('Marchezi ca rebut?')) remScrapMut.mutate(r.id) }} className="text-xs text-red-400 hover:text-red-600 ml-2">Rebut</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!remLoading && remnantList.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <Scissors size={32} className="mx-auto mb-2 text-slate-300" />
                    Niciun rest disponibil.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <ItemModal onClose={() => setModal(false)} />}
      {movementItem && <MovementModal item={movementItem} onClose={() => setMovementItem(null)} />}
      {selectedItem && <ItemDetail item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {locModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">{locModal?.id ? 'Editeaza locatie' : 'Locatie noua'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cod *</label>
                <input className="input" placeholder="Ex: LOC-MP-01" value={locForm.code} onChange={e => setLocForm({ ...locForm, code: e.target.value })} disabled={!!locModal?.id} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nume *</label>
                <input className="input" placeholder="Ex: Depozit materie prima" value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tip locatie</label>
                <select className="input" value={locForm.locationType} onChange={e => setLocForm({ ...locForm, locationType: e.target.value })}>
                  <option value="raw_material">Materie prima</option>
                  <option value="wip">WIP (Work in Progress)</option>
                  <option value="finished_good">Produs finit</option>
                  <option value="remnant">Resturi</option>
                  <option value="scrap">Rebut</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zona</label>
                <input className="input" placeholder="Ex: Hala A" value={locForm.zone} onChange={e => setLocForm({ ...locForm, zone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Capacitate</label>
                  <input className="input" type="number" placeholder="Ex: 500" value={locForm.capacity} onChange={e => setLocForm({ ...locForm, capacity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Unitate capacitate</label>
                  <input className="input" placeholder="buc, kg, m3" value={locForm.capacityUnit} onChange={e => setLocForm({ ...locForm, capacityUnit: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setLocModal(null)} className="btn-secondary">Anuleaza</button>
              <button
                onClick={() => locMutation.mutate({ ...(locModal?.id ? { id: locModal.id } : {}), ...locForm })}
                disabled={locMutation.isPending || !locForm.code || !locForm.name}
                className="btn-primary"
              >
                {locMutation.isPending ? 'Se salveaza...' : 'Salveaza'}
              </button>
            </div>
          </div>
        </div>
      )}

      {remModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-800 mb-4">Adauga rest utilizabil</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cod material</label>
                  <input className="input" placeholder="Ex: OL42" value={remForm.materialCode} onChange={e => setRemForm({ ...remForm, materialCode: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nume material</label>
                  <input className="input" placeholder="Ex: Otel carbon" value={remForm.materialName} onChange={e => setRemForm({ ...remForm, materialName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Grad material</label>
                  <input className="input" placeholder="Ex: S355J2" value={remForm.materialGrade} onChange={e => setRemForm({ ...remForm, materialGrade: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Forma</label>
                  <select className="input" value={remForm.shape} onChange={e => setRemForm({ ...remForm, shape: e.target.value })}>
                    <option value="bar">Bara</option>
                    <option value="plate">Tabla</option>
                    <option value="tube">Teava</option>
                    <option value="profile">Profil</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Diametru (mm)</label>
                  <input className="input" type="number" value={remForm.diameter} onChange={e => setRemForm({ ...remForm, diameter: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lungime (mm)</label>
                  <input className="input" type="number" value={remForm.length} onChange={e => setRemForm({ ...remForm, length: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Latime (mm)</label>
                  <input className="input" type="number" value={remForm.width} onChange={e => setRemForm({ ...remForm, width: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Grosime (mm)</label>
                  <input className="input" type="number" value={remForm.thickness} onChange={e => setRemForm({ ...remForm, thickness: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Greutate (kg)</label>
                <input className="input" type="number" step="0.01" placeholder="Ex: 12.5" value={remForm.weightKg} onChange={e => setRemForm({ ...remForm, weightKg: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setRemModal(false)} className="btn-secondary">Anuleaza</button>
              <button
                onClick={() => remCreateMut.mutate({
                  ...remForm,
                  length: remForm.length ? Number(remForm.length) : null,
                  width: remForm.width ? Number(remForm.width) : null,
                  diameter: remForm.diameter ? Number(remForm.diameter) : null,
                  thickness: remForm.thickness ? Number(remForm.thickness) : null,
                  weightKg: remForm.weightKg ? Number(remForm.weightKg) : null,
                })}
                disabled={remCreateMut.isPending || !remForm.materialCode}
                className="btn-primary"
              >
                {remCreateMut.isPending ? 'Se adauga...' : 'Adauga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
