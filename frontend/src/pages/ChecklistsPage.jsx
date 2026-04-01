import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Plus, Pencil, X, Trash2 } from 'lucide-react'

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
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Utilaj *</label>
            <select className="input" value={machineId} onChange={e => setMachineId(e.target.value)}>
              <option value="">Selecteaza utilaj</option>
              {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tura</label>
            <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
              {['Tura I', 'Tura II', 'Tura III'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
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

function TemplateModal({ onClose, editTemplate }) {
  const qc = useQueryClient()
  const isEdit = !!editTemplate
  const [form, setForm] = useState(
    isEdit
      ? {
          name: editTemplate.name || '',
          description: editTemplate.description || '',
          category: editTemplate.category || '',
          items: (editTemplate.items || []).map(i => typeof i === 'string' ? i : i.text || ''),
        }
      : { name: '', description: '', category: '', items: [''] }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/checklists/templates/${editTemplate.id}`, data) : api.post('/checklists/templates', data),
    onSuccess: () => {
      qc.invalidateQueries(['templates'])
      if (isEdit) qc.invalidateQueries(['template-detail', editTemplate.id])
      toast.success(isEdit ? 'Template actualizat.' : 'Template creat.')
      onClose()
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const addItem = () => setForm({ ...form, items: [...form.items, ''] })
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
  const updateItem = (idx, val) => setForm({ ...form, items: form.items.map((it, i) => i === idx ? val : it) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza template' : 'Template nou'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nume checklist *</label>
            <input className="input" placeholder="Ex: Verificare zilnica CNC" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descriere</label>
            <input className="input" placeholder="Descrierea scopului checklistului" value={form.description} onChange={f('description')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categorie</label>
            <input className="input" placeholder="Ex: Calitate, Siguranta, Mentenanta" value={form.category} onChange={f('category')} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Puncte de verificare</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga punct</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder={`Punct ${idx + 1} *`}
                    value={item}
                    onChange={e => updateItem(idx, e.target.value)}
                  />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({
              name: form.name,
              description: form.description,
              category: form.category,
              items: form.items.filter(i => i.trim()),
            })}
            disabled={mutation.isPending || !form.name || form.items.filter(i => i.trim()).length === 0}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplateDetail({ template, machines, onClose }) {
  const [editMode, setEditMode] = useState(false)
  const [completeMode, setCompleteMode] = useState(false)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['template-detail', template.id],
    queryFn: () => api.get(`/checklists/templates/${template.id}`).then(r => r.data),
  })

  const t = detail || template

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{t.name}</h3>
            {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
            {t.category && <p className="text-xs text-slate-400">Categorie: {t.category}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditMode(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm">Se incarca...</p>
        ) : (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Puncte de verificare ({t.items?.length || 0})</h4>
            <div className="space-y-2">
              {t.items?.map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-400 mt-0.5 w-5">{idx + 1}.</span>
                  <div className="flex-1">
                    <span className="text-sm text-slate-700">{item.text || item}</span>
                    {item.required && <span className="text-red-400 text-xs ml-1">*</span>}
                  </div>
                </div>
              ))}
              {(!t.items || t.items.length === 0) && <p className="text-sm text-slate-400">Niciun punct de verificare.</p>}
            </div>

            {t.is_active && (
              <div className="mt-4">
                <button onClick={() => setCompleteMode(true)} className="btn-primary text-sm">Completeaza checklist</button>
              </div>
            )}
          </div>
        )}
      </div>

      {editMode && <TemplateModal editTemplate={t} onClose={() => setEditMode(false)} />}
      {completeMode && t.items?.length > 0 && <CompleteModal template={t} machines={machines} onClose={() => setCompleteMode(false)} />}
    </div>
  )
}

export default function ChecklistsPage() {
  const { user } = useAuth()
  const [createModal, setCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [tab, setTab] = useState('templates')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data: templates, isLoading } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/checklists/templates').then(r => r.data) })
  const { data: completions } = useQuery({ queryKey: ['completions'], queryFn: () => api.get('/checklists/completions').then(r => r.data), enabled: tab === 'completions' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Checklists</h2>
        {isManager && tab === 'templates' && (
          <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Template nou
          </button>
        )}
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
              <div className="cursor-pointer flex-1" onClick={() => setSelectedTemplate(t)}>
                <h4 className="font-medium text-slate-800">{t.name}</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.items?.length ?? 0} puncte
                  {t.machine_type && ` • ${t.machine_type}`}
                  {!t.is_active && <span className="ml-2 text-red-400">inactiv</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {t.is_active && (
                  <button onClick={() => setSelectedTemplate(t)} className="btn-secondary text-xs">
                    Detalii
                  </button>
                )}
              </div>
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

      {createModal && <TemplateModal onClose={() => setCreateModal(false)} />}
      {selectedTemplate && <TemplateDetail template={selectedTemplate} machines={machines} onClose={() => setSelectedTemplate(null)} />}
    </div>
  )
}
