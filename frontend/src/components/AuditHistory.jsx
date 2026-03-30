import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

export default function AuditHistory({ entityType, entityId }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['audit-history', entityType, entityId],
    queryFn: () => api.get(`/audit/entity/${entityType}/${entityId}`).then(r => r.data),
    enabled: !!entityType && !!entityId,
  })

  if (isLoading) return <div className="text-slate-400 text-sm">Se incarca istoricul...</div>
  if (!data.length) return <div className="text-slate-400 text-sm">Nicio actiune inregistrata.</div>

  return (
    <div className="space-y-2">
      {data.map(a => (
        <div key={a.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
          <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{a.user_name || 'Sistem'}</span>
              {' — '}{a.description || a.action_type}
            </p>
            <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString('ro-RO')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
