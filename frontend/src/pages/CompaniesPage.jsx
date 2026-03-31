import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Building2, ChevronRight, Pencil, Trash2 } from 'lucide-react'

const TYPE_LABELS = { client: 'Client', supplier: 'Furnizor', prospect: 'Prospect', both: 'Client & Furnizor' }
const TYPE_COLORS = {
  client: 'bg-blue-100 text-blue-700',
  supplier: 'bg-orange-100 text-orange-700',
  prospect: 'bg-slate-100 text-slate-600',
  both: 'bg-purple-100 text-purple-700',
}

// company_types is stored as JSONB array in DB; extract display-friendly list
function getCompanyTypes(company) {
  if (Array.isArray(company.company_types)) return company.company_types
  if (typeof company.company_types === 'string') {
    try { return JSON.parse(company.company_types) } catch { /* fall through */ }
  }
  if (company.company_type) return [company.company_type]
  return ['client']
}

function CompanyModal({ onClose, editCompany }) {
  const qc = useQueryClient()
  const isEdit = !!editCompany
  // company_types is a JSONB array in DB, e.g. ["client","supplier"]
  const initType = isEdit
    ? (Array.isArray(editCompany.company_types)
        ? editCompany.company_types[0]
        : (editCompany.company_type || 'client'))
    : 'client'
  const [form, setForm] = useState(
    isEdit
      ? {
          name: editCompany.name || '',
          companyType: initType,
          fiscalCode: editCompany.fiscal_code || '',
          city: editCompany.city || '',
          phone: editCompany.phone || '',
          email: editCompany.email || '',
        }
      : { name: '', companyType: 'client', fiscalCode: '', city: '', phone: '', email: '' }
  )
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => {
      // Backend expects companyTypes (plural, array) — convert from singular select
      const payload = {
        name: data.name,
        companyTypes: [data.companyType],
        fiscalCode: data.fiscalCode,
        city: data.city,
        phone: data.phone,
        email: data.email,
      }
      return isEdit ? api.put(`/companies/${editCompany.id}`, payload) : api.post('/companies', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['companies'])
      if (isEdit) qc.invalidateQueries(['company', editCompany.id])
      toast.success(isEdit ? 'Companie actualizata.' : 'Companie creata.')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">{isEdit ? 'Editeaza companie' : 'Companie noua'}</h3>
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
            {mutation.isPending ? 'Se salveaza...' : isEdit ? 'Salveaza' : 'Creeaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditContactModal({ contact, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    fullName: contact.full_name || '',
    role: contact.role || '',
    phone: contact.phone || '',
    email: contact.email || '',
  })
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const mutation = useMutation({
    mutationFn: (data) => api.put(`/companies/contacts/${contact.id}`, data),
    onSuccess: () => { qc.invalidateQueries(['company']); toast.success('Contact actualizat.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-800 mb-4">Editeaza contact</h3>
        <div className="space-y-3">
          <input className="input" placeholder="Nume *" value={form.fullName} onChange={f('fullName')} />
          <input className="input" placeholder="Functie" value={form.role} onChange={f('role')} />
          <input className="input" placeholder="Telefon" value={form.phone} onChange={f('phone')} />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={f('email')} />
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="btn-secondary">Anuleaza</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.fullName} className="btn-primary">
            {mutation.isPending ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CompanyDetail({ company, onClose }) {
  const qc = useQueryClient()
  const [addContact, setAddContact] = useState(false)
  const [editCompany, setEditCompany] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [contactForm, setContactForm] = useState({ fullName: '', role: '', phone: '', email: '' })
  const fc = (k) => (e) => setContactForm({ ...contactForm, [k]: e.target.value })

  const contactMutation = useMutation({
    mutationFn: (data) => api.post(`/companies/${company.id}/contacts`, data),
    onSuccess: () => { qc.invalidateQueries(['company', company.id]); toast.success('Contact adaugat.'); setAddContact(false) },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const deleteCompanyMut = useMutation({
    mutationFn: () => api.delete(`/companies/${company.id}`),
    onSuccess: () => { qc.invalidateQueries(['companies']); toast.success('Companie stearsa.'); onClose() },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  const deleteContactMut = useMutation({
    mutationFn: (contactId) => api.delete(`/companies/contacts/${contactId}`),
    onSuccess: () => { qc.invalidateQueries(['company', company.id]); toast.success('Contact sters.') },
    onError: (err) => toast.error(err.response?.data?.message || 'Eroare.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">{company.name}</h3>
            <div className="flex flex-wrap gap-1 mt-1">
              {getCompanyTypes(company).map(t => (
                <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t] || 'bg-slate-100 text-slate-600'}`}>
                  {TYPE_LABELS[t] || t}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">{company.fiscal_code && `CIF: ${company.fiscal_code} • `}{company.city}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditCompany(true)} className="btn-secondary text-xs flex items-center gap-1"><Pencil size={12} /> Editeaza</button>
            <button
              onClick={() => { if (confirm('Stergi compania?')) deleteCompanyMut.mutate() }}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
            <button onClick={onClose} className="btn-secondary text-xs">Inchide</button>
          </div>
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
              <button onClick={() => setEditContact(c)} className="text-slate-400 hover:text-blue-500"><Pencil size={13} /></button>
              <button onClick={() => { if (confirm('Stergi contactul?')) deleteContactMut.mutate(c.id) }} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      {editCompany && <CompanyModal editCompany={company} onClose={() => setEditCompany(false)} />}
      {editContact && <EditContactModal contact={editContact} onClose={() => setEditContact(null)} />}
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
            {data?.data?.map(c => {
              const types = getCompanyTypes(c)
              return (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {types.map(t => (
                        <span key={t} className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[t] || 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_LABELS[t] || t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{c.fiscal_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="text-slate-300 ml-auto" />
                  </td>
                </tr>
              )
            })}
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
