import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { formatMoney, getRate, convertDisplay } from '../utils/currency'
import { TrendingUp, TrendingDown, Calculator, Settings, BarChart3 } from 'lucide-react'
import ExportButton from '../components/ExportButton'

function useTenantCurrency() {
  const [currency, setCurrency] = useState('RON')
  useEffect(() => {
    api.get('/admin/settings').then(r => {
      const c = r.data?.default_currency || r.data?.defaultCurrency
      if (c) setCurrency(c)
    }).catch(() => {})
  }, [])
  return currency
}

function MoneyDisplay({ amount, fromCurrency, tenantCurrency }) {
  const [converted, setConverted] = useState(null)
  useEffect(() => {
    if (!fromCurrency || !tenantCurrency || fromCurrency === tenantCurrency) return
    getRate(fromCurrency, tenantCurrency).then(rate => {
      const result = convertDisplay(amount, fromCurrency, tenantCurrency, rate)
      if (result) setConverted(result)
    })
  }, [amount, fromCurrency, tenantCurrency])
  return (
    <span>
      {formatMoney(amount, fromCurrency || tenantCurrency)}
      {converted && (
        <span className="text-slate-400 text-xs ml-1">
          ({formatMoney(converted.amount, converted.currency)})
        </span>
      )}
    </span>
  )
}

function CostBar({ label, planned, actual, currency }) {
  const max = Math.max(planned, actual, 1)
  const pPct = Math.round((planned / max) * 100)
  const aPct = Math.round((actual / max) * 100)
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="text-slate-400">{formatMoney(planned, currency)} / {formatMoney(actual, currency)}</span>
      </div>
      <div className="space-y-1">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pPct}%` }} />
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${actual > planned ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${aPct}%` }} />
        </div>
      </div>
    </div>
  )
}

/* ── Configuratie Sub-tabs ── */

function CostElementsConfig() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['cost-elements'],
    queryFn: () => api.get('/costs/elements').then(r => r.data),
  })
  const elements = data?.data || data || []

  const toggleMut = useMutation({
    mutationFn: (el) => api.put(`/costs/elements/${el.id}`, { ...el, active: !el.active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-elements'] }); toast.success('Actualizat.') },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la actualizare. Incercati din nou.'); },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name, rate }) => api.put(`/costs/elements/${id}`, { name, rate }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cost-elements'] }); toast.success('Salvat.') },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la salvare. Incercati din nou.'); },
  })

  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRate, setEditRate] = useState('')

  function startEdit(el) {
    setEditing(el.id)
    setEditName(el.name || '')
    setEditRate(el.rate ?? '')
  }

  function saveEdit(id) {
    updateMut.mutate({ id, name: editName, rate: parseFloat(editRate) || 0 })
    setEditing(null)
  }

  if (isLoading) return <p className="text-slate-400">Se incarca...</p>

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Element</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Rata</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600">Activ</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600">Actiuni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {elements.map(el => (
            <tr key={el.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-800">
                {editing === el.id ? <input className="input w-full" value={editName} onChange={e => setEditName(e.target.value)} /> : el.name}
              </td>
              <td className="px-4 py-3 text-slate-600">{el.type || '—'}</td>
              <td className="px-4 py-3 text-right text-slate-600">
                {editing === el.id ? <input className="input w-24 text-right" type="number" value={editRate} onChange={e => setEditRate(e.target.value)} /> : (el.rate ?? '—')}
              </td>
              <td className="px-4 py-3 text-center">
                <button onClick={() => toggleMut.mutate(el)} className={`w-10 h-5 rounded-full transition ${el.active ? 'bg-green-500' : 'bg-slate-300'}`}>
                  <span className={`block w-4 h-4 bg-white rounded-full shadow transition transform ${el.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </td>
              <td className="px-4 py-3 text-center">
                {editing === el.id ? (
                  <button onClick={() => saveEdit(el.id)} className="text-xs text-blue-600 hover:underline">Salveaza</button>
                ) : (
                  <button onClick={() => startEdit(el)} className="text-xs text-slate-500 hover:text-blue-600">Editeaza</button>
                )}
              </td>
            </tr>
          ))}
          {elements.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Fara elemente.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function MachineCostConfig() {
  const qc = useQueryClient()
  const { data: machines } = useQuery({
    queryKey: ['machines-list'],
    queryFn: () => api.get('/machines').then(r => r.data?.data || r.data || []),
  })
  const machineList = machines || []

  const [selectedMachine, setSelectedMachine] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [energyRate, setEnergyRate] = useState('')
  const [depreciationRate, setDepreciationRate] = useState('')

  const { data: machineConfig } = useQuery({
    queryKey: ['machine-cost-config', selectedMachine],
    queryFn: () => api.get(`/costs/machines/${selectedMachine}/config`).then(r => r.data),
    enabled: !!selectedMachine,
  })

  useEffect(() => {
    if (machineConfig) {
      setHourlyRate(machineConfig.hourlyRate ?? machineConfig.hourly_rate ?? '')
      setEnergyRate(machineConfig.energyRate ?? machineConfig.energy_rate ?? '')
      setDepreciationRate(machineConfig.depreciationRate ?? machineConfig.depreciation_rate ?? '')
    }
  }, [machineConfig])

  const saveMut = useMutation({
    mutationFn: () => api.post(`/costs/machines/${selectedMachine}/config`, {
      hourlyRate: parseFloat(hourlyRate) || 0,
      energyRate: parseFloat(energyRate) || 0,
      depreciationRate: parseFloat(depreciationRate) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['machine-cost-config'] }); toast.success('Configuratie salvata.') },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la salvare. Incercati din nou.'); },
  })

  const { data: allConfigs } = useQuery({
    queryKey: ['all-machine-configs'],
    queryFn: async () => {
      const results = []
      for (const m of machineList) {
        try {
          const r = await api.get(`/costs/machines/${m.id}/config`)
          results.push({ ...r.data, machine_name: m.name || m.machine_name || `#${m.id}` })
        } catch { /* skip */ }
      }
      return results
    },
    enabled: machineList.length > 0,
  })
  const configList = allConfigs || []

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Masina</label>
          <select className="input max-w-xs" value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}>
            <option value="">Selecteaza masina...</option>
            {machineList.map(m => <option key={m.id} value={m.id}>{m.name || m.machine_name || `#${m.id}`}</option>)}
          </select>
        </div>
        {selectedMachine && (
          <>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rata orara</label>
              <input className="input w-28" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rata energie</label>
              <input className="input w-28" type="number" value={energyRate} onChange={e => setEnergyRate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rata depreciere</label>
              <input className="input w-28" type="number" value={depreciationRate} onChange={e => setDepreciationRate(e.target.value)} />
            </div>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-secondary text-sm">
              {saveMut.isPending ? 'Se salveaza...' : 'Salveaza'}
            </button>
          </>
        )}
      </div>
      {configList.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Orara</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Energie</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Depreciere</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configList.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.machine_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.hourlyRate ?? c.hourly_rate ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.energyRate ?? c.energy_rate ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.depreciationRate ?? c.depreciation_rate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OperatorCostConfig() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['operator-cost-config'],
    queryFn: () => api.get('/costs/operators/config').then(r => r.data),
  })
  const configs = data?.data || data || []

  const [role, setRole] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')

  const saveMut = useMutation({
    mutationFn: () => api.post('/costs/operators/config', { role, hourlyRate: parseFloat(hourlyRate) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-cost-config'] })
      toast.success('Salvat.')
      setRole('')
      setHourlyRate('')
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la salvare. Incercati din nou.'); },
  })

  if (isLoading) return <p className="text-slate-400">Se incarca...</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Rol</label>
          <input className="input w-40" value={role} onChange={e => setRole(e.target.value)} placeholder="ex: Operator CNC" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Rata orara</label>
          <input className="input w-28" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
        </div>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !role} className="btn-secondary text-sm">
          {saveMut.isPending ? 'Se salveaza...' : 'Adauga / Actualizeaza'}
        </button>
      </div>
      {configs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rata Orara</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.role}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.hourlyRate ?? c.hourly_rate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OverheadConfig() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['overhead-costs'],
    queryFn: () => api.get('/costs/overhead').then(r => r.data),
  })
  const items = data?.data || data || []

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [amount, setAmount] = useState('')
  const [allocationMethod, setAllocationMethod] = useState('')
  const [editing, setEditing] = useState(null)

  const createMut = useMutation({
    mutationFn: () => api.post('/costs/overhead', { name, type, amount: parseFloat(amount) || 0, allocationMethod }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overhead-costs'] })
      toast.success('Adaugat.')
      setName(''); setType(''); setAmount(''); setAllocationMethod('')
    },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la adaugare. Incercati din nou.'); },
  })

  const updateMut = useMutation({
    mutationFn: (item) => api.put(`/costs/overhead/${item.id}`, item),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead-costs'] }); toast.success('Actualizat.'); setEditing(null) },
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la actualizare. Incercati din nou.'); },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/costs/overhead/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overhead-costs'] }); toast.success('Sters.') },
    onError: (e) => { const msg = e.response?.data?.message || ''; if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.'); else toast.error(msg || 'Eroare la stergere. Incercati din nou.'); },
  })

  const [editData, setEditData] = useState({})

  function startEdit(item) {
    setEditing(item.id)
    setEditData({ name: item.name, type: item.type, amount: item.amount, allocationMethod: item.allocationMethod || item.allocation_method })
  }

  if (isLoading) return <p className="text-slate-400">Se incarca...</p>

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Denumire</label>
          <input className="input w-40" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tip</label>
          <input className="input w-32" value={type} onChange={e => setType(e.target.value)} placeholder="fix / variabil" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Suma</label>
          <input className="input w-28" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Metoda alocare</label>
          <input className="input w-36" value={allocationMethod} onChange={e => setAllocationMethod(e.target.value)} placeholder="proportional" />
        </div>
        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name} className="btn-secondary text-sm">
          {createMut.isPending ? 'Se adauga...' : 'Adauga'}
        </button>
      </div>
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Suma</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Metoda Alocare</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">
                    {editing === item.id ? <input className="input w-full" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} /> : item.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {editing === item.id ? <input className="input w-full" value={editData.type} onChange={e => setEditData({ ...editData, type: e.target.value })} /> : (item.type || '—')}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {editing === item.id ? <input className="input w-24 text-right" type="number" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} /> : (item.amount ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {editing === item.id ? <input className="input w-full" value={editData.allocationMethod} onChange={e => setEditData({ ...editData, allocationMethod: e.target.value })} /> : (item.allocationMethod || item.allocation_method || '—')}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    {editing === item.id ? (
                      <button onClick={() => updateMut.mutate({ id: item.id, ...editData, amount: parseFloat(editData.amount) || 0 })} className="text-xs text-blue-600 hover:underline">Salveaza</button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item)} className="text-xs text-slate-500 hover:text-blue-600">Editeaza</button>
                        <button onClick={() => { if (window.confirm('Sigur doriti sa stergeti? Aceasta actiune este ireversibila.')) deleteMut.mutate(item.id) }} className="text-xs text-red-500 hover:text-red-700">Sterge</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Profitabilitate Tab ── */

function ProfitabilityTab({ tenantCurrency }) {
  const { data, isLoading } = useQuery({
    queryKey: ['profitability'],
    queryFn: () => api.get('/costs/profitability').then(r => r.data),
  })
  const rows = data?.data || data || []

  if (isLoading) return <p className="text-slate-400">Se incarca...</p>

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Venituri</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Costuri</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Marja %</th>
            <th className="text-center px-4 py-3 font-medium text-slate-600">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const margin = r.margin_pct ?? (r.revenue ? ((r.revenue - r.costs) / r.revenue * 100) : 0)
            return (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{r.client || r.customer || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.revenue != null ? formatMoney(r.revenue, r.currency || tenantCurrency) : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.costs != null ? formatMoney(r.costs, r.currency || tenantCurrency) : '—'}</td>
                <td className={`px-4 py-3 text-right font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</td>
                <td className="px-4 py-3 text-center">
                  {r.trend === 'up' || margin > 0 ? <TrendingUp size={16} className="inline text-green-500" /> : <TrendingDown size={16} className="inline text-red-500" />}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Fara date de profitabilitate.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/* ── Calculatoare Tab ── */

function CalculatorsTab({ tenantCurrency }) {
  const calcDescription = "Calculeaza costul estimat per piesa sau per comanda bazat pe BOM, timpi operatii, costuri masini si manopera."
  const [calcType, setCalcType] = useState('piece')

  const { data: products } = useQuery({
    queryKey: ['bom-products-calc'],
    queryFn: () => api.get('/bom/products', { params: { limit: 500 } }).then(r => r.data?.data || r.data || []),
  })
  const { data: orders } = useQuery({
    queryKey: ['work-orders-calc'],
    queryFn: () => api.get('/work-orders').then(r => r.data?.data || r.data || []),
  })

  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedOrder, setSelectedOrder] = useState('')
  const [quoteQty, setQuoteQty] = useState('')
  const [quoteMaterial, setQuoteMaterial] = useState('')
  const [quoteMargin, setQuoteMargin] = useState('20')

  const pieceCost = useQuery({
    queryKey: ['calc-piece', selectedProduct],
    queryFn: () => api.get(`/costs/calculate/piece/${selectedProduct}`).then(r => r.data),
    enabled: calcType === 'piece' && !!selectedProduct,
  })

  const orderCost = useQuery({
    queryKey: ['calc-order', selectedOrder],
    queryFn: () => api.get(`/costs/calculate/order/${selectedOrder}`).then(r => r.data),
    enabled: calcType === 'order' && !!selectedOrder,
  })

  const [quoteResult, setQuoteResult] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  async function calcQuote() {
    setQuoteLoading(true)
    try {
      const r = await api.get('/costs/calculate/quote', { params: { qty: quoteQty, materialCost: quoteMaterial, margin: quoteMargin } })
      setQuoteResult(r.data)
    } catch {
      toast.error('Eroare la calcul oferta.')
    }
    setQuoteLoading(false)
  }

  const productList = products || []
  const orderList = orders || []

  const subTabCls = t => t === calcType
    ? 'px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg border border-blue-200'
    : 'px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200'

  function BreakdownTable({ data: bd }) {
    if (!bd) return null
    const entries = typeof bd === 'object' && !Array.isArray(bd) ? Object.entries(bd) : []
    if (entries.length === 0) return <p className="text-slate-400 text-sm">Fara date detaliate.</p>
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-3">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Componenta</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Valoare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(([k, v]) => (
              <tr key={k} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800 capitalize">{k.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-right text-slate-600">{typeof v === 'number' ? formatMoney(v, tenantCurrency) : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-700">
        <strong>Scopul acestei pagini:</strong> {calcDescription}
      </div>
      <div className="flex gap-2">
        <button className={subTabCls('piece')} onClick={() => setCalcType('piece')}>Cost per piesa</button>
        <button className={subTabCls('order')} onClick={() => setCalcType('order')}>Cost per comanda</button>
        <button className={subTabCls('quote')} onClick={() => setCalcType('quote')}>Oferta pret</button>
      </div>

      {calcType === 'piece' && (
        <div className="space-y-3">
          <select className="input max-w-xs" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
            <option value="">Selecteaza produs...</option>
            {productList.map(p => <option key={p.id} value={p.id}>{p.reference ? `${p.reference} - ` : ''}{p.name || p.product_name || `#${p.id}`}</option>)}
          </select>
          {pieceCost.isLoading && <p className="text-slate-400">Se calculeaza...</p>}
          {pieceCost.data && <BreakdownTable data={pieceCost.data.breakdown || pieceCost.data} />}
        </div>
      )}

      {calcType === 'order' && (
        <div className="space-y-3">
          <select className="input max-w-xs" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
            <option value="">Selecteaza comanda...</option>
            {orderList.map(o => <option key={o.id} value={o.id}>{o.work_order_number || o.order_number || o.name || `#${o.id}`}</option>)}
          </select>
          {orderCost.isLoading && <p className="text-slate-400">Se calculeaza...</p>}
          {orderCost.data && <BreakdownTable data={orderCost.data.breakdown || orderCost.data} />}
        </div>
      )}

      {calcType === 'quote' && (
        <div className="space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Cantitate</label>
              <input className="input w-28" type="number" value={quoteQty} onChange={e => setQuoteQty(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Cost material</label>
              <input className="input w-28" type="number" value={quoteMaterial} onChange={e => setQuoteMaterial(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Marja %</label>
              <input className="input w-20" type="number" value={quoteMargin} onChange={e => setQuoteMargin(e.target.value)} />
            </div>
            <button onClick={calcQuote} disabled={quoteLoading} className="btn-secondary text-sm">
              {quoteLoading ? 'Se calculeaza...' : 'Calculeaza'}
            </button>
          </div>
          {quoteResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500 mb-1">Cost Total</p>
                  <p className="text-xl font-bold text-blue-700">{formatMoney(quoteResult.totalCost ?? quoteResult.total_cost ?? 0, tenantCurrency)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-500 mb-1">Pret Sugerat</p>
                  <p className="text-xl font-bold text-green-700">{formatMoney(quoteResult.suggestedPrice ?? quoteResult.suggested_price ?? 0, tenantCurrency)}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-500 mb-1">Marja</p>
                  <p className="text-xl font-bold text-amber-700">{quoteResult.margin ?? quoteMargin}%</p>
                </div>
              </div>
              {quoteResult.breakdown && <BreakdownTable data={quoteResult.breakdown} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */

export default function CostsPage() {
  const tenantCurrency = useTenantCurrency()
  const [tab, setTab] = useState('order')
  const [configSub, setConfigSub] = useState('elements')
  const [orderId, setOrderId] = useState('')
  const [machineFrom, setMachineFrom] = useState('')
  const [machineTo, setMachineTo] = useState('')
  const [opFrom, setOpFrom] = useState('')
  const [opTo, setOpTo] = useState('')

  const { data: orders } = useQuery({
    queryKey: ['production-orders'],
    queryFn: () => api.get('/production/orders').then(r => r.data),
  })

  const { data: orderCosts, isLoading: ocLoading } = useQuery({
    queryKey: ['order-costs', orderId],
    queryFn: () => api.get(`/costs/order/${orderId}`).then(r => r.data),
    enabled: !!orderId,
  })

  const { data: machineCosts, isLoading: mcLoading } = useQuery({
    queryKey: ['machine-costs', machineFrom, machineTo],
    queryFn: () => api.get('/costs/by-machine', { params: { dateFrom: machineFrom, dateTo: machineTo } }).then(r => r.data),
    enabled: tab === 'machine' && !!(machineFrom && machineTo),
  })

  const { data: opCosts, isLoading: opLoading } = useQuery({
    queryKey: ['op-costs', opFrom, opTo],
    queryFn: () => api.get('/costs/by-operator', { params: { dateFrom: opFrom, dateTo: opTo } }).then(r => r.data),
    enabled: tab === 'operator' && !!(opFrom && opTo),
  })

  const snapshotMut = useMutation({
    mutationFn: id => api.post(`/costs/snapshot/${id}`),
    onSuccess: () => toast.success('Snapshot salvat.'),
    onError: (e) => { const msg = e.response?.data?.message || ''; toast.error(msg || 'Eroare la salvare snapshot. Incercati din nou.'); },
  })

  const orderList = orders?.data || orders || []
  const oc = orderCosts
  const mcList = machineCosts?.data || machineCosts || []
  const opList = opCosts?.data || opCosts || []

  const variance = oc ? ((oc.actual_total - oc.planned_total) / Math.max(oc.planned_total, 1)) * 100 : 0

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  const configSubCls = t => t === configSub
    ? 'px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg border border-blue-200'
    : 'px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Costuri</h1>
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        <button className={tabCls('order')} onClick={() => setTab('order')}>Pe Comanda</button>
        <button className={tabCls('machine')} onClick={() => setTab('machine')}>Pe Masina</button>
        <button className={tabCls('operator')} onClick={() => setTab('operator')}>Pe Operator</button>
        <button className={tabCls('config')} onClick={() => setTab('config')}>
          <span className="flex items-center gap-1"><Settings size={14} /> Configuratie</span>
        </button>
        <button className={tabCls('profitability')} onClick={() => setTab('profitability')}>
          <span className="flex items-center gap-1"><BarChart3 size={14} /> Profitabilitate</span>
        </button>
        <button className={tabCls('calculators')} onClick={() => setTab('calculators')}>
          <span className="flex items-center gap-1"><Calculator size={14} /> Calculatoare</span>
        </button>
      </div>

      {tab === 'order' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Comanda de productie</label>
              <select className="input max-w-xs" value={orderId} onChange={e => setOrderId(e.target.value)}>
                <option value="">Selecteaza comanda...</option>
              {orderList.map(o => <option key={o.id} value={o.id}>{o.work_order_number || o.order_number || o.name || `#${o.id}`}</option>)}
              </select>
            </div>
            {orderId && (
              <button onClick={() => snapshotMut.mutate(orderId)} disabled={snapshotMut.isPending} className="btn-secondary text-sm">
                {snapshotMut.isPending ? 'Se salveaza...' : 'Salveaza Snapshot'}
              </button>
            )}
          </div>

          {ocLoading && <p className="text-slate-400">Se incarca...</p>}

          {oc && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-blue-500 mb-1">Planificat Total</p>
                  <p className="text-2xl font-bold text-blue-700">{formatMoney(oc.planned_total, oc.currency || tenantCurrency)}</p>
                </div>
                <div className={`border rounded-xl p-4 ${variance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-xs mb-1 ${variance > 0 ? 'text-red-500' : 'text-green-500'}`}>Realizat Total ({variance > 0 ? '+' : ''}{variance.toFixed(1)}%)</p>
                  <p className={`text-2xl font-bold ${variance > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatMoney(oc.actual_total, oc.currency || tenantCurrency)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Estimat Final</p>
                  <p className="text-2xl font-bold text-slate-700">{oc.estimated_final ? formatMoney(oc.estimated_final, oc.currency || tenantCurrency) : '—'}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between text-xs text-slate-400 mb-3">
                  <span>Categorie (Planificat / Realizat)</span>
                  <div className="flex gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Planificat</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Realizat</span>
                  </div>
                </div>
                {['material', 'machine', 'labor', 'downtime', 'scrap'].map(cat => (
                  <CostBar
                    key={cat}
                    label={{ material: 'Material', machine: 'Masina', labor: 'Manopera', downtime: 'Opriri', scrap: 'Rebuturi' }[cat]}
                    planned={oc.breakdown?.planned?.[cat] || 0}
                    actual={oc.breakdown?.actual?.[cat] || 0}
                  />
                ))}
                {oc.progress_pct != null && (
                  <div className="mt-3 flex gap-4 text-sm text-slate-600">
                    <span>Progres: <strong>{oc.progress_pct?.toFixed(1)}%</strong></span>
                    {oc.cost_per_piece != null && <span>Cost/buc: <strong>{formatMoney(oc.cost_per_piece, oc.currency || tenantCurrency)}</strong></span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'machine' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data inceput *</label>
              <input className="input w-40" type="date" value={machineFrom} onChange={e => setMachineFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data sfarsit *</label>
              <input className="input w-40" type="date" value={machineTo} onChange={e => setMachineTo(e.target.value)} />
            </div>
          </div>
          {mcLoading ? <p className="text-slate-400">Se incarca...</p> : (machineFrom && machineTo) ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Masina</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Piese Bune</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Rebuturi</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Ore Oprire</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Cost Masina</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Cost Opriri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mcList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.machine_name || r.machine}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.good_pieces ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.scrap_pieces ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.downtime_hours?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.machine_cost != null ? formatMoney(r.machine_cost, r.currency || tenantCurrency) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.downtime_cost != null ? formatMoney(r.downtime_cost, r.currency || tenantCurrency) : '—'}</td>
                    </tr>
                  ))}
                  {mcList.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Fara date.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 text-sm">Selecteaza intervalul de date.</p>}
        </div>
      )}

      {tab === 'operator' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data inceput *</label>
              <input className="input w-40" type="date" value={opFrom} onChange={e => setOpFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data sfarsit *</label>
              <input className="input w-40" type="date" value={opTo} onChange={e => setOpTo(e.target.value)} />
            </div>
          </div>
          {opLoading ? <p className="text-slate-400">Se incarca...</p> : (opFrom && opTo) ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Operator</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Ore Totale</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Cost Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.operator_name || r.operator}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.total_hours?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.total_cost != null ? formatMoney(r.total_cost, r.currency || tenantCurrency) : '—'}</td>
                    </tr>
                  ))}
                  {opList.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Fara date.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : <p className="text-slate-400 text-sm">Selecteaza intervalul de date.</p>}
        </div>
      )}

      {tab === 'config' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button className={configSubCls('elements')} onClick={() => setConfigSub('elements')}>Elemente Cost</button>
            <button className={configSubCls('machine')} onClick={() => setConfigSub('machine')}>Cost Masini</button>
            <button className={configSubCls('operator')} onClick={() => setConfigSub('operator')}>Cost Operatori</button>
            <button className={configSubCls('overhead')} onClick={() => setConfigSub('overhead')}>Overhead</button>
          </div>
          {configSub === 'elements' && <CostElementsConfig />}
          {configSub === 'machine' && <MachineCostConfig />}
          {configSub === 'operator' && <OperatorCostConfig />}
          {configSub === 'overhead' && <OverheadConfig />}
        </div>
      )}

      {tab === 'profitability' && <ProfitabilityTab tenantCurrency={tenantCurrency} />}

      {tab === 'calculators' && <CalculatorsTab tenantCurrency={tenantCurrency} />}
    </div>
  )
}
