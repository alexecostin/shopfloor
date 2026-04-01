import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { I18nProvider } from './i18n/I18nProvider'
import Layout from './components/Layout'
import AppLayout from './layouts/AppLayout'
import OperatorLayout from './layouts/OperatorLayout'
import LoginPage from './pages/LoginPage'
import ThemePage from './pages/ThemePage'
import useTheme from './hooks/useTheme'
import DashboardPage from './pages/DashboardPage'
import MachinesPage from './pages/MachinesPage'
import ProductionPage from './pages/ProductionPage'
import MaintenancePage from './pages/MaintenancePage'
import ChecklistsPage from './pages/ChecklistsPage'
import UsersPage from './pages/UsersPage'
import BomPage from './pages/BomPage'
import PlanningPage from './pages/PlanningPage'
import InventoryPage from './pages/InventoryPage'
import CompaniesPage from './pages/CompaniesPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import SkillMatrixPage from './pages/SkillMatrixPage'
import ToolsPage from './pages/ToolsPage'
import AlertsPage from './pages/AlertsPage'
import CostsPage from './pages/CostsPage'
import ReportsPage from './pages/ReportsPage'
import ImportPage from './pages/ImportPage'
import AdminPage from './pages/AdminPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ShiftsPage from './pages/ShiftsPage'
import LookupsPage from './pages/LookupsPage'
import CurrencyPage from './pages/CurrencyPage'
import ProfilePage from './pages/ProfilePage'
import SchedulingPage from './pages/SchedulingPage'
import SetupPage from './pages/SetupPage'
import AuditPage from './pages/AuditPage'
import ReworkPage from './pages/ReworkPage'
import BarcodesPage from './pages/BarcodesPage'
import TraceabilityPage from './pages/TraceabilityPage'
import MachineKPIPage from './pages/MachineKPIPage'
import WorkInstructionsPage from './pages/WorkInstructionsPage'
import PurchasingPage from './pages/PurchasingPage'
import ShipmentsPage from './pages/ShipmentsPage'
import QualityPage from './pages/QualityPage'
import DocumentsPage from './pages/DocumentsPage'
import SupplierScorecardPage from './pages/SupplierScorecardPage'
import IntegrationsPage from './pages/IntegrationsPage'
import ClientOrdersPage from './pages/ClientOrdersPage'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } })

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  const { loadFullTheme } = useTheme()
  const isOperatorOnly = user?.role === 'operator' && !user?.roles?.some(r => !['operator'].includes(r))
  const LayoutComponent = isOperatorOnly ? OperatorLayout : AppLayout
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={
        <PrivateRoute>
          <LayoutComponent>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/machines" element={<MachinesPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/checklists" element={<ChecklistsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/bom" element={<BomPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/work-orders" element={<WorkOrdersPage />} />
              <Route path="/skill-matrix" element={<SkillMatrixPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/costs" element={<CostsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/shifts" element={<ShiftsPage />} />
              <Route path="/lookups" element={<LookupsPage />} />
              <Route path="/currency" element={<CurrencyPage />} />
              <Route path="/theme" element={<ThemePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/scheduling" element={<SchedulingPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/rework" element={<ReworkPage />} />
              <Route path="/barcodes" element={<BarcodesPage />} />
              <Route path="/traceability" element={<TraceabilityPage />} />
              <Route path="/machine-kpi" element={<MachineKPIPage />} />
              <Route path="/work-instructions" element={<WorkInstructionsPage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/shipments" element={<ShipmentsPage />} />
              <Route path="/quality" element={<QualityPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/supplier-scorecard" element={<SupplierScorecardPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/client-orders" element={<ClientOrdersPage />} />
            </Routes>
          </LayoutComponent>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <Toaster position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </I18nProvider>
  )
}
