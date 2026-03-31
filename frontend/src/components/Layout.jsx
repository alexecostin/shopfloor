import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as Icons from 'lucide-react'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useOnlineStatus, usePendingCount } from '../hooks/useOffline'
import { useApprovalPendingCount } from './ApprovalQueue'
import { getMenuForUser } from '../config/menuConfig'

function MenuIcon({ name, size = 18 }) {
  const Icon = Icons[name] || Icons.Circle
  return <Icon size={size} />
}

function SidebarMenu({ items, onNavigate, approvalCount }) {
  const [expanded, setExpanded] = useState({})
  const location = useLocation()

  // Auto-expand group containing current path
  useEffect(() => {
    items.forEach(item => {
      if (item.children?.some(c => c.path === location.pathname)) {
        setExpanded(prev => ({ ...prev, [item.id]: true }))
      }
    })
  }, [location.pathname, items])

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {items.map(item => {
        if (item.children) {
          const isOpen = expanded[item.id]
          return (
            <div key={item.id}>
              <button
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <MenuIcon name={item.icon} size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                <Icons.ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
                  {item.children.map(child => (
                    <NavLink key={child.id} to={child.path}
                      onClick={onNavigate}
                      className={({ isActive }) => `block px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}>
                      {child.label}
                      {child.path === '/approvals' && approvalCount > 0 && (
                        <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 inline-flex items-center justify-center">{approvalCount}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        }
        // Simple item (no children)
        return (
          <NavLink key={item.id} to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
              isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            <MenuIcon name={item.icon} size={18} />
            {item.label}
            {item.path === '/approvals' && approvalCount > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{approvalCount}</span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const online = useOnlineStatus()
  const { count: pendingCount, refresh: refreshPending } = usePendingCount()
  const approvalCount = useApprovalPendingCount()

  useEffect(() => {
    const handler = (e) => {
      toast.success(`${e.detail.count} rapoarte sincronizate!`)
      refreshPending()
    }
    window.addEventListener('sw-sync-done', handler)
    return () => window.removeEventListener('sw-sync-done', handler)
  }, [refreshPending])

  function handleLogout() {
    logout()
    toast.success('Deconectat.')
    navigate('/login')
  }

  const menuItems = getMenuForUser(user)

  return (
    <div className="flex h-screen bg-slate-100 flex-col">
      {/* Offline banner */}
      {!online && (
        <div className="flex items-center justify-center gap-2 bg-red-500 text-white text-xs py-1.5 px-4">
          <Icons.WifiOff size={13} />
          Offline — Datele se vor sincroniza la reconectare
          {pendingCount > 0 && <span className="bg-white text-red-500 rounded-full px-2 font-bold ml-1">{pendingCount}</span>}
        </div>
      )}
      {/* License grace warning banner */}
      {user?.licenseStatus === 'grace' && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-white text-xs py-1.5 px-4">
          ⚠️ Licenta expira curand — contactati administratorul pentru reinnoire
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-900 text-white flex flex-col transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">ShopFloor.ro</h1>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.full_name}</p>
          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block capitalize">{user?.role?.replace('_', ' ')}</span>
        </div>

        <SidebarMenu items={menuItems} onNavigate={() => setOpen(false)} approvalCount={approvalCount} />

        <div className="px-2 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <Icons.LogOut size={16} />
            Deconectare
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-slate-600">
            <Icons.Menu size={20} />
          </button>
          <span className="font-semibold text-slate-800">ShopFloor.ro</span>
          {pendingCount > 0 && (
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {pendingCount} nesincronizat{pendingCount > 1 ? 'e' : ''}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
      </div>
    </div>
  )
}
