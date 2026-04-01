import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  FileText, Plus, X, Search, Upload, Link2, Eye,
  File, FileImage, FileSpreadsheet, FileCheck,
  BookOpen, ClipboardList, Award, BarChart3, Settings2, Tag
} from 'lucide-react'

// ── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'drawing', label: 'Desen tehnic', icon: FileImage, color: 'bg-blue-100 text-blue-700' },
  { value: 'procedure', label: 'Procedura', icon: ClipboardList, color: 'bg-purple-100 text-purple-700' },
  { value: 'certificate', label: 'Certificat', icon: Award, color: 'bg-green-100 text-green-700' },
  { value: 'report', label: 'Raport', icon: BarChart3, color: 'bg-amber-100 text-amber-700' },
  { value: 'manual', label: 'Manual', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'other', label: 'Altele', icon: File, color: 'bg-slate-100 text-slate-600' },
]

const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map(t => [t.value, t]))

const REVISION_STATUSES = {
  draft: { label: 'Ciorna', color: 'bg-slate-100 text-slate-600' },
  pending_approval: { label: 'In aprobare', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobat', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Arhivat', color: 'bg-slate-100 text-slate-400' },
}

const ENTITY_TYPES = [
  { value: 'machine', label: 'Masina' },
  { value: 'work_order', label: 'Comanda de lucru' },
  { value: 'product', label: 'Produs' },
  { value: 'tool', label: 'Unealta' },
  { value: 'supplier', label: 'Furnizor' },
  { value: 'maintenance', label: 'Mentenanta' },
  { value: 'quality_plan', label: 'Plan calitate' },
  { value: 'other', label: 'Altele' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const meta = DOC_TYPE_MAP[type] || DOC_TYPE_MAP.other
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const meta = REVISION_STATUSES[status] || { label: status, color: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function formatFileSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ro-RO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function isImageMime(mime) {
  return mime && mime.startsWith('image/')
}

function isPdfMime(mime) {
  return mime === 'application/pdf'
}

// ── New Document Modal ──────────────────────────────────────────────────────

function NewDocumentModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '', document_type: 'drawing', description: '', tagsInput: '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/documents', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Document creat cu succes.')
      onClose()
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'Eroare la creare. Incercati din nou.');
    },
  })

  function submit() {
    if (!form.title.trim()) return toast.error('Titlul este obligatoriu.')
    const tags = form.tagsInput
      ? form.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      : []
    mutation.mutate({
      title: form.title,
      documentType: form.document_type,
      description: form.description,
      tags,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Plus size={18} /> Document nou
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Titlu *</label>
            <input className="input" value={form.title} onChange={f('title')} placeholder="Numele documentului" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip document</label>
            <select className="input" value={form.document_type} onChange={f('document_type')}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descriere</label>
            <textarea className="input" rows={3} value={form.description} onChange={f('description')} placeholder="Descrierea documentului..." />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Etichete (separate prin virgula)</label>
            <input className="input" value={form.tagsInput} onChange={f('tagsInput')} placeholder="ex: calitate, ISO, procedura" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Upload Revision Modal ───────────────────────────────────────────────────

function UploadRevisionModal({ documentId, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [revisionCode, setRevisionCode] = useState('')

  const mutation = useMutation({
    mutationFn: (formData) => api.post(`/documents/${documentId}/revisions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('Revizie incarcata cu succes.')
      onSuccess?.()
      onClose()
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      toast.error(msg || 'Eroare la incarcare. Verificati fisierul si incercati din nou.');
    },
  })

  function submit() {
    if (!file) return toast.error('Selecteaza un fisier.')
    if (!revisionCode.trim()) return toast.error('Codul reviziei este obligatoriu.')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('revisionCode', revisionCode)
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Upload size={18} /> Incarcare revizie noua
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Cod revizie *</label>
            <input className="input" value={revisionCode} onChange={e => setRevisionCode(e.target.value)} placeholder="ex: A, B, 1.0, 1.1" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Fisier *</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && <p className="text-xs text-slate-400 mt-1">{file.name} ({formatFileSize(file.size)})</p>}
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se incarca...' : 'Incarca'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Link Entity Modal ───────────────────────────────────────────────────────

function LinkEntityModal({ documentId, onClose, onSuccess }) {
  const [entityType, setEntityType] = useState('machine')
  const [entityId, setEntityId] = useState('')
  const [linkType, setLinkType] = useState('reference')

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/documents/${documentId}/link`, data),
    onSuccess: () => {
      toast.success('Legatura creata cu succes.')
      onSuccess?.()
      onClose()
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la legare. Incercati din nou.'); },
  })

  function submit() {
    if (!entityId.trim()) return toast.error('ID-ul entitatii este obligatoriu.')
    mutation.mutate({ entityType, entityId, linkType })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Link2 size={18} /> Leaga de entitate
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip entitate</label>
            <select className="input" value={entityType} onChange={e => setEntityType(e.target.value)}>
              {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">ID Entitate *</label>
            <input className="input" value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="UUID-ul entitatii" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Tip legatura</label>
            <select className="input" value={linkType} onChange={e => setLinkType(e.target.value)}>
              <option value="reference">Referinta</option>
              <option value="attachment">Atasament</option>
              <option value="specification">Specificatie</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Se leaga...' : 'Leaga'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Document Detail Modal ───────────────────────────────────────────────────

function DocumentDetailModal({ documentId, onClose }) {
  const [showUpload, setShowUpload] = useState(false)
  const [showLink, setShowLink] = useState(false)

  const { data: doc, isLoading, refetch } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api.get(`/documents/${documentId}`).then(r => r.data),
    enabled: !!documentId,
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
        <p className="text-slate-400 text-sm">Se incarca...</p>
      </div>
    </div>
  )

  if (!doc) return null

  const tags = Array.isArray(doc.tags) ? doc.tags : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText size={18} /> {doc.title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Info */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <TypeBadge type={doc.document_type} />
            {doc.current_revision_id && doc.revisions?.length > 0 && (
              <span className="text-xs text-slate-500">
                Rev. {doc.revisions.find(r => r.id === doc.current_revision_id)?.revision_code || '-'}
              </span>
            )}
          </div>
          {doc.description && (
            <p className="text-sm text-slate-600 mb-2">{doc.description}</p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* File Preview */}
        {doc.revisions?.length > 0 && (() => {
          const current = doc.revisions.find(r => r.id === doc.current_revision_id) || doc.revisions[0]
          if (isImageMime(current.mime_type) && current.file_path) {
            return (
              <div className="mb-5 border border-slate-200 rounded-lg overflow-hidden">
                <img
                  src={`/${current.file_path}`}
                  alt={current.file_name}
                  className="max-w-full max-h-64 object-contain mx-auto"
                />
              </div>
            )
          }
          if (isPdfMime(current.mime_type) && current.file_path) {
            return (
              <div className="mb-5">
                <a
                  href={`/${current.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <FileText size={14} /> Deschide PDF: {current.file_name}
                </a>
              </div>
            )
          }
          return null
        })()}

        {/* Revisions */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <FileCheck size={14} /> Revizii ({doc.revisions?.length || 0})
            </h4>
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Upload size={12} /> Revizie noua
            </button>
          </div>
          {doc.revisions?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">Cod</th>
                    <th className="pb-2 pr-3">Fisier</th>
                    <th className="pb-2 pr-3">Dimensiune</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Data</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {doc.revisions.map(rev => (
                    <tr
                      key={rev.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 ${
                        rev.id === doc.current_revision_id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="py-1.5 pr-3 font-medium">
                        {rev.revision_code}
                        {rev.id === doc.current_revision_id && (
                          <span className="ml-1 text-[10px] text-blue-600">(curent)</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-600">
                        {rev.file_path ? (
                          <a
                            href={`/${rev.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {rev.file_name || 'Descarca'}
                          </a>
                        ) : (
                          rev.file_name || '-'
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-400">{formatFileSize(rev.file_size)}</td>
                      <td className="py-1.5 pr-3"><StatusBadge status={rev.status} /></td>
                      <td className="py-1.5 text-slate-400">{formatDate(rev.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nicio revizie incarcata.</p>
          )}
        </div>

        {/* Linked Entities */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <Link2 size={14} /> Entitati legate ({doc.links?.length || 0})
            </h4>
            <button
              onClick={() => setShowLink(true)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus size={12} /> Leaga de entitate
            </button>
          </div>
          {doc.links?.length > 0 ? (
            <div className="space-y-1">
              {doc.links.map(link => (
                <div key={link.id} className="flex items-center gap-2 text-xs p-2 bg-slate-50 rounded">
                  <Link2 size={12} className="text-slate-400" />
                  <span className="font-medium text-slate-600 capitalize">
                    {ENTITY_TYPES.find(et => et.value === link.entity_type)?.label || link.entity_type}
                  </span>
                  <span className="text-slate-400 font-mono">{link.entity_id.substring(0, 8)}...</span>
                  <span className="ml-auto text-slate-400">{link.link_type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nicio entitate legata.</p>
          )}
        </div>

        <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
          <button onClick={onClose} className="btn-secondary">Inchide</button>
        </div>
      </div>

      {showUpload && (
        <UploadRevisionModal
          documentId={documentId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => refetch()}
        />
      )}
      {showLink && (
        <LinkEntityModal
          documentId={documentId}
          onClose={() => setShowLink(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  )
}

// ── Document Card ───────────────────────────────────────────────────────────

function DocumentCard({ doc, onClick }) {
  const meta = DOC_TYPE_MAP[doc.document_type] || DOC_TYPE_MAP.other
  const Icon = meta.icon

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${meta.color}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{doc.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={doc.document_type} />
            {doc.current_revision_code && (
              <span className="text-xs text-slate-400">Rev. {doc.current_revision_code}</span>
            )}
          </div>
          {doc.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {doc.current_file_name && (
              <span className="flex items-center gap-1">
                <File size={10} /> {doc.current_file_name}
              </span>
            )}
            {doc.current_file_size && (
              <span>{formatFileSize(doc.current_file_size)}</span>
            )}
            <span>{formatDate(doc.updated_at)}</span>
          </div>
          {doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {doc.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-500">
                  {tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[10px] text-slate-400">+{doc.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <button className="text-slate-400 hover:text-blue-600 shrink-0">
          <Eye size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput)
    setPage(1)
  }, [searchInput])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  // List mode (with filters)
  const { data, isLoading } = useQuery({
    queryKey: ['documents', filterType, searchQuery, page],
    queryFn: () => {
      if (searchQuery) {
        return api.get('/documents/search', { params: { q: searchQuery } }).then(r => ({
          data: r.data,
          total: Array.isArray(r.data) ? r.data.length : 0,
          page: 1,
          limit: 50,
        }))
      }
      return api.get('/documents', {
        params: {
          ...(filterType ? { type: filterType } : {}),
          page,
          limit: 25,
        },
      }).then(r => r.data)
    },
  })

  const documents = data?.data || []
  const total = data?.total || 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText size={22} /> Documente
          </h1>
          <p className="text-sm text-slate-400 mt-1">Gestioneaza documentele, reviziile si legaturile cu entitatile</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1">
          <Plus size={16} /> Document nou
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Cauta documente..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button onClick={handleSearch} className="btn-secondary flex items-center gap-1">
          <Search size={14} /> Cauta
        </button>
        <select
          className="input w-48"
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); setSearchQuery(''); setSearchInput('') }}
        >
          <option value="">Toate tipurile</option>
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="text-xs text-slate-400">
          {total} {total === 1 ? 'document' : 'documente'}
        </span>
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : documents.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onClick={() => setSelectedId(doc.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {!searchQuery && data?.limit && total > data.limit && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary text-xs"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Pagina {page} din {Math.ceil(total / data.limit)}
              </span>
              <button
                disabled={page >= Math.ceil(total / data.limit)}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary text-xs"
              >
                Urmator
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">
            {searchQuery ? 'Niciun document gasit pentru aceasta cautare.' : 'Niciun document adaugat inca.'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowNew(true)} className="btn-primary mt-4 inline-flex items-center gap-1">
              <Plus size={14} /> Adauga primul document
            </button>
          )}
        </div>
      )}

      {showNew && <NewDocumentModal onClose={() => setShowNew(false)} />}
      {selectedId && <DocumentDetailModal documentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
