import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'

export default function CurrencyPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ from: 'EUR', to: 'RON', rate: '', date: new Date().toISOString().slice(0,10) })

  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.get('/currencies').then(r => r.data),
  })
  const { data: rates = [] } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.get('/currencies/exchange-rates').then(r => r.data),
  })

  const addRate = useMutation({
    mutationFn: data => api.post('/currencies/exchange-rates', data),
    onSuccess: () => { qc.invalidateQueries(['exchange-rates']); toast.success('Curs adaugat.') },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Monede & Cursuri</h2>
        <p className="text-sm text-slate-500">Gestioneaza monedele si cursurile de schimb.</p>
      </div>

      {/* Currencies */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-3">Monede active</h3>
        <div className="flex flex-wrap gap-3">
          {currencies.map(c => (
            <div key={c.code} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-bold text-slate-800">{c.symbol}</span>
              <span className="text-sm text-slate-600">{c.code}</span>
              <span className="text-xs text-slate-400">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add rate */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-3">Adauga curs de schimb</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">De la</label>
            <select className="input w-24" value={form.from} onChange={e => setForm({...form, from: e.target.value})}>
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">La</label>
            <select className="input w-24" value={form.to} onChange={e => setForm({...form, to: e.target.value})}>
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Curs</label>
            <input type="number" step="0.000001" className="input w-32" placeholder="ex: 4.97" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Data</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <button onClick={() => addRate.mutate(form)} disabled={!form.rate || addRate.isPending} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Adauga
          </button>
        </div>
      </div>

      {/* Rates table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">De la</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">La</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Curs</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Sursa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rates.slice(0, 30).map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-blue-600">{r.from_currency}</td>
                <td className="px-4 py-3 text-slate-700">{r.to_currency}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-800">{Number(r.rate).toFixed(6)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{r.valid_date}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
