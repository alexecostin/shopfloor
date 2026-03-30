import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Clock, Calendar, Grid, AlertCircle } from 'lucide-react'

const DAYS = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica']

function OrgUnitSelect({ value, onChange }) {
  const { data: orgUnits = [] } = useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.get('/admin/org').then(r => {
      // Flatten tree
      const flat = []
      function flatten(nodes, depth = 0) {
        for (const n of nodes) {
          flat.push({ ...n, depth })
          if (n.children) flatten(n.children, depth + 1)
        }
      }
      flatten(Array.isArray(r.data) ? r.data : [r.data])
      return flat
    }),
  })
  return (
    <select className="input w-64" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Selecteaza fabrica/sectie</option>
      {orgUnits.map(u => (
        <option key={u.id} value={u.id}>
          {'  '.repeat(u.depth)}{u.name} ({u.unit_type})
        </option>
      ))}
    </select>
  )
}

function DefinitionsTab({ orgUnitId }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ shiftName: '', shiftCode: '', startTime: '06:00', endTime: '14:00', breakMinutes: 30 })
  const [showAdd, setShowAdd] = useState(false)

  const { data: defs = [], isLoading } = useQuery({
    queryKey: ['shift-defs', orgUnitId],
    queryFn: () => api.get(`/shifts/definitions?orgUnitId=${orgUnitId}`).then(r => r.data),
    enabled: !!orgUnitId,
  })

  const create = useMutation({
    mutationFn: data => api.post('/shifts/definitions', { ...data, orgUnitId }),
    onSuccess: () => { qc.invalidateQueries(['shift-defs', orgUnitId]); setShowAdd(false); toast.success('Tura adaugata.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const del = useMutation({
    mutationFn: id => api.delete(`/shifts/definitions/${id}`),
    onSuccess: () => { qc.invalidateQueries(['shift-defs', orgUnitId]); toast.success('Sters.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  if (!orgUnitId) return <div className="text-slate-400 text-sm py-8 text-center">Selecteaza o fabrica sau sectie pentru a gestiona turele.</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Adauga tura</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Cod</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Interval</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Pauza</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Min productive</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {defs.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-bold text-blue-600">{d.shift_code}</td>
                <td className="px-4 py-3 text-slate-800">{d.shift_name}</td>
                <td className="px-4 py-3 text-slate-700">
                  {String(d.start_time).substring(0,5)} – {String(d.end_time).substring(0,5)}
                  {d.crosses_midnight && <span className="ml-1 text-xs text-amber-600">(+1 zi)</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{d.break_minutes} min</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{d.productive_minutes} min</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => { if(confirm('Stergi tura?')) del.mutate(d.id) }} className="text-slate-300 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && defs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio tura definita. Apasa "Adauga tura".</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Tura noua</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Cod * (ex: T1)</label>
                  <input className="input" value={form.shiftCode} onChange={e => setForm({...form, shiftCode: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Denumire * (ex: Tura I)</label>
                  <input className="input" value={form.shiftName} onChange={e => setForm({...form, shiftName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ora start</label>
                  <input type="time" className="input" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ora final</label>
                  <input type="time" className="input" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pauza masa (minute)</label>
                <input type="number" min={0} max={120} className="input" value={form.breakMinutes} onChange={e => setForm({...form, breakMinutes: +e.target.value})} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => create.mutate(form)} disabled={!form.shiftCode || !form.shiftName || create.isPending} className="btn-primary">
                {create.isPending ? 'Se salveaza...' : 'Salveaza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WeeklyTab({ orgUnitId }) {
  const qc = useQueryClient()
  const { data: defs = [] } = useQuery({
    queryKey: ['shift-defs', orgUnitId],
    queryFn: () => api.get(`/shifts/definitions?orgUnitId=${orgUnitId}`).then(r => r.data),
    enabled: !!orgUnitId,
  })
  const { data: weekly = [], isLoading } = useQuery({
    queryKey: ['shift-weekly', orgUnitId],
    queryFn: () => api.get(`/shifts/weekly?orgUnitId=${orgUnitId}`).then(r => r.data),
    enabled: !!orgUnitId,
  })

  // Build editable grid: {dayOfWeek → Set of shiftCodes}
  const [grid, setGrid] = useState(null)
  const currentGrid = grid || Object.fromEntries((weekly || []).map(d => [d.dayOfWeek, new Set(d.shifts.map(s => s.shiftCode))]))

  const save = useMutation({
    mutationFn: () => api.put('/shifts/weekly', {
      orgUnitId,
      schedule: Object.entries(currentGrid).map(([day, codes]) => ({
        dayOfWeek: Number(day),
        shiftCodes: [...codes],
      })),
    }),
    onSuccess: () => { qc.invalidateQueries(['shift-weekly', orgUnitId]); setGrid(null); toast.success('Program salvat.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  function toggle(day, code) {
    const newGrid = { ...currentGrid }
    const daySet = new Set(newGrid[day] || [])
    if (daySet.has(code)) daySet.delete(code)
    else daySet.add(code)
    newGrid[day] = daySet
    setGrid(newGrid)
  }

  if (!orgUnitId) return <div className="text-slate-400 text-sm py-8 text-center">Selecteaza o fabrica sau sectie.</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="text-sm min-w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">Tura</th>
              {DAYS.map((d, i) => (
                <th key={i} className="px-3 py-3 font-medium text-slate-600 text-center min-w-[80px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {defs.map(def => (
              <tr key={def.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 text-xs">{def.shift_code}</div>
                  <div className="text-xs text-slate-400">{String(def.start_time).substring(0,5)}–{String(def.end_time).substring(0,5)}</div>
                </td>
                {[0,1,2,3,4,5,6].map(day => {
                  const active = (currentGrid[day] || new Set()).has(def.shift_code)
                  return (
                    <td key={day} className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggle(day, def.shift_code)}
                        className={`w-10 h-8 rounded text-xs font-medium transition-colors ${active ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        {active ? '✓' : '—'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {!isLoading && defs.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Defineste mai intai turele in tab-ul "Definitii".</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {grid && (
        <div className="flex justify-end gap-2">
          <button onClick={() => setGrid(null)} className="btn-secondary">Anuleaza</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'Se salveaza...' : 'Salveaza program'}
          </button>
        </div>
      )}
    </div>
  )
}

function ExceptionsTab({ orgUnitId }) {
  const qc = useQueryClient()
  const year = new Date().getFullYear()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ exceptionDate: '', exceptionType: 'holiday', name: '', activeShifts: [], isRecurring: false })

  const { data: defs = [] } = useQuery({
    queryKey: ['shift-defs', orgUnitId],
    queryFn: () => api.get(`/shifts/definitions?orgUnitId=${orgUnitId}`).then(r => r.data),
    enabled: !!orgUnitId,
  })
  const { data: exceptions = [], isLoading } = useQuery({
    queryKey: ['shift-exceptions', orgUnitId, year],
    queryFn: () => api.get(`/shifts/exceptions?orgUnitId=${orgUnitId}&year=${year}`).then(r => r.data),
    enabled: !!orgUnitId,
  })

  const create = useMutation({
    mutationFn: data => api.post('/shifts/exceptions', { ...data, orgUnitId }),
    onSuccess: () => { qc.invalidateQueries(['shift-exceptions']); setShowAdd(false); toast.success('Exceptie adaugata.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const del = useMutation({
    mutationFn: id => api.delete(`/shifts/exceptions/${id}`),
    onSuccess: () => { qc.invalidateQueries(['shift-exceptions']); toast.success('Sters.') },
  })

  const typeLabel = { holiday: 'Sarbatoare', extra_shift: 'Tura extra', reduced: 'Program redus', custom: 'Custom' }
  const typeColor = { holiday: 'bg-red-100 text-red-700', extra_shift: 'bg-green-100 text-green-700', reduced: 'bg-yellow-100 text-yellow-700', custom: 'bg-blue-100 text-blue-700' }

  if (!orgUnitId) return <div className="text-slate-400 text-sm py-8 text-center">Selecteaza o fabrica sau sectie.</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={14} /> Adauga exceptie</button>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="text-slate-400 text-sm">Se incarca...</div>}
        {exceptions.map(exc => (
          <div key={exc.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-slate-800">{exc.name || '—'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[exc.exception_type] || 'bg-slate-100 text-slate-600'}`}>
                  {typeLabel[exc.exception_type] || exc.exception_type}
                </span>
                {exc.is_recurring && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Recurent anual</span>}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                {new Date(exc.exception_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {(exc.active_shifts || []).length === 0
                  ? <span className="text-red-600 font-medium">Inchis</span>
                  : <span>{exc.active_shifts.join(', ')}</span>
                }
              </div>
            </div>
            <button onClick={() => { if(confirm('Stergi exceptia?')) del.mutate(exc.id) }} className="text-slate-300 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {!isLoading && exceptions.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            Nicio exceptie. Adauga sarbatori legale sau zile cu program special.
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Exceptie noua</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Data *</label>
                <input type="date" className="input" value={form.exceptionDate} onChange={e => setForm({...form, exceptionDate: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tip *</label>
                <select className="input" value={form.exceptionType} onChange={e => setForm({...form, exceptionType: e.target.value})}>
                  <option value="holiday">Sarbatoare (zi libera)</option>
                  <option value="extra_shift">Tura extra (zi suplimentara)</option>
                  <option value="reduced">Program redus</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Denumire</label>
                <input className="input" placeholder="ex: 1 Mai — Ziua Muncii" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-2 block">Ture active in aceasta zi (gol = zi inchisa)</label>
                <div className="flex flex-wrap gap-2">
                  {defs.map(d => {
                    const active = form.activeShifts.includes(d.shift_code)
                    return (
                      <button key={d.id}
                        onClick={() => setForm(f => ({
                          ...f,
                          activeShifts: active ? f.activeShifts.filter(c => c !== d.shift_code) : [...f.activeShifts, d.shift_code]
                        }))}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-300'}`}
                      >
                        {d.shift_code}
                      </button>
                    )
                  })}
                </div>
                {form.activeShifts.length === 0 && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} /> Zi inchisa — nicio tura activa</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({...form, isRecurring: e.target.checked})} />
                Se repeta anual (ex: sarbatori fixe)
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => create.mutate(form)} disabled={!form.exceptionDate || create.isPending} className="btn-primary">
                {create.isPending ? 'Se salveaza...' : 'Adauga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarTab({ orgUnitId }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['shift-calendar', orgUnitId, month, year],
    queryFn: () => api.get(`/shifts/calendar?orgUnitId=${orgUnitId}&month=${month}&year=${year}`).then(r => r.data),
    enabled: !!orgUnitId,
  })

  if (!orgUnitId) return <div className="text-slate-400 text-sm py-8 text-center">Selecteaza o fabrica sau sectie.</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="input w-32" value={month} onChange={e => setMonth(+e.target.value)}>
          {['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => (
            <option key={i} value={i+1}>{m}</option>
          ))}
        </select>
        <select className="input w-24" value={year} onChange={e => setYear(+e.target.value)}>
          {[2025,2026,2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Se incarca...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {['L','M','M','J','V','S','D'].map((d,i) => (
            <div key={i} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
          ))}
          {/* Leading empty cells */}
          {Array.from({ length: days[0]?.dayOfWeek || 0 }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => (
            <div key={day.date}
              className={`rounded-lg p-2 min-h-[60px] text-xs border ${
                day.isException && !day.isWorkingDay ? 'bg-red-50 border-red-200' :
                day.isException ? 'bg-blue-50 border-blue-200' :
                day.isWorkingDay ? 'bg-green-50 border-green-100' :
                'bg-slate-50 border-slate-200'
              }`}
            >
              <div className={`font-bold mb-1 ${
                day.isException && !day.isWorkingDay ? 'text-red-600' :
                day.isException ? 'text-blue-600' :
                day.isWorkingDay ? 'text-green-700' : 'text-slate-400'
              }`}>{new Date(day.date).getDate()}</div>
              {day.isException && <div className="text-xs text-slate-500 truncate">{day.exceptionName}</div>}
              {day.isWorkingDay && !day.isException && (
                <div className="text-slate-600">{day.shifts.map(s => s.shiftCode).join(' ')}</div>
              )}
              {day.isWorkingDay && <div className="text-slate-400">{day.totalHours}h</div>}
              {!day.isWorkingDay && !day.isException && <div className="text-slate-300">—</div>}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-50 border border-green-100 rounded inline-block" /> Zi lucratoare</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-50 border border-blue-200 rounded inline-block" /> Exceptie (program modificat)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-50 border border-red-200 rounded inline-block" /> Inchis</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-50 border border-slate-200 rounded inline-block" /> Zi libera</span>
      </div>
    </div>
  )
}

export default function ShiftsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('defs')
  const [orgUnitId, setOrgUnitId] = useState('')
  const isAdmin = ['admin', 'production_manager'].includes(user?.role)

  if (!isAdmin) {
    return <div className="text-center py-12 text-slate-400">Acces restrictionat.</div>
  }

  const tabs = [
    { id: 'defs', label: 'Definitii ture', icon: Clock },
    { id: 'weekly', label: 'Program saptamanal', icon: Grid },
    { id: 'exceptions', label: 'Exceptii', icon: AlertCircle },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Configurare Ture</h2>
        <p className="text-sm text-slate-500">Defineste turele, programul saptamanal si exceptiile per fabrica/sectie.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-600 font-medium">Fabrica / Sectie:</span>
        <OrgUnitSelect value={orgUnitId} onChange={setOrgUnitId} />
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors
              ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'defs' && <DefinitionsTab orgUnitId={orgUnitId} />}
      {tab === 'weekly' && <WeeklyTab orgUnitId={orgUnitId} />}
      {tab === 'exceptions' && <ExceptionsTab orgUnitId={orgUnitId} />}
      {tab === 'calendar' && <CalendarTab orgUnitId={orgUnitId} />}
    </div>
  )
}
