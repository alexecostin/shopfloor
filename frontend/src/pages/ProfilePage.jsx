import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { User, Lock, Globe, Clock } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()
  const [langForm, setLangForm] = useState({
    preferred_language: user?.preferred_language || 'ro',
    preferred_timezone: user?.preferred_timezone || 'Europe/Bucharest',
  })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwError, setPwError] = useState('')

  const { data: timezones = [] } = useQuery({
    queryKey: ['timezones'],
    queryFn: () => api.get('/admin/settings/timezones').then(r => r.data),
  })

  const profileMut = useMutation({
    mutationFn: (data) => api.put(`/auth/users/${user?.id}`, data),
    onSuccess: () => toast.success('Profil actualizat.'),
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      toast.error(msg || 'Eroare la salvarea profilului. Incercati din nou.');
    },
  })

  const pwMut = useMutation({
    mutationFn: (data) => api.put('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Parola schimbata cu succes.')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwError('')
    },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('invalid') || msg.includes('incorrect')) setPwError('Parola curenta incorecta.');
      else setPwError(msg || 'Eroare la schimbarea parolei. Incercati din nou.');
    },
  })

  function handlePasswordChange() {
    setPwError('')
    if (pwForm.newPassword.length < 8) {
      setPwError('Parola noua trebuie sa aiba minim 8 caractere.')
      return
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Parolele nu coincid.')
      return
    }
    pwMut.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
  }

  const tzList = Array.isArray(timezones) ? timezones : timezones?.data || []

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Profilul Meu</h1>

      {/* User info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <User size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">Informatii Cont</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">Nume</p>
            <p className="text-slate-800 font-medium">{user?.full_name || user?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Email</p>
            <p className="text-slate-800">{user?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Rol</p>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{user?.role || '—'}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Limba</p>
            <p className="text-slate-800">{user?.preferred_language === 'en' ? 'English' : 'Romana'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Fus orar</p>
            <p className="text-slate-800">{user?.preferred_timezone || 'Europe/Bucharest'}</p>
          </div>
        </div>
      </div>

      {/* Edit profile preferences */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">Preferinte</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Limba preferata</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={langForm.preferred_language}
              onChange={e => setLangForm(p => ({ ...p, preferred_language: e.target.value }))}
            >
              <option value="ro">Romana</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fus orar</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={langForm.preferred_timezone}
              onChange={e => setLangForm(p => ({ ...p, preferred_timezone: e.target.value }))}
            >
              {tzList.length > 0 ? tzList.map(tz => (
                <option key={tz.value || tz} value={tz.value || tz}>{tz.label || tz}</option>
              )) : (
                <>
                  <option value="Europe/Bucharest">Europe/Bucharest</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="UTC">UTC</option>
                </>
              )}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => profileMut.mutate(langForm)}
            disabled={profileMut.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {profileMut.isPending ? 'Se salveaza...' : 'Salveaza Preferinte'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-800">Schimba Parola</h2>
        </div>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Parola curenta</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={pwForm.currentPassword}
              onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Parola noua (minim 8 caractere)</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={pwForm.newPassword}
              onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Confirma parola noua</label>
            <input
              type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
            />
          </div>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handlePasswordChange}
            disabled={pwMut.isPending || !pwForm.currentPassword || !pwForm.newPassword}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {pwMut.isPending ? 'Se schimba...' : 'Schimba Parola'}
          </button>
        </div>
      </div>
    </div>
  )
}
