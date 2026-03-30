// frontend/src/hooks/useLookup.js
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'

export function useLookup(lookupType, options = {}) {
  const { includeInactive = false, enabled = true } = options

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['lookup', lookupType, includeInactive],
    queryFn: () => api.get(`/lookups/${lookupType}${includeInactive ? '?includeInactive=true' : ''}`).then(r => r.data),
    staleTime: 5 * 60 * 1000, // 5 min cache
    enabled: !!lookupType && enabled,
  })

  return { values: data, loading: isLoading, error }
}

export function getLookupLabel(value, lang = 'ro') {
  if (lang === 'en' && value.display_name_en) return value.display_name_en
  return value.display_name
}

export function useLookupTypes() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['lookup-types'],
    queryFn: () => api.get('/lookups').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  return { types: data, loading: isLoading }
}
