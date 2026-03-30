import { NavLink } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { getBottomNavForRole } from '../config/menuConfig'
import { useAuth } from '../context/AuthContext'

function IconComp({ name, size = 20 }) {
  const Icon = Icons[name] || Icons.Circle
  return <Icon size={size} />
}

export default function BottomNav({ alertCount = 0 }) {
  const { user } = useAuth()
  const roles = user?.roles || (user?.role ? [user.role] : [])
  const items = getBottomNavForRole(roles)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 flex">
      {items.map(item => (
        <NavLink
          key={item.path + item.label}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors relative min-h-[48px]
            ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`
          }
        >
          <div className="relative">
            <IconComp name={item.icon} size={20} />
            {item.icon === 'Bell' && alertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
