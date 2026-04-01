import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  Award, RefreshCw, X, Star, Truck, DollarSign, ShieldCheck, Zap,
  ChevronUp, ChevronDown, TrendingUp
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 3)
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  }
}

function scoreColor(score) {
  if (score >= 80) return 'text-green-700 bg-green-50'
  if (score >= 60) return 'text-amber-700 bg-amber-50'
  return 'text-red-700 bg-red-50'
}

function scoreBorder(score) {
  if (score >= 80) return 'border-green-200'
  if (score >= 60) return 'border-amber-200'
  return 'border-red-200'
}

function ScoreBadge({ score, large }) {
  const cls = scoreColor(score)
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${cls} ${
      large ? 'w-14 h-14 text-xl' : 'px-2.5 py-0.5 text-sm min-w-[2.5rem] text-center'
    }`}>
      {score}
    </span>
  )
}

// ─── Ranking Table ──────────────────────────────────────────────────────────

function RankingTable({ data, onSelect }) {
  const [sortField, setSortField] = useState('overall')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      let av, bv
      if (sortField === 'name') {
        av = (a.name || '').toLowerCase()
        bv = (b.name || '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      if (sortField === 'overall') { av = a.overall; bv = b.overall }
      else if (sortField === 'quality') { av = a.quality?.score; bv = b.quality?.score }
      else if (sortField === 'delivery') { av = a.delivery?.score; bv = b.delivery?.score }
      else if (sortField === 'price') { av = a.price?.score; bv = b.price?.score }
      else if (sortField === 'reactivity') { av = a.reactivity?.score; bv = b.reactivity?.score }
      else { av = a.overall; bv = b.overall }
      return sortDir === 'asc' ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0)
    })
  }, [data, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const columns = [
    { key: 'pos', label: 'Pos', sortable: false },
    { key: 'name', label: 'Furnizor', sortable: true },
    { key: 'quality', label: 'Calitate', sortable: true },
    { key: 'delivery', label: 'Livrare', sortable: true },
    { key: 'price', label: 'Pret', sortable: true },
    { key: 'reactivity', label: 'Reactivitate', sortable: true },
    { key: 'overall', label: 'TOTAL', sortable: true },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                  col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''
                } ${col.key === 'overall' ? 'bg-slate-50' : ''}`}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && <SortIcon field={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                Nu exista furnizori de evaluat.
              </td>
            </tr>
          )}
          {sorted.map((row, idx) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
            >
              <td className="px-3 py-2.5 font-medium text-slate-400">{idx + 1}</td>
              <td className="px-3 py-2.5 font-medium text-slate-800">{row.name}</td>
              <td className="px-3 py-2.5"><ScoreBadge score={row.quality?.score ?? 0} /></td>
              <td className="px-3 py-2.5"><ScoreBadge score={row.delivery?.score ?? 0} /></td>
              <td className="px-3 py-2.5"><ScoreBadge score={row.price?.score ?? 0} /></td>
              <td className="px-3 py-2.5"><ScoreBadge score={row.reactivity?.score ?? 0} /></td>
              <td className="px-3 py-2.5 bg-slate-50/50">
                <ScoreBadge score={row.overall ?? 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Score Card (in detail modal) ───────────────────────────────────────────

function ScoreCard({ icon: Icon, title, score, children, color }) {
  return (
    <div className={`rounded-xl border p-4 ${scoreBorder(score)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </div>
        <ScoreBadge score={score} large />
      </div>
      <div className="text-xs text-slate-500 space-y-1">
        {children}
      </div>
    </div>
  )
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

function DetailModal({ supplier, dateFrom, dateTo, onClose }) {
  const qc = useQueryClient()
  const [showReactivity, setShowReactivity] = useState(false)
  const [reactScore, setReactScore] = useState(supplier.reactivity?.score || 75)
  const [reactNotes, setReactNotes] = useState('')

  const { data: detail, isLoading } = useQuery({
    queryKey: ['supplier-scorecard', supplier.id, dateFrom, dateTo],
    queryFn: () => api.get(`/suppliers/scorecards/${supplier.id}`, {
      params: { dateFrom, dateTo },
    }).then(r => r.data),
    initialData: supplier,
  })

  const reactMut = useMutation({
    mutationFn: (body) => api.put(`/suppliers/scorecards/${supplier.id}/reactivity`, body),
    onSuccess: () => {
      toast.success('Reactivitate actualizata.')
      setShowReactivity(false)
      qc.invalidateQueries({ queryKey: ['supplier-scorecard', supplier.id] })
      qc.invalidateQueries({ queryKey: ['supplier-ranking'] })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const d = detail || supplier

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">{supplier.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Fisa evaluare furnizor</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">Scor total</div>
              <ScoreBadge score={d.overall ?? 0} large />
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Score Cards Grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ScoreCard icon={ShieldCheck} title="Calitate" score={d.quality?.score ?? 0}>
            <p>Livrari totale: <strong>{d.quality?.deliveries ?? 0}</strong></p>
            <p>Probleme (NCR): <strong>{d.quality?.problems ?? 0}</strong></p>
            <p>Pondere: {d.weights?.quality ?? 40}%</p>
          </ScoreCard>

          <ScoreCard icon={Truck} title="Livrare" score={d.delivery?.score ?? 0}>
            <p>Comenzi evaluate: <strong>{d.delivery?.total ?? 0}</strong></p>
            <p>La timp: <strong>{d.delivery?.onTime ?? 0}</strong></p>
            <p>Pondere: {d.weights?.delivery ?? 30}%</p>
          </ScoreCard>

          <ScoreCard icon={DollarSign} title="Pret" score={d.price?.score ?? 0}>
            <p>Articole evaluate: <strong>{d.price?.items ?? 0}</strong></p>
            <p>100 = pret egal sau sub medie</p>
            <p>Pondere: {d.weights?.price ?? 20}%</p>
          </ScoreCard>

          <ScoreCard icon={Zap} title="Reactivitate" score={d.reactivity?.score ?? 0}>
            <p>Evaluare manuala</p>
            <p>Pondere: {d.weights?.reactivity ?? 10}%</p>
            <button
              onClick={() => { setShowReactivity(true); setReactScore(d.reactivity?.score || 75) }}
              className="mt-2 btn-primary text-xs !py-1 !px-3"
            >
              Evalueaza reactivitate
            </button>
          </ScoreCard>
        </div>

        {/* Weights summary */}
        <div className="px-6 pb-4">
          <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3 text-xs text-slate-500">
            <TrendingUp size={14} />
            <span>Formula: Calitate ({d.weights?.quality ?? 40}%) + Livrare ({d.weights?.delivery ?? 30}%) + Pret ({d.weights?.price ?? 20}%) + Reactivitate ({d.weights?.reactivity ?? 10}%) = <strong className="text-slate-700">{d.overall ?? 0}</strong></span>
          </div>
        </div>

        {/* Reactivity edit */}
        {showReactivity && (
          <div className="px-6 pb-6">
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Evalueaza reactivitate</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Scor reactivitate (0-100) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input w-32"
                    value={reactScore}
                    onChange={e => setReactScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Note / Observatii</label>
                  <p className="text-[11px] text-slate-400 mb-1">Descrieti motivul scorului acordat (timp de raspuns, flexibilitate, comunicare)</p>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={reactNotes}
                    onChange={e => setReactNotes(e.target.value)}
                    placeholder="Motivul scorului acordat..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reactMut.mutate({ score: reactScore, notes: reactNotes })}
                    disabled={reactMut.isPending}
                    className="btn-primary text-xs"
                  >
                    {reactMut.isPending ? 'Se salveaza...' : 'Salveaza'}
                  </button>
                  <button onClick={() => setShowReactivity(false)} className="btn-secondary text-xs">
                    Anuleaza
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SupplierScorecardPage() {
  const qc = useQueryClient()
  const defaults = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom)
  const [dateTo, setDateTo] = useState(defaults.dateTo)
  const [selected, setSelected] = useState(null)

  const { data: ranking, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['supplier-ranking', dateFrom, dateTo],
    queryFn: () => api.get('/suppliers/scorecards/ranking', {
      params: { dateFrom, dateTo },
    }).then(r => r.data),
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award size={22} className="text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Evaluare Furnizori</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">De la:</label>
            <input
              type="date"
              className="input text-sm !py-1.5"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500">Pana la:</label>
            <input
              type="date"
              className="input text-sm !py-1.5"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Recalculeaza
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {ranking && ranking.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Furnizori evaluati</div>
            <div className="text-2xl font-bold text-slate-800">{ranking.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Scor &ge; 80</div>
            <div className="text-2xl font-bold text-green-600">
              {ranking.filter(r => r.overall >= 80).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Scor 60-79</div>
            <div className="text-2xl font-bold text-amber-600">
              {ranking.filter(r => r.overall >= 60 && r.overall < 80).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <div className="text-xs text-slate-400 mb-1">Scor &lt; 60</div>
            <div className="text-2xl font-bold text-red-600">
              {ranking.filter(r => r.overall < 60).length}
            </div>
          </div>
        </div>
      )}

      {/* Ranking Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Clasament furnizori</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Se incarca...</div>
        ) : (
          <RankingTable data={ranking || []} onSelect={setSelected} />
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          supplier={selected}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
