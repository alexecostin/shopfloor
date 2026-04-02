import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Search, Calendar, ChevronLeft, ChevronRight, Trash2, XCircle, ShieldCheck } from 'lucide-react'
import { useLookup, getLookupLabel } from '../hooks/useLookup'

const STATUS_COLORS = { pending: 'bg-slate-100 text-slate-600', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' }

function AddSkillModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ user_id: '', machine_id: '', skill_level_id: '', certified_at: '' })
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const { data: matrix } = useQuery({ queryKey: ['skill-matrix'], queryFn: () => api.get('/hr/skills/matrix').then(r => r.data) })
  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data) })
  const { data: levels } = useQuery({ queryKey: ['skill-levels'], queryFn: () => api.get('/hr/skill-levels').then(r => r.data) })
  const mut = useMutation({
    mutationFn: d => api.post('/hr/skills', d),
    onSuccess: () => { qc.invalidateQueries(['skill-matrix']); toast.success('Skill adaugat.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })
  const users = matrix?.operators || []
  const machineList = machines?.data || machines || []
  const levelList = levels?.data || levels || []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga Skill</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Operator * - selecteaza angajatul</label>
            <select className="input" value={form.user_id} onChange={f('user_id')}>
              <option value="">Selecteaza operator</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Masina * - selecteaza utilajul</label>
            <select className="input" value={form.machine_id} onChange={f('machine_id')}>
              <option value="">Selecteaza masina</option>
              {machineList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nivel competenta - nivelul de calificare</label>
            <select className="input" value={form.skill_level_id} onChange={f('skill_level_id')}>
              <option value="">Selecteaza nivel</option>
              {levelList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data certificare - cand a obtinut certificarea</label>
            <input className="input" type="date" value={form.certified_at} onChange={f('certified_at')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.user_id || !form.machine_id} className="btn-primary">
            {mut.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FALLBACK_LEAVE_TYPES = [
  { code: 'annual', display_name: 'Concediu anual' },
  { code: 'sick', display_name: 'Concediu medical' },
  { code: 'unpaid', display_name: 'Concediu fara plata' },
  { code: 'other', display_name: 'Altul' },
]

function LeaveModal({ onClose }) {
  const qc = useQueryClient()
  const { values: lookupLeaveTypes, loading: lookupLoading } = useLookup('leave_types')
  const leaveTypes = lookupLeaveTypes && lookupLeaveTypes.length > 0 ? lookupLeaveTypes : FALLBACK_LEAVE_TYPES
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
  const f = k => e => setForm({ ...form, [k]: e.target.value })
  const mut = useMutation({
    mutationFn: d => api.post('/hr/leave', d),
    onSuccess: () => { qc.invalidateQueries(['leave']); toast.success('Cerere de concediu trimisa cu succes.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la trimiterea cererii de concediu.'),
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Cerere Concediu</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tip concediu - selecteaza tipul de concediu dorit</label>
            <select className="input" value={form.leave_type} onChange={f('leave_type')}>
              {leaveTypes.map(lt => (
                <option key={lt.code || lt.id} value={lt.code || lt.value}>
                  {lt.display_name || getLookupLabel(lt) || lt.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data inceput * - prima zi de concediu</label>
            <input className="input" type="date" value={form.start_date} onChange={f('start_date')} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Data sfarsit * - ultima zi de concediu</label>
            <input className="input" type="date" value={form.end_date} onChange={f('end_date')} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Motiv - descrie motivul cererii (optional)</label>
            <textarea className="input" rows={3} placeholder="Descrie motivul concediului..." value={form.reason} onChange={f('reason')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.start_date || !form.end_date} className="btn-primary">
            {mut.isPending ? 'Se trimite...' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Nivel Competenta Nou ──────────────────────────────────────────────

function SkillLevelModal({ editLevel, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: editLevel?.name || '',
    level: String(editLevel?.level || ''),
    description: editLevel?.description || '',
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => editLevel
      ? api.put(`/hr/skill-levels/${editLevel.id}`, data)
      : api.post('/hr/skill-levels', data),
    onSuccess: () => {
      qc.invalidateQueries(['skill-levels'])
      qc.invalidateQueries(['skill-matrix'])
      toast.success(editLevel ? 'Nivel actualizat.' : 'Nivel creat.')
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">
          {editLevel ? 'Editeaza nivel' : 'Nivel nou'}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Denumire *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Ex: Expert" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nivel (numar) *</label>
            <input className="input" type="number" min="1" value={form.level} onChange={f('level')} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={f('description')} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ name: form.name, level: Number(form.level), description: form.description || null })}
            disabled={mutation.isPending || !form.name || !form.level}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Editare Skill ─────────────────────────────────────────────────────

function EditSkillModal({ skill, levels, onClose }) {
  const qc = useQueryClient()
  const levelList = levels?.data || levels || []
  const [form, setForm] = useState({
    skillLevelId: skill.skill_level_id || '',
    notes: skill.notes || '',
  })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/hr/skills/${skill.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['skill-matrix'])
      toast.success('Competenta actualizata.')
      onClose()
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Pencil size={16} /> Editeaza competenta
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nivel competenta</label>
            <select className="input" value={form.skillLevelId} onChange={e => setForm({ ...form, skillLevelId: e.target.value })}>
              <option value="">Selecteaza nivel</option>
              {levelList.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Note</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ skillLevelId: form.skillLevelId, notes: form.notes || null })}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RejectLeaveModal({ leaveId, onClose, onReject, loading }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Respinge cerere concediu</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Motiv respingere (optional)</label>
            <textarea className="input w-full" rows={3} placeholder="Descrieti motivul respingerii..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => onReject(leaveId, reason)}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
          >
            {loading ? 'Se respinge...' : 'Respinge'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SkillMatrixPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('matrix')
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editLevel, setEditLevel] = useState(null)
  const [editSkill, setEditSkill] = useState(null)
  const [rejectLeaveId, setRejectLeaveId] = useState(null)
  const [availDate, setAvailDate] = useState(new Date().toISOString().split('T')[0])
  const [availMachineType, setAvailMachineType] = useState('')
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const qc = useQueryClient()
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: matrix, isLoading } = useQuery({ queryKey: ['skill-matrix'], queryFn: () => api.get('/hr/skills/matrix').then(r => r.data) })
  const { data: levels } = useQuery({ queryKey: ['skill-levels'], queryFn: () => api.get('/hr/skill-levels').then(r => r.data) })
  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leave'], queryFn: () => api.get('/hr/leave').then(r => r.data) })

  const { data: available } = useQuery({
    queryKey: ['hr-available', availDate, availMachineType],
    queryFn: () => api.get('/hr/available', { params: { date: availDate, machineType: availMachineType || undefined } }).then(r => r.data),
    enabled: tab === 'availability',
  })

  const { data: leaveCalendar } = useQuery({
    queryKey: ['leave-calendar', calMonth, calYear],
    queryFn: () => api.get('/hr/leave/calendar', { params: { month: calMonth, year: calYear } }).then(r => r.data),
    enabled: tab === 'calendar',
  })

  const { data: certMachines } = useQuery({
    queryKey: ['machines-for-cert'],
    queryFn: () => api.get('/machines').then(r => r.data?.data || r.data || []),
    enabled: tab === 'certifications',
  })

  const { data: certMatrix } = useQuery({
    queryKey: ['cert-matrix', certMachines?.map(m => m.id).join(',')],
    queryFn: async () => {
      const machineList = certMachines || []
      const results = {}
      for (const m of machineList) {
        try {
          const ops = await api.get(`/machines/${m.id}/certified-operators`).then(r => r.data)
          results[m.id] = ops || []
        } catch { results[m.id] = [] }
      }
      return results
    },
    enabled: tab === 'certifications' && certMachines && certMachines.length > 0,
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/hr/skills/${id}`),
    onSuccess: () => { qc.invalidateQueries(['skill-matrix']); toast.success('Skill sters.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, action }) => api.put(`/hr/leave/${id}/${action}`),
    onSuccess: (data) => {
      qc.invalidateQueries(['leave'])
      toast.success('Status actualizat.')
      if (data?.data?.warning) toast(data.data.warning, { icon: '⚠️' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/hr/leave/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries(['leave'])
      toast.success('Cerere de concediu respinsa.')
      setRejectLeaveId(null)
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la respingere.'),
  })

  const levelList = levels?.data || levels || []
  const levelMap = Object.fromEntries(levelList.map(l => [l.id, l]))
  const operators = matrix?.operators || []
  const machines = matrix?.machines || []
  const skills = matrix?.skills || []

  const getSkill = (userId, machineId) => skills.find(s => s.user_id === userId && s.machine_id === machineId)
  const leaveList = leaves?.data || leaves || []

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Competente & Concedii</h1>
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        <button className={tabCls('matrix')} onClick={() => setTab('matrix')}>Matrice Competente</button>
        <button className={tabCls('certifications')} onClick={() => setTab('certifications')}>Certificari masini</button>
        <button className={tabCls('levels')} onClick={() => setTab('levels')}>Niveluri competenta</button>
        <button className={tabCls('leave')} onClick={() => setTab('leave')}>Concedii</button>
        <button className={tabCls('availability')} onClick={() => setTab('availability')}>Disponibilitate</button>
        <button className={tabCls('calendar')} onClick={() => setTab('calendar')}>Calendar concedii</button>
      </div>

      {tab === 'matrix' && (
        <div>
          <div className="flex justify-end mb-3">
            {isManager && <button onClick={() => setShowAddSkill(true)} className="btn-primary flex items-center gap-2"><Plus size={15} />Adauga Skill</button>}
          </div>
          {isLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-32">Operator</th>
                    {machines.map(m => <th key={m.id} className="px-3 py-3 font-medium text-slate-600 text-center whitespace-nowrap">{m.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {operators.map(op => (
                    <tr key={op.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{op.full_name}</td>
                      {machines.map(m => {
                        const sk = getSkill(op.id, m.id)
                        const lvl = sk ? levelMap[sk.skill_level_id] : null
                        return (
                          <td key={m.id} className="px-3 py-3 text-center">
                            {lvl ? (
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="text-xs px-2 py-1 rounded-full cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: lvl.color + '30', color: lvl.color }}
                                  onClick={() => isManager && setEditSkill(sk)}
                                  title={isManager ? 'Click pentru editare' : ''}
                                >
                                  {lvl.name}
                                </span>
                                {isManager && (
                                  <button
                                    onClick={() => { if (confirm('Sigur doriti sa stergeti aceasta competenta?')) deleteMut.mutate(sk.id) }}
                                    className="text-slate-300 hover:text-red-400"
                                    title="Sterge competenta"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </span>
                            ) : <span className="text-slate-200">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'leave' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowLeave(true)} className="btn-primary flex items-center gap-2"><Plus size={15} />Cerere Concediu</button>
          </div>
          {leavesLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Inceput</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Sfarsit</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    {isManager && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveList.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{l.full_name || l.user?.full_name || l.user_id}</td>
                      <td className="px-4 py-3 text-slate-600 capitalize">{l.leave_type}</td>
                      <td className="px-4 py-3 text-slate-500">{l.start_date?.slice(0,10)}</td>
                      <td className="px-4 py-3 text-slate-500">{l.end_date?.slice(0,10)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[l.status] || 'bg-slate-100'}`}>{l.status}</span>
                      </td>
                      {isManager && (
                        <td className="px-4 py-3 flex gap-2 justify-end">
                          {l.status === 'pending' && (<>
                            <button onClick={() => approveMut.mutate({ id: l.id, action: 'approve' })} className="text-xs btn-primary py-1">Aproba</button>
                            <button onClick={() => setRejectLeaveId(l.id)} className="text-xs btn-secondary py-1 flex items-center gap-1"><XCircle size={11} /> Respinge</button>
                          </>)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {leaveList.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio cerere.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'levels' && (
        <div>
          <div className="flex justify-end mb-3">
            {isManager && (
              <button onClick={() => { setEditLevel(null); setShowLevelModal(true) }} className="btn-primary flex items-center gap-2">
                <Plus size={15} /> Nivel nou
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nivel</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Descriere</th>
                  {isManager && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {levelList.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        {l.color && <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: l.color }} />}
                        {l.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.level}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.description || '—'}</td>
                    {isManager && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setEditLevel(l); setShowLevelModal(true) }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {levelList.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Niciun nivel definit.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'availability' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">Data:</label>
            <input className="input w-40" type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} />
            <label className="text-sm text-slate-500">Tip utilaj:</label>
            <input className="input w-48" placeholder="Optional" value={availMachineType} onChange={e => setAvailMachineType(e.target.value)} />
            <Search size={16} className="text-slate-400" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Competente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(available?.data || available || []).map((op, i) => (
                  <tr key={op.id || i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{op.full_name || op.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{op.role || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{op.skills || op.machines || '—'}</td>
                  </tr>
                ))}
                {(available?.data || available || []).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Niciun operator disponibil pentru aceasta data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }} className="p-1 hover:bg-slate-100 rounded">
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium text-slate-700 text-sm min-w-32 text-center">
              {new Date(calYear, calMonth - 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }} className="p-1 hover:bg-slate-100 rounded">
              <ChevronRight size={16} />
            </button>
          </div>
          {(() => {
            const calData = leaveCalendar?.data || leaveCalendar || []
            const daysInMonth = new Date(calYear, calMonth, 0).getDate()
            const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)
            // Group by person
            const people = {}
            calData.forEach(entry => {
              const key = entry.user_name || entry.full_name || entry.user_id
              if (!people[key]) people[key] = new Set()
              // entry might have a single day or a range
              if (entry.day) people[key].add(Number(entry.day))
              if (entry.days) entry.days.forEach(d => people[key].add(Number(d)))
              if (entry.start_date && entry.end_date) {
                const s = new Date(entry.start_date)
                const e = new Date(entry.end_date)
                for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                  if (d.getMonth() + 1 === calMonth && d.getFullYear() === calYear) {
                    people[key].add(d.getDate())
                  }
                }
              }
            })
            const personNames = Object.keys(people)
            return (
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 sticky left-0 bg-slate-50 min-w-28">Operator</th>
                      {dayNumbers.map(d => (
                        <th key={d} className="px-1 py-2 font-medium text-slate-500 text-center min-w-6">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {personNames.map(name => (
                      <tr key={name} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">{name}</td>
                        {dayNumbers.map(d => (
                          <td key={d} className="px-1 py-2 text-center">
                            {people[name].has(d) ? (
                              <span className="inline-block w-4 h-4 rounded bg-red-400" title="Concediu" />
                            ) : (
                              <span className="inline-block w-4 h-4 rounded bg-green-100" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {personNames.length === 0 && (
                      <tr><td colSpan={daysInMonth + 1} className="px-4 py-8 text-center text-slate-400">Niciun concediu inregistrat pentru aceasta luna.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {tab === 'certifications' && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2"><ShieldCheck size={16} /> Operator x Tip masina — Certificari</h4>
          {(!certMachines || certMachines.length === 0) ? (
            <p className="text-slate-400 text-sm">Se incarca sau nu exista utilaje.</p>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-36 sticky left-0 bg-slate-50">Operator</th>
                    {(certMachines || []).map(m => (
                      <th key={m.id} className="px-3 py-3 font-medium text-slate-600 text-center whitespace-nowrap">
                        <div>{m.name}</div>
                        {m.controller_type && <div className="text-xs font-normal text-indigo-500">{m.controller_type}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    // Collect all unique operators across all machines
                    const allOps = {}
                    for (const mId of Object.keys(certMatrix || {})) {
                      for (const op of (certMatrix[mId] || [])) {
                        if (!allOps[op.id]) allOps[op.id] = { id: op.id, full_name: op.full_name }
                      }
                    }
                    const opList = Object.values(allOps).sort((a, b) => a.full_name.localeCompare(b.full_name))
                    if (opList.length === 0) return (
                      <tr><td colSpan={(certMachines || []).length + 1} className="px-4 py-8 text-center text-slate-400">Nicio certificare inregistrata.</td></tr>
                    )
                    return opList.map(op => (
                      <tr key={op.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">{op.full_name}</td>
                        {(certMachines || []).map(m => {
                          const cert = (certMatrix?.[m.id] || []).find(c => c.id === op.id)
                          if (!cert) return <td key={m.id} className="px-3 py-3 text-center"><span className="text-slate-200">—</span></td>
                          const isExpired = cert.expiry_date && new Date(cert.expiry_date) < new Date()
                          const isExpiring = cert.expiry_date && !isExpired && new Date(cert.expiry_date) < new Date(Date.now() + 30 * 86400000)
                          const color = isExpired ? 'bg-red-100 text-red-700' : isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          return (
                            <td key={m.id} className="px-3 py-3 text-center">
                              <span className={`text-xs px-2 py-1 rounded-full ${color}`}>
                                {cert.certification_level}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddSkill && <AddSkillModal onClose={() => setShowAddSkill(false)} />}
      {showLeave && <LeaveModal onClose={() => setShowLeave(false)} />}
      {showLevelModal && <SkillLevelModal editLevel={editLevel} onClose={() => { setShowLevelModal(false); setEditLevel(null) }} />}
      {editSkill && <EditSkillModal skill={editSkill} levels={levels} onClose={() => setEditSkill(null)} />}
      {rejectLeaveId && <RejectLeaveModal leaveId={rejectLeaveId} onClose={() => setRejectLeaveId(null)} onReject={(id, reason) => rejectMut.mutate({ id, reason })} loading={rejectMut.isPending} />}
    </div>
  )
}
