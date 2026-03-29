import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-slate-100 text-slate-500',
}

function MachineModal({ machine, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!machine?.id
  const [form, setForm] = useState({
    code: machine?.code ?? '',
    name: machine?.name ?? '',
    type: machine?.type ?? '',
    location: machine?.location ?? '',
    status: machine?.status ?? 'active',
  })

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/machines/${machine.id}`, data)
      : api.post('/machines', data),
    onSuccess: () => {
      qc.invalidateQueries(['machines'])
      toast.success(isEdit ? 'Utilaj actualizat.' : 'Utilaj adaugat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza utilaj' : 'Adauga utilaj'}</h3>
        <div className="space-y-3">
          {!isEdit && (
            <input className="input" placeholder="Cod (ex: CNC-01)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          )}
          <input className="input" placeholder="Nume" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Tip (ex: CNC, Injectie)" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} />
          <input className="input" placeholder="Locatie (ex: Hala A)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Activ</option>
            <option value="maintenance">In mentenanta</option>
            <option value="inactive">Inactiv</option>
          </select>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MachinesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const isAdmin = user?.role === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get('/machines').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/machines/${id}`),
    onSuccess: () => { qc.invalidateQueries(['machines']); toast.success('Utilaj sters.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Utilaje</h2>
        {isAdmin && (
          <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Adauga
          </button>
        )}
      </div>

      {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Tip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Locatie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data?.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-slate-800">{m.code}</td>
                <td className="px-4 py-3 text-slate-700">{m.name}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{m.type}</td>
                <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{m.location || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[m.status]}`}>
                    {m.status === 'active' ? 'Activ' : m.status === 'maintenance' ? 'Mentenanta' : 'Inactiv'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setModal(m)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => { if (confirm('Stergi utilajul?')) deleteMutation.mutate(m.id) }} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Niciun utilaj adaugat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal !== null && <MachineModal machine={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
