import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, RotateCcw, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'
import { applyTheme, toCamel, defaultTheme } from '../config/defaultTheme'

const FONTS = ['DM Sans', 'Inter', 'Roboto', 'Open Sans', 'Nunito']

function ColorInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <input type="color" value={value || '#3B82F6'} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-slate-200" />
      <div>
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 font-mono">{value}</p>
      </div>
    </div>
  )
}

export default function ThemePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(defaultTheme)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  const { data: savedTheme } = useQuery({
    queryKey: ['admin-theme'],
    queryFn: () => api.get('/admin/theme').then(r => toCamel(r.data)),
  })

  useEffect(() => {
    if (savedTheme) setForm(f => ({ ...f, ...savedTheme }))
  }, [savedTheme])

  function update(key, value) {
    const next = { ...form, [key]: value }
    setForm(next)
    applyTheme(next) // live preview
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upload logo if selected
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        await api.post('/admin/theme/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return api.put('/admin/theme', {
        primary_color: form.primaryColor,
        secondary_color: form.secondaryColor,
        sidebar_bg: form.sidebarBg,
        header_bg: form.headerBg,
        font_family: form.fontFamily,
        dark_mode_enabled: form.darkModeEnabled,
        company_name_display: form.companyNameDisplay,
        danger_color: form.dangerColor,
        warning_color: form.warningColor,
        success_color: form.successColor,
      })
    },
    onSuccess: () => { toast.success('Tema salvata!'); qc.invalidateQueries(['admin-theme']) },
    onError: () => toast.error('Eroare la salvare'),
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Tema vizuala</h2>
        <div className="flex gap-2">
          <button onClick={() => { setForm(defaultTheme); applyTheme(defaultTheme) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            <RotateCcw size={13} /> Reset
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save size={13} /> {saveMutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>

      {/* Logo upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-slate-700">Logo</h3>
        <div className="flex items-center gap-4">
          {(logoPreview || form.logoUrl) && (
            <img src={logoPreview || form.logoUrl} alt="Logo preview" className="h-12 object-contain bg-slate-900 rounded p-2" />
          )}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <Upload size={14} /> Incarca logo
            <input type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setLogoFile(f)
                setLogoPreview(URL.createObjectURL(f))
              }} />
          </label>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Culori</h3>
        <div className="grid grid-cols-2 gap-4">
          <ColorInput label="Primar" value={form.primaryColor} onChange={v => update('primaryColor', v)} />
          <ColorInput label="Secundar" value={form.secondaryColor} onChange={v => update('secondaryColor', v)} />
          <ColorInput label="Sidebar" value={form.sidebarBg} onChange={v => update('sidebarBg', v)} />
          <ColorInput label="Header" value={form.headerBg} onChange={v => update('headerBg', v)} />
          <ColorInput label="Pericol" value={form.dangerColor} onChange={v => update('dangerColor', v)} />
          <ColorInput label="Atentie" value={form.warningColor} onChange={v => update('warningColor', v)} />
        </div>
      </div>

      {/* Font + name */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Afisare</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nume companie (afisat in header)</label>
            <input value={form.companyNameDisplay || ''} onChange={e => update('companyNameDisplay', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Font</label>
            <select value={form.fontFamily || 'DM Sans'} onChange={e => update('fontFamily', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
