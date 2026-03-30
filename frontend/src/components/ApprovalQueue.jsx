import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export function useApprovalPendingCount() {
  const { data } = useQuery({
    queryKey: ['approval-pending'],
    queryFn: () => api.get('/approvals/pending').then(r => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  })
  return data?.length || 0
}

export default function ApprovalQueue() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['approval-pending'],
    queryFn: () => api.get('/approvals/pending').then(r => r.data),
    refetchInterval: 60000,
  })

  if (isLoading) return <div className="p-4 text-sm text-slate-500">Se incarca...</div>

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Asteapta aprobarea mea ({items.length})
      </h2>
      {items.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">Nicio cerere in asteptare</p>
      )}
      {items.map(item => (
        <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Clock size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 capitalize">
                {item.document_type.replace('_', ' ')}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {item.document_reference || item.document_id}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Nivel {item.current_level} — {item.level_label}</p>
            </div>
          </div>
          <Link
            to={item.document_type === 'mbom' ? '/bom' : `/${item.document_type}`}
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <CheckCircle size={12} /> Deschide pentru aprobare
          </Link>
        </div>
      ))}
    </div>
  )
}
