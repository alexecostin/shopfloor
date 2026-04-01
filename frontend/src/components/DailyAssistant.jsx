import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Info, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react'
import api from '../api/client'

const ROLE_LABELS = {
  inginer_tehnolog: 'Inginer Tehnolog',
  logistica: 'Logistica',
  comercial: 'Comercial',
  planificator: 'Planificator',
  mentenanta: 'Mentenanta',
}

const SEVERITY_CONFIG = {
  critical: {
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    textColor: 'text-red-800',
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    textColor: 'text-amber-800',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50',
    icon: Info,
    iconColor: 'text-blue-600',
    textColor: 'text-blue-800',
  },
  success: {
    border: 'border-l-green-500',
    bg: 'bg-green-50',
    icon: CheckCircle,
    iconColor: 'text-green-600',
    textColor: 'text-green-800',
  },
}

function TaskCard({ task }) {
  const navigate = useNavigate()
  const config = SEVERITY_CONFIG[task.severity] || SEVERITY_CONFIG.info
  const Icon = config.icon

  return (
    <button
      onClick={() => task.actionUrl && navigate(task.actionUrl)}
      className={`w-full text-left rounded-lg border-l-4 ${config.border} ${config.bg} p-3 flex items-start gap-3 hover:opacity-80 transition-opacity cursor-pointer`}
    >
      <Icon size={18} className={`${config.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${config.textColor}`}>{task.message}</span>
        {task.assignTo && (
          <div className="flex items-center gap-1 mt-1">
            <ArrowRight size={12} className="text-slate-400" />
            <span className="text-xs text-slate-500">Responsabil: <strong>{ROLE_LABELS[task.assignTo] || task.assignTo}</strong></span>
          </div>
        )}
      </div>
    </button>
  )
}

export default function DailyAssistant() {
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['daily-assistant-tasks'],
    queryFn: () => api.get('/dashboard/tasks').then((r) => r.data),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          Se incarca asistentul zilnic...
        </div>
      </div>
    )
  }

  if (!tasks || tasks.length === 0) return null

  const criticalCount = tasks.filter((t) => t.severity === 'critical').length
  const warningCount = tasks.filter((t) => t.severity === 'warning').length

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          Asistent Zilnic
          {criticalCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {criticalCount} critice
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {warningCount} avertismente
            </span>
          )}
        </h3>
        <button
          onClick={() => refetch()}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Reincarca"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((task, idx) => (
          <TaskCard key={idx} task={task} />
        ))}
      </div>
    </div>
  )
}
