import db from '../../config/db.js';
import path from 'path';
import fs from 'fs/promises';

const DEFAULT_THEME = {
  primary_color: '#3B82F6',
  secondary_color: '#64748B',
  accent_color: '#3B82F6',
  danger_color: '#FF4757',
  warning_color: '#FFB020',
  success_color: '#00D4AA',
  sidebar_bg: '#0F172A',
  header_bg: '#1E293B',
  font_family: 'DM Sans',
  dark_mode_enabled: true,
  company_name_display: 'ShopFloor.ro',
};

export async function getTheme(tenantId) {
  if (!tenantId) return DEFAULT_THEME;
  const theme = await db('system.tenant_theme').where({ tenant_id: tenantId }).first();
  return theme || DEFAULT_THEME;
}

export async function upsertTheme(tenantId, data) {
  const allowed = [
    'primary_color', 'secondary_color', 'accent_color', 'danger_color',
    'warning_color', 'success_color', 'sidebar_bg', 'header_bg',
    'font_family', 'dark_mode_enabled', 'company_name_display',
    'logo_url', 'logo_dark_url', 'favicon_url', 'login_background_url', 'custom_css'
  ];
  const updates = {};
  for (const key of allowed) {
    // Accept both camelCase and snake_case
    const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (data[key] !== undefined) updates[key] = data[key];
    else if (data[camel] !== undefined) updates[key] = data[camel];
  }
  updates.updated_at = new Date();

  const existing = await db('system.tenant_theme').where({ tenant_id: tenantId }).first();
  if (existing) {
    const [updated] = await db('system.tenant_theme').where({ tenant_id: tenantId }).update(updates).returning('*');
    return updated;
  } else {
    const [inserted] = await db('system.tenant_theme').insert({ tenant_id: tenantId, ...updates }).returning('*');
    return inserted;
  }
}

export async function getPublicTheme(slug) {
  // Find tenant by slug
  let theme = DEFAULT_THEME;
  if (slug) {
    const tenant = await db('system.tenants').where({ subdomain: slug }).first().catch(() => null);
    if (tenant) {
      const t = await db('system.tenant_theme').where({ tenant_id: tenant.id }).first().catch(() => null);
      if (t) theme = t;
    }
  }
  return {
    logo_url: theme.logo_url || null,
    company_name_display: theme.company_name_display || 'ShopFloor.ro',
    primary_color: theme.primary_color || '#3B82F6',
    sidebar_bg: theme.sidebar_bg || '#0F172A',
    login_background_url: theme.login_background_url || null,
    font_family: theme.font_family || 'DM Sans',
  };
}

export async function saveLogo(tenantId, fileBuffer, mimeType, logoType = 'main') {
  // Save to disk under /uploads/logos/
  const uploadDir = path.resolve('uploads/logos');
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = mimeType === 'image/svg+xml' ? 'svg' : mimeType === 'image/png' ? 'png' : 'jpg';
  const filename = `${tenantId}-${logoType}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, fileBuffer);

  const url = `/uploads/logos/${filename}`;
  const field = logoType === 'dark' ? 'logo_dark_url' : 'logo_url';
  await upsertTheme(tenantId, { [field]: url });
  return url;
}
