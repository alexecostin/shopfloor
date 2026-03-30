import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react'
import * as Icons from 'lucide-react'
import toast from 'react-hot-toast'

function IconComponent({ name, size = 16 }) {
  const Icon = Icons[name] || Icons.Circle
  return <Icon size={size} />
}

function MenuItem({ item, depth = 0 }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <IconComponent name={item.icon} />
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
            {item.children.map(child => (
              <NavLink
                key={child.id}
                to={child.path}
                end={child.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors
                  ${isActive ? 'text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
      }
    >
      <IconComponent name={item.icon} />
      {item.label}
    </NavLink>
  )
}

export default function Sidebar({ menu = [], logoUrl = null, companyName = 'ShopFloor.ro', onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    toast.success('Deconectat.')
    navigate('/login')
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full w-60 bg-slate-900 text-white">
      {/* Logo / Header */}
      <div className="px-4 py-5 border-b border-slate-700 flex-shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 object-contain mb-1" />
        ) : (
          <h1 className="text-lg font-bold text-white">{companyName}</h1>
        )}
        <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.full_name}</p>
        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block capitalize">
          {user?.role?.replace('_', ' ')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {menu.map(item => (
          <MenuItem key={item.id} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-4 border-t border-slate-700 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
        >
          <LogOut size={16} />
          Deconectare
        </button>
      </div>
    </div>
  )
}
