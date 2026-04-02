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

const CHECKLIST_PLACEHOLDERS = [
  'Verifica nivelul uleiului pe masina',
  'Verifica fixarea piesei in mandrina',
  'Curata zona de lucru',
  'Verifica sculele (uzura, fixare)',
  'Verifica presiunea aerului comprimat',
  'Inspecteaza vizual prima piesa',
]

const CHECK_TYPE_OPTIONS = [
  { value: 'yes_no', label: 'Da / Nu' },
  { value: 'ok_nok', label: 'OK / NOK' },
  { value: 'numeric', label: 'Valoare numerica' },
  { value: 'text', label: 'Text liber' },
]

const TRIGGER_OPTIONS = [
  { value: 'shift_start', label: 'La inceput de tura' },
  { value: 'product_change', label: 'La schimbare produs' },
  { value: 'inspection', label: 'La inspectie periodica' },
]

function TemplateModal({ onClose, editTemplate }) {
  const qc = useQueryClient()
  const isEdit = !!editTemplate
  const [form, setForm] = useState(
    isEdit
      ? {
          name: editTemplate.name || '',
          description: editTemplate.description || '',
          category: editTemplate.category || '',
          trigger: editTemplate.trigger || 'shift_start',
          items: (editTemplate.items || []).map(i => {
            if (typeof i === 'string') return { text: i, checkType: 'yes_no' }
            return { text: i.text || '', checkType: i.check_type || i.checkType || 'yes_no' }
          }),
        }
      : { name: '', description: '', category: '', trigger: 'shift_start', items: [{ text: '', checkType: 'yes_no' }] }
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

  const addItem = () => setForm({ ...form, items: [...form.items, { text: '', checkType: 'yes_no' }] })
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })
  const updateItem = (idx, field, val) => setForm({
    ...form,
    items: form.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-2">{isEdit ? 'Editeaza checklist' : 'Checklist nou'}</h3>

        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
          Un checklist este o lista de verificari pe care operatorul le completeaza la inceputul turului, la schimbarea produsului sau periodic. Definiti punctele pe care operatorul trebuie sa le verifice.
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nume checklist *</label>
            <input className="input" placeholder="Ex: Verificare zilnica CNC" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descriere</label>
            <input className="input" placeholder="Descrierea scopului checklistului" value={form.description} onChange={f('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categorie</label>
              <input className="input" placeholder="Ex: Calitate, Siguranta, Mentenanta" value={form.category} onChange={f('category')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cand se completeaza</label>
              <select className="input" value={form.trigger} onChange={f('trigger')}>
                {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Ce trebuie sa verifice operatorul?</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Adauga punct</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1 space-y-1">
                    <input
                      className="input w-full"
                      placeholder={CHECKLIST_PLACEHOLDERS[idx % CHECKLIST_PLACEHOLDERS.length]}
                      value={item.text}
                      onChange={e => updateItem(idx, 'text', e.target.value)}
                    />
                    <select
                      className="input w-full text-xs"
                      value={item.checkType}
                      onChange={e => updateItem(idx, 'checkType', e.target.value)}
                    >
                      {CHECK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 mt-2"><X size={16} /></button>
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
              trigger: form.trigger,
              items: form.items.filter(i => i.text.trim()).map(i => typeof i === 'object' ? i.text : i),
            })}
            disabled={mutation.isPending || !form.name || form.items.filter(i => i.text.trim()).length === 0}
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
  const [selectedCompletion, setSelectedCompletion] = useState(null)
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
          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-700">
            <strong>Scopul acestei pagini:</strong> Definiti sabloane de verificare pe care operatorii le completeaza la inceputul turelor, la schimbarea produsului sau la inspectii periodice. Fiecare sablon contine o lista de puncte de verificat.
          </div>
          {isLoading && <p className="text-slate-400 text-sm">Se incarca...</p>}
          {templates?.map(t => {
            const triggerLabel = TRIGGER_OPTIONS.find(o => o.value === t.trigger)?.label || '—'
            return (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div className="cursor-pointer flex-1" onClick={() => setSelectedTemplate(t)}>
                  <h4 className="font-medium text-slate-800">{t.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {t.category && (
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.category}</span>
                    )}
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{t.items?.length ?? 0} puncte</span>
                    <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{triggerLabel}</span>
                    {!t.is_active && <span className="text-[11px] bg-red-50 text-red-400 px-2 py-0.5 rounded-full">Inactiv</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTemplate(t)} className="btn-secondary text-xs">
                    Detalii
                  </button>
                </div>
              </div>
            )
          })}
          {templates?.length === 0 && <p className="text-slate-400 text-sm">Niciun template.</p>}
        </div>
      )}

      {tab === 'completions' && (
        <>
        <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-700">
          <strong>Scopul acestei pagini:</strong> Istoricul completarilor de checklist-uri de catre operatori. Verificati ca toate punctele sunt bifate si identificati problemele raportate.
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Completat de</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Masina</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Tura</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rezultat</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completions?.data?.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedCompletion(selectedCompletion === c.id ? null : c.id)}>
                  <td className="px-4 py-3 text-slate-700">{c.completed_by_name || c.user_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{c.machine_code || c.machine_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{c.shift || '—'}</td>
                  <td className="px-4 py-3">
                    {c.all_ok
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={13} /> Toate OK</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={13} /> Probleme gasite</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{new Date(c.completed_at).toLocaleString('ro-RO')}</td>
                </tr>
              ))}
              {completions?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio completare.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      {createModal && <TemplateModal onClose={() => setCreateModal(false)} />}
      {selectedTemplate && <TemplateDetail template={selectedTemplate} machines={machines} onClose={() => setSelectedTemplate(null)} />}
    </div>
  )
}
