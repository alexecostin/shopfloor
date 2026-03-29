import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
}
const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

function NewRequestModal({ machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', problemType: '', description: '', priority: 'normal' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/maintenance', data),
    onSuccess: () => { qc.invalidateQueries(['maintenance']); toast.success('Cerere trimisa.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Cerere mentenanta</h3>
        <div className="space-y-3">
          <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <input className="input" placeholder="Tipul problemei" value={form.problemType} onChange={e => setForm({ ...form, problemType: e.target.value })} />
          <textarea className="input resize-none" rows={3} placeholder="Descriere (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Scazuta</option>
            <option value="normal">Normala</option>
            <option value="high">Ridicata</option>
            <option value="critical">Critica</option>
          </select>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.machineId || !form.problemType} className="btn-primary">
            {mutation.isPending ? 'Se trimite...' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MaintenancePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const canManage = ['admin', 'production_manager', 'maintenance'].includes(user?.role)

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data, isLoading } = useQuery({ queryKey: ['maintenance'], queryFn: () => api.get('/maintenance').then(r => r.data) })

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/maintenance/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['maintenance']); toast.success('Actualizat.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Mentenanta</h2>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Cerere noua
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nr.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Problema</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Prioritate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              {canManage && <th className="text-left px-4 py-3 font-medium text-slate-600">Actiune</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-700">{r.request_number}</td>
                <td className="px-4 py-3 text-slate-800">{r.problem_type}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    {r.status === 'open' && (
                      <button onClick={() => update.mutate({ id: r.id, status: 'in_progress' })} className="text-xs text-blue-600 hover:underline">Preia</button>
                    )}
                    {r.status === 'in_progress' && (
                      <button onClick={() => update.mutate({ id: r.id, status: 'done', resolution: 'Rezolvat.' })} className="text-xs text-green-600 hover:underline">Rezolva</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio cerere.</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <NewRequestModal machines={machines} onClose={() => setModal(false)} />}
    </div>
  )
}
