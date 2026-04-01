import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import SearchableSelect from '../components/SearchableSelect'
import {
  Package, Hash, GitBranch, ChevronDown, ChevronRight,
  Plus, Search, ArrowRight, ArrowLeft, Box, FileText, Truck, ShoppingCart
} from 'lucide-react'

const TABS = [
  { key: 'lots', label: 'Loturi', icon: Package },
  { key: 'serials', label: 'Seriale', icon: Hash },
  { key: 'trace', label: 'Trasabilitate', icon: GitBranch },
]

const STATUS_COLORS = {
  active: 'bg-green-50 text-green-700',
  consumed: 'bg-slate-100 text-slate-600',
  expired: 'bg-red-50 text-red-600',
}

// ─── Trace Tree Node ────────────────────────────────────────────────────

const NODE_ICONS = {
  lot: Package,
  report: FileText,
  order: ShoppingCart,
  supplier: Truck,
  serial: Hash,
}

const NODE_COLORS = {
  lot: 'border-blue-400 bg-blue-50',
  report: 'border-amber-400 bg-amber-50',
  order: 'border-green-400 bg-green-50',
  supplier: 'border-purple-400 bg-purple-50',
  serial: 'border-cyan-400 bg-cyan-50',
}

const NODE_LABELS = {
  lot: 'Lot',
  report: 'Raport productie',
  order: 'Comanda',
  supplier: 'Furnizor',
  serial: 'Serial',
}

function TraceNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(true)
  const Icon = NODE_ICONS[node.type] || Box
  const color = NODE_COLORS[node.type] || 'border-slate-300 bg-slate-50'
  const hasChildren = node.children && node.children.length > 0

  const name = node.data?.lot_number || node.data?.serial_number || node.data?.name || node.data?.code || node.data?.id?.substring(0, 8) || '-'
  const date = node.data?.created_at || node.data?.received_date || node.data?.reported_at || null

  return (
    <div className={depth > 0 ? 'ml-6 mt-2' : 'mt-2'}>
      {depth > 0 && (
        <div className="flex items-center mb-1">
          <div className="w-4 border-t border-slate-300" />
          <div className="w-2 h-2 rounded-full bg-slate-300" />
        </div>
      )}
      <div
        className={`border-l-4 rounded-lg p-3 ${color} cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : <div className="w-3.5" />}
          <Icon size={16} />
          <span className="text-xs font-semibold uppercase text-slate-500">{NODE_LABELS[node.type]}</span>
          <span className="font-medium text-sm">{name}</span>
          {node.quantity_used && (
            <span className="ml-2 text-xs bg-white/70 px-2 py-0.5 rounded">Cant: {node.quantity_used}</span>
          )}
          {date && (
            <span className="ml-auto text-xs text-slate-400">{new Date(date).toLocaleDateString('ro-RO')}</span>
          )}
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <TraceNode key={`${child.type}-${child.data?.id || i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Loturi Tab ─────────────────────────────────────────────────────────

function LotDetailModal({ lotId, onClose }) {
  const { data: lotDetail, isLoading } = useQuery({
    queryKey: ['lot-detail', lotId],
    queryFn: () => api.get(`/traceability/lots/${lotId}`).then(r => r.data),
    enabled: !!lotId,
  })

  const lot = lotDetail?.lot || lotDetail || {}
  const usage = lotDetail?.usage || lotDetail?.production_lot_usage || []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">Detalii Lot</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold">X</button>
        </div>

        {isLoading ? (
          <p className="text-slate-400 text-sm">Se incarca...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400">Nr. Lot:</span> <strong className="font-mono">{lot.lot_number}</strong></div>
              <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[lot.status] || ''}`}>{lot.status}</span></div>
              <div><span className="text-slate-400">Cantitate:</span> {lot.quantity} {lot.unit}</div>
              <div><span className="text-slate-400">Ramas:</span> {lot.remaining_quantity} {lot.unit}</div>
              <div><span className="text-slate-400">Articol ID:</span> <span className="text-xs font-mono text-slate-500">{lot.item_id || '-'}</span></div>
              <div><span className="text-slate-400">Furnizor ID:</span> <span className="text-xs font-mono text-slate-500">{lot.supplier_id || '-'}</span></div>
              <div><span className="text-slate-400">Data receptie:</span> {lot.received_date ? new Date(lot.received_date).toLocaleDateString('ro-RO') : '-'}</div>
              <div><span className="text-slate-400">Data expirare:</span> {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('ro-RO') : '-'}</div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Utilizare lot in productie</h4>
              {usage.length === 0 ? (
                <p className="text-sm text-slate-400">Acest lot nu a fost inca folosit in productie.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-2 pr-4">Raport ID</th>
                        <th className="pb-2 pr-4">Cantitate folosita</th>
                        <th className="pb-2 pr-4">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.map((u, i) => (
                        <tr key={u.id || i} className="border-b border-slate-100">
                          <td className="py-2 pr-4 text-xs font-mono text-slate-500">{(u.production_report_id || u.report_id || '-').substring(0, 12)}</td>
                          <td className="py-2 pr-4">{u.quantity_used} {lot.unit || ''}</td>
                          <td className="py-2 pr-4 text-xs text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString('ro-RO') : u.used_at ? new Date(u.used_at).toLocaleDateString('ro-RO') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="btn-secondary">Inchide</button>
        </div>
      </div>
    </div>
  )
}

function LoturiTab() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selectedLotId, setSelectedLotId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['lots', filterStatus, page],
    queryFn: () => api.get('/traceability/lots', { params: { status: filterStatus || undefined, page, limit: 25 } }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body) => api.post('/traceability/lots', body),
    onSuccess: () => {
      toast.success('Lot creat cu succes')
      setShowModal(false)
      qc.invalidateQueries({ queryKey: ['lots'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Acest lot exista deja. Numarul de lot trebuie sa fie unic.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'Eroare la creare lot. Incercati din nou.');
    },
  })

  const lots = data?.data || []
  const total = data?.total || 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="input w-48" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">Toate statusurile</option>
          <option value="active">Activ</option>
          <option value="consumed">Consumat</option>
          <option value="expired">Expirat</option>
        </select>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1 ml-auto">
          <Plus size={14} /> Lot nou
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Nr. Lot</th>
                <th className="pb-2 pr-4">Articol ID</th>
                <th className="pb-2 pr-4">Furnizor ID</th>
                <th className="pb-2 pr-4">Cantitate</th>
                <th className="pb-2 pr-4">Ramas</th>
                <th className="pb-2 pr-4">UM</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Data receptie</th>
                <th className="pb-2">Expira</th>
              </tr>
            </thead>
            <tbody>
              {lots.map(l => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedLotId(l.id)}>
                  <td className="py-2 pr-4 font-mono font-medium">{l.lot_number}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{l.item_id?.substring(0, 8) || '-'}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{l.supplier_id?.substring(0, 8) || '-'}</td>
                  <td className="py-2 pr-4">{l.quantity}</td>
                  <td className="py-2 pr-4">{l.remaining_quantity}</td>
                  <td className="py-2 pr-4">{l.unit}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[l.status] || ''}`}>{l.status}</span>
                  </td>
                  <td className="py-2 pr-4 text-xs">{l.received_date ? new Date(l.received_date).toLocaleDateString('ro-RO') : '-'}</td>
                  <td className="py-2 text-xs">{l.expiry_date ? new Date(l.expiry_date).toLocaleDateString('ro-RO') : '-'}</td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">Niciun lot gasit.</td></tr>
              )}
            </tbody>
          </table>
          {total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {total} loturi</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={lots.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <CreateLotModal onClose={() => setShowModal(false)} onSubmit={d => createMut.mutate(d)} loading={createMut.isPending} />}
      {selectedLotId && <LotDetailModal lotId={selectedLotId} onClose={() => setSelectedLotId(null)} />}
    </div>
  )
}

function CreateLotModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    lot_number: '', item_id: '', supplier_id: '', received_date: '', expiry_date: '', quantity: '', unit: 'buc',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.lot_number) return toast.error('Nr. lot obligatoriu')
    onSubmit({ ...form, quantity: Number(form.quantity) || 0 })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Lot nou</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nr. Lot *</label>
            <input className="input w-full" value={form.lot_number} onChange={e => setForm(f => ({ ...f, lot_number: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Articol</label>
              <SearchableSelect
                endpoint="/inventory/items"
                labelField="name"
                valueField="id"
                placeholder="Cauta articol din inventar..."
                value={form.item_id || null}
                onChange={(id, item) => setForm(f => ({ ...f, item_id: id || '', unit: item?.unit || f.unit }))}
                allowCreate={false}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Furnizor</label>
              <SearchableSelect
                endpoint="/companies"
                filterParams={{ companyType: 'supplier' }}
                labelField="name"
                valueField="id"
                placeholder="Cauta furnizor..."
                value={form.supplier_id || null}
                onChange={(id) => setForm(f => ({ ...f, supplier_id: id || '' }))}
                allowCreate={false}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Cantitate</label>
              <input type="number" className="input w-full" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">UM</label>
              <input className="input w-full" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Data receptie</label>
              <input type="date" className="input w-full" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Data expirare</label>
              <input type="date" className="input w-full" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Seriale Tab ────────────────────────────────────────────────────────

function SerialeTab() {
  const qc = useQueryClient()
  const [showGen, setShowGen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['serials', page],
    queryFn: () => api.get('/traceability/serials', { params: { page, limit: 25 } }).then(r => r.data),
  })

  const genMut = useMutation({
    mutationFn: (body) => api.post('/traceability/serials/generate', body),
    onSuccess: (res) => {
      const count = Array.isArray(res.data) ? res.data.length : 1
      toast.success(`${count} seriale generate`)
      setShowGen(false)
      qc.invalidateQueries({ queryKey: ['serials'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Eroare la generare'),
  })

  const serials = data?.data || []
  const total = data?.total || 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShowGen(true)} className="btn-primary flex items-center gap-1 ml-auto">
          <Plus size={14} /> Genereaza seriale
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Se incarca...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2 pr-4">Serial</th>
                <th className="pb-2 pr-4">Produs ID</th>
                <th className="pb-2 pr-4">Comanda ID</th>
                <th className="pb-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {serials.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-mono font-medium">{s.serial_number}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{s.product_id?.substring(0, 8) || '-'}</td>
                  <td className="py-2 pr-4 text-xs text-slate-400">{s.order_id?.substring(0, 8) || '-'}</td>
                  <td className="py-2 text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString('ro-RO')}</td>
                </tr>
              ))}
              {serials.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Niciun serial generat.</td></tr>
              )}
            </tbody>
          </table>
          {total > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">Total: {total} seriale</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-2 py-1">Anterior</button>
                <span className="text-xs text-slate-500 px-2 py-1">Pag. {page}</span>
                <button disabled={serials.length < 25} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-2 py-1">Urmator</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showGen && <GenerateSerialModal onClose={() => setShowGen(false)} onSubmit={d => genMut.mutate(d)} loading={genMut.isPending} />}
    </div>
  )
}

function GenerateSerialModal({ onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ product_id: '', production_report_id: '', order_id: '', count: 1, format: 'SN' })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.count || form.count < 1) return toast.error('Numar minim: 1')
    onSubmit({ ...form, count: Number(form.count) })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Genereaza numere de serie</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Prefix format</label>
            <input className="input w-full" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} placeholder="SN" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Numar seriale *</label>
            <input type="number" min="1" className="input w-full" value={form.count} onChange={e => setForm(f => ({ ...f, count: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Produs ID</label>
            <input className="input w-full" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Raport productie ID</label>
            <input className="input w-full" value={form.production_report_id} onChange={e => setForm(f => ({ ...f, production_report_id: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Comanda ID</label>
            <input className="input w-full" value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anuleaza</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Se genereaza...' : 'Genereaza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Trasabilitate Tab ──────────────────────────────────────────────────

function TrasabilitateTab() {
  const [mode, setMode] = useState('forward') // forward | backward | serial
  const [searchId, setSearchId] = useState('')
  const [traceResult, setTraceResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleTrace() {
    if (!searchId.trim()) return toast.error('Introdu un ID')
    setLoading(true)
    setTraceResult(null)
    try {
      let res
      if (mode === 'forward') {
        res = await api.get(`/traceability/forward/lot/${searchId.trim()}`)
      } else if (mode === 'backward') {
        res = await api.get(`/traceability/backward/order/${searchId.trim()}`)
      } else {
        res = await api.get(`/traceability/backward/serial/${encodeURIComponent(searchId.trim())}`)
      }
      setTraceResult(res.data)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Eroare la trasabilitate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => { setMode('forward'); setTraceResult(null); setSearchId('') }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${mode === 'forward' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <ArrowRight size={14} /> Forward (Lot)
          </button>
          <button
            onClick={() => { setMode('backward'); setTraceResult(null); setSearchId('') }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l ${mode === 'backward' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <ArrowLeft size={14} /> Backward (Comanda)
          </button>
          <button
            onClick={() => { setMode('serial'); setTraceResult(null); setSearchId('') }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l ${mode === 'serial' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <Hash size={14} /> Serial
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <input
            className="input flex-1"
            placeholder={mode === 'forward' ? 'ID Lot (UUID)' : mode === 'backward' ? 'ID Comanda (UUID)' : 'Numar serial (ex: SN-0000001)'}
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrace()}
          />
          <button onClick={handleTrace} disabled={loading} className="btn-primary flex items-center gap-1">
            <Search size={14} /> {loading ? 'Se cauta...' : 'Traseaza'}
          </button>
        </div>
      </div>

      {traceResult && (
        <div className="border rounded-xl p-4 bg-white">
          <h4 className="text-sm font-semibold text-slate-600 mb-2">
            {mode === 'forward' ? 'Forward Trace: Lot -> Rapoarte -> Comenzi' :
             mode === 'backward' ? 'Backward Trace: Comanda -> Rapoarte -> Loturi -> Furnizori' :
             'Serial Trace: Serial -> Raport -> Loturi -> Furnizori'}
          </h4>
          <TraceNode node={traceResult} />
        </div>
      )}

      {!traceResult && !loading && (
        <div className="text-center py-12 text-slate-400">
          <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {mode === 'forward' ? 'Selecteaza un lot pentru a vedea unde a fost folosit (rapoarte, comenzi).' :
             mode === 'backward' ? 'Selecteaza o comanda pentru a vedea din ce loturi provine.' :
             'Introdu un numar de serie pentru a-i trasa originea.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function TraceabilityPage() {
  const [tab, setTab] = useState('lots')

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
        <GitBranch size={22} /> Trasabilitate
      </h1>
      <p className="text-sm text-slate-500 mb-6">Urmarire loturi, seriale si trasabilitate forward/backward.</p>

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

      {tab === 'lots' && <LoturiTab />}
      {tab === 'serials' && <SerialeTab />}
      {tab === 'trace' && <TrasabilitateTab />}
    </div>
  )
}
