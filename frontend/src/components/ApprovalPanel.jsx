import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, ChevronRight, History } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import ApprovalBadge from './ApprovalBadge'

const STEP_ICONS = {
  waiting: <Clock size={18} className="text-amber-500" />,
  approved: <CheckCircle size={18} className="text-green-500" />,
  rejected: <XCircle size={18} className="text-red-500" />,
  skipped: <ChevronRight size={18} className="text-slate-400" />,
}

export default function ApprovalPanel({ documentType, documentId, currentStatus, currentVersion, onStatusChange }) {
  const [comment, setComment] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const qc = useQueryClient()

  const { data: approval } = useQuery({
    queryKey: ['approval-status', documentType, documentId],
    queryFn: () => api.get(`/approvals/history/${documentType}/${documentId}`).then(r => r.data[0] || null),
    enabled: !!documentId,
  })

  const { data: versions } = useQuery({
    queryKey: ['approval-versions', documentType, documentId],
    queryFn: () => api.get(`/approvals/versions/${documentType}/${documentId}`).then(r => r.data),
    enabled: showVersions && !!documentId,
  })

  const { data: requestDetail } = useQuery({
    queryKey: ['approval-detail', approval?.id],
    queryFn: () => api.get(`/approvals/${approval.id}`).then(r => r.data),
    enabled: !!approval?.id,
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post('/approvals/submit', { documentType, documentId, documentReference: documentId }),
    onSuccess: () => {
      toast.success('Trimis spre aprobare!')
      qc.invalidateQueries(['approval-status', documentType, documentId])
      qc.invalidateQueries(['approval-detail'])
      onStatusChange?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la trimitere'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ requestId }) => api.post(`/approvals/${requestId}/approve`, { comment }),
    onSuccess: () => {
      toast.success('Aprobat!')
      setComment('')
      qc.invalidateQueries(['approval-status', documentType, documentId])
      qc.invalidateQueries(['approval-detail', approval?.id])
      onStatusChange?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la aprobare'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ requestId }) => api.post(`/approvals/${requestId}/reject`, { comment }),
    onSuccess: () => {
      toast.error('Respins')
      setComment('')
      qc.invalidateQueries(['approval-status', documentType, documentId])
      qc.invalidateQueries(['approval-detail', approval?.id])
      onStatusChange?.()
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  })

  const steps = requestDetail?.steps || []
  const canApprove = requestDetail?.status === 'pending'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Flux aprobare</h3>
        <ApprovalBadge status={currentStatus} version={currentVersion} />
      </div>

      {/* Timeline */}
      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5">{STEP_ICONS[step.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    Nivel {step.level} — {step.level_label}
                  </span>
                  {step.status !== 'waiting' && (
                    <ApprovalBadge status={step.status} size="xs" />
                  )}
                </div>
                {step.decided_by_name && (
                  <p className="text-xs text-slate-500">
                    {step.decided_by_name} · {new Date(step.decided_at).toLocaleDateString('ro-RO')}
                  </p>
                )}
                {step.comment && (
                  <p className="text-xs text-slate-500 italic mt-0.5">"{step.comment}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {currentStatus === 'draft' && (
        <button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
          className="w-full bg-blue-600 text-white text-sm rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {submitMutation.isPending ? 'Se trimite...' : 'Trimite spre aprobare'}
        </button>
      )}

      {canApprove && requestDetail && (
        <div className="space-y-2 border-t pt-3">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comentariu (optional)..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => approveMutation.mutate({ requestId: requestDetail.id })}
              disabled={approveMutation.isPending}
              className="flex-1 bg-green-600 text-white text-sm rounded-lg py-2 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <CheckCircle size={14} /> Aproba
            </button>
            <button
              onClick={() => {
                if (!comment.trim()) { toast.error('Adauga un motiv pentru respingere.'); return; }
                rejectMutation.mutate({ requestId: requestDetail.id })
              }}
              disabled={rejectMutation.isPending}
              className="flex-1 bg-red-600 text-white text-sm rounded-lg py-2 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <XCircle size={14} /> Respinge
            </button>
          </div>
        </div>
      )}

      {/* Versions toggle */}
      <button
        onClick={() => setShowVersions(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
      >
        <History size={13} />
        {showVersions ? 'Ascunde versiuni' : 'Istoric versiuni'}
      </button>

      {showVersions && versions && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {versions.map(v => (
            <div key={v.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">
              <span className="font-mono">v{v.version}</span>
              <span>{new Date(v.created_at).toLocaleDateString('ro-RO')}</span>
            </div>
          ))}
          {versions.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Fara versiuni anterioare</p>}
        </div>
      )}
    </div>
  )
}
