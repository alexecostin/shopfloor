import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Plus, X, ChevronDown, Loader2 } from 'lucide-react'
import api from '../api/client'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SearchableSelect({
  endpoint,
  searchParam = 'search',
  labelField = 'name',
  valueField = 'id',
  filterParams = {},
  createEndpoint,
  createFields = [],
  placeholder = 'Cauta...',
  value,
  onChange,
  allowCreate = true,
  disabled = false,
  className = '',
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({})
  const [creating, setCreating] = useState(false)
  const containerRef = useRef(null)
  const debouncedQuery = useDebounce(query, 300)

  // Load selected item label
  useEffect(() => {
    if (!value || !endpoint) { setSelectedItem(null); return; }
    api.get(`${endpoint}/${value}`)
      .then(r => setSelectedItem(r.data))
      .catch(() => setSelectedItem(null));
  }, [value, endpoint])

  // Search
  useEffect(() => {
    if (!open || !endpoint) return;
    setLoading(true);
    const params = { limit: 20, ...filterParams };
    if (debouncedQuery) params[searchParam] = debouncedQuery;
    api.get(endpoint, { params })
      .then(r => {
        const data = r.data;
        setOptions(Array.isArray(data) ? data : (data.data || []));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, open, endpoint]);

  // Click outside
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSelect(item) {
    setSelectedItem(item);
    onChange(item[valueField], item);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e) {
    e.stopPropagation();
    setSelectedItem(null);
    onChange(null, null);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!createEndpoint) return;
    setCreating(true);
    try {
      const r = await api.post(createEndpoint, createForm);
      const newItem = r.data;
      handleSelect(newItem);
      setShowCreate(false);
      setCreateForm({});
    } catch (err) {
      alert(err.response?.data?.message || 'Eroare la creare');
    } finally {
      setCreating(false);
    }
  }

  const displayLabel = selectedItem ? selectedItem[labelField] : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div
        onClick={() => { if (!disabled) { setOpen(true); } }}
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 bg-white cursor-pointer text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'} ${open ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        {open ? (
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 outline-none bg-transparent text-slate-700"
            onKeyDown={e => e.key === 'Escape' && setOpen(false)}
          />
        ) : (
          <span className={`flex-1 truncate ${displayLabel ? 'text-slate-800' : 'text-slate-400'}`}>
            {displayLabel || placeholder}
          </span>
        )}
        {selectedItem && !open && (
          <button onClick={handleClear} className="text-slate-400 hover:text-slate-600">
            <X size={13} />
          </button>
        )}
        {!selectedItem && <ChevronDown size={13} className="text-slate-400 shrink-0" />}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-3 text-slate-400">
              <Loader2 size={14} className="animate-spin mr-2" /> Se cauta...
            </div>
          )}
          {!loading && options.length === 0 && (
            <div className="p-3 text-xs text-slate-400 text-center">
              {debouncedQuery ? 'Niciun rezultat gasit' : 'Niciun rezultat. Tastati pentru a cauta...'}
            </div>
          )}
          {options.map(item => (
            <button
              key={item[valueField]}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {item[labelField]}
              {item.code && <span className="ml-2 text-xs text-slate-400">({item.code})</span>}
            </button>
          ))}
          {allowCreate && createEndpoint && createFields.length > 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 flex items-center gap-1.5"
            >
              <Plus size={13} /> Adauga nou
            </button>
          )}
        </div>
      )}

      {/* Create mini-modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Adauga intrare noua</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              {createFields.map(field => (
                <div key={field.name}>
                  <label className="block text-xs text-slate-600 mb-1">{field.label}{field.required && ' *'}</label>
                  {field.type === 'select' ? (
                    <select
                      value={createForm[field.name] || ''}
                      onChange={e => setCreateForm(f => ({ ...f, [field.name]: e.target.value }))}
                      required={field.required}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">Alege...</option>
                      {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={createForm[field.name] || ''}
                      onChange={e => setCreateForm(f => ({ ...f, [field.name]: e.target.value }))}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm rounded-lg py-1.5 hover:bg-slate-50">
                  Anuleaza
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-blue-600 text-white text-sm rounded-lg py-1.5 hover:bg-blue-700 disabled:opacity-50">
                  {creating ? 'Se salveaza...' : 'Salveaza'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
