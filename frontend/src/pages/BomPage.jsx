import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, ChevronRight, Package, Pencil, Trash2, X } from 'lucide-react'
import SearchableSelect from '../components/SearchableSelect'

const TYPE_LABELS = {
  raw_material: 'Materie prima',
  semi_finished: 'Semifabricat',
  finished: 'Produs finit',
  component: 'Componenta',
}

const OPERATION_TYPES = ['cutting', 'bending', 'welding', 'machining', 'assembly', 'painting', 'inspection', 'packaging']

function ProductModal({ onClose, editProduct }) {
  const qc = useQueryClient()
  const isEdit = !!editProduct
  const [form, setForm] = useState(
    isEdit
      ? {
          reference: editProduct.reference || '',
          name: editProduct.name || '',
          productType: editProduct.product_type || 'finished',
          clientName: editProduct.client_name || '',
          clientId: editProduct.client_id || null,
          materialType: editProduct.material_type || '',
          weightPieceKg: editProduct.weight_piece_kg || '',
        }
      : { reference: '', name: '', productType: 'finished', clientName: '', clientId: null, materialType: '', weightPieceKg: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/bom/products/${editProduct.id}`, data) : api.post('/bom/products', data),
    onSuccess: () => {
      qc.invalidateQueries(['bom-products'])
      if (isEdit) qc.invalidateQueries(['bom-product', editProduct.id])
      toast.success(isEdit ? 'Produs actualizat.' : 'Produs creat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza produs' : 'Produs nou'}</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Referinta *" value={form.reference} onChange={f('reference')} />
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.productType} onChange={f('productType')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <SearchableSelect
            endpoint="/companies"
            filterParams={{ companyType: 'client' }}
            labelField="name"
            valueField="id"
            placeholder="Selecteaza client"
            value={form.clientId}
            onChange={(id, item) => setForm(prev => ({ ...prev, clientId: id, clientName: item?.name || '' }))}
            allowCreate={false}
          />
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
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OperationModal({ productId, editOp, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!editOp
  const [form, setForm] = useState(
    isEdit
      ? {
          operation_name: editOp.operation_name || '',
          operation_type: editOp.operation_type || '',
          machine_type: editOp.machine_type || '',
          cycle_time_seconds: editOp.cycle_time_seconds || '',
          setup_time_minutes: editOp.setup_time_minutes || '',
          sequence: editOp.sequence || '',
        }
      : { operation_name: '', operation_type: '', machine_type: '', cycle_time_seconds: '', setup_time_minutes: '', sequence: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/bom/operations/${editOp.id}`, data) : api.post(`/bom/products/${productId}/operations`, data),
    onSuccess: () => { qc.invalidateQueries(['bom-product', productId]); toast.success(isEdit ? 'Operatie actualizata.' : 'Operatie adaugata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza operatie' : 'Adauga operatie'}</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume operatie *" value={form.operation_name} onChange={f('operation_name')} />
          <select className="input" value={form.operation_type} onChange={f('operation_type')}>
            <option value="">Selecteaza tip</option>
            {OPERATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input" placeholder="Tip masina" value={form.machine_type} onChange={f('machine_type')} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" placeholder="Timp ciclu (sec)" value={form.cycle_time_seconds} onChange={f('cycle_time_seconds')} />
            <input className="input" type="number" placeholder="Timp setup (min)" value={form.setup_time_minutes} onChange={f('setup_time_minutes')} />
          </div>
          <input className="input" type="number" placeholder="Secventa" value={form.sequence} onChange={f('sequence')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              ...form,
              cycle_time_seconds: form.cycle_time_seconds ? Number(form.cycle_time_seconds) : null,
              setup_time_minutes: form.setup_time_minutes ? Number(form.setup_time_minutes) : null,
              sequence: form.sequence ? Number(form.sequence) : null,
            })}
            disabled={mutation.isPending || !form.operation_name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MaterialModal({ productId, editMat, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!editMat
  const [form, setForm] = useState(
    isEdit
      ? {
          material_name: editMat.material_name || '',
          material_code: editMat.material_code || '',
          quantity_per_piece: editMat.qty_per_piece || editMat.quantity_per_piece || '',
          unit: editMat.unit || '',
          cost_per_unit: editMat.cost_per_unit || '',
        }
      : { material_name: '', material_code: '', quantity_per_piece: '', unit: '', cost_per_unit: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/bom/materials/${editMat.id}`, data) : api.post(`/bom/products/${productId}/materials`, data),
    onSuccess: () => { qc.invalidateQueries(['bom-product', productId]); toast.success(isEdit ? 'Material actualizat.' : 'Material adaugat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza material' : 'Adauga material'}</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume material *" value={form.material_name} onChange={f('material_name')} />
          <input className="input" placeholder="Cod material" value={form.material_code} onChange={f('material_code')} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" placeholder="Cantitate / piesa *" value={form.quantity_per_piece} onChange={f('quantity_per_piece')} />
            <input className="input" placeholder="UM (kg, buc...)" value={form.unit} onChange={f('unit')} />
          </div>
          <input className="input" type="number" step="0.01" placeholder="Cost / unitate" value={form.cost_per_unit} onChange={f('cost_per_unit')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              ...form,
              quantity_per_piece: form.quantity_per_piece ? Number(form.quantity_per_piece) : null,
              cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : null,
            })}
            disabled={mutation.isPending || !form.material_name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ComponentModal({ productId, onClose }) {
  const qc = useQueryClient()
  const [childId, setChildId] = useState(null)
  const [qty, setQty] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/bom/products/${productId}/components`, data),
    onSuccess: () => { qc.invalidateQueries(['bom-product', productId]); toast.success('Component adaugat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga component</h3>
        <div className="space-y-3">
          <SearchableSelect
            endpoint="/bom/products"
            labelField="name"
            valueField="id"
            placeholder="Selecteaza produs component"
            value={childId}
            onChange={(id) => setChildId(id)}
            allowCreate={false}
          />
          <input className="input" type="number" placeholder="Cantitate per parinte *" value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ childProductId: childId, qtyPerParent: Number(qty) })}
            disabled={mutation.isPending || !childId || !qty}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductDetail({ product, onClose }) {
  const qc = useQueryClient()
  const [editProduct, setEditProduct] = useState(false)
  const [opModal, setOpModal] = useState(null) // null | 'new' | operation object
  const [matModal, setMatModal] = useState(null)
  const [compModal, setCompModal] = useState(false)

  const { data: cost } = useQuery({
    queryKey: ['bom-cost', product.id],
    queryFn: () => api.get(`/bom/products/${product.id}/cost`).then(r => r.data),
  })

  const deleteOpMut = useMutation({
    mutationFn: (opId) => api.delete(`/bom/operations/${opId}`),
    onSuccess: () => { qc.invalidateQueries(['bom-product', product.id]); toast.success('Operatie stearsa.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const deleteMatMut = useMutation({
    mutationFn: (matId) => api.delete(`/bom/materials/${matId}`),
    onSuccess: () => { qc.invalidateQueries(['bom-product', product.id]); toast.success('Material sters.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const isAssemblyType = ['finished', 'assembly', 'semi_finished'].includes(product.product_type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-400">{product.reference} • {TYPE_LABELS[product.product_type] || product.product_type}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditProduct(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        {/* Operations */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-700">Operatii</h4>
            <button onClick={() => setOpModal('new')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga operatie</button>
          </div>
          {product.operations?.length > 0 ? (
            <div className="space-y-1">
              {product.operations.map(op => (
                <div key={op.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400 w-5">{op.sequence}.</span>
                  <span className="font-medium text-slate-700 flex-1">{op.operation_name}</span>
                  {op.pieces_per_hour && <span className="text-xs text-slate-400">{Math.round(op.pieces_per_hour)} buc/h</span>}
                  <button onClick={(e) => { e.stopPropagation(); setOpModal(op) }} className="text-slate-400 hover:text-blue-500"><Pencil size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Stergi operatia?')) deleteOpMut.mutate(op.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Nicio operatie.</p>}
        </div>

        {/* Materials */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-slate-700">Materiale</h4>
            <button onClick={() => setMatModal('new')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga material</button>
          </div>
          {product.materials?.length > 0 ? (
            <div className="space-y-1">
              {product.materials.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-700 flex-1">{m.material_name}</span>
                  <span className="text-slate-400 text-xs mr-3">{m.qty_per_piece} {m.unit}</span>
                  <button onClick={() => setMatModal(m)} className="text-slate-400 hover:text-blue-500 mr-1"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm('Stergi materialul?')) deleteMatMut.mutate(m.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400">Niciun material.</p>}
        </div>

        {/* Components (for finished/assembly) */}
        {isAssemblyType && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">Componente</h4>
              <button onClick={() => setCompModal(true)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga component</button>
            </div>
            {product.components?.length > 0 ? (
              <div className="space-y-1">
                {product.components.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-slate-700">{c.child_name || c.name || `Produs #${c.child_product_id}`}</span>
                    <span className="text-slate-400 text-xs">x {c.qty_per_parent}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">Nicio componenta.</p>}
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

      {editProduct && <ProductModal editProduct={product} onClose={() => setEditProduct(false)} />}
      {opModal && <OperationModal productId={product.id} editOp={opModal === 'new' ? null : opModal} onClose={() => setOpModal(null)} />}
      {matModal && <MaterialModal productId={product.id} editMat={matModal === 'new' ? null : matModal} onClose={() => setMatModal(null)} />}
      {compModal && <ComponentModal productId={product.id} onClose={() => setCompModal(false)} />}
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
