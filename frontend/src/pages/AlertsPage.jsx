import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Bell, X, Mail, Smartphone, BellRing } from 'lucide-react'

const SEV_COLORS = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
}

const RULE_TYPES = [
  { value: 'stock_low', label: 'Stoc scazut' },
  { value: 'oee_low', label: 'OEE scazut' },
  { value: 'maintenance_overdue', label: 'Mentenanta depasita' },
  { value: 'custom', label: 'Custom' },
]

const CHANNEL_ICONS = { email: Mail, sms: Smartphone, push: BellRing }

function CreateRuleModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', description: '', rule_type: 'stock_low', severity: 'warning', is_active: true,
    condition: { threshold: '' },
  })
  const f = k => e => setForm({ ...form, [k]: e.target.value })

  const mut = useMutation({
    mutationFn: d => api.post('/alerts/rules', d),
    onSuccess: () => { qc.invalidateQueries(['alert-rules']); toast.success('Regula creata.'); onClose() },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">Regula noua</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nume regula *</label>
            <input className="input w-full" placeholder="Ex: Stoc minim atins" value={form.name} onChange={f('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descriere</label>
            <textarea className="input w-full" rows={2} placeholder="Descrieti scopul regulii" value={form.description} onChange={f('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tip regula</label>
              <select className="input w-full" value={form.rule_type} onChange={f('rule_type')}>
                {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Severitate</label>
              <select className="input w-full" value={form.severity} onChange={f('severity')}>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Prag (threshold)</label>
            <input className="input w-full" type="number" placeholder="ex: 10" value={form.condition.threshold}
              onChange={e => setForm({ ...form, condition: { ...form.condition, threshold: e.target.value } })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
            Activa
          </label>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mut.mutate({ ...form, condition: { threshold: form.condition.threshold ? Number(form.condition.threshold) : undefined } })}
            disabled={mut.isPending || !form.name}
            className="btn-primary"
          >
            {mut.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RuleDetailModal({ rule, onClose }) {
  const qc = useQueryClient()
  const [channelType, setChannelType] = useState('email')
  const [channelTarget, setChannelTarget] = useState('')

  const { data: channelsData, isLoading: chLoading } = useQuery({
    queryKey: ['rule-channels', rule.id],
    queryFn: () => api.get(`/alerts/rules/${rule.id}/channels`).then(r => r.data),
  })

  const addChannel = useMutation({
    mutationFn: d => api.post(`/alerts/rules/${rule.id}/channels`, d),
    onSuccess: () => { qc.invalidateQueries(['rule-channels', rule.id]); toast.success('Canal adaugat.'); setChannelTarget('') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const removeChannel = useMutation({
    mutationFn: id => api.delete(`/alerts/channels/${id}`),
    onSuccess: () => { qc.invalidateQueries(['rule-channels', rule.id]); toast.success('Canal sters.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const channels = channelsData?.data || channelsData || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{rule.name}</h3>
            {rule.description && <p className="text-xs text-slate-400">{rule.description}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_COLORS[rule.severity] || 'bg-slate-100'}`}>{rule.severity}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{rule.rule_type}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {rule.is_active ? 'Activa' : 'Inactiva'}
          </span>
        </div>

        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Canale de notificare</h4>
        {chLoading ? <p className="text-slate-400 text-sm">Se incarca...</p> : (
          <div className="space-y-2 mb-4">
            {channels.map(ch => {
              const Icon = CHANNEL_ICONS[ch.channel_type] || Bell
              return (
                <div key={ch.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <Icon size={14} className="text-slate-500" />
                  <span className="text-sm text-slate-700 flex-1">{ch.channel_type}: {ch.target}</span>
                  <button onClick={() => removeChannel.mutate(ch.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              )
            })}
            {channels.length === 0 && <p className="text-sm text-slate-400">Niciun canal configurat.</p>}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-shrink-0">
            <label className="text-xs text-slate-500 mb-1 block">Tip</label>
            <select className="input" value={channelType} onChange={e => setChannelType(e.target.value)}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Destinatar</label>
            <input className="input w-full" placeholder="ex: user@email.com" value={channelTarget} onChange={e => setChannelTarget(e.target.value)} />
          </div>
          <button
            onClick={() => addChannel.mutate({ channelType, target: channelTarget })}
            disabled={addChannel.isPending || !channelTarget}
            className="btn-primary text-sm"
          >
            Adauga
          </button>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="btn-secondary">Inchide</button>
        </div>
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const [tab, setTab] = useState('alerts')
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [selectedRule, setSelectedRule] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const qc = useQueryClient()

  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts', { params: { status: 'new' } }).then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: rulesData, isLoading: rLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: () => api.get('/alerts/rules').then(r => r.data),
    enabled: tab === 'rules',
  })

  const { data: alertCount } = useQuery({
    queryKey: ['alert-count'],
    queryFn: () => api.get('/alerts/count').then(r => r.data).catch(() => null),
    refetchInterval: 60000,
  })

  const ackMut = useMutation({
    mutationFn: id => api.put(`/alerts/${id}/acknowledge`),
    onSuccess: () => { qc.invalidateQueries(['alerts']); qc.invalidateQueries(['alert-count']); toast.success('Marcat vazut.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const resolveMut = useMutation({
    mutationFn: id => api.put(`/alerts/${id}/resolve`),
    onSuccess: () => { qc.invalidateQueries(['alerts']); qc.invalidateQueries(['alert-count']); toast.success('Rezolvat.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const toggleRuleMut = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/alerts/rules/${id}`, { is_active }),
    onSuccess: () => { qc.invalidateQueries(['alert-rules']); toast.success('Regula actualizata.') },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const deleteRuleMut = useMutation({
    mutationFn: id => api.delete(`/alerts/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries(['alert-rules']); toast.success('Regula stearsa.'); setDeleteConfirm(null) },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const checkMut = useMutation({
    mutationFn: () => api.post('/alerts/check'),
    onSuccess: data => { qc.invalidateQueries(['alerts']); qc.invalidateQueries(['alert-count']); toast.success(`Verificare finalizata: ${data?.data?.triggered || 0} alerte noi.`) },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) toast.error('Aceasta inregistrare exista deja.');
      else if (msg.includes('not-null') || msg.includes('violates')) toast.error('Campuri obligatorii necompletate. Verificati formularul.');
      else if (msg.includes('foreign key')) toast.error('Nu se poate sterge — exista date asociate.');
      else toast.error(msg || 'A aparut o eroare. Incercati din nou.');
    },
  })

  const alerts = alertsData?.data || alertsData || []
  const rules = rulesData?.data || rulesData || []

  const counts = { critical: 0, warning: 0, info: 0 }
  alerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++ })

  const totalCount = alertCount?.count ?? alertCount?.data?.count ?? null

  const tabCls = t => t === tab
    ? 'px-4 py-2 text-sm font-medium bg-white border-b-2 border-blue-600 text-blue-600'
    : 'px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700'

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-700">
        <strong>Scopul acestei pagini:</strong> Alertele sunt generate automat de sistem cand detecteaza probleme: stoc minim, OEE scazut, mentenanta necesara, comenzi la risc. Configurati regulile de alerta si canalele de notificare.
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Alerte</h1>
        {totalCount != null && totalCount > 0 && (
          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full -mt-4">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </div>

      {tab === 'alerts' && (
        <div className="flex gap-3 mb-4">
          {Object.entries(counts).map(([sev, cnt]) => (
            <span key={sev} className={`text-sm px-3 py-1 rounded-full font-medium ${SEV_COLORS[sev]}`}>
              {sev}: {cnt}
            </span>
          ))}
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-4">
        <button className={tabCls('alerts')} onClick={() => setTab('alerts')}>Alerte Active</button>
        <button className={tabCls('rules')} onClick={() => setTab('rules')}>Reguli</button>
      </div>

      {tab === 'alerts' && (
        <div>
          {isLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Severitate</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Titlu</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Mesaj</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Entitate</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Data</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_COLORS[a.severity] || 'bg-slate-100'}`}>{a.severity}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.title}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell max-w-xs truncate">{a.message}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{a.entity_type} #{a.entity_id}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{a.created_at?.slice(0, 16)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => ackMut.mutate(a.id)} className="text-xs btn-secondary py-1">Vazut</button>
                          <button onClick={() => resolveMut.mutate(a.id)} className="text-xs btn-primary py-1">Rezolvat</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {alerts.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center">
                      <Bell size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">Nicio alerta activa</p>
                      <p className="text-slate-400 text-sm mt-1">Totul functioneaza normal. Alertele vor aparea automat cand o regula este declansata.</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <div>
          <div className="flex justify-end mb-3 gap-2">
            <button onClick={() => setShowCreateRule(true)} className="btn-primary text-sm flex items-center gap-1">
              <Plus size={14} /> Regula noua
            </button>
            <button onClick={() => checkMut.mutate()} disabled={checkMut.isPending} className="btn-secondary text-sm">
              {checkMut.isPending ? 'Se verifica...' : 'Ruleaza verificare'}
            </button>
          </div>
          {rLoading ? <p className="text-slate-400">Se incarca...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Regula</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Severitate</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Activ</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedRule(r)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.name}</p>
                        {r.description && <p className="text-xs text-slate-400">{r.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.rule_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_COLORS[r.severity] || 'bg-slate-100'}`}>{r.severity}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleRuleMut.mutate({ id: r.id, is_active: !r.is_active })}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.is_active ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteConfirm(r)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center">
                    <BellRing size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Nicio regula</p>
                    <p className="text-slate-400 text-sm mt-1">Apasa "Regula noua" pentru a configura alerte automate.</p>
                  </td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCreateRule && <CreateRuleModal onClose={() => setShowCreateRule(false)} />}
      {selectedRule && <RuleDetailModal rule={selectedRule} onClose={() => setSelectedRule(null)} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Confirma stergerea</h3>
            <p className="text-sm text-slate-500 mb-4">Sigur doriti sa stergeti regula "{deleteConfirm.name}"?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Anuleaza</button>
              <button
                onClick={() => deleteRuleMut.mutate(deleteConfirm.id)}
                disabled={deleteRuleMut.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                {deleteRuleMut.isPending ? 'Se sterge...' : 'Sterge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
