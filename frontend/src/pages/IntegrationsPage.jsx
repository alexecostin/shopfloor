import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  Cable, FileSpreadsheet, Webhook, ScrollText, Plus, X, Download,
  Trash2, Pencil, Play, ToggleLeft, ToggleRight, CheckCircle2,
  XCircle, Clock, Send
} from 'lucide-react'

const TABS = [
  { key: 'export', label: 'Export', icon: FileSpreadsheet },
  { key: 'webhooks', label: 'Webhooks', icon: Webhook },
  { key: 'log', label: 'Log activitate', icon: ScrollText },
]

const TARGET_SYSTEMS = [
  { value: 'saga', label: 'Saga' },
  { value: 'winmentor', label: 'WinMentor' },
  { value: 'sap', label: 'SAP' },
  { value: 'generic', label: 'Generic' },
]

const DATA_SOURCES = [
  { value: 'receipts', label: 'Receptii' },
  { value: 'shipments', label: 'Expeditii' },
  { value: 'movements', label: 'Miscari stoc' },
  { value: 'production', label: 'Productie' },
  { value: 'inventory', label: 'Inventar' },
]

const FILE_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'XLSX' },
  { value: 'xml', label: 'XML' },
]

const EVENT_TYPES = [
  { value: 'receipt.confirmed', label: 'Receptie confirmata' },
  { value: 'shipment.dispatched', label: 'Expeditie trimisa' },
  { value: 'po.created', label: 'Comanda achizitie creata' },
  { value: 'order.completed', label: 'Comanda finalizata' },
  { value: 'alert.triggered', label: 'Alerta declansata' },
]

function StatusBadge({ status }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 size={12} /> Complet
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <XCircle size={12} /> Eroare
    </span>
  )
}

function HttpStatusBadge({ code }) {
  if (!code) return <span className="text-xs text-slate-400">-</span>
  const ok = code >= 200 && code < 300
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {code}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TEMPLATE MODAL
// ════════════════════════════════════════════════════════════════════════

const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'Fara transformare' },
  { value: 'uppercase', label: 'Majuscule' },
  { value: 'lowercase', label: 'Minuscule' },
  { value: 'date_ro', label: 'Data (RO)' },
  { value: 'number', label: 'Numar' },
  { value: 'trim', label: 'Trim spatii' },
]

function parseColumnConfig(cfg) {
  if (Array.isArray(cfg)) return cfg
  if (typeof cfg === 'string') { try { const p = JSON.parse(cfg); if (Array.isArray(p)) return p } catch { /* ignore */ } }
  return []
}

function TemplateModal({ template, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!template
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    target_system: template?.target_system || 'generic',
    data_source: template?.data_source || 'receipts',
    file_format: template?.file_format || 'csv',
    delimiter: template?.delimiter || ',',
  })
  const [columns, setColumns] = useState(() => parseColumnConfig(template?.column_config))
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function addColumn() {
    setColumns(c => [...c, { sourceField: '', targetColumn: '', transform: 'none' }])
  }
  function removeColumn(idx) {
    setColumns(c => c.filter((_, i) => i !== idx))
  }
  function updateColumn(idx, field, val) {
    setColumns(c => c.map((col, i) => i === idx ? { ...col, [field]: val } : col))
  }

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/integrations/templates/${template.id}`, data)
      : api.post('/integrations/templates', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-templates'] })
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

  function submit() {
    if (!form.name.trim()) return toast.error('Numele este obligatoriu.')
    mutation.mutate({ ...form, column_config: columns })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={18} /> {isEdit ? 'Editeaza template' : 'Template nou'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nume *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Ex: Saga NIR Export" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
            <textarea className="input" rows={2} value={form.description} onChange={f('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sistem tinta</label>
              <select className="input" value={form.target_system} onChange={f('target_system')}>
                {TARGET_SYSTEMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Sursa date</label>
              <select className="input" value={form.data_source} onChange={f('data_source')}>
                {DATA_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Format fisier</label>
              <select className="input" value={form.file_format} onChange={f('file_format')}>
                {FILE_FORMATS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Delimiter</label>
              <input className="input" value={form.delimiter} onChange={f('delimiter')} maxLength={5} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Configuratie coloane</label>
              <button type="button" onClick={addColumn} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus size={12} /> Adauga coloana
              </button>
            </div>
            <div className="space-y-2">
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <input
                    className="input flex-1 text-xs"
                    placeholder="Camp sursa"
                    value={col.sourceField || ''}
                    onChange={e => updateColumn(idx, 'sourceField', e.target.value)}
                  />
                  <input
                    className="input flex-1 text-xs"
                    placeholder="Coloana tinta"
                    value={col.targetColumn || ''}
                    onChange={e => updateColumn(idx, 'targetColumn', e.target.value)}
                  />
                  <select
                    className="input w-36 text-xs"
                    value={col.transform || 'none'}
                    onChange={e => updateColumn(idx, 'transform', e.target.value)}
                  >
                    {TRANSFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeColumn(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {columns.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Nicio coloana definita. Adaugati coloane.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : (isEdit ? 'Salveaza' : 'Creeaza')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT DATE RANGE MODAL
// ════════════════════════════════════════════════════════════════════════

function ExportModal({ template, onClose }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(monthAgo)
  const [dateTo, setDateTo] = useState(today)

  const mutation = useMutation({
    mutationFn: (body) => api.post('/integrations/export', body),
    onSuccess: (res) => {
      const result = res.data
      qc.invalidateQueries({ queryKey: ['integration-export-logs'] })
      // Download CSV
      if (result.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${template.name.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast.success(`Export finalizat: ${result.rowCount} randuri`)
      onClose()
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la export. Incercati din nou.'); },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Download size={18} /> Export: {template.name}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">De la</label>
            <input className="input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Pana la</label>
            <input className="input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate({ templateId: template.id, dateFrom, dateTo })}
            disabled={mutation.isPending}
            className="btn-primary flex items-center gap-1"
          >
            <Download size={14} /> {mutation.isPending ? 'Se exporta...' : 'Exporta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// WEBHOOK MODAL
// ════════════════════════════════════════════════════════════════════════

function WebhookModal({ webhook, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!webhook
  const [form, setForm] = useState({
    name: webhook?.name || '',
    event_type: webhook?.event_type || 'receipt.confirmed',
    target_url: webhook?.target_url || '',
    secret: webhook?.secret || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/integrations/webhooks/${webhook.id}`, data)
      : api.post('/integrations/webhooks', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success(isEdit ? 'Webhook actualizat.' : 'Webhook creat.')
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

  function submit() {
    if (!form.name.trim()) return toast.error('Numele este obligatoriu.')
    if (!form.target_url.trim()) return toast.error('URL-ul tinta este obligatoriu.')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Webhook size={18} /> {isEdit ? 'Editeaza webhook' : 'Webhook nou'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nume *</label>
            <input className="input" value={form.name} onChange={f('name')} placeholder="Ex: Notificare ERP" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip eveniment</label>
            <select className="input" value={form.event_type} onChange={f('event_type')}>
              {EVENT_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">URL tinta *</label>
            <input className="input" value={form.target_url} onChange={f('target_url')} placeholder="https://erp.example.com/webhook" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Secret (HMAC)</label>
            <input className="input font-mono text-xs" value={form.secret} onChange={f('secret')} placeholder="Se va genera automat daca e gol" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : (isEdit ? 'Salveaza' : 'Creeaza')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// EXPORT TAB
// ════════════════════════════════════════════════════════════════════════

function ExportTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState(null)
  const [exportTemplate, setExportTemplate] = useState(null)

  const { data: templates, isLoading } = useQuery({
    queryKey: ['integration-templates'],
    queryFn: () => api.get('/integrations/templates').then(r => r.data),
  })

  const { data: logsData } = useQuery({
    queryKey: ['integration-export-logs'],
    queryFn: () => api.get('/integrations/export-logs').then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/integrations/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-templates'] })
      toast.success('Template sters.')
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const list = templates || []
  const logs = logsData?.data || []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Template-uri de export pentru sisteme ERP</p>
        <button onClick={() => { setEditTemplate(null); setShowModal(true) }} className="btn-primary flex items-center gap-1">
          <Plus size={14} /> Template nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3">Nume</th>
                <th className="px-4 py-3">Sistem tinta</th>
                <th className="px-4 py-3">Sursa date</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Stare</th>
                <th className="px-4 py-3 text-right">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{t.name}</div>
                    {t.description && <div className="text-xs text-slate-400 mt-0.5">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 uppercase">
                      {t.target_system}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {DATA_SOURCES.find(s => s.value === t.data_source)?.label || t.data_source}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-600">{t.file_format}</td>
                  <td className="px-4 py-3">
                    {t.is_active
                      ? <span className="text-xs text-green-600 font-medium">Activ</span>
                      : <span className="text-xs text-slate-400">Inactiv</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setExportTemplate(t)}
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                        title="Exporta"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => { setEditTemplate(t); setShowModal(true) }}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        title="Editeaza"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Stergi acest template?')) deleteMut.mutate(t.id) }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Sterge"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Niciun template de export.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Export Logs */}
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <ScrollText size={16} /> Istoric exporturi
      </h3>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Perioada</th>
              <th className="px-4 py-3">Randuri</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Eroare</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(l.created_at).toLocaleString('ro-RO')}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{l.template_name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {l.date_from ? new Date(l.date_from).toLocaleDateString('ro-RO') : '-'}
                  {' - '}
                  {l.date_to ? new Date(l.date_to).toLocaleDateString('ro-RO') : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{l.row_count}</td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">{l.error_message || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Niciun export realizat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TemplateModal
          template={editTemplate}
          onClose={() => { setShowModal(false); setEditTemplate(null) }}
        />
      )}
      {exportTemplate && (
        <ExportModal
          template={exportTemplate}
          onClose={() => setExportTemplate(null)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// WEBHOOKS TAB
// ════════════════════════════════════════════════════════════════════════

function WebhooksTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editWebhook, setEditWebhook] = useState(null)

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['integration-webhooks'],
    queryFn: () => api.get('/integrations/webhooks').then(r => r.data),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/integrations/webhooks/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Stare actualizata.')
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const testMut = useMutation({
    mutationFn: (id) => api.post(`/integrations/webhooks/${id}/test`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['integration-webhooks'] })
      const r = res.data
      if (r.success) toast.success(`Test reusit (status: ${r.status})`)
      else toast.error(`Test esuat: ${r.error || `status ${r.status}`}`)
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la test webhook. Verificati URL-ul si incercati din nou.'); },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/integrations/webhooks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Webhook sters.')
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const list = webhooks || []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">Notificari automate catre sisteme externe la evenimente</p>
        <button onClick={() => { setEditWebhook(null); setShowModal(true) }} className="btn-primary flex items-center gap-1">
          <Plus size={14} /> Webhook nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3">Nume</th>
                <th className="px-4 py-3">Eveniment</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Activ</th>
                <th className="px-4 py-3">Ultima declansare</th>
                <th className="px-4 py-3">Ultim status</th>
                <th className="px-4 py-3 text-right">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {list.map(w => (
                <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{w.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                      {EVENT_TYPES.find(e => e.value === w.event_type)?.label || w.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={w.target_url}>
                    {w.target_url}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMut.mutate({ id: w.id, is_active: !w.is_active })}
                      className="text-slate-500 hover:text-slate-700"
                      title={w.is_active ? 'Dezactiveaza' : 'Activeaza'}
                    >
                      {w.is_active
                        ? <ToggleRight size={22} className="text-green-500" />
                        : <ToggleLeft size={22} className="text-slate-300" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {w.last_triggered_at
                      ? <span className="flex items-center gap-1"><Clock size={12} /> {new Date(w.last_triggered_at).toLocaleString('ro-RO')}</span>
                      : '-'
                    }
                  </td>
                  <td className="px-4 py-3">
                    <HttpStatusBadge code={w.last_status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => testMut.mutate(w.id)}
                        disabled={testMut.isPending}
                        className="p-1.5 rounded hover:bg-green-50 text-green-600"
                        title="Test"
                      >
                        <Play size={15} />
                      </button>
                      <button
                        onClick={() => { setEditWebhook(w); setShowModal(true) }}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        title="Editeaza"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Stergi acest webhook?')) deleteMut.mutate(w.id) }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Sterge"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Niciun webhook configurat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <WebhookModal
          webhook={editWebhook}
          onClose={() => { setShowModal(false); setEditWebhook(null) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// LOG TAB (combined)
// ════════════════════════════════════════════════════════════════════════

function LogTab() {
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['integration-export-logs'],
    queryFn: () => api.get('/integrations/export-logs', { params: { limit: 100 } }).then(r => r.data),
  })

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ['integration-webhooks'],
    queryFn: () => api.get('/integrations/webhooks').then(r => r.data),
  })

  const isLoading = logsLoading || webhooksLoading

  // Combine export logs and webhook trigger events into a unified log
  const exportLogs = (logsData?.data || []).map(l => ({
    id: 'e-' + l.id,
    date: l.created_at,
    type: 'export',
    label: `Export: ${l.template_name}`,
    detail: `${l.row_count} randuri (${l.date_from ? new Date(l.date_from).toLocaleDateString('ro-RO') : '?'} - ${l.date_to ? new Date(l.date_to).toLocaleDateString('ro-RO') : '?'})`,
    status: l.status === 'completed' ? 'success' : 'error',
    error: l.error_message,
  }))

  const webhookLogs = (webhooks || [])
    .filter(w => w.last_triggered_at)
    .map(w => ({
      id: 'w-' + w.id,
      date: w.last_triggered_at,
      type: 'webhook',
      label: `Webhook: ${w.name}`,
      detail: `${EVENT_TYPES.find(e => e.value === w.event_type)?.label || w.event_type} -> ${w.target_url}`,
      status: w.last_status >= 200 && w.last_status < 300 ? 'success' : 'error',
      error: w.last_status && (w.last_status < 200 || w.last_status >= 300) ? `HTTP ${w.last_status}` : null,
    }))

  const combined = [...exportLogs, ...webhookLogs].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">Jurnal combinat de exporturi si apeluri webhook</p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Descriere</th>
                <th className="px-4 py-3">Detalii</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Eroare</th>
              </tr>
            </thead>
            <tbody>
              {combined.map(item => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(item.date).toLocaleString('ro-RO')}
                  </td>
                  <td className="px-4 py-3">
                    {item.type === 'export' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <FileSpreadsheet size={12} /> Export
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        <Send size={12} /> Webhook
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{item.label}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{item.detail}</td>
                  <td className="px-4 py-3">
                    {item.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 size={12} /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <XCircle size={12} /> Eroare
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">{item.error || '-'}</td>
                </tr>
              ))}
              {combined.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nicio activitate inregistrata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════

export default function IntegrationsPage() {
  const [tab, setTab] = useState('export')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Cable size={22} /> Integratii ERP
        </h1>
        <p className="text-sm text-slate-400 mt-1">Export date, webhooks si configurari pentru sisteme externe</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {tab === 'export' && <ExportTab />}
      {tab === 'webhooks' && <WebhooksTab />}
      {tab === 'log' && <LogTab />}
    </div>
  )
}
