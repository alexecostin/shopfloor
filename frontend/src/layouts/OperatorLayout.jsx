import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, Clock } from 'lucide-react'
import BottomNav from '../components/BottomNav'
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
  const [machineOpen, setMachineOpen] = useState(false)
  const orgUnitId = user?.scopes?.[0]?.orgUnitId || null
  const currentShift = useCurrentShift(orgUnitId)
  const { t } = useTranslation()

  function handleLogout() {
    logout()
    toast.success(t('auth.logoutSuccess'))
    navigate('/login')
  }

  const shiftLabel = currentShift
    ? `${currentShift.shiftName} (${currentShift.startTime}–${currentShift.endTime})`
    : t('shifts.outside')

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-16">
      {/* Operator header */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-bold text-white flex-shrink-0">SF</span>
        <button
          onClick={() => setMachineOpen(o => !o)}
          className="flex items-center gap-1 bg-slate-700 rounded-lg px-3 py-1.5 text-sm min-h-[64px] md:min-h-0"
        >
          <span>Masina: {user?.selectedMachine || 'Neselectata'}</span>
          <ChevronDown size={13} />
        </button>
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
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
