import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, Search, Calendar, ChevronLeft, ChevronRight, Trash2, XCircle, ShieldCheck, Eye } from 'lucide-react'
import { useLookup, getLookupLabel } from '../hooks/useLookup'

const STATUS_COLORS = { pending: 'bg-slate-100 text-slate-600', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700' }

function AddSkillModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ user_id: '', machine_id: '', skill_level_id: '', certified_at: '' })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  // Fetch users from /auth/users so the dropdown is always populated
  const { data: usersData } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => api.get('/auth/users', { params: { limit: 200 } }).then(r => {
      const d = r.data
      return d?.data || d?.users || (Array.isArray(d) ? d : [])
    }),
  })
  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data) })
  const { data: levels } = useQuery({ queryKey: ['skill-levels'], queryFn: () => api.get('/hr/skill-levels').then(r => r.data) })
  const mut = useMutation({
    mutationFn: d => api.post('/hr/skills', d),
    onSuccess: () => { qc.invalidateQueries(['skill-matrix']); toast.success('Skill adaugat.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })
  const users = usersData || []
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
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
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

const SAFE_LEAVE_TYPES = [
  { code: 'annual', display_name: 'Concediu anual' },
  { code: 'medical', display_name: 'Concediu medical' },
  { code: 'unpaid', display_name: 'Concediu fara plata' },
  { code: 'other', display_name: 'Altul' },
]

function LeaveModal({ onClose }) {
  const qc = useQueryClient()
  const { values: lookupLeaveTypes, loading: lookupLoading } = useLookup('leave_types')
  // Use lookup values if available, otherwise use safe fallback matching DB constraint
  const leaveTypes = lookupLeaveTypes && lookupLeaveTypes.length > 0 ? lookupLeaveTypes : SAFE_LEAVE_TYPES
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

// --- Modal Nivel Competenta Nou ---

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

// --- Modal Editare Skill ---

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

// --- Certifications: Add Certification Modal ---

function AddCertificationModal({ onClose, operators, machineTypes }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    user_id: '', machine_type: '', controller_type: '', certification_level: 'operator',
    certified_date: '', expiry_date: '',
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  // Deduplicate machine types from machines list
  const uniqueTypes = useMemo(() => {
    const map = {}
    for (const m of (machineTypes || [])) {
      const t = m.type || m.machine_type || 'General'
      if (!map[t]) map[t] = { type: t, controller_types: new Set() }
      if (m.controller_type) map[t].controller_types.add(m.controller_type)
    }
    return Object.values(map).map(v => ({ ...v, controller_types: [...v.controller_types] }))
  }, [machineTypes])

  const selectedType = uniqueTypes.find(t => t.type === form.machine_type)

  const mut = useMutation({
    mutationFn: d => api.post('/hr/certifications', d).catch(() =>
      // Fallback: use skills endpoint to create certification
      api.post('/hr/skills', {
        user_id: d.user_id,
        machine_id: (machineTypes || []).find(m => (m.type || m.machine_type) === d.machine_type)?.id,
        certified_at: d.certified_date,
      })
    ),
    onSuccess: () => { qc.invalidateQueries(['cert-matrix']); qc.invalidateQueries(['operator-certifications']); toast.success('Certificare adaugata.'); onClose() },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la adaugare certificare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Adauga certificare</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Operator *</label>
            <select className="input" value={form.user_id} onChange={f('user_id')}>
              <option value="">Selecteaza operator</option>
              {(operators || []).map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tip masina *</label>
            <select className="input" value={form.machine_type} onChange={f('machine_type')}>
              <option value="">Selecteaza tip masina</option>
              {uniqueTypes.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
            </select>
          </div>
          {selectedType && selectedType.controller_types.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tip controller</label>
              <select className="input" value={form.controller_type} onChange={f('controller_type')}>
                <option value="">Toate</option>
                {selectedType.controller_types.map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nivel certificare</label>
            <select className="input" value={form.certification_level} onChange={f('certification_level')}>
              <option value="operator">Operator</option>
              <option value="setup">Reglor (Setup)</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Data certificare</label>
              <input type="date" className="input" value={form.certified_date} onChange={f('certified_date')} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Data expirare</label>
              <input type="date" className="input" value={form.expiry_date} onChange={f('expiry_date')} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.user_id || !form.machine_type} className="btn-primary">
            {mut.isPending ? 'Se salveaza...' : 'Salveaza'}
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
  const [showAddCert, setShowAddCert] = useState(false)
  const [certOperatorFilter, setCertOperatorFilter] = useState('')
  const [availDate, setAvailDate] = useState(new Date().toISOString().split('T')[0])
  const [availMachineType, setAvailMachineType] = useState('')
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [annualView, setAnnualView] = useState(false)
  const qc = useQueryClient()
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: matrix, isLoading } = useQuery({ queryKey: ['skill-matrix'], queryFn: () => api.get('/hr/skills/matrix').then(r => r.data) })
  const { data: levels } = useQuery({ queryKey: ['skill-levels'], queryFn: () => api.get('/hr/skill-levels').then(r => r.data) })
  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leave'], queryFn: () => api.get('/hr/leave').then(r => r.data) })

  // Fetch ALL users for availability (not just "available" ones)
  const { data: allUsersData } = useQuery({
    queryKey: ['all-users-avail'],
    queryFn: () => api.get('/auth/users', { params: { limit: 200 } }).then(r => {
      const d = r.data
      return d?.data || d?.users || (Array.isArray(d) ? d : [])
    }),
    enabled: tab === 'availability' || tab === 'certifications',
  })

  // Fetch leave requests for the selected availability date to mark who is on leave
  const { data: leavesForDate } = useQuery({
    queryKey: ['leave-for-date', availDate],
    queryFn: () => api.get('/hr/leave', { params: { status: 'approved' } }).then(r => {
      const list = r.data?.data || r.data || []
      return list.filter(l => {
        const start = l.start_date?.slice(0, 10)
        const end = l.end_date?.slice(0, 10)
        return start <= availDate && end >= availDate
      })
    }),
    enabled: tab === 'availability',
  })

  // Fetch the skill matrix data to show certifications per operator
  const { data: skillsForAvail } = useQuery({
    queryKey: ['skills-for-avail'],
    queryFn: () => api.get('/hr/skills/matrix').then(r => r.data),
    enabled: tab === 'availability',
  })

  const { data: leaveCalendar } = useQuery({
    queryKey: ['leave-calendar', calMonth, calYear, annualView],
    queryFn: () => {
      if (annualView) {
        const dateFrom = `${calYear}-01-01`
        const dateTo = `${calYear}-12-31`
        return api.get('/hr/leave/calendar', { params: { dateFrom, dateTo } }).then(r => r.data)
      }
      const daysInMonth = new Date(calYear, calMonth, 0).getDate()
      const dateFrom = `${calYear}-${String(calMonth).padStart(2, '0')}-01`
      const dateTo = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      return api.get('/hr/leave/calendar', { params: { dateFrom, dateTo } }).then(r => r.data)
    },
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

  // Fetch lookup for machine types for availability filter
  const { values: machineTypeLookup } = useLookup('machine_types', { enabled: tab === 'availability' || tab === 'certifications' })

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
      if (data?.data?.warning) toast(data.data.warning, { icon: '!!!' })
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare.'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/hr/leave/${id}/reject`, { reviewer_notes: reason }),
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

  // --- Availability helpers ---
  const allUsers = allUsersData || []
  const onLeaveUserIds = new Set((leavesForDate || []).map(l => l.user_id))
  const skillMatrixArr = Array.isArray(skillsForAvail) ? skillsForAvail : (skillsForAvail?.operators ? [] : [])
  // Build a map of user_id -> machines they are certified on
  const userCertMap = useMemo(() => {
    const map = {}
    const src = Array.isArray(skillsForAvail) ? skillsForAvail : []
    for (const op of src) {
      map[op.user_id] = (op.machines || []).map(m => m.machine_name || m.machine_code).join(', ')
    }
    return map
  }, [skillsForAvail])

  // Derive unique machine types from certMachines for filter dropdown
  const availMachineTypes = useMemo(() => {
    const types = new Set()
    for (const m of (certMachines || [])) {
      if (m.type) types.add(m.type)
      if (m.machine_type) types.add(m.machine_type)
    }
    // Also use lookup values
    for (const lt of (machineTypeLookup || [])) {
      if (lt.code) types.add(lt.code)
      if (lt.display_name) types.add(lt.display_name)
    }
    return [...types]
  }, [certMachines, machineTypeLookup])

  // Filter users for availability
  const filteredAvailUsers = useMemo(() => {
    let list = allUsers.filter(u => u.is_active !== false)
    if (availMachineType) {
      // Only show users certified on machines of this type
      const machineIdsOfType = new Set((certMachines || []).filter(m => (m.type || m.machine_type) === availMachineType).map(m => m.id))
      const certifiedUserIds = new Set()
      for (const [mId, ops] of Object.entries(certMatrix || {})) {
        if (machineIdsOfType.has(mId)) {
          for (const op of ops) certifiedUserIds.add(op.id)
        }
      }
      // Also check skills matrix
      const matrixArr = Array.isArray(skillsForAvail) ? skillsForAvail : []
      for (const op of matrixArr) {
        for (const m of (op.machines || [])) {
          if (machineIdsOfType.has(m.machine_id)) certifiedUserIds.add(op.user_id)
        }
      }
      list = list.filter(u => certifiedUserIds.has(u.id))
    }
    return list
  }, [allUsers, availMachineType, certMachines, certMatrix, skillsForAvail])

  // --- Certifications: group by operator ---
  const certByOperator = useMemo(() => {
    const map = {}
    for (const mId of Object.keys(certMatrix || {})) {
      const machine = (certMachines || []).find(m => m.id === mId)
      for (const op of (certMatrix[mId] || [])) {
        if (!map[op.id]) map[op.id] = { id: op.id, full_name: op.full_name, certs: [] }
        map[op.id].certs.push({
          machine_id: mId,
          machine_name: machine?.name || '?',
          machine_type: machine?.type || machine?.machine_type || '',
          controller_type: machine?.controller_type || '',
          certification_level: op.certification_level || op.skill_level || '?',
          expiry_date: op.expiry_date,
        })
      }
    }
    return Object.values(map).sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [certMatrix, certMachines])

  const filteredCertOperators = certOperatorFilter
    ? certByOperator.filter(op => op.id === certOperatorFilter)
    : certByOperator

  // --- Calendar: build month view for a given month/year from leaveCalendar data ---
  function buildMonthData(monthNum, yearNum, calData) {
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const people = {}
    const entries = calData || []
    entries.forEach(entry => {
      const key = entry.user_name || entry.full_name || entry.user_id
      if (!people[key]) people[key] = { days: new Set(), statuses: {} }
      if (entry.day) { people[key].days.add(Number(entry.day)); people[key].statuses[Number(entry.day)] = entry.status || 'approved' }
      if (entry.days) entry.days.forEach(d => { people[key].days.add(Number(d)); people[key].statuses[Number(d)] = entry.status || 'approved' })
      if (entry.start_date && entry.end_date) {
        const s = new Date(entry.start_date)
        const e = new Date(entry.end_date)
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          if (d.getMonth() + 1 === monthNum && d.getFullYear() === yearNum) {
            people[key].days.add(d.getDate())
            people[key].statuses[d.getDate()] = entry.status || 'approved'
          }
        }
      }
    })
    return { daysInMonth, dayNumbers, people }
  }

  function renderMonthCalendar(monthNum, yearNum, calData, compact = false) {
    const { daysInMonth, dayNumbers, people } = buildMonthData(monthNum, yearNum, calData)
    const personNames = Object.keys(people)
    return (
      <div className={`bg-white rounded-xl border border-slate-200 overflow-x-auto ${compact ? '' : ''}`}>
        {compact && (
          <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium text-slate-700">
            {new Date(yearNum, monthNum - 1).toLocaleDateString('ro-RO', { month: 'long' })}
          </div>
        )}
        <table className="text-xs w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-slate-600 sticky left-0 bg-slate-50 min-w-20">Operator</th>
              {dayNumbers.map(d => (
                <th key={d} className="px-0.5 py-1.5 font-medium text-slate-500 text-center min-w-5">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {personNames.map(name => (
              <tr key={name} className="hover:bg-slate-50">
                <td className="px-2 py-1.5 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap text-xs">{name}</td>
                {dayNumbers.map(d => {
                  const isOnLeave = people[name].days.has(d)
                  const status = people[name].statuses[d]
                  const color = isOnLeave
                    ? (status === 'pending' ? 'bg-yellow-300' : 'bg-red-400')
                    : 'bg-green-100'
                  return (
                    <td key={d} className="px-0.5 py-1.5 text-center">
                      <span className={`inline-block w-3.5 h-3.5 rounded ${color}`}
                        title={isOnLeave ? (status === 'pending' ? 'Pending' : 'Concediu') : 'Lucreaza'} />
                    </td>
                  )
                })}
              </tr>
            ))}
            {personNames.length === 0 && (
              <tr><td colSpan={daysInMonth + 1} className="px-4 py-4 text-center text-slate-400 text-xs">Niciun concediu in aceasta luna.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

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
                            ) : <span className="text-slate-200">-</span>}
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
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.description || '-'}</td>
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
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-500">Data:</label>
            <input className="input w-40" type="date" value={availDate} onChange={e => setAvailDate(e.target.value)} />
            <label className="text-sm text-slate-500">Filtreaza per tip masina:</label>
            <select className="input w-48" value={availMachineType} onChange={e => setAvailMachineType(e.target.value)}>
              <option value="">Toate</option>
              {availMachineTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Search size={16} className="text-slate-400" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Masini certificate</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAvailUsers.map((op, i) => {
                  const isOnLeave = onLeaveUserIds.has(op.id)
                  const leaveEntry = (leavesForDate || []).find(l => l.user_id === op.id)
                  const leaveType = leaveEntry?.leave_type || ''
                  const statusLabel = isOnLeave
                    ? (leaveType === 'medical' ? 'Bolnav' : 'Concediu')
                    : 'Disponibil'
                  const statusColor = isOnLeave
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                  const certInfo = userCertMap[op.id] || '-'
                  return (
                    <tr key={op.id || i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{op.full_name || op.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{op.role || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{certInfo}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredAvailUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Niciun operator gasit pentru aceasta selectie.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block" /> Disponibil</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded inline-block" /> Concediu / Bolnav</span>
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {!annualView && (
              <>
                <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1) }} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-medium text-slate-700 text-sm min-w-32 text-center">
                  {new Date(calYear, calMonth - 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1) }} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            {annualView && (
              <>
                <button onClick={() => setCalYear(calYear - 1)} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-medium text-slate-700 text-sm min-w-20 text-center">{calYear}</span>
                <button onClick={() => setCalYear(calYear + 1)} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button
              onClick={() => setAnnualView(!annualView)}
              className={`ml-4 px-3 py-1 text-xs rounded-lg border transition-colors ${annualView ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-300'}`}
            >
              <Eye size={12} className="inline mr-1" />
              {annualView ? 'Vizualizare lunara' : 'Vizualizare anuala'}
            </button>
          </div>

          {annualView ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <div key={m}>
                  {renderMonthCalendar(m, calYear, leaveCalendar?.data || leaveCalendar || [], true)}
                </div>
              ))}
            </div>
          ) : (
            renderMonthCalendar(calMonth, calYear, leaveCalendar?.data || leaveCalendar || [], false)
          )}

          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded inline-block" /> Lucreaza</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded inline-block" /> Concediu</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-300 rounded inline-block" /> Pending</span>
          </div>
        </div>
      )}

      {tab === 'certifications' && (
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2"><ShieldCheck size={16} /> Certificari per operator</h4>
            <div className="flex items-center gap-2">
              <select className="input w-48" value={certOperatorFilter} onChange={e => setCertOperatorFilter(e.target.value)}>
                <option value="">Toti operatorii</option>
                {certByOperator.map(op => <option key={op.id} value={op.id}>{op.full_name}</option>)}
              </select>
              {isManager && (
                <button onClick={() => setShowAddCert(true)} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> Adauga certificare
                </button>
              )}
            </div>
          </div>
          {(!certMachines || certMachines.length === 0) ? (
            <p className="text-slate-400 text-sm">Se incarca sau nu exista utilaje.</p>
          ) : filteredCertOperators.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              Nicio certificare inregistrata.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCertOperators.map(op => (
                <div key={op.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <span className="font-medium text-slate-800">{op.full_name}</span>
                    <span className="text-xs text-slate-400 ml-2">{op.certs.length} certificari</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Masina</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Tip masina</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Controller</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Nivel</th>
                        <th className="text-left px-4 py-2 font-medium text-slate-600 text-xs">Expira</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {op.certs.map((c, ci) => {
                        const isExpired = c.expiry_date && new Date(c.expiry_date) < new Date()
                        const isExpiring = c.expiry_date && !isExpired && new Date(c.expiry_date) < new Date(Date.now() + 30 * 86400000)
                        const color = isExpired ? 'bg-red-100 text-red-700' : isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        return (
                          <tr key={ci} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-800">{c.machine_name}</td>
                            <td className="px-4 py-2 text-slate-500">{c.machine_type || '-'}</td>
                            <td className="px-4 py-2 text-slate-500">{c.controller_type || '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{c.certification_level}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs">
                              {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('ro-RO') : '-'}
                              {isExpired && <span className="ml-1 text-red-600 font-medium">Expirat</span>}
                              {isExpiring && <span className="ml-1 text-amber-600 font-medium">Expira curand</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddSkill && <AddSkillModal onClose={() => setShowAddSkill(false)} />}
      {showLeave && <LeaveModal onClose={() => setShowLeave(false)} />}
      {showLevelModal && <SkillLevelModal editLevel={editLevel} onClose={() => { setShowLevelModal(false); setEditLevel(null) }} />}
      {editSkill && <EditSkillModal skill={editSkill} levels={levels} onClose={() => setEditSkill(null)} />}
      {rejectLeaveId && <RejectLeaveModal leaveId={rejectLeaveId} onClose={() => setRejectLeaveId(null)} onReject={(id, reason) => rejectMut.mutate({ id, reason })} loading={rejectMut.isPending} />}
      {showAddCert && <AddCertificationModal onClose={() => setShowAddCert(false)} operators={allUsersData || []} machineTypes={certMachines || []} />}
    </div>
  )
}
