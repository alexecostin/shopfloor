import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { RefreshCw, Play, CheckCircle, XCircle, ChevronDown, X } from 'lucide-react'

const STATUS_LABELS = {
  pending: 'In asteptare',
  planned: 'Planificat',
  in_progress: 'In lucru',
  completed: 'Finalizat',
  scrapped: 'Casat',
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  scrapped: 'bg-red-100 text-red-700',
}

function StatCard({ label, value, suffix = '', color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}{suffix}</p>
    </div>
  )
}

function DetailModal({ item, machines, onClose }) {
  const qc = useQueryClient()
  const [targetMachineId, setTargetMachineId] = useState(item.target_machine_id || '')
  const [completeForm, setCompleteForm] = useState({ reworkGood: 0, reworkScrapped: 0, notes: item.notes || '' })
  const [showComplete, setShowComplete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data) => api.put(`/production/rework/${item.id}`, data),
    onSuccess: () => { qc.invalidateQueries(['rework-queue']); toast.success('Actualizat.'); },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const startMutation = useMutation({
    mutationFn: () => api.post(`/production/rework/${item.id}/start`),
    onSuccess: () => { qc.invalidateQueries(['rework-queue']); toast.success('Reprelucrare inceputa.'); },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const completeMutation = useMutation({
    mutationFn: (data) => api.post(`/production/rework/${item.id}/complete`, data),
    onSuccess: () => { qc.invalidateQueries(['rework-queue']); qc.invalidateQueries(['rework-stats']); toast.success('Reprelucrare finalizata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const isDone = item.status === 'completed' || item.status === 'scrapped'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <RefreshCw size={16} /> Detalii reprelucrare
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Produs</p>
              <p className="font-medium text-slate-800">{item.product_name || '—'}</p>
              {item.product_reference && <p className="text-xs text-slate-500">{item.product_reference}</p>}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Cantitate reprelucrare</p>
              <p className="font-medium text-slate-800">{item.rework_qty}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Motiv</p>
              <p className="font-medium text-slate-800">{item.rework_reason || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Status</p>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-500'}`}>
                {STATUS_LABELS[item.status] || item.status}
              </span>
            </div>
          </div>

          {/* Assign target machine */}
          {!isDone && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Masina destinatie</label>
              <p className="text-[11px] text-slate-400 mb-1">Selecteaza masina pe care se va face reprelucrarea</p>
              <div className="flex gap-2">
                <select className="input flex-1" value={targetMachineId} onChange={e => setTargetMachineId(e.target.value)}>
                  <option value="">Selecteaza masina...</option>
                  {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
                <button
                  onClick={() => updateMutation.mutate({ targetMachineId })}
                  disabled={!targetMachineId || updateMutation.isPending}
                  className="btn-primary text-xs px-3"
                >
                  Atribuie
                </button>
              </div>
            </div>
          )}

          {/* Start rework */}
          {!isDone && item.status !== 'in_progress' && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Play size={15} /> {startMutation.isPending ? 'Se porneste...' : 'Incepe reprelucrarea'}
            </button>
          )}

          {/* Complete rework */}
          {!isDone && (
            <>
              {!showComplete ? (
                <button
                  onClick={() => setShowComplete(true)}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  <CheckCircle size={15} /> Finalizeaza reprelucrarea
                </button>
              ) : (
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-3">
                  <h4 className="text-sm font-medium text-green-800">Finalizeaza reprelucrare</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Piese bune recuperate</label>
                      <input
                        type="number" min={0} max={item.rework_qty} className="input"
                        value={completeForm.reworkGood}
                        onChange={e => setCompleteForm({ ...completeForm, reworkGood: +e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Piese scrap definitiv</label>
                      <input
                        type="number" min={0} max={item.rework_qty} className="input"
                        value={completeForm.reworkScrapped}
                        onChange={e => setCompleteForm({ ...completeForm, reworkScrapped: +e.target.value })}
                      />
                    </div>
                  </div>
                  <textarea
                    className="input resize-none w-full" rows={2} placeholder="Observatii"
                    value={completeForm.notes}
                    onChange={e => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowComplete(false)} className="btn-secondary text-xs">Anuleaza</button>
                    <button
                      onClick={() => completeMutation.mutate(completeForm)}
                      disabled={completeMutation.isPending || (completeForm.reworkGood + completeForm.reworkScrapped === 0)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {completeMutation.isPending ? 'Se salveaza...' : 'Confirma'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Completed info */}
          {isDone && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Piese recuperate</p>
                <p className="font-bold text-green-700">{item.rework_good}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Piese casate</p>
                <p className="font-bold text-red-600">{item.rework_scrapped}</p>
              </div>
            </div>
          )}

          {item.notes && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400">Observatii</p>
              <p className="text-slate-700">{item.notes}</p>
            </div>
          )}

          {item.created_at && (
            <div className="text-xs text-slate-400 pt-2">
              Creat la: {new Date(item.created_at).toLocaleString('ro-RO')}
              {item.started_at && <> | Inceput: {new Date(item.started_at).toLocaleString('ro-RO')}</>}
              {item.completed_at && <> | Finalizat: {new Date(item.completed_at).toLocaleString('ro-RO')}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReworkPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  const { data: queue, isLoading } = useQuery({
    queryKey: ['rework-queue', statusFilter],
    queryFn: () => api.get('/production/rework', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['rework-stats'],
    queryFn: () => api.get('/production/rework/stats').then(r => r.data),
  })

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get('/machines').then(r => r.data.data),
  })

  const items = queue?.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <RefreshCw size={20} /> Reprelucrare
        </h2>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Rata rebuturi" value={stats.scrapRate} suffix="%" color="text-red-600" />
          <StatCard label="Rata reprelucrare" value={stats.reworkRate} suffix="%" color="text-orange-600" />
          <StatCard label="Rata recuperare" value={stats.recoveryRate} suffix="%" color="text-green-600" />
          <StatCard label="In coada" value={stats.activeItems} color="text-blue-600" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <label className="block text-xs font-medium text-slate-600">Filtreaza dupa status:</label>
        <select
          className="input w-48"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Toate statusurile</option>
          <option value="pending">In asteptare</option>
          <option value="planned">Planificat</option>
          <option value="in_progress">In lucru</option>
          <option value="completed">Finalizat</option>
          <option value="scrapped">Casat</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Comanda</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Cantitate</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Motiv</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Masina sursa</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Masina target</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>
            )}
            {items.map(item => {
              const srcMachine = machines?.find(m => m.id === item.source_machine_id)
              const tgtMachine = machines?.find(m => m.id === item.target_machine_id)
              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  <td className="px-4 py-3 text-slate-700">
                    {item.product_name || '—'}
                    {item.product_reference && <span className="text-xs text-slate-400 ml-1">({item.product_reference})</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono hidden md:table-cell">
                    {item.order_id ? item.order_id.slice(0, 8) + '...' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{item.rework_qty}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{item.rework_reason || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {srcMachine ? `${srcMachine.code}` : item.source_machine_id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {tgtMachine ? `${tgtMachine.code}` : item.target_machine_id?.slice(0, 8) || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center">
                <RefreshCw size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">Niciun element in coada de reprelucrare</p>
                <p className="text-slate-400 text-sm mt-1">Piesele de reprelucrare vor aparea automat din rapoartele de productie.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedItem && (
        <DetailModal
          item={selectedItem}
          machines={machines}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
