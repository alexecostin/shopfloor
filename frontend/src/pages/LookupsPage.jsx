// frontend/src/pages/LookupsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Pencil, X, RotateCcw, Circle } from 'lucide-react'
import { useLookupTypes } from '../hooks/useLookup'

function ColorDot({ color }) {
  if (!color) return <Circle size={14} className="text-slate-300" />
  return <span className="inline-block w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
}

function LookupValuesPanel({ lookupType, typeName }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = ['admin', 'production_manager'].includes(user?.role)
  const [editing, setEditing] = useState(null) // code being edited
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ code: '', displayName: '', displayNameEn: '', color: '', sortOrder: 0 })

  const { data: values = [], isLoading } = useQuery({
    queryKey: ['lookup', lookupType, true],
    queryFn: () => api.get(`/lookups/${lookupType}?includeInactive=true`).then(r => r.data),
    staleTime: 60000,
  })

  const create = useMutation({
    mutationFn: data => api.post(`/lookups/${lookupType}`, data),
    onSuccess: () => { qc.invalidateQueries(['lookup', lookupType]); qc.invalidateQueries(['lookup-types']); setShowAdd(false); toast.success('Valoare adaugata.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const update = useMutation({
    mutationFn: ({ code, data }) => api.put(`/lookups/${lookupType}/${code}`, data),
    onSuccess: () => { qc.invalidateQueries(['lookup', lookupType]); setEditing(null); toast.success('Actualizat.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const deactivate = useMutation({
    mutationFn: code => api.delete(`/lookups/${lookupType}/${code}`),
    onSuccess: () => { qc.invalidateQueries(['lookup', lookupType]); toast.success('Dezactivat.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const activate = useMutation({
    mutationFn: code => api.put(`/lookups/${lookupType}/${code}`, { isActive: true }),
    onSuccess: () => { qc.invalidateQueries(['lookup', lookupType]); toast.success('Activat.') },
  })

  const reset = useMutation({
    mutationFn: () => api.post(`/lookups/${lookupType}/reset`),
    onSuccess: () => { qc.invalidateQueries(['lookup', lookupType]); toast.success('Resetat la default.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">{typeName}</h3>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { if (confirm('Resetezi la valorile default? Modificarile custom se pierd.')) reset.mutate() }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded-lg">
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={() => { setForm({ code: '', displayName: '', displayNameEn: '', color: '', sortOrder: values.length }); setShowAdd(true) }}
              className="btn-primary flex items-center gap-1 text-xs px-3 py-1.5">
              <Plus size={13} /> Adauga
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-6" />
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Cod</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Denumire (RO)</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 hidden md:table-cell">Denumire (EN)</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-20">Ordine</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-16">Status</th>
                {isAdmin && <th className="px-4 py-2.5 w-16" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {values.map(v => (
                <tr key={v.code} className={`hover:bg-slate-50 ${!v.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 text-center"><ColorDot color={v.color} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-600">{v.code}</td>
                  <td className="px-4 py-2.5 text-slate-800">
                    {editing === v.code ? (
                      <input className="input py-0.5 text-sm" defaultValue={v.displayName}
                        onBlur={e => update.mutate({ code: v.code, data: { displayName: e.target.value } })} />
                    ) : v.displayName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{v.displayNameEn}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-center">{v.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {v.isActive ? 'Activ' : 'Inactiv'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditing(editing === v.code ? null : v.code)}
                          className="text-slate-300 hover:text-blue-500"><Pencil size={13} /></button>
                        {v.isActive
                          ? <button onClick={() => deactivate.mutate(v.code)} className="text-slate-300 hover:text-red-400"><X size={13} /></button>
                          : <button onClick={() => activate.mutate(v.code)} className="text-slate-300 hover:text-green-500 text-xs">ON</button>
                        }
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {values.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nicio valoare.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-800 mb-4">Valoare noua — {typeName}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Cod * (unic)</label>
                  <input className="input" placeholder="ex: tip_nou" value={form.code} onChange={e => setForm({...form, code: e.target.value.toLowerCase().replace(/\s+/g,'_')})} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ordine sortare</label>
                  <input type="number" className="input" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: +e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Denumire romana *</label>
                <input className="input" value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Denumire engleza</label>
                <input className="input" value={form.displayNameEn} onChange={e => setForm({...form, displayNameEn: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Culoare (optional)</label>
                <div className="flex gap-2 items-center">
                  <input type="color" className="h-9 w-16 rounded border border-slate-200 cursor-pointer" value={form.color || '#6B7280'} onChange={e => setForm({...form, color: e.target.value})} />
                  <input className="input flex-1" placeholder="#6B7280" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Anuleaza</button>
              <button onClick={() => create.mutate(form)} disabled={!form.code || !form.displayName || create.isPending} className="btn-primary">
                {create.isPending ? 'Se adauga...' : 'Adauga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LookupsPage() {
  const { user } = useAuth()
  const [selectedType, setSelectedType] = useState(null)
  const { types, loading } = useLookupTypes()

  if (!['admin', 'production_manager'].includes(user?.role)) {
    return <div className="text-center py-12 text-slate-400">Acces restrictionat.</div>
  }

  const selectedDef = types.find(t => t.lookupType === selectedType)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Configurare Liste</h2>
        <p className="text-sm text-slate-500">Personalizeaza valorile dropdown-urilor din aplicatie.</p>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Type list */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-medium text-slate-600">Tipuri de liste</p>
            </div>
            {loading ? (
              <p className="text-slate-400 text-sm p-4">Se incarca...</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {types.map(t => (
                  <button key={t.lookupType}
                    onClick={() => setSelectedType(t.lookupType)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                      selectedType === t.lookupType ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">{t.displayName}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{t.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Values panel */}
        <div className="flex-1 min-w-0">
          {selectedType ? (
            <LookupValuesPanel lookupType={selectedType} typeName={selectedDef?.displayName || selectedType} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <p className="text-sm">Selecteaza un tip de lista din stanga pentru a vedea si edita valorile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
