import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Pencil, X, FileText, CheckCircle, XCircle } from 'lucide-react'

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Avertisment' },
  { value: 'critical', label: 'Critic' },
]

const emptyForm = {
  title: '',
  productId: '',
  operationId: '',
  machineType: '',
  drawingUrl: '',
  parameters: [],
  attentionPoints: [],
  tolerances: [],
  videoUrl: '',
  notes: '',
  revision: 1,
  isActive: true,
}

function InstructionModal({ onClose, editItem }) {
  const qc = useQueryClient()
  const isEdit = !!editItem

  const [form, setForm] = useState(() => {
    if (isEdit) {
      const params = typeof editItem.parameters === 'string' ? JSON.parse(editItem.parameters) : (editItem.parameters || [])
      const attn = typeof editItem.attention_points === 'string' ? JSON.parse(editItem.attention_points) : (editItem.attention_points || [])
      const tols = typeof editItem.tolerances === 'string' ? JSON.parse(editItem.tolerances) : (editItem.tolerances || [])
      return {
        title: editItem.title || '',
        productId: editItem.product_id || '',
        operationId: editItem.operation_id || '',
        machineType: editItem.machine_type || '',
        drawingUrl: editItem.drawing_url || '',
        parameters: params,
        attentionPoints: attn,
        tolerances: tols,
        videoUrl: editItem.video_url || '',
        notes: editItem.notes || '',
        revision: editItem.revision || 1,
        isActive: editItem.is_active !== false,
      }
    }
    return { ...emptyForm }
  })

  const f = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e })

  // Load products
  const { data: productsData } = useQuery({
    queryKey: ['bom-products-select'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data),
  })
  const products = productsData?.data || []

  // Load operations filtered by product
  const { data: operationsData } = useQuery({
    queryKey: ['bom-operations', form.productId],
    queryFn: () => form.productId ? api.get(`/bom/products/${form.productId}/operations`).then(r => r.data) : Promise.resolve([]),
    enabled: !!form.productId,
  })
  const operations = operationsData || []

  // Reset operation when product changes
  useEffect(() => {
    if (!isEdit) setForm(prev => ({ ...prev, operationId: '' }))
  }, [form.productId])

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/work-instructions/${editItem.id}`, data) : api.post('/work-instructions', data),
    onSuccess: () => {
      qc.invalidateQueries(['work-instructions'])
      toast.success(isEdit ? 'Instructiune actualizata.' : 'Instructiune creata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const submit = () => {
    if (!form.title.trim()) return toast.error('Titlul este obligatoriu.')
    mutation.mutate({
      ...form,
      productId: form.productId || null,
      operationId: form.operationId || null,
    })
  }

  // Dynamic row helpers
  const addParam = () => setForm({ ...form, parameters: [...form.parameters, { name: '', value: '', unit: '' }] })
  const updateParam = (i, k, v) => {
    const arr = [...form.parameters]; arr[i] = { ...arr[i], [k]: v }; setForm({ ...form, parameters: arr })
  }
  const removeParam = (i) => setForm({ ...form, parameters: form.parameters.filter((_, j) => j !== i) })

  const addAttn = () => setForm({ ...form, attentionPoints: [...form.attentionPoints, { text: '', severity: 'info' }] })
  const updateAttn = (i, k, v) => {
    const arr = [...form.attentionPoints]; arr[i] = { ...arr[i], [k]: v }; setForm({ ...form, attentionPoints: arr })
  }
  const removeAttn = (i) => setForm({ ...form, attentionPoints: form.attentionPoints.filter((_, j) => j !== i) })

  const addTol = () => setForm({ ...form, tolerances: [...form.tolerances, { characteristic: '', nominal: '', upper: '', lower: '', unit: '' }] })
  const updateTol = (i, k, v) => {
    const arr = [...form.tolerances]; arr[i] = { ...arr[i], [k]: v }; setForm({ ...form, tolerances: arr })
  }
  const removeTol = (i) => setForm({ ...form, tolerances: form.tolerances.filter((_, j) => j !== i) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800">{isEdit ? 'Editeaza instructiune' : 'Instructiune noua'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <input className="input" placeholder="Titlu *" value={form.title} onChange={f('title')} />

          <div className="grid grid-cols-2 gap-3">
            <select className="input" value={form.productId} onChange={f('productId')}>
              <option value="">-- Produs (optional) --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>)}
            </select>
            <select className="input" value={form.operationId} onChange={f('operationId')}>
              <option value="">-- Operatie (optional) --</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.operation_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Tip masina (optional)" value={form.machineType} onChange={f('machineType')} />
            <input className="input" placeholder="Revizie" type="number" value={form.revision} onChange={e => setForm({ ...form, revision: +e.target.value || 1 })} />
          </div>

          <input className="input" placeholder="URL desen tehnic (optional)" value={form.drawingUrl} onChange={f('drawingUrl')} />
          <input className="input" placeholder="URL video (optional)" value={form.videoUrl} onChange={f('videoUrl')} />

          {/* Parameters */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500">Parametri</label>
              <button onClick={addParam} className="text-xs text-blue-600 hover:underline">+ Adauga rand</button>
            </div>
            {form.parameters.map((p, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className="input flex-1" placeholder="Nume" value={p.name} onChange={e => updateParam(i, 'name', e.target.value)} />
                <input className="input flex-1" placeholder="Valoare" value={p.value} onChange={e => updateParam(i, 'value', e.target.value)} />
                <input className="input w-24" placeholder="UM" value={p.unit} onChange={e => updateParam(i, 'unit', e.target.value)} />
                <button onClick={() => removeParam(i)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
              </div>
            ))}
          </div>

          {/* Attention Points */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500">Puncte de atentie</label>
              <button onClick={addAttn} className="text-xs text-blue-600 hover:underline">+ Adauga rand</button>
            </div>
            {form.attentionPoints.map((a, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className="input flex-1" placeholder="Text" value={a.text} onChange={e => updateAttn(i, 'text', e.target.value)} />
                <select className="input w-36" value={a.severity} onChange={e => updateAttn(i, 'severity', e.target.value)}>
                  {SEVERITY_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={() => removeAttn(i)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
              </div>
            ))}
          </div>

          {/* Tolerances */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500">Tolerante</label>
              <button onClick={addTol} className="text-xs text-blue-600 hover:underline">+ Adauga rand</button>
            </div>
            {form.tolerances.map((t, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className="input flex-1" placeholder="Cota" value={t.characteristic} onChange={e => updateTol(i, 'characteristic', e.target.value)} />
                <input className="input w-20" placeholder="Nominal" value={t.nominal} onChange={e => updateTol(i, 'nominal', e.target.value)} />
                <input className="input w-20" placeholder="Min" value={t.lower} onChange={e => updateTol(i, 'lower', e.target.value)} />
                <input className="input w-20" placeholder="Max" value={t.upper} onChange={e => updateTol(i, 'upper', e.target.value)} />
                <input className="input w-20" placeholder="UM" value={t.unit} onChange={e => updateTol(i, 'unit', e.target.value)} />
                <button onClick={() => removeTol(i)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
              </div>
            ))}
          </div>

          <textarea className="input min-h-[60px]" placeholder="Note (optional)" value={form.notes} onChange={f('notes')} />

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Activ
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : (isEdit ? 'Salveaza' : 'Creeaza')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WorkInstructionsPage() {
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['work-instructions'],
    queryFn: () => api.get('/work-instructions').then(r => r.data),
  })

  const items = data?.data || []

  const openEdit = (item) => { setEditItem(item); setShowModal(true) }
  const openCreate = () => { setEditItem(null); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditItem(null) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FileText size={20} /> Instructiuni de lucru
        </h2>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1">
          <Plus size={16} /> Instructiune noua
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Titlu</th>
                <th className="pb-2 pr-4">Produs</th>
                <th className="pb-2 pr-4">Operatie</th>
                <th className="pb-2 pr-4">Tip masina</th>
                <th className="pb-2 pr-4">Revizie</th>
                <th className="pb-2 pr-4">Activ</th>
                <th className="pb-2">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-800">{item.title}</td>
                  <td className="py-2 pr-4 text-slate-600">{item.product_name || '-'}</td>
                  <td className="py-2 pr-4 text-slate-600">{item.operation_name || '-'}</td>
                  <td className="py-2 pr-4 text-slate-600">{item.machine_type || '-'}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">v{item.revision}</span>
                  </td>
                  <td className="py-2 pr-4">
                    {item.is_active
                      ? <CheckCircle size={16} className="text-green-500" />
                      : <XCircle size={16} className="text-red-400" />}
                  </td>
                  <td className="py-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                      <Pencil size={14} /> Editeaza
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Nicio instructiune de lucru.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <InstructionModal onClose={closeModal} editItem={editItem} />}
    </div>
  )
}
