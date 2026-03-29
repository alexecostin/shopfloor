import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Building2, ChevronRight } from 'lucide-react'

const TYPE_LABELS = { client: 'Client', supplier: 'Furnizor', prospect: 'Prospect', both: 'Client & Furnizor' }
const TYPE_COLORS = {
  client: 'bg-blue-100 text-blue-700',
  supplier: 'bg-orange-100 text-orange-700',
  prospect: 'bg-slate-100 text-slate-600',
  both: 'bg-purple-100 text-purple-700',
}

function CompanyModal({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', companyType: 'client', fiscalCode: '', city: '', phone: '', email: '' })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/companies', data),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Companie creata.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Companie noua</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Denumire *" value={form.name} onChange={f('name')} />
          <select className="input" value={form.companyType} onChange={f('companyType')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="CIF" value={form.fiscalCode} onChange={f('fiscalCode')} />
            <input className="input" placeholder="Oras" value={form.city} onChange={f('city')} />
          </div>
          <input className="input" placeholder="Telefon" value={form.phone} onChange={f('phone')} />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={f('email')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name}
            className="btn-primary"
          >
            {mutation.isPending ? 'Se creeaza...' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CompanyDetail({ company, onClose }) {
  const qc = useQueryClient()
  const [addContact, setAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ fullName: '', role: '', phone: '', email: '' })
  const fc = (k) => (e) => setContactForm({ ...contactForm, [k]: e.target.value })

  const contactMutation = useMutation({
    mutationFn: (data) => api.post(`/companies/${company.id}/contacts`, data),
    onSuccess: () => { qc.invalidateQueries(['company', company.id]); toast.success('Contact adaugat.'); setAddContact(false) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{company.name}</h3>
            <p className="text-xs text-slate-400">{company.fiscal_code && `CIF: ${company.fiscal_code} • `}{company.city}</p>
          </div>
          <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          {company.phone && <div><span className="text-slate-400">Tel: </span>{company.phone}</div>}
          {company.email && <div><span className="text-slate-400">Email: </span>{company.email}</div>}
        </div>

        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-700">Contacte</h4>
          <button onClick={() => setAddContact(!addContact)} className="text-xs text-blue-500 hover:text-blue-700">+ Adauga</button>
        </div>

        {addContact && (
          <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-xs" placeholder="Nume *" value={contactForm.fullName} onChange={fc('fullName')} />
              <input className="input text-xs" placeholder="Functie" value={contactForm.role} onChange={fc('role')} />
              <input className="input text-xs" placeholder="Telefon" value={contactForm.phone} onChange={fc('phone')} />
              <input className="input text-xs" placeholder="Email" value={contactForm.email} onChange={fc('email')} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddContact(false)} className="btn-secondary text-xs py-1">Anuleaza</button>
              <button onClick={() => contactMutation.mutate(contactForm)} disabled={!contactForm.fullName} className="btn-primary text-xs py-1">Salveaza</button>
            </div>
          </div>
        )}

        {company.contacts?.length === 0 && <p className="text-slate-400 text-sm">Fara contacte.</p>}
        <div className="space-y-2">
          {company.contacts?.map(c => (
            <div key={c.id} className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-3">
              {c.is_primary && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">principal</span>}
              <div className="flex-1">
                <span className="font-medium text-slate-800 text-sm">{c.full_name}</span>
                {c.role && <span className="text-xs text-slate-400 ml-2">{c.role}</span>}
              </div>
              {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CompaniesPage() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const isManager = ['admin', 'production_manager'].includes(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, typeFilter],
    queryFn: () => api.get('/companies', { params: { search, companyType: typeFilter || undefined, limit: 100 } }).then(r => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['company', selected?.id],
    queryFn: () => api.get(`/companies/${selected.id}`).then(r => r.data),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Companii</h2>
        {isManager && (
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Companie noua
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input className="input max-w-xs" placeholder="Cauta..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">Toate tipurile</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Denumire</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">CIF</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Oras</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Se incarca...</td></tr>}
            {data?.data?.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c)}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.company_type] || 'bg-slate-100'}`}>
                    {TYPE_LABELS[c.company_type] || c.company_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.fiscal_code || '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{c.city || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="text-slate-300 ml-auto" />
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                Nicio companie.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && <CompanyModal onClose={() => setModal(false)} />}
      {selected && detail && <CompanyDetail company={detail} onClose={() => setSelected(null)} />}
    </div>
  )
}
