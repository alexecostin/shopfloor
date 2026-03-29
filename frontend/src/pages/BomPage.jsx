import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, ChevronRight, Package } from 'lucide-react'

const TYPE_LABELS = {
  raw_material: 'Materie prima',
  semi_finished: 'Semifabricat',
  finished: 'Produs finit',
  component: 'Componenta',
}

function ProductModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ reference: '', name: '', productType: 'finished', clientName: '', materialType: '', weightPieceKg: '' })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/bom/products', data),
    onSuccess: () => { qc.invalidateQueries(['bom-products']); toast.success('Produs creat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Produs nou</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Referinta *" value={form.reference} onChange={f('reference')} />
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.productType} onChange={f('productType')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="input" placeholder="Client" value={form.clientName} onChange={f('clientName')} />
          <input className="input" placeholder="Tip material" value={form.materialType} onChange={f('materialType')} />
          <input className="input" type="number" placeholder="Masa piesa (kg)" value={form.weightPieceKg} onChange={f('weightPieceKg')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ ...form, weightPieceKg: form.weightPieceKg ? Number(form.weightPieceKg) : null })}
            disabled={mutation.isPending || !form.reference || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductDetail({ product, onClose }) {
  const { data: cost } = useQuery({
    queryKey: ['bom-cost', product.id],
    queryFn: () => api.get(`/bom/products/${product.id}/cost`).then(r => r.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-400">{product.reference} • {TYPE_LABELS[product.product_type] || product.product_type}</p>
          </div>
          <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
        </div>

        {product.operations?.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Operatii</h4>
            <div className="space-y-1">
              {product.operations.map(op => (
                <div key={op.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400 w-5">{op.sequence}.</span>
                  <span className="font-medium text-slate-700">{op.operation_name}</span>
                  {op.pieces_per_hour && <span className="ml-auto text-xs text-slate-400">{Math.round(op.pieces_per_hour)} buc/h</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {product.materials?.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Materiale</h4>
            <div className="space-y-1">
              {product.materials.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-700">{m.material_name}</span>
                  <span className="text-slate-400 text-xs">{m.qty_per_piece} {m.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cost && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-700 mb-2">Cost calculat / piesa</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Material:</span> <span className="font-medium">{cost.summary.totalMaterial.toFixed(4)} EUR</span></div>
              <div><span className="text-slate-500">Operatii:</span> <span className="font-medium">{cost.summary.totalOperation.toFixed(4)} EUR</span></div>
              <div><span className="text-slate-500">Overhead:</span> <span className="font-medium">{cost.summary.overhead.toFixed(4)} EUR</span></div>
              <div><span className="text-slate-500 font-medium">TOTAL:</span> <span className="font-bold text-blue-700">{cost.summary.totalCostPerPiece.toFixed(4)} EUR</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BomPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['bom-products', search],
    queryFn: () => api.get('/bom/products', { params: { search, limit: 100 } }).then(r => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['bom-product', selected?.id],
    queryFn: () => api.get(`/bom/products/${selected.id}`).then(r => r.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">BOM — Produse</h2>
        {isManager && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Produs nou
          </button>
        )}
      </div>

      <input
        className="input max-w-sm"
        placeholder="Cauta dupa referinta sau denumire..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Referinta</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Tip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Client</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(p)}>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.reference}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[p.product_type] || p.product_type}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{p.client_name || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="text-slate-300 ml-auto" />
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-2 text-slate-300" />
                Niciun produs.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <ProductModal onClose={() => setModal(false)} />}
      {selected && detail && <ProductDetail product={detail} onClose={() => setSelected(null)} />}
    </div>
  )
}
