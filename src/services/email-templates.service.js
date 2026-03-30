import db from '../config/db.js';

/**
 * Get a template: tenant-specific first, fallback to global (tenant_id = null).
 * @param {string|null} tenantId
 * @param {string} templateType
 * @param {string} lang  'ro' or 'en', defaults to 'ro'
 */
export async function getTemplate(tenantId, templateType, lang = 'ro') {
  // Try tenant-specific
  if (tenantId) {
    const tpl = await db('system.email_templates')
      .where({ tenant_id: tenantId, template_type: templateType, lang, is_active: true })
      .first();
    if (tpl) return tpl;
  }
  // Fallback to global
  const global = await db('system.email_templates')
    .whereNull('tenant_id')
    .where({ template_type: templateType, lang, is_active: true })
    .first();
  if (global) return global;
  // Fallback to 'ro' if lang not found
  if (lang !== 'ro') return getTemplate(tenantId, templateType, 'ro');
  return null;
}

/**
 * Render a template by substituting {variable} placeholders.
 */
export function renderTemplate(template, data) {
  let subject = template.subject;
  let body = template.body_html;
  if (data) {
    Object.entries(data).forEach(([key, value]) => {
      const re = new RegExp(`\\{${key}\\}`, 'g');
      subject = subject.replace(re, value ?? '');
      body = body.replace(re, value ?? '');
    });
  }
  return { subject, body_html: body };
}

/**
 * List all templates for a tenant (global + tenant overrides).
 */
export async function listTemplates(tenantId) {
  const global = await db('system.email_templates')
    .whereNull('tenant_id')
    .orderBy(['template_type', 'lang'])
    .select('*');

  const tenantOverrides = tenantId
    ? await db('system.email_templates')
        .where('tenant_id', tenantId)
        .orderBy(['template_type', 'lang'])
        .select('*')
    : [];

  // Merge: tenant overrides take precedence
  const map = new Map();
  for (const t of global) map.set(`${t.template_type}:${t.lang}`, { ...t, isOverridden: false });
  for (const t of tenantOverrides) map.set(`${t.template_type}:${t.lang}`, { ...t, isOverridden: true });

  return Array.from(map.values());
}

/**
 * Upsert a tenant's template override.
 */
export async function upsertTemplate(tenantId, templateType, lang, { subject, body_html }) {
  if (!tenantId) throw new Error('Tenant necunoscut');
  const existing = await db('system.email_templates')
    .where({ tenant_id: tenantId, template_type: templateType, lang })
    .first();

  if (existing) {
    await db('system.email_templates')
      .where('id', existing.id)
      .update({ subject, body_html, updated_at: db.fn.now() });
    return db('system.email_templates').where('id', existing.id).first();
  }

  // Copy from global to get variables metadata
  const globalTpl = await getTemplate(null, templateType, lang);
  const [id] = await db('system.email_templates').insert({
    tenant_id: tenantId,
    template_type: templateType,
    lang,
    subject,
    body_html,
    variables: globalTpl?.variables || '[]',
    is_active: true,
    updated_at: new Date()
  }).returning('id');

  return db('system.email_templates').where('id', id.id || id).first();
}

/**
 * Reset a tenant's template override (delete it, reverting to global).
 */
export async function resetTemplate(tenantId, templateType, lang) {
  if (!tenantId) throw new Error('Tenant necunoscut');
  await db('system.email_templates')
    .where({ tenant_id: tenantId, template_type: templateType, lang })
    .del();
  return { reset: true };
}

export const TEMPLATE_LABELS = {
  maintenance_new: 'Cerere mentenanta noua',
  machine_stop: 'Oprire masina',
  stock_low: 'Alerta stoc minim',
  oee_low: 'OEE scazut',
};
