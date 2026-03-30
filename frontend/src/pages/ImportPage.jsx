import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Upload, FileText, Check, AlertTriangle } from 'lucide-react'
import { useLookup } from '../hooks/useLookup'

function fuzzyMatch(input, options) {
  if (!input) return null
  const lower = input.toLowerCase().trim()
  // exact match first
  const exact = options.find(o => o.code === lower || o.display_name?.toLowerCase() === lower)
  if (exact) return exact
  // partial match
  const partial = options.find(o =>
    o.code?.includes(lower) || o.display_name?.toLowerCase().includes(lower) ||
    lower.includes(o.code) || lower.includes(o.display_name?.toLowerCase())
  )
  return partial || null
}

const IMPORT_TYPES = [
  { value: 'orders', label: 'Comenzi' },
  { value: 'customer_requests', label: 'Cereri Client' },
  { value: 'material_receipts', label: 'Receptie Materiale' },
  { value: 'bom', label: 'Produse BOM' },
  { value: 'stock_update', label: 'Update Stoc' },
]

export default function ImportPage() {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importType, setImportType] = useState('orders')
  const [templateId, setTemplateId] = useState('')
  const [importLogId, setImportLogId] = useState(null)
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [detectedColumns, setDetectedColumns] = useState([])
  const [targetFields, setTargetFields] = useState([])
  const [saveTemplate, setSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const { data: templates } = useQuery({
    queryKey: ['import-templates'],
    queryFn: () => api.get('/smart-imports/templates').then(r => r.data),
  })

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('importType', importType)
      if (templateId) fd.append('templateId', templateId)
      if (pasteMode) {
        const blob = new Blob([pasteText], { type: 'text/plain' })
        fd.append('file', blob, 'paste.txt')
      } else {
        fd.append('file', file)
      }
      return api.post('/smart-imports/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: data => {
      setImportLogId(data.importLogId)
      setDetectedColumns(data.detectedColumns || [])
      setTargetFields(data.targetFields || [])
      setMapping(data.suggestedMapping || {})
      setPreview(data.preview || [])
      setStep(2)
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare upload.'),
  })

  const mapMut = useMutation({
    mutationFn: () => api.post(`/smart-imports/${importLogId}/map`, {
      mapping,
      saveAsTemplate: saveTemplate,
      templateName: saveTemplate ? templateName : undefined,
    }).then(r => r.data),
    onSuccess: () => setStep(3),
    onError: e => toast.error(e.response?.data?.message || 'Eroare mapping.'),
  })

  const confirmMut = useMutation({
    mutationFn: () => api.post(`/smart-imports/${importLogId}/confirm`).then(r => r.data),
    onSuccess: data => setResult(data),
    onError: e => toast.error(e.response?.data?.message || 'Eroare import.'),
  })

  function reset() {
    setStep(1); setFile(null); setPasteText(''); setImportLogId(null)
    setMapping({}); setPreview([]); setDetectedColumns([]); setResult(null)
    setSaveTemplate(false); setTemplateName('')
  }

  const templateList = templates?.data || templates || []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Import Date</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {[{ n: 1, label: 'Upload' }, { n: 2, label: 'Mapping' }, { n: 3, label: 'Confirmare' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${step > n ? 'bg-green-500 text-white' : step === n ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {step > n ? <Check size={14} /> : n}
            </div>
            <span className={`text-sm ${step === n ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>{label}</span>
            {n < 3 && <div className="w-8 h-px bg-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-40">
              <label className="text-xs text-slate-500 block mb-1">Tip Import</label>
              <select className="input" value={importType} onChange={e => setImportType(e.target.value)}>
                {IMPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {templateList.length > 0 && (
              <div className="flex-1 min-w-40">
                <label className="text-xs text-slate-500 block mb-1">Template (optional)</label>
                <select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                  <option value="">Fara template</option>
                  {templateList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPasteMode(false)} className={`text-xs px-3 py-1.5 rounded ${!pasteMode ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>Fisier</button>
            <button onClick={() => setPasteMode(true)} className={`text-xs px-3 py-1.5 rounded ${pasteMode ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>Lipeste text</button>
          </div>

          {!pasteMode ? (
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
            >
              <Upload size={32} className="mx-auto mb-2 text-slate-400" />
              {file
                ? <p className="text-sm font-medium text-slate-700"><FileText size={14} className="inline mr-1" />{file.name}</p>
                : <p className="text-sm text-slate-400">Trage fisierul aici sau click pentru selectare</p>}
              <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
            </div>
          ) : (
            <textarea
              className="input w-full text-xs font-mono"
              rows={8}
              placeholder="Lipeste datele CSV / TSV aici..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
          )}

          <div className="flex justify-end">
            <button
              onClick={() => uploadMut.mutate()}
              disabled={uploadMut.isPending || (!file && !pasteText)}
              className="btn-primary"
            >
              {uploadMut.isPending ? 'Se incarca...' : 'Urmatorul'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Mapeaza coloanele</h3>
          <div className="space-y-2">
            {detectedColumns.map(col => (
              <div key={col} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-40 font-mono truncate">{col}</span>
                <span className="text-slate-400">→</span>
                <select
                  className="input flex-1"
                  value={mapping[col] || ''}
                  onChange={e => setMapping({ ...mapping, [col]: e.target.value })}
                >
                  <option value="">Ignora</option>
                  {targetFields.map(f => <option key={f.key || f} value={f.key || f}>{f.label || f}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Fuzzy match warnings for lookup columns */}
          {preview.length > 0 && targetFields.length > 0 && (() => {
            const warnings = []
            const lookupFields = targetFields.filter(f => f.lookupType)
            // Check preview rows for unmatched lookup values
            for (const field of lookupFields) {
              const col = Object.entries(mapping).find(([, v]) => v === (field.key || field))?.[0]
              if (!col) continue
              for (const row of preview.slice(0, 5)) {
                const val = row[col]
                if (!val) continue
                const match = fuzzyMatch(String(val), field.lookupValues || [])
                if (!match) {
                  warnings.push({ col, value: val, field: field.label || field.key })
                } else if (match.code !== String(val).toLowerCase().trim() && match.display_name?.toLowerCase() !== String(val).toLowerCase().trim()) {
                  warnings.push({ col, value: val, field: field.label || field.key, suggestion: match.display_name || match.code })
                }
              }
            }
            if (warnings.length === 0) return null
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Valori necunoscute in lookup-uri:</p>
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    Coloana "{w.col}" → camp "{w.field}": valoare "{w.value}"
                    {w.suggestion ? <span className="font-medium"> — poate ati vrut: "{w.suggestion}"?</span> : ' — fara potrivire gasita'}
                  </p>
                ))}
              </div>
            )
          })()}

          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Preview (primele 5 randuri)</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border border-slate-200 rounded">
                  <thead className="bg-slate-50">
                    <tr>{detectedColumns.map(c => <th key={c} className="px-2 py-1.5 text-left font-medium text-slate-600 border-b">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {detectedColumns.map(c => <td key={c} className="px-2 py-1.5 text-slate-600">{row[c] ?? '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} />
              Salveaza ca template
            </label>
            {saveTemplate && (
              <input className="input w-48" placeholder="Nume template" value={templateName} onChange={e => setTemplateName(e.target.value)} />
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setStep(1)} className="btn-secondary">Inapoi</button>
            <button onClick={() => mapMut.mutate()} disabled={mapMut.isPending} className="btn-primary">
              {mapMut.isPending ? 'Se mapeaza...' : 'Urmatorul'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 max-w-sm">
          {!result ? (
            <>
              <div className="text-center py-4">
                <FileText size={48} className="mx-auto mb-3 text-blue-400" />
                <p className="text-slate-700 font-medium mb-1">Gata pentru import</p>
                <p className="text-sm text-slate-400">Verifica setarile si apasa Importa.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setStep(2)} className="btn-secondary">Inapoi</button>
                <button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending} className="btn-primary">
                  {confirmMut.isPending ? 'Se importa...' : 'Importa'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <Check size={48} className="mx-auto text-green-500" />
              <p className="font-semibold text-slate-800">Import finalizat</p>
              <div className="flex gap-4 justify-center">
                <div className="bg-green-50 rounded-lg px-4 py-2">
                  <p className="text-xs text-green-500">Importate</p>
                  <p className="text-xl font-bold text-green-700">{result.imported ?? 0}</p>
                </div>
                <div className="bg-red-50 rounded-lg px-4 py-2">
                  <p className="text-xs text-red-500">Erori</p>
                  <p className="text-xl font-bold text-red-700">{result.errors ?? 0}</p>
                </div>
              </div>
              {result.errorDetails?.length > 0 && (
                <div className="text-left bg-red-50 rounded-lg p-3 text-xs text-red-700 max-h-32 overflow-y-auto">
                  {result.errorDetails.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <button onClick={reset} className="btn-primary w-full">Import Nou</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
