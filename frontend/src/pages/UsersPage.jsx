import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, UserX, UserCheck } from 'lucide-react'

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  production_manager: 'bg-blue-100 text-blue-700',
  shift_leader: 'bg-cyan-100 text-cyan-700',
  operator: 'bg-green-100 text-green-700',
  maintenance: 'bg-orange-100 text-orange-700',
}

const ROLES = [
  { value: 'operator', label: 'Operator' },
  { value: 'shift_leader', label: 'Sef Tura' },
  { value: 'production_manager', label: 'Manager Productie' },
  { value: 'maintenance', label: 'Mentenanta' },
  { value: 'admin', label: 'Administrator' },
]

function UserModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', role: 'operator',
    badgeNumber: '', phone: '',
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data),
    onSuccess: () => {
      qc.invalidateQueries(['users'])
      toast.success('Utilizator creat.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Utilizator nou</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume complet *" value={form.fullName} onChange={f('fullName')} />
          <input className="input" type="email" placeholder="Email *" value={form.email} onChange={f('email')} />
          <input className="input" type="password" placeholder="Parola * (min 8 caractere, o majuscula, o cifra)" value={form.password} onChange={f('password')} />
          <select className="input" value={form.role} onChange={f('role')}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Nr. ecuson (optional)" value={form.badgeNumber} onChange={f('badgeNumber')} />
            <input className="input" placeholder="Telefon (optional)" value={form.phone} onChange={f('phone')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.fullName || !form.email || !form.password}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const isAdmin = user?.role === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/auth/users/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('Status actualizat.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Utilizatori</h2>
        {isAdmin && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Utilizator nou
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-500'}`}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? 'Activ' : 'Inactiv'}
                  </span>
                </td>
                {isAdmin && u.id !== user.id && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.is_active })}
                      className={`text-xs flex items-center gap-1 ml-auto transition-colors ${u.is_active ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-green-600'}`}
                    >
                      {u.is_active ? <><UserX size={13} /> Dezactiveaza</> : <><UserCheck size={13} /> Activeaza</>}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Niciun utilizator.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <UserModal onClose={() => setModal(false)} />}
    </div>
  )
}
