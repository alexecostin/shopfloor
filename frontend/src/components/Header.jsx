import { Menu, Bell, ChevronDown, User, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from '../i18n/I18nProvider'

export default function Header({ onToggleSidebar, companyName = 'ShopFloor.ro', logoUrl = null, alertCount = 0, mode = 'desktop' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const { lang, setLang, t } = useTranslation()

  function handleLogout() {
    logout()
    toast.success(t('auth.logoutSuccess'))
    navigate('/login')
  }

  if (mode === 'mobile') {
    return (
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-6 object-contain" /> : <span className="text-white font-bold text-sm">{companyName}</span>}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/alerts')} className="relative text-slate-300">
            <Bell size={18} />
            {alertCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{alertCount}</span>}
          </button>
          <button
            onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded border border-slate-600 hover:border-slate-400 transition-colors"
            title="Switch language"
          >
            {lang === 'ro' ? 'EN' : 'RO'}
          </button>
          <button onClick={() => setProfileOpen(o => !o)} className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
            {user?.full_name?.[0] || 'U'}
          </button>
        </div>
      </header>
    )
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      {mode === 'tablet' && (
        <button onClick={onToggleSidebar} className="text-slate-600 mr-1">
          <Menu size={20} />
        </button>
      )}
      {mode === 'tablet' && (
        logoUrl ? <img src={logoUrl} alt="Logo" className="h-6 object-contain" /> : <span className="font-semibold text-slate-800 text-sm">{companyName}</span>
      )}
      {mode === 'desktop' && (
        <div className="flex-1 text-sm text-slate-500 font-medium">
          {/* Breadcrumb slot */}
        </div>
      )}
      <div className="ml-auto flex items-center gap-3">
        <button onClick={() => navigate('/alerts')} className="relative text-slate-500 hover:text-slate-700">
          <Bell size={18} />
          {alertCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{alertCount}</span>}
        </button>
        <button
          onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-1 rounded border border-slate-200 hover:border-slate-400 transition-colors"
          title="Switch language"
        >
          {lang === 'ro' ? 'EN' : 'RO'}
        </button>
        <div className="relative">
          <button onClick={() => setProfileOpen(o => !o)} className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
              {user?.full_name?.[0] || 'U'}
            </div>
            <span className="hidden md:block truncate max-w-[100px]">{user?.full_name}</span>
            <ChevronDown size={12} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">{t('auth.logout')}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
