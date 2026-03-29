import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Cpu, ClipboardList, Wrench,
  CheckSquare, Users, LogOut, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','production_manager','shift_leader','operator','maintenance'] },
  { to: '/machines', label: 'Utilaje', icon: Cpu, roles: ['admin','production_manager','shift_leader','operator','maintenance'] },
  { to: '/production', label: 'Productie', icon: ClipboardList, roles: ['admin','production_manager','shift_leader','operator'] },
  { to: '/maintenance', label: 'Mentenanta', icon: Wrench, roles: ['admin','production_manager','maintenance'] },
  { to: '/checklists', label: 'Checklists', icon: CheckSquare, roles: ['admin','production_manager','shift_leader','operator'] },
  { to: '/users', label: 'Utilizatori', icon: Users, roles: ['admin','production_manager'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    logout()
    toast.success('Deconectat.')
    navigate('/login')
  }

  const links = NAV.filter((n) => n.roles.includes(user?.role))

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-slate-900 text-white flex flex-col transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">ShopFloor.ro</h1>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.full_name}</p>
          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block capitalize">{user?.role?.replace('_', ' ')}</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <LogOut size={16} />
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
            <Menu size={20} />
          </button>
          <span className="font-semibold text-slate-800">ShopFloor.ro</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
