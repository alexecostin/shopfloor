import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, AlertTriangle, ArrowUpDown, Package } from 'lucide-react'

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

function ItemModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ code: '', name: '', category: 'raw_material', unit: 'buc', minStock: '0', costPerUnit: '' })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/inventory/items', data),
    onSuccess: () => { qc.invalidateQueries(['inventory-items']); toast.success('Articol creat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Articol nou</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Cod *" value={form.code} onChange={f('code')} />
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.category} onChange={f('category')}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="UM (buc, kg...)" value={form.unit} onChange={f('unit')} />
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
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MovementModal({ item, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ movementType: 'receipt', qty: '', notes: '' })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

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
          <input className="input" type="number" placeholder="Cantitate *" value={form.qty} onChange={f('qty')} />
          <input className="input" placeholder="Note" value={form.notes} onChange={f('notes')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ itemId: item.id, movementType: form.movementType, qty: Number(form.qty), notes: form.notes })}
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

export default function InventoryPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('items')
  const [modal, setModal] = useState(false)
  const [movementItem, setMovementItem] = useState(null)
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
        {[['items', 'Articole'], ['alerts', 'Alerte'], ['dashboard', 'Dashboard']].map(([t, l]) => (
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
                    <tr key={item.id} className={`hover:bg-slate-50 ${belowMin ? 'bg-red-50' : ''}`}>
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
                          onClick={() => setMovementItem(item)}
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
    </div>
  )
}
