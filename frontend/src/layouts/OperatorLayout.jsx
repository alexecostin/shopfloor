import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, LogOut, Clock, X } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import OperatorWorkSheet from '../components/OperatorWorkSheet'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useTranslation } from '../i18n/I18nProvider'

function useCurrentShift(orgUnitId) {
  const [shift, setShift] = useState(null)
  useEffect(() => {
    if (!orgUnitId) return
    api.get(`/shifts/current?orgUnitId=${orgUnitId}`)
      .then(r => setShift(r.data))
      .catch(() => setShift(null))
    const interval = setInterval(() => {
      api.get(`/shifts/current?orgUnitId=${orgUnitId}`)
        .then(r => setShift(r.data))
        .catch(() => {})
    }, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [orgUnitId])
  return shift
}

export default function OperatorLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [machineOpen, setMachineOpen] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState(() => {
    return localStorage.getItem('operator_machine_id') || null
  })
  const [selectedMachineCode, setSelectedMachineCode] = useState(() => {
    return localStorage.getItem('operator_machine_code') || user?.selectedMachine || null
  })
  const orgUnitId = user?.scopes?.[0]?.orgUnitId || null
  const currentShift = useCurrentShift(orgUnitId)
  const { t } = useTranslation()

  // Fetch machines for selection dropdown
  const { data: machines } = useQuery({
    queryKey: ['operator-machines'],
    queryFn: () => api.get('/machines?limit=500').then(r => r.data?.data || r.data || []),
    staleTime: 10 * 60 * 1000,
  })

  function handleSelectMachine(machine) {
    setSelectedMachineId(machine.id)
    setSelectedMachineCode(machine.code)
    localStorage.setItem('operator_machine_id', machine.id)
    localStorage.setItem('operator_machine_code', machine.code)
    setMachineOpen(false)
  }

  function handleLogout() {
    logout()
    localStorage.removeItem('operator_machine_id')
    localStorage.removeItem('operator_machine_code')
    toast.success(t('auth.logoutSuccess'))
    navigate('/login')
  }

  const shiftLabel = currentShift
    ? `${currentShift.shiftName} (${currentShift.startTime}–${currentShift.endTime})`
    : t('shifts.outside')

  // Show the work sheet on the dashboard (home) page
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard'

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-16">
      {/* Operator header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-bold text-white flex-shrink-0">SF</span>
        <div className="relative">
          <button
            onClick={() => setMachineOpen(o => !o)}
            className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1.5 text-sm min-h-[44px] md:min-h-0"
          >
            <span>Masina: {selectedMachineCode || user?.selectedMachine || 'Neselectata'}</span>
            <ChevronDown size={13} />
          </button>
          {machineOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase">Selecteaza masina</span>
                <button onClick={() => setMachineOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              {machines?.length > 0 ? machines.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMachine(m)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${
                    selectedMachineId === m.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className="font-medium">{m.code}</span>
                  {m.name && <span className="text-slate-400 ml-1.5">— {m.name}</span>}
                </button>
              )) : (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">Nu exista masini.</div>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-300">
            <Clock size={12} />
            {shiftLabel}
          </span>
          <button onClick={() => navigate('/alerts')} className="text-slate-300">
            <Bell size={18} />
          </button>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main content — touch-friendly */}
      <main className="flex-1 p-4 overflow-y-auto">
        {isDashboard && (
          <div className="mb-4">
            <OperatorWorkSheet machineId={selectedMachineId} />
          </div>
        )}
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
