// File: frontend/src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext'
import GeneralDashboard from './dashboards/GeneralDashboard'
import ShiftDashboard from './dashboards/ShiftDashboard'
import MaintenanceDashboard from './dashboards/MaintenanceDashboard'
import ExecutiveDashboard from './dashboards/ExecutiveDashboard'

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role

  if (role === 'director') return <ExecutiveDashboard />
  if (role === 'shift_leader') return <ShiftDashboard />
  if (role === 'maintenance') return <MaintenanceDashboard />
  return <GeneralDashboard />
}
