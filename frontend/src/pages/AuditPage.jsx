import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { History, FileText, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const ACTION_TYPES = [
  { value: '', label: 'Toate actiunile' },
  { value: 'user.login', label: 'Autentificare' },
  { value: 'workorder.created', label: 'Comanda creata' },
  { value: 'maintenance.created', label: 'Mentenanta creata' },
  { value: 'production.reported', label: 'Productie raportata' },
  { value: 'machine.updated', label: 'Utilaj actualizat' },
]

function ActionsTab() {
  const [page, setPage] = useState(1)
  const [actionType, setActionType] = useState('')
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const limit = 25

  const { data, isLoading } = useQuery({
    queryKey: ['audit-actions', { actionType, entityType, dateFrom, dateTo, page }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (actionType) params.set('actionType', actionType)
      if (entityType) params.set('entityType', entityType)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo + 'T23:59:59')
      params.set('page', page)
      params.set('limit', limit)
      return api.get(`/audit/actions?${params}`).then(r => r.data)
    },
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filtre</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={actionType}
            onChange={e => { setActionType(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {ACTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tip entitate (ex: order)"
            value={entityType}
            onChange={e => { setEntityType(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Utilizator</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actiune</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Entitate</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Descriere</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Se incarca...</td></tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio actiune gasita.</td></tr>
              )}
              {data?.data?.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString('ro-RO')}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{a.user_name || a.user_email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {a.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {a.entity_type && (
                      <span className="text-slate-500">{a.entity_type}: </span>
                    )}
                    {a.entity_name || a.entity_id || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{a.description || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{a.ip_address || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">
              Total: {data.total} | Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChangesTab() {
  const [page, setPage] = useState(1)
  const [tableName, setTableName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const limit = 25

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-changes', { tableName, dateFrom, dateTo, page }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (tableName) params.set('tableName', tableName)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo + 'T23:59:59')
      params.set('page', page)
      params.set('limit', limit)
      return api.get(`/audit/changes?${params}`).then(r => r.data)
    },
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  if (error?.response?.status === 403) {
    return <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-yellow-700">Acces permis doar pentru administratori.</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filtre</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Nume tabel (ex: machines)"
            value={tableName}
            onChange={e => { setTableName(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tabel</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Operatie</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Record ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Modificat de</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Campuri modificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Se incarca...</td></tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nicio modificare gasita.</td></tr>
              )}
              {data?.data?.map(c => {
                const opColor = c.operation === 'INSERT' ? 'bg-green-100 text-green-700'
                  : c.operation === 'DELETE' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                const fields = c.changed_fields
                  ? (typeof c.changed_fields === 'string' ? JSON.parse(c.changed_fields) : c.changed_fields)
                  : null
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(c.changed_at).toLocaleString('ro-RO')}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.table_schema}.{c.table_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${opColor}`}>
                        {c.operation}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.record_id ? c.record_id.substring(0, 8) + '...' : '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{c.changed_by ? c.changed_by.substring(0, 8) + '...' : '-'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">
                      {fields ? fields.join(', ') : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500">
              Total: {data.total} | Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuditPage() {
  const [tab, setTab] = useState('actions')
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('actions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'actions' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Actiuni
        </button>
        <button
          onClick={() => setTab('changes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'changes' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Modificari
        </button>
      </div>

      {tab === 'actions' ? <ActionsTab /> : <ChangesTab />}
    </div>
  )
}
