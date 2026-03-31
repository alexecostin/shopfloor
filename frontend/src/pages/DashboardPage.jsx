// File: frontend/src/pages/DashboardPage.jsx
import { useAuth } from '../context/AuthContext'
import DailyAssistant from '../components/DailyAssistant'
import GeneralDashboard from './dashboards/GeneralDashboard'
import ShiftDashboard from './dashboards/ShiftDashboard'
import MaintenanceDashboard from './dashboards/MaintenanceDashboard'
import ExecutiveDashboard from './dashboards/ExecutiveDashboard'

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role

  if (role === 'director') return <><DailyAssistant /><ExecutiveDashboard /></>
  if (role === 'shift_leader') return <><DailyAssistant /><ShiftDashboard /></>
  if (role === 'maintenance') return <><DailyAssistant /><MaintenanceDashboard /></>
  return <><DailyAssistant /><GeneralDashboard /></>
}
