import { useState, useEffect, useCallback } from 'react'
import { defaultTheme, applyTheme, toCamel } from '../config/defaultTheme'
import api from '../api/client'

const CACHE_KEY = 'sf_tenant_theme'

export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : defaultTheme;
    } catch { return defaultTheme; }
  });

  const loadPublicTheme = useCallback(async () => {
    try {
      const slug = window.location.hostname.split('.')[0];
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const params = isLocalhost ? {} : { slug };
      const r = await api.get('/theme/public', { params });
      const t = toCamel(r.data);
      const merged = { ...defaultTheme, ...t };
      setTheme(merged);
      applyTheme(merged);
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    } catch { applyTheme(defaultTheme); }
  }, []);

  const loadFullTheme = useCallback(async () => {
    try {
      const r = await api.get('/admin/theme');
      const t = toCamel(r.data);
      const merged = { ...defaultTheme, ...t };
      setTheme(merged);
      applyTheme(merged);
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    // Apply cached theme immediately
    applyTheme(theme);
    // Then load public theme
    loadPublicTheme();
  }, []);

  return { theme, loadPublicTheme, loadFullTheme, applyTheme };
}
