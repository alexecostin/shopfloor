import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, StopCircle, PlayCircle } from 'lucide-react'

const SHIFTS = ['Tura I', 'Tura II', 'Tura III']

function ReportModal({ machines, orders, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', orderId: '', shift: 'Tura I', goodPieces: 0, scrapPieces: 0, scrapReason: '', notes: '' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/production/reports', data),
    onSuccess: () => { qc.invalidateQueries(['reports']); toast.success('Raport inregistrat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-4">Raporteaza productie</h3>
        <div className="space-y-3">
          <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <select className="input" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })}>
            <option value="">Fara comanda (optional)</option>
            {orders?.filter(o => o.status === 'active').map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.product_name}</option>)}
          </select>
          <select className="input" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Piese bune</label>
              <input type="number" min={0} className="input" value={form.goodPieces} onChange={e => setForm({ ...form, goodPieces: +e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Rebuturi</label>
              <input type="number" min={0} className="input" value={form.scrapPieces} onChange={e => setForm({ ...form, scrapPieces: +e.target.value })} />
            </div>
          </div>
          {form.scrapPieces > 0 && (
            <input className="input" placeholder="Motiv rebuturi" value={form.scrapReason} onChange={e => setForm({ ...form, scrapReason: e.target.value })} />
          )}
          <textarea className="input resize-none" rows={2} placeholder="Observatii (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate({ ...form, orderId: form.orderId || null })} disabled={mutation.isPending || !form.machineId} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Raporteaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StopModal({ machines, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ machineId: '', reason: '', category: '', shift: 'Tura I' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/production/stops', data),
    onSuccess: () => { qc.invalidateQueries(['stops']); toast.success('Oprire inregistrata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-red-600 mb-4">Inregistreaza oprire</h3>
        <div className="space-y-3">
          <select className="input" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Selecteaza utilaj</option>
            {machines?.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
          </select>
          <input className="input" placeholder="Motiv oprire" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <input className="input" placeholder="Categorie (ex: Defect utilaj)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <select className="input" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.machineId || !form.reason} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {mutation.isPending ? 'Se salveaza...' : 'Inregistreaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductionPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState('reports')
  const [modal, setModal] = useState(null)
  const canReport = ['admin', 'production_manager', 'shift_leader', 'operator'].includes(user?.role)

  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/machines').then(r => r.data.data) })
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => api.get('/production/orders').then(r => r.data.data) })
  const { data: reports, isLoading: rLoading } = useQuery({ queryKey: ['reports'], queryFn: () => api.get('/production/reports').then(r => r.data), enabled: tab === 'reports' })
  const { data: stops, isLoading: sLoading } = useQuery({ queryKey: ['stops'], queryFn: () => api.get('/production/stops').then(r => r.data), enabled: tab === 'stops' })

  const closeStop = useMutation({
    mutationFn: (id) => api.put(`/production/stops/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries(['stops']); toast.success('Oprire inchisa.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Productie</h2>
        {canReport && (
          <div className="flex gap-2">
            <button onClick={() => setModal('stop')} className="flex items-center gap-2 text-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
              <StopCircle size={15} /> Oprire
            </button>
            <button onClick={() => setModal('report')} className="btn-primary flex items-center gap-2">
              <Plus size={15} /> Raport
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {['reports', 'stops', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
              ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'reports' ? 'Rapoarte' : t === 'stops' ? 'Opriri' : 'Comenzi'}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Utilaj</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tura</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Bune</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
              {reports?.data?.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.machine_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-slate-700">{r.shift}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{r.good_pieces}</td>
                  <td className="px-4 py-3 text-right text-red-500 font-medium">{r.scrap_pieces}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell text-xs">{new Date(r.reported_at).toLocaleString('ro-RO')}</td>
                </tr>
              ))}
              {reports?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Niciun raport.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'stops' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Motiv</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Categorie</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Durata</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                {canReport && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
              {stops?.data?.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{s.reason}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.category || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.duration_minutes != null ? `${s.duration_minutes} min` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${s.ended_at ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600 animate-pulse'}`}>
                      {s.ended_at ? 'Inchisa' : 'Deschisa'}
                    </span>
                  </td>
                  {canReport && !s.ended_at && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => closeStop.mutate(s.id)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                        <PlayCircle size={13} /> Inchide
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {stops?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nicio oprire.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nr. Comanda</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Produs</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cantitate</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders?.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-800">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-700">{o.product_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{o.target_quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      o.status === 'active' ? 'bg-green-100 text-green-700' :
                      o.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      o.status === 'planned' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{o.status}</span>
                  </td>
                </tr>
              ))}
              {orders?.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nicio comanda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'report' && <ReportModal machines={machines} orders={orders} onClose={() => setModal(null)} />}
      {modal === 'stop' && <StopModal machines={machines} onClose={() => setModal(null)} />}
    </div>
  )
}
