import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import httpClient from '../api/client';
import toast from 'react-hot-toast';
import { Building2, Shield, Package, CreditCard, Users, Settings, Mail, Plus, Pencil, Trash2, X } from 'lucide-react';

const api = (path) => httpClient.get(`/admin${path}`).then(r => r.data);

export default function AdminPage() {
  const [tab, setTab] = useState('org');
  const tabs = [
    { id: 'org', label: 'Organizatie', icon: Building2 },
    { id: 'roles', label: 'Roluri', icon: Shield },
    { id: 'modules', label: 'Module', icon: Package },
    { id: 'license', label: 'Licenta', icon: CreditCard },
    { id: 'users', label: 'Utilizatori', icon: Users },
    { id: 'settings', label: 'Setari', icon: Settings },
    { id: 'email', label: 'Email', icon: Mail },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Administrare</h1>
      <div className="flex border-b border-slate-200 mb-6 gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>
      {tab === 'org' && <OrgTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'modules' && <ModulesTab />}
      {tab === 'license' && <LicenseTab />}
      {tab === 'users' && <UsersAdminTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'email' && <EmailTemplatesTab />}
    </div>
  );
}

function OrgTab() {
  const qc = useQueryClient();
  const { data: tree = [], isLoading } = useQuery({ queryKey: ['admin-org'], queryFn: () => api('/org') });
  const { data: types = [] } = useQuery({ queryKey: ['admin-org-types'], queryFn: () => api('/org/types') });
  const { data: timezones = [] } = useQuery({ queryKey: ['admin-timezones'], queryFn: () => api('/settings/timezones') });
  const [showAdd, setShowAdd] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [form, setForm] = useState({ name: '', unit_type: 'factory', code: '', level: 1 });
  const [editForm, setEditForm] = useState({ name: '', code: '', unit_type: '', timezone: '' });
  const [typeForm, setTypeForm] = useState({ type_code: '', type_label: '', level: 1 });

  const create = useMutation({
    mutationFn: data => httpClient.post('/admin/org', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-org']); setShowAdd(false); toast.success('Unitate creata.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const del = useMutation({
    mutationFn: id => httpClient.delete(`/admin/org/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-org']); toast.success('Sters.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const updateUnit = useMutation({
    mutationFn: ({ id, ...data }) => httpClient.put(`/admin/org/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-org']); setEditUnit(null); toast.success('Unitate actualizata.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const createType = useMutation({
    mutationFn: data => httpClient.post('/admin/org/types', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-org-types']); setShowAddType(false); toast.success('Tip creat.'); setTypeForm({ type_code: '', type_label: '', level: 1 }); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  function openEdit(unit) {
    setEditUnit(unit);
    setEditForm({ name: unit.name || '', code: unit.code || '', unit_type: unit.unit_type || '', timezone: unit.settings?.timezone || '' });
  }

  function OrgNode({ unit, depth = 0 }) {
    return (
      <div>
        <div className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 group`} style={{ marginLeft: depth * 20 }}>
          <span className="text-base">{unit.unit_type === 'factory' ? '🏭' : unit.unit_type === 'department' ? '🔧' : '⚙️'}</span>
          <div className="flex-1">
            <span className="font-medium text-slate-800 text-sm">{unit.name}</span>
            {unit.code && <span className="text-xs text-slate-400 ml-2">({unit.code})</span>}
            <span className="text-xs text-slate-400 ml-2">— {unit.unit_type}</span>
          </div>
          <button onClick={() => openEdit(unit)} className="text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 text-xs mr-2"><Pencil size={12} /></button>
          <button onClick={() => del.mutate(unit.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs">Sterge</button>
        </div>
        {unit.children?.map(c => <OrgNode key={c.id} unit={c} depth={depth + 1} />)}
      </div>
    );
  }

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-slate-800">Ierarhie Organizationala</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowAddType(true)} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Tip nou</button>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ Adauga</button>
        </div>
      </div>
      {tree.length === 0 ? <p className="text-slate-400 text-sm">Nicio unitate organizationala.</p> : tree.map(u => <OrgNode key={u.id} unit={u} />)}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-slate-800 mb-4">Adauga Unitate</h3>
            <div className="space-y-3">
              <input placeholder="Nume" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Cod (ex: CJ)" value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={form.unit_type} onChange={e => setForm(p => ({...p, unit_type: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {types.map(t => <option key={t.type_code} value={t.type_code}>{t.type_label}</option>)}
                <option value="factory">Fabrica</option>
                <option value="department">Sectie</option>
                <option value="line">Linie</option>
              </select>
              <input type="number" placeholder="Nivel (1=top)" value={form.level} onChange={e => setForm(p => ({...p, level: parseInt(e.target.value)}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => create.mutate(form)} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Salveaza</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      {editUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Editeaza Unitate</h3>
              <button onClick={() => setEditUnit(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nume</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({...p, name: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cod</label>
                <input value={editForm.code} onChange={e => setEditForm(p => ({...p, code: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tip unitate</label>
                <select value={editForm.unit_type} onChange={e => setEditForm(p => ({...p, unit_type: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {types.map(t => <option key={t.type_code} value={t.type_code}>{t.type_label}</option>)}
                  <option value="factory">Fabrica</option>
                  <option value="department">Sectie</option>
                  <option value="line">Linie</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Fus orar</label>
                <select value={editForm.timezone} onChange={e => setEditForm(p => ({...p, timezone: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">-- Selecteaza fus orar --</option>
                  {timezones.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => updateUnit.mutate({ id: editUnit.id, name: editForm.name, code: editForm.code, unit_type: editForm.unit_type, settings: { timezone: editForm.timezone } })} disabled={updateUnit.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                {updateUnit.isPending ? 'Se salveaza...' : 'Salveaza'}
              </button>
              <button onClick={() => setEditUnit(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      {showAddType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Tip organizational nou</h3>
              <button onClick={() => setShowAddType(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Cod (ex: workshop)" value={typeForm.type_code} onChange={e => setTypeForm(p => ({...p, type_code: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Eticheta (ex: Atelier)" value={typeForm.type_label} onChange={e => setTypeForm(p => ({...p, type_label: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder="Nivel" value={typeForm.level} onChange={e => setTypeForm(p => ({...p, level: parseInt(e.target.value) || 1}))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => createType.mutate(typeForm)} disabled={createType.isPending || !typeForm.type_code} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createType.isPending ? 'Se creeaza...' : 'Creeaza'}
              </button>
              <button onClick={() => setShowAddType(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Anuleaza</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesTab() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ['admin-roles'], queryFn: () => api('/roles') });
  const { data: permsByModule = [] } = useQuery({ queryKey: ['admin-perms'], queryFn: () => api('/permissions/by-module') });
  const [selected, setSelected] = useState(null);

  const { data: roleDetail } = useQuery({ queryKey: ['admin-role', selected], queryFn: () => selected ? api(`/roles/${selected}`) : null, enabled: !!selected });

  const deleteRoleMut = useMutation({
    mutationFn: (roleId) => httpClient.delete(`/admin/roles/${roleId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-roles']); setSelected(null); toast.success('Rol sters.'); },
    onError: (e) => {
      const msg = e.response?.data?.message || '';
      if (msg.includes('foreign key') || msg.includes('associated')) toast.error('Nu se poate sterge — exista utilizatori asociati.');
      else toast.error(msg || 'Eroare la stergere rol.');
    },
  });

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  return (
    <div className="flex gap-4">
      <div className="w-64 bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">Roluri</h3>
        <div className="space-y-1">
          {roles.map(r => (
            <div key={r.id} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${selected === r.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <button onClick={() => setSelected(r.id)} className="flex-1 text-left">
                {r.name}
                {r.is_predefined && <span className="ml-1 text-xs text-slate-400">(sistem)</span>}
              </button>
              {!r.is_predefined && (
                <button
                  onClick={() => { if (confirm(`Sigur doriti sa stergeti rolul "${r.name}"? Aceasta actiune este ireversibila.`)) deleteRoleMut.mutate(r.id) }}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                  title="Sterge rol"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {roleDetail && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-1">{roleDetail.name}</h3>
          <p className="text-slate-400 text-sm mb-4">{roleDetail.description}</p>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Permisiuni ({roleDetail.permissions?.length || 0})</h4>
          <div className="space-y-3">
            {permsByModule.map(mod => {
              const modPerms = roleDetail.permissions?.filter(p => p.module_code === mod.module_code) || [];
              if (modPerms.length === 0) return null;
              return (
                <div key={mod.module_code}>
                  <p className="text-xs font-medium text-slate-600 mb-1 capitalize">{mod.module_code.replace('_', ' ')}</p>
                  <div className="flex flex-wrap gap-1">
                    {modPerms.map(p => <span key={p.code} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{p.code.split('.').slice(1).join('.')}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModulesTab() {
  const qc = useQueryClient();
  const { data: modules = [], isLoading } = useQuery({ queryKey: ['admin-modules'], queryFn: () => api('/modules') });

  const toggle = useMutation({
    mutationFn: ({ code, active }) => httpClient.post(`/admin/modules/${code}/${active ? 'activate' : 'deactivate'}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-modules']); toast.success('Modul actualizat.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const tierBadge = { basic: 'bg-slate-100 text-slate-600', professional: 'bg-blue-100 text-blue-600', enterprise: 'bg-purple-100 text-purple-600' };

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  const grouped = { basic: [], professional: [], enterprise: [] };
  for (const m of modules) grouped[m.tier]?.push(m);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([tier, mods]) => mods.length > 0 && (
        <div key={tier} className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 capitalize">{tier}</h3>
          <div className="space-y-2">
            {mods.map(m => (
              <div key={m.code} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-slate-800">{m.name}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${tierBadge[m.tier]}`}>{m.tier}</span>
                  {m.always_included && <span className="ml-1 text-xs text-slate-400">(inclus)</span>}
                </div>
                {!m.always_included && (
                  <button onClick={() => toggle.mutate({ code: m.code, active: !m.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${m.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${m.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                )}
                {m.always_included && <span className="text-xs text-green-600 font-medium">✓ Activ</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LicenseTab() {
  const { data: license, isLoading } = useQuery({ queryKey: ['admin-license'], queryFn: () => api('/license') });
  const { data: usage } = useQuery({ queryKey: ['admin-usage'], queryFn: () => api('/license/usage') });

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;
  if (!license) return <div className="text-slate-400">Licenta negasita.</div>;

  const statusColor = { active: 'text-green-600 bg-green-50', grace: 'text-amber-600 bg-amber-50', expired: 'text-red-600 bg-red-50' };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{license.tier?.toUpperCase()} Plan</h2>
          <p className="text-slate-400 text-sm">{license.license_type === 'cloud' ? 'Cloud' : 'On-Premise'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor[license.status] || 'text-slate-600 bg-slate-50'}`}>
          {license.status === 'active' ? '✓ Activ' : license.status === 'grace' ? '⚠ Grace Period' : '✗ Expirat'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Utilizatori</p>
          <p className="text-2xl font-bold text-slate-800">{usage?.users_active || 0}<span className="text-sm font-normal text-slate-400"> / {license.max_users}</span></p>
          <div className="mt-2 h-1.5 bg-slate-200 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{width: `${Math.min(100, (usage?.users_active || 0) / license.max_users * 100)}%`}} /></div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">Fabrici</p>
          <p className="text-2xl font-bold text-slate-800">{usage?.factories_active || 0}<span className="text-sm font-normal text-slate-400"> / {license.max_factories}</span></p>
          <div className="mt-2 h-1.5 bg-slate-200 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{width: `${Math.min(100, (usage?.factories_active || 0) / license.max_factories * 100)}%`}} /></div>
        </div>
      </div>
      <div className="text-sm text-slate-500">
        <p>Valabila pana la: <strong className="text-slate-800">{new Date(license.valid_to).toLocaleDateString('ro-RO')}</strong></p>
        {license.days_remaining > 0 ? <p className="text-green-600">{license.days_remaining} zile ramase</p> : <p className="text-red-600">Expirata cu {Math.abs(license.days_remaining)} zile</p>}
      </div>
    </div>
  );
}

function UsersAdminTab() {
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => httpClient.get('/auth/users').then(r => r.data?.data || r.data || []) });
  const { data: roles = [] } = useQuery({ queryKey: ['admin-roles'], queryFn: () => api('/roles') });
  const qc = useQueryClient();
  const [editUser, setEditUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ fullName: '', email: '', password: '', role: 'operator', is_active: true });

  const setRoles = useMutation({
    mutationFn: ({ userId, roleIds }) => httpClient.put(`/admin/users/${userId}/roles`, { roleIds }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-users']); setEditUser(null); toast.success('Roluri actualizate.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const createUser = useMutation({
    mutationFn: data => httpClient.post('/auth/register', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['admin-users']);
      setShowAddUser(false);
      setNewUserForm({ fullName: '', email: '', password: '', role: 'operator', is_active: true });
      toast.success('Utilizator creat.');
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare la creare utilizator.'),
  });

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAddUser(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus size={14} /> Utilizator nou
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>
            <th className="text-left p-3 text-slate-500 font-medium">Utilizator</th>
            <th className="text-left p-3 text-slate-500 font-medium">Email</th>
            <th className="text-left p-3 text-slate-500 font-medium">Rol legacy</th>
            <th className="text-left p-3 text-slate-500 font-medium">Actiuni</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-800">{u.full_name}</td>
                <td className="p-3 text-slate-500">{u.email}</td>
                <td className="p-3"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{u.role}</span></td>
                <td className="p-3">
                  <button onClick={() => { setEditUser(u); setSelectedRoles([]); }}
                    className="text-xs text-blue-600 hover:text-blue-800">Seteaza Roluri</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Utilizator nou</h3>
              <button onClick={() => setShowAddUser(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nume complet</label>
                <input value={newUserForm.fullName} onChange={e => setNewUserForm(p => ({...p, fullName: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: Ion Popescu" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                <input type="email" value={newUserForm.email} onChange={e => setNewUserForm(p => ({...p, email: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: ion.popescu@firma.ro" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Parola</label>
                <input type="password" value={newUserForm.password} onChange={e => setNewUserForm(p => ({...p, password: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Minim 6 caractere" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rol</label>
                <select value={newUserForm.role} onChange={e => setNewUserForm(p => ({...p, role: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="operator">Operator</option>
                  <option value="production_manager">Manager productie</option>
                  <option value="admin">Administrator</option>
                  <option value="viewer">Vizualizare</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-medium text-slate-500">Cont activ</span>
                  <button
                    type="button"
                    onClick={() => setNewUserForm(p => ({...p, is_active: !p.is_active}))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newUserForm.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newUserForm.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => createUser.mutate({ email: newUserForm.email, password: newUserForm.password, fullName: newUserForm.fullName, role: newUserForm.role })}
                disabled={createUser.isPending || !newUserForm.email || !newUserForm.password || !newUserForm.fullName}
                className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createUser.isPending ? 'Se creeaza...' : 'Creeaza utilizator'}
              </button>
              <button onClick={() => setShowAddUser(false)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Anuleaza</button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-800">Seteaza roluri</h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Selecteaza rolurile pentru {editUser.full_name}:</p>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {roles.map(r => (
                <label key={r.id} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                  <input type="checkbox" className="mt-0.5" checked={selectedRoles.includes(r.id)} onChange={e => setSelectedRoles(prev => e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id))} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{r.name}</span>
                      {r.is_predefined && <span className="text-xs text-slate-400">(sistem)</span>}
                    </div>
                    {r.description && <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRoles.mutate({ userId: editUser.id, roleIds: selectedRoles })} disabled={setRoles.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {setRoles.isPending ? 'Se salveaza...' : 'Salveaza'}
              </button>
              <button onClick={() => setEditUser(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200">Anuleaza</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: () => api('/settings') });
  const { data: timezones = [] } = useQuery({ queryKey: ['admin-timezones-settings'], queryFn: () => api('/settings/timezones') });
  const [form, setForm] = useState(null);

  // Auto-populate form when settings data loads
  useEffect(() => {
    if (settings && !form) setForm({ ...settings });
  }, [settings]);

  const current = form || settings || {};
  const set = (key, val) => setForm(prev => ({ ...(prev || settings || {}), [key]: val }));

  const save = useMutation({
    mutationFn: data => httpClient.put('/admin/settings', data).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['admin-settings'], data);
      setForm({ ...data });
      toast.success('Setari salvate.');
    },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  const isDirty = form !== null;

  return (
    <div className="space-y-6">
      {/* General */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-5">Setari Generale</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fus orar implicit</label>
            <select
              value={current.default_timezone || 'Europe/Bucharest'}
              onChange={e => set('default_timezone', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Limba implicita</label>
            <select
              value={current.default_language || 'ro'}
              onChange={e => set('default_language', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ro">Romana</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Moneda implicita</label>
            <select
              value={current.default_currency || 'RON'}
              onChange={e => set('default_currency', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="RON">RON — leu romanesc</option>
              <option value="EUR">EUR — euro</option>
              <option value="USD">USD — dolar american</option>
              <option value="GBP">GBP — lira sterlina</option>
              <option value="HUF">HUF — forint</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Format data</label>
            <select
              value={current.date_format || 'DD/MM/YYYY'}
              onChange={e => set('date_format', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (ex: 29/03/2026)</option>
              <option value="DD.MM.YYYY">DD.MM.YYYY (ex: 29.03.2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (ex: 03/29/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO, ex: 2026-03-29)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Format ora</label>
            <select
              value={current.time_format || '24h'}
              onChange={e => set('time_format', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">24h (ex: 14:30)</option>
              <option value="12h">12h (ex: 2:30 PM)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Inceput saptamana</label>
            <select
              value={current.week_starts_on ?? 1}
              onChange={e => set('week_starts_on', parseInt(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Luni</option>
              <option value={0}>Duminica</option>
            </select>
          </div>
        </div>
      </div>

      {/* Number format */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-5">Format Numere</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Separator zecimal</label>
            <select
              value={current.decimal_separator || ','}
              onChange={e => set('decimal_separator', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value=",">, virgula (ex: 1.234,56)</option>
              <option value=".">. punct (ex: 1,234.56)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Separator mii</label>
            <select
              value={current.thousands_separator || '.'}
              onChange={e => set('thousands_separator', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value=".">. punct</option>
              <option value=",">, virgula</option>
              <option value=" ">spatiu</option>
              <option value="">fara separator</option>
            </select>
          </div>
        </div>
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          Previzualizare: <strong>
            {(1234567.89).toLocaleString(undefined, {}).replace(/[0-9]/g, '') /* just show separators visually */ }
            {Number(1234567.89).toFixed(2)
              .replace('.', '___DEC___')
              .replace(/\B(?=(\d{3})+(?!\d))/g, current.thousands_separator ?? '.')
              .replace('___DEC___', current.decimal_separator ?? ',')
            }
          </strong>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {isDirty && (
          <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Anuleaza
          </button>
        )}
        <button
          onClick={() => save.mutate(current)}
          disabled={!isDirty || save.isPending}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {save.isPending ? 'Se salveaza...' : 'Salveaza Setarile'}
        </button>
      </div>
    </div>
  );
}

function EmailTemplatesTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null); // { type, lang }
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-email-templates'],
    queryFn: () => httpClient.get('/admin/email-templates').then(r => r.data)
  });

  const templates = data?.templates || [];
  const labels = data?.labels || {};

  // Group by type
  const grouped = {};
  for (const t of templates) {
    if (!grouped[t.template_type]) grouped[t.template_type] = {};
    grouped[t.template_type][t.lang] = t;
  }

  function selectTemplate(type, lang) {
    setSelected({ type, lang });
    const tpl = grouped[type]?.[lang];
    setEditSubject(tpl?.subject || '');
    setEditBody(tpl?.body_html || '');
  }

  const save = useMutation({
    mutationFn: ({ type, lang }) => httpClient.put(`/admin/email-templates/${type}/${lang}`, { subject: editSubject, body_html: editBody }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-email-templates']); toast.success('Template salvat.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  const reset = useMutation({
    mutationFn: ({ type, lang }) => httpClient.delete(`/admin/email-templates/${type}/${lang}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['admin-email-templates']); toast.success('Template resetat la valoarea implicita.'); },
    onError: e => toast.error(e.response?.data?.message || 'Eroare'),
  });

  if (isLoading) return <div className="text-slate-400">Se incarca...</div>;

  const currentTpl = selected ? grouped[selected.type]?.[selected.lang] : null;

  return (
    <div className="flex gap-4">
      {/* Left panel: template list */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">Template-uri Email</h3>
          <div className="space-y-3">
            {Object.entries(grouped).map(([type, langs]) => (
              <div key={type}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{labels[type] || type}</p>
                <div className="flex gap-1">
                  {['ro', 'en'].map(lang => (
                    <button
                      key={lang}
                      onClick={() => selectTemplate(type, lang)}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        selected?.type === type && selected?.lang === lang
                          ? 'bg-blue-600 text-white'
                          : langs[lang]?.isOverridden
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {lang.toUpperCase()}
                      {langs[lang]?.isOverridden && ' *'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: editor */}
      {selected ? (
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">
                {labels[selected.type] || selected.type} — {selected.lang.toUpperCase()}
                {currentTpl?.isOverridden && <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Personalizat</span>}
              </h3>
              {currentTpl?.isOverridden && (
                <button onClick={() => reset.mutate(selected)} className="text-xs text-red-500 hover:text-red-700">Reseteaza la implicit</button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Subiect</label>
                <input
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Corp email (HTML)</label>
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={8}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => save.mutate(selected)}
                disabled={save.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Salveaza
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Previzualizare</p>
            <div className="text-xs text-slate-500 mb-2">Subiect: <strong className="text-slate-700">{editSubject}</strong></div>
            <div className="border border-slate-200 rounded-lg p-4 text-sm" dangerouslySetInnerHTML={{ __html: editBody }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Selecteaza un template din stanga
        </div>
      )}
    </div>
  );
}
