import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, XCircle, Send } from 'lucide-react'
import api from '../api/client'
import ApprovalBadge from '../components/ApprovalBadge'

const TABS = ['Asteapta mine', 'Trimise de mine']

export default function ApprovalsPage() {
  const [tab, setTab] = useState(0)

  const { data: pending = [] } = useQuery({
    queryKey: ['approval-pending'],
    queryFn: () => api.get('/approvals/pending').then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: submitted = [] } = useQuery({
    queryKey: ['approval-my-submissions'],
    queryFn: () => api.get('/approvals/my-submissions').then(r => r.data),
  })

  const list = tab === 0 ? pending : submitted

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Aprobari</h1>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === i ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
            {i === 0 && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">Nicio cerere</div>
        )}
        {list.map(item => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800 capitalize">
                    {item.document_type?.replace('_', ' ')}
                  </span>
                  <ApprovalBadge status={item.status} version={item.version} />
                </div>
                <p className="text-xs text-slate-500">
                  Ref: {item.document_reference || item.document_id}
                </p>
                {item.level_label && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Nivel curent: {item.current_level} — {item.level_label}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(item.submitted_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="text-slate-400">
                {item.status === 'pending' ? <Clock size={18} /> : item.status === 'approved' ? <CheckCircle size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
