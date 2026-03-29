import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
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

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } })

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
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
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
