import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { QrCode, Tag, Printer, Check, RefreshCw } from 'lucide-react'

const ENTITY_TYPES = [
  { value: 'machine', label: 'Masini', endpoint: '/machines' },
  { value: 'tool', label: 'Scule', endpoint: '/tools' },
  { value: 'inventory_item', label: 'Articole inventar', endpoint: '/inventory/items' },
  { value: 'product', label: 'Produse', endpoint: '/bom/products' },
]

const TABS = [
  { key: 'list', label: 'Coduri', icon: QrCode },
  { key: 'generate', label: 'Genereaza', icon: Tag },
  { key: 'labels', label: 'Etichete', icon: Printer },
]

function CoduriTab() {
  const [filterType, setFilterType] = useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['barcodes', filterType],
    queryFn: () => api.get('/barcodes', { params: filterType ? { entityType: filterType } : {} }).then(r => r.data),
  })

  return (
    <div>
      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Filtreaza dupa tip entitate</label>
          <select className="input w-48" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Toate tipurile</option>
            {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={() => refetch()} className="btn-secondary flex items-center gap-1">
          <RefreshCw size={14} /> Reincarca
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Cod</th>
                <th className="pb-2 pr-4">Tip</th>
                <th className="pb-2 pr-4">Entitate</th>
                <th className="pb-2 pr-4">Eticheta</th>
                <th className="pb-2 pr-4">Format</th>
                <th className="pb-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map(b => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-mono text-xs">{b.barcode_value}</td>
                  <td className="py-2 pr-4">{b.entity_type}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{b.entity_id?.substring(0, 8)}...</td>
                  <td className="py-2 pr-4">{b.label || '-'}</td>
                  <td className="py-2 pr-4">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs uppercase">{b.barcode_type}</span>
                  </td>
                  <td className="py-2 text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString('ro-RO')}</td>
                </tr>
              ))}
              {(data?.data || []).length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Niciun cod generat.</td></tr>
              )}
            </tbody>
          </table>
          {data?.total > 0 && (
            <p className="text-xs text-slate-400 mt-2">Total: {data.total} coduri</p>
          )}
        </div>
      )}
    </div>
  )
}

function GenereazaTab() {
  const qc = useQueryClient()
  const [entityType, setEntityType] = useState('')
  const [selected, setSelected] = useState([])

  const endpoint = ENTITY_TYPES.find(t => t.value === entityType)?.endpoint
  const { data: entities, isLoading } = useQuery({
    queryKey: ['barcode-entities', entityType],
    queryFn: () => api.get(endpoint).then(r => {
      const d = r.data
      return Array.isArray(d) ? d : (d.data || d.items || d.rows || [])
    }),
    enabled: !!endpoint,
  })

  const mutation = useMutation({
    mutationFn: (items) => api.post('/barcodes/generate-batch', { entityType, items }),
    onSuccess: (res) => {
      const count = Array.isArray(res.data) ? res.data.length : 1
      toast.success(`${count} coduri generate.`)
      setSelected([])
      qc.invalidateQueries(['barcodes'])
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Codurile pentru entitatile selectate exista deja.');
      else toast.error(msg || 'Eroare la generare. Incercati din nou.');
    },
  })

  function toggleItem(id, label) {
    setSelected(prev => prev.find(s => s.entityId === id)
      ? prev.filter(s => s.entityId !== id)
      : [...prev, { entityId: id, label }]
    )
  }

  function handleGenerate() {
    if (!selected.length) return toast.error('Selecteaza cel putin un element.')
    mutation.mutate(selected)
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm text-slate-600 mb-1">Tip entitate</label>
        <select className="input w-64" value={entityType} onChange={e => { setEntityType(e.target.value); setSelected([]) }}>
          <option value="">-- Alege --</option>
          {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {entityType && isLoading && <p className="text-slate-400 text-sm">Se incarca lista...</p>}

      {entityType && entities && (
        <>
          <div className="border rounded-lg divide-y max-h-80 overflow-y-auto mb-4">
            {entities.map(e => {
              const id = e.id
              const label = e.name || e.code || e.title || id
              const isSelected = selected.find(s => s.entityId === id)
              return (
                <label key={id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                  <input type="checkbox" checked={!!isSelected} onChange={() => toggleItem(id, label)} className="accent-blue-600" />
                  <span className="text-sm">{label}</span>
                  <span className="text-xs text-slate-400 ml-auto font-mono">{id?.substring(0, 8)}</span>
                </label>
              )
            })}
            {entities.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Nicio entitate gasita.</p>
            )}
          </div>

          <button onClick={handleGenerate} disabled={!selected.length || mutation.isPending} className="btn-primary flex items-center gap-2">
            <QrCode size={16} />
            {mutation.isPending ? 'Se genereaza...' : `Genereaza QR (${selected.length})`}
          </button>
        </>
      )}
    </div>
  )
}

function EticheteTab() {
  const [filterType, setFilterType] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['barcodes', filterType],
    queryFn: () => api.get('/barcodes', { params: filterType ? { entityType: filterType } : {} }).then(r => r.data),
  })

  const barcodes = data?.data || []

  function toggleId(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAll() {
    if (selectedIds.length === barcodes.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(barcodes.map(b => b.id))
    }
  }

  function handleDownloadPdf() {
    toast('Generare PDF etichete - disponibil in curand.', { icon: 'info' })
  }

  const selectedBarcodes = barcodes.filter(b => selectedIds.includes(b.id))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="input w-48" value={filterType} onChange={e => { setFilterType(e.target.value); setSelectedIds([]) }}>
          <option value="">Toate tipurile</option>
          {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {barcodes.length > 0 && (
          <button onClick={selectAll} className="btn-secondary text-sm">
            {selectedIds.length === barcodes.length ? 'Deselecteaza tot' : 'Selecteaza tot'}
          </button>
        )}
        <button onClick={handleDownloadPdf} disabled={!selectedIds.length} className="btn-primary flex items-center gap-1 ml-auto">
          <Printer size={14} /> Descarca PDF ({selectedIds.length})
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <>
          <div className="border rounded-lg divide-y max-h-60 overflow-y-auto mb-6">
            {barcodes.map(b => (
              <label key={b.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 ${selectedIds.includes(b.id) ? 'bg-blue-50' : ''}`}>
                <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggleId(b.id)} className="accent-blue-600" />
                <span className="font-mono text-xs">{b.barcode_value}</span>
                <span className="text-sm text-slate-600">{b.label || b.entity_type}</span>
                <span className="text-xs text-slate-400 ml-auto uppercase">{b.barcode_type}</span>
              </label>
            ))}
            {barcodes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Niciun cod generat. Mergi la tab-ul Genereaza.</p>
            )}
          </div>

          {selectedBarcodes.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Previzualizare etichete ({selectedBarcodes.length})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {selectedBarcodes.map(b => (
                  <div key={b.id} className="border rounded-lg p-3 text-center bg-white">
                    <div className="w-16 h-16 mx-auto mb-2 bg-slate-100 rounded flex items-center justify-center">
                      <QrCode size={32} className="text-slate-400" />
                    </div>
                    <p className="font-mono text-xs truncate">{b.barcode_value}</p>
                    <p className="text-xs text-slate-500 truncate">{b.label || b.entity_type}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function BarcodesPage() {
  const [tab, setTab] = useState('list')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <QrCode size={22} /> Coduri QR / Barcode
      </h1>
      <p className="text-sm text-slate-500 mb-6">Genereaza si gestioneaza coduri QR si etichete pentru entitati.</p>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && <CoduriTab />}
      {tab === 'generate' && <GenereazaTab />}
      {tab === 'labels' && <EticheteTab />}
    </div>
  )
}
