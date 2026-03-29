import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Plus } from 'lucide-react'

function CompleteModal({ template, machines, onClose }) {
  const qc = useQueryClient()
  const [machineId, setMachineId] = useState('')
  const [shift, setShift] = useState('Tura I')
  const [responses, setResponses] = useState(
    template.items.map(i => ({ itemId: i.id, checked: false, note: '' }))
  )

  const mutation = useMutation({
    mutationFn: (data) => api.post('/checklists/complete', data),
    onSuccess: () => { qc.invalidateQueries(['completions']); toast.success('Checklist completat!'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  function toggle(itemId) {
    setResponses(prev => prev.map(r => r.itemId === itemId ? { ...r, checked: !r.checked } : r))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-1">{template.name}</h3>
        <p className="text-xs text-slate-400 mb-4">Completeaza toate punctele obligatorii</p>

        <div className="space-y-3 mb-4">
          <select className="input" value={machineId} onChange={e => setMachineId(e.target.value)}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
            {['Tura I', 'Tura II', 'Tura III'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {template.items.map((item, i) => {
            const resp = responses.find(r => r.itemId === item.id)
            return (
              <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                ${resp?.checked ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}
                onClick={() => toggle(item.id)}>
                <div className={`mt-0.5 flex-shrink-0 ${resp?.checked ? 'text-green-500' : 'text-slate-300'}`}>
                  <CheckCircle size={18} />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-slate-700">{item.text}</span>
                  {item.required && <span className="text-red-400 text-xs ml-1">*</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ templateId: template.id, machineId, shift, responses })}
            disabled={mutation.isPending || !machineId}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : 'Completeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChecklistsPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('templates')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data: templates, isLoading } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/checklists/templates').then(r => r.data) })
  const { data: completions } = useQuery({ queryKey: ['completions'], queryFn: () => api.get('/checklists/completions').then(r => r.data), enabled: tab === 'completions' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Checklists</h2>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {['templates', 'completions'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'templates' ? 'Template-uri' : 'Completari'}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div className="grid gap-3">
          {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
          {templates?.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-800">{t.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.items?.length ?? 0} puncte
                  {t.machine_type && ` • ${t.machine_type}`}
                  {!t.is_active && <span className="ml-2 text-red-400">inactiv</span>}
                </p>
              </div>
              {t.is_active && (
                <button onClick={() => setModal(t)} className="btn-primary text-xs">
                  Completeaza
                </button>
              )}
            </div>
          ))}
          {templates?.length === 0 && <p className="text-slate-400 text-sm">Niciun template.</p>}
        </div>
      )}

      {tab === 'completions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tura</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rezultat</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completions?.data?.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{c.shift || '—'}</td>
                  <td className="px-4 py-3">
                    {c.all_ok
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={13} /> OK</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={13} /> Probleme</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{new Date(c.completed_at).toLocaleString('ro-RO')}</td>
                </tr>
              ))}
              {completions?.data?.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nicio completare.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && <CompleteModal template={modal} machines={machines} onClose={() => setModal(null)} />}
    </div>
  )
}
