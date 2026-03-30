import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import useTheme from '../hooks/useTheme'
import { useTranslation } from '../i18n/I18nProvider'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const { t } = useTranslation()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`${t('auth.welcome')}, ${user.full_name}!`)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          {theme.logoUrl && (
            <img src={theme.logoUrl} alt="Logo" className="h-12 object-contain mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-slate-800">{theme.companyNameDisplay || 'ShopFloor.ro'}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('auth.login')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.email')}</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@shopfloor.local"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? t('common.loading') : t('auth.loginButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
