import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tag, User } from 'lucide-react'
import api from '../api/client'

export default function ContactSelector({ companyId, relationshipType, contextTag, value, onChange, placeholder = 'Selecteaza contact...' }) {
  const [query, setQuery] = useState('')

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', companyId, relationshipType, contextTag],
    queryFn: async () => {
      if (!companyId) return [];
      const params = {};
      if (relationshipType) params.relationshipType = relationshipType;
      if (contextTag) params.contextTag = contextTag;
      const r = await api.get(`/companies/${companyId}/contacts`, { params });
      return Array.isArray(r.data) ? r.data : (r.data.data || []);
    },
    enabled: !!companyId,
  });

  const filtered = contacts.filter(c =>
    !query || c.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.department?.toLowerCase().includes(query.toLowerCase())
  );

  const selected = contacts.find(c => c.id === value);

  return (
    <div className="space-y-1">
      {!companyId && (
        <p className="text-xs text-slate-400 italic">Selecteaza mai intai o companie</p>
      )}
      {companyId && (
        <select
          value={value || ''}
          onChange={e => {
            const contact = contacts.find(c => c.id === e.target.value);
            onChange(e.target.value || null, contact || null);
          }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
        >
          <option value="">{placeholder}</option>
          {filtered.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.department ? ` — ${c.department}` : ''}{c.role ? ` (${c.role})` : ''}
            </option>
          ))}
        </select>
      )}
      {selected && (
        <div className="flex flex-wrap gap-1 mt-1">
          {(selected.context_tags || []).map(tag => (
            <span key={tag} className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
