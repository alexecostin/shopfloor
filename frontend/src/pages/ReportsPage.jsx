import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Download, Save, Trash2, FileSpreadsheet } from 'lucide-react'
import ExportButton from '../components/ExportButton'

function OldExportButtons({ params }) {
  const dl = (format) => {
    const q = new URLSearchParams({ ...params, format }).toString()
    window.open(`/api/v1/reports/export/${format}?${q}`, '_blank')
  }
  return (
    <div className="flex gap-2">
      <button onClick={() => dl('pdf')} className="btn-secondary text-xs">Export PDF</button>
      <button onClick={() => dl('excel')} className="btn-secondary text-xs">Export Excel</button>
    </div>
  )
}

function ExcelExportButton({ params }) {
  async function handleExcel() {
    try {
      const res = await api.get('/reports/export/excel', { params, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'raport.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export Excel generat.')
    } catch (err) {
      if (err.response?.status === 501) toast('Functionalitate in dezvoltare', { icon: '\uD83D\uDD27' })
      else toast.error('Eroare la export Excel.')
    }
  }
  return (
    <button onClick={handleExcel} className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600 border border-slate-200 rounded-lg px-3 py-1.5">
      <FileSpreadsheet size={13} /> Export Excel
    </button>
  )
}

/* ── Saved Reports ── */

function SavedReports({ onLoad }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['saved-reports'],
    queryFn: () => api.get('/reports/saved').then(r => r.data),
  })
  const reports = data?.data || data || []

  const [name, setName] = useState('')
  const [saveType, setSaveType] = useState('')
  const [paramDateFrom, setParamDateFrom] = useState('')
  const [paramDateTo, setParamDateTo] = useState('')

  const saveMut = useMutation({
    mutationFn: (body) => api.post('/reports/saved', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-reports'] }); toast.success('Raport salvat.'); setName('') },
    onError: () => toast.error('Eroare la salvare raport.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/reports/saved/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-reports'] }); toast.success('Raport sters.') },
    onError: () => toast.error('Eroare la stergere.'),
  })

  function formatParamsDisplay(params) {
    if (!params || typeof params !== 'object') return '-'
    const parts = []
    if (params.dateFrom) parts.push(`De la: ${params.dateFrom}`)
    if (params.dateTo) parts.push(`Pana la: ${params.dateTo}`)
    if (parts.length === 0) {
      return Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ') || '-'
    }
    return parts.join(' | ')
  }

  if (isLoading) return <p className="text-slate-400">Se incarca...</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Nume raport</label>
          <input className="input w-48" value={name} onChange={e => setName(e.target.value)} placeholder="Numele raportului" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tip</label>
          <select className="input w-40" value={saveType} onChange={e => setSaveType(e.target.value)}>
            <option value="">Selecteaza...</option>
            <option value="prr_product">Per Reper</option>
            <option value="prr_machine">Per Masina</option>
            <option value="prr_order">Per Comanda</option>
            <option value="prr_operator">Per Operator</option>
            <option value="prr_weekly_summary">Saptamanal</option>
            <option value="month_comparison">Lunar</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">De la</label>
          <input type="date" className="input w-40" value={paramDateFrom} onChange={e => setParamDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Pana la</label>
          <input type="date" className="input w-40" value={paramDateTo} onChange={e => setParamDateTo(e.target.value)} />
        </div>
        <button
          onClick={() => {
            const filters = {}
            if (paramDateFrom) filters.dateFrom = paramDateFrom
            if (paramDateTo) filters.dateTo = paramDateTo
            saveMut.mutate({ name, report_type: saveType, filters })
          }}
          disabled={saveMut.isPending || !name || !saveType}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          <Save size={14} /> {saveMut.isPending ? 'Se salveaza...' : 'Salveaza'}
        </button>
      </div>

      {reports.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Parametri</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.report_type || r.type || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatParamsDisplay(r.filters || r.params)}</td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => onLoad && onLoad(r)} className="text-xs text-blue-600 hover:underline">Incarca</button>
                    <button onClick={() => { if (window.confirm('Stergi raportul salvat?')) deleteMut.mutate(r.id) }} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-0.5">
                      <Trash2 size={12} /> Sterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reports.length === 0 && <p className="text-slate-400 text-sm">Niciun raport salvat.</p>}
    </div>
  )
}

/* ── Report by Order ── */

function ReportByOrder() {
  const [orderId, setOrderId] = useState('')
  const { data: orders } = useQuery({
    queryKey: ['production-orders'],
    queryFn: () => api.get('/production/orders').then(r => r.data),
  })
  const orderList = orders?.data || orders || []

  const { data, isLoading } = useQuery({
    queryKey: ['report-by-order', orderId],
    queryFn: () => api.get(`/reports/prr/by-order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })
  const rows = data?.data || (data ? [data] : [])

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Comanda</label>
          <select className="input max-w-xs" value={orderId} onChange={e => setOrderId(e.target.value)}>
            <option value="">Selecteaza comanda...</option>
            {orderList.map(o => <option key={o.id} value={o.id}>{o.order_number || o.name || `#${o.id}`}</option>)}
          </select>
        </div>
        {orderId && (
          <>
            <ExportButton endpoint={`/reports/export/pdf`} params={{ type: 'prr_order', orderId }} label="Export PDF" filename={`raport_comanda_${orderId}.pdf`} />
            <ExcelExportButton params={{ type: 'prr_order', orderId }} />
          </>
        )}
      </div>
      {isLoading && <p className="text-slate-400">Se incarca...</p>}
      {!orderId && <p className="text-slate-400 text-sm">Selecteaza o comanda.</p>}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reper</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Planificat</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Realizat</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Rebut %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.product || r.reper || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.planned ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.actual ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.scrap ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.scrap_rate != null ? `${r.scrap_rate?.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Report by Operator ── */

function ReportByOperator() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-by-operator'],
    queryFn: () => api.get('/reports/prr/by-operator').then(r => r.data),
  })
  const rows = data?.data || data || []

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ExportButton endpoint="/reports/export/pdf" params={{ type: 'prr_operator' }} label="Export PDF" filename="raport_operatori.pdf" />
        <ExcelExportButton params={{ type: 'prr_operator' }} />
      </div>
      {isLoading && <p className="text-slate-400">Se incarca...</p>}
      {rows.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Piese</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Ore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.operator_name || r.operator || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.pieces ?? r.actual ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.scrap ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.hours != null ? r.hours.toFixed(1) : (r.total_hours != null ? r.total_hours.toFixed(1) : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (!isLoading && <p className="text-slate-400 text-sm">Fara date.</p>)}
    </div>
  )
}

/* ── Main Page ── */

export default function ReportsPage() {
  const [tab, setTab] = useState('product')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [product, setProduct] = useState('')
  const [machineId, setMachineId] = useState('')
  const [week, setWeek] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const { data: machinesRaw } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const machinesList = machinesRaw?.data || machinesRaw || []

  const { data: productsRaw } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/bom/products').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const productsList = productsRaw?.data || productsRaw || []

  const byProduct = useQuery({
    queryKey: ['report-product', dateFrom, dateTo, product],
    queryFn: () => api.get('/reports/prr/by-product', { params: { dateFrom, dateTo, product: product || undefined } }).then(r => r.data),
    enabled: tab === 'product' && !!(dateFrom && dateTo),
  })

  const trend = useQuery({
    queryKey: ['report-trend', product, dateFrom, dateTo],
    queryFn: () => api.get('/reports/prr/trend', { params: { product, dateFrom, dateTo } }).then(r => r.data),
    enabled: tab === 'product' && !!product && !!(dateFrom && dateTo),
  })

  const byMachine = useQuery({
    queryKey: ['report-machine', dateFrom, dateTo, machineId],
    queryFn: () => api.get('/reports/prr/by-machine', { params: { dateFrom, dateTo, machineId: machineId || undefined } }).then(r => r.data),
    enabled: tab === 'machine' && !!(dateFrom && dateTo),
  })

  const weekly = useQuery({
    queryKey: ['report-weekly', week],
    queryFn: () => api.get('/reports/prr/weekly-summary', { params: { week } }).then(r => r.data),
    enabled: tab === 'weekly' && !!week,
  })

  const monthly = useQuery({
    queryKey: ['report-monthly', month, year],
    queryFn: () => api.get('/reports/prr/month-comparison', { params: { month, year } }).then(r => r.data),
    enabled: tab === 'monthly' && !!(month && year),
  })

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  const productList = byProduct.data?.data || byProduct.data || []
  const machineList = byMachine.data?.data || byMachine.data || []
  const weekData = weekly.data
  const monthList = monthly.data?.data || monthly.data || []
  const trendList = trend.data?.data || trend.data || []

  function handleLoadSaved(report) {
    const p = report.filters || report.params || {}
    if (p.dateFrom) setDateFrom(p.dateFrom)
    if (p.dateTo) setDateTo(p.dateTo)
    if (p.product) setProduct(p.product)
    if (p.week) setWeek(p.week)
    if (p.month) setMonth(p.month)
    if (p.year) setYear(p.year)
    const typeMap = { prr_product: 'product', prr_machine: 'machine', prr_order: 'byOrder', prr_operator: 'byOperator', prr_weekly_summary: 'weekly', month_comparison: 'monthly', weekly: 'weekly', monthly: 'monthly' }
    const rt = report.report_type || report.type
    if (typeMap[rt]) setTab(typeMap[rt])
    toast.success(`Raport "${report.name}" incarcat.`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Rapoarte</h1>
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        <button className={tabCls('product')} onClick={() => setTab('product')}>Per Reper</button>
        <button className={tabCls('machine')} onClick={() => setTab('machine')}>Per Masina</button>
        <button className={tabCls('byOrder')} onClick={() => setTab('byOrder')}>Per Comanda</button>
        <button className={tabCls('byOperator')} onClick={() => setTab('byOperator')}>Per Operator</button>
        <button className={tabCls('weekly')} onClick={() => setTab('weekly')}>Sumar Saptamanal</button>
        <button className={tabCls('monthly')} onClick={() => setTab('monthly')}>Comparatie Luna</button>
        <button className={tabCls('saved')} onClick={() => setTab('saved')}>
          <span className="flex items-center gap-1"><Save size={14} /> Rapoarte Salvate</span>
        </button>
      </div>

      {tab === 'product' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs text-slate-500 block mb-1">De la</label>
              <input className="input w-36" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Pana la</label>
              <input className="input w-36" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Reper / Produs</label>
              <select className="input w-48" value={product} onChange={e => setProduct(e.target.value)}>
                <option value="">Toate reperele</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.code || p.name}>{p.code ? `${p.code} — ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
            <OldExportButtons params={{ type: 'prr_product', dateFrom, dateTo, product: product || undefined }} />
            <ExcelExportButton params={{ type: 'prr_product', dateFrom, dateTo, product: product || undefined }} />
          </div>
          {byProduct.isLoading && <p className="text-slate-400">Se incarca...</p>}
          {!(dateFrom && dateTo) && <p className="text-slate-400 text-sm">Selecteaza intervalul de date.</p>}
          {productList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Reper</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Planificat</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Realizat</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Dif. Abs</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Dif. %</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Rebut %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.product || r.reper}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.planned ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.actual ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.diff_abs ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.diff_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>{r.diff_pct != null ? `${r.diff_pct?.toFixed(1)}%` : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.scrap_rate != null ? `${r.scrap_rate?.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {trendList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Trend — {product}</p>
              <div className="flex items-end gap-2 h-32">
                {trendList.map((p, i) => {
                  const max = Math.max(...trendList.map(x => Math.max(x.planned || 0, x.actual || 0)), 1)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
                        <div className="flex-1 bg-blue-300 rounded-t" style={{ height: `${Math.round(((p.planned || 0) / max) * 100)}%` }} title={`Planificat: ${p.planned}`} />
                        <div className="flex-1 bg-green-400 rounded-t" style={{ height: `${Math.round(((p.actual || 0) / max) * 100)}%` }} title={`Realizat: ${p.actual}`} />
                      </div>
                      <span className="text-xs text-slate-400 truncate w-full text-center">{p.period || p.date}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'machine' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs text-slate-500 block mb-1">De la</label>
              <input className="input w-36" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Pana la</label>
              <input className="input w-36" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Masina</label>
              <select className="input w-48" value={machineId} onChange={e => setMachineId(e.target.value)}>
                <option value="">Toate masinile</option>
                {machinesList.map(m => (
                  <option key={m.id} value={m.id}>{m.code ? `${m.code} — ${m.name}` : m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Reper / Produs</label>
              <select className="input w-48" value={product} onChange={e => setProduct(e.target.value)}>
                <option value="">Toate reperele</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.code || p.name}>{p.code ? `${p.code} — ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
            <ExcelExportButton params={{ type: 'prr_machine', dateFrom, dateTo, machineId: machineId || undefined, product: product || undefined }} />
          </div>
          {byMachine.isLoading && <p className="text-slate-400">Se incarca...</p>}
          {!(dateFrom && dateTo) && <p className="text-slate-400 text-sm">Selecteaza intervalul de date.</p>}
          {machineList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Reper</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tura</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Planificat</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Realizat</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {machineList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.machine}</td>
                      <td className="px-4 py-3 text-slate-600">{r.product || r.reper}</td>
                      <td className="px-4 py-3 text-slate-500">{r.shift || r.tura}</td>
                      <td className="px-4 py-3 text-slate-500">{r.date?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.planned ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.actual ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.scrap ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'byOrder' && <ReportByOrder />}

      {tab === 'byOperator' && <ReportByOperator />}

      {tab === 'weekly' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Saptamana</label>
              <input className="input w-44" type="week" value={week} onChange={e => setWeek(e.target.value)} />
            </div>
            <ExcelExportButton params={{ type: 'weekly', week }} />
          </div>
          {weekly.isLoading && <p className="text-slate-400">Se incarca...</p>}
          {weekData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-500 mb-1">Total Planificat</p>
                  <p className="text-xl font-bold text-blue-700">{weekData.total_planned ?? '—'}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-green-500 mb-1">Total Realizat</p>
                  <p className="text-xl font-bold text-green-700">{weekData.total_actual ?? '—'}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-amber-500 mb-1">Eficienta %</p>
                  <p className="text-xl font-bold text-amber-700">{weekData.efficiency_pct?.toFixed(1) ?? '—'}%</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-red-500 mb-1">Rata Rebut %</p>
                  <p className="text-xl font-bold text-red-700">{weekData.scrap_rate?.toFixed(1) ?? '—'}%</p>
                </div>
              </div>
              {weekData.rows?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        {Object.keys(weekData.rows[0]).map(k => (
                          <th key={k} className="text-left px-4 py-3 font-medium text-slate-600 capitalize">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {weekData.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(r).map((v, j) => (
                            <td key={j} className="px-4 py-3 text-slate-700">{v ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {!week && <p className="text-slate-400 text-sm">Selecteaza saptamana.</p>}
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Luna</label>
              <select className="input w-36" value={month} onChange={e => setMonth(e.target.value)}>
                <option value="">Selecteaza...</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">An</label>
              <input className="input w-24" type="number" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <ExcelExportButton params={{ type: 'monthly', month, year }} />
          </div>
          {monthly.isLoading && <p className="text-slate-400">Se incarca...</p>}
          {!(month && year) && <p className="text-slate-400 text-sm">Selecteaza luna si anul.</p>}
          {monthList.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Luna Curenta</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Luna Anterioara</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Variatie %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.machine}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.current_month ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.previous_month ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.variation_pct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {r.variation_pct != null ? `${r.variation_pct?.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'saved' && <SavedReports onLoad={handleLoadSaved} />}
    </div>
  )
}
