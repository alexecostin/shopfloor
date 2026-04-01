import { resend, EMAIL_FROM, NOTIFICATIONS_ENABLED, logger } from '../config/email.js';
import db from '../config/db.js';
import { getTemplate, renderTemplate } from './email-templates.service.js';
import { getTenantConfig } from './app-config.service.js';

export async function sendEmail({ to, subject, html }) {
  if (!NOTIFICATIONS_ENABLED) {
    logger.info('[EMAIL] Notificare (disabled)', { to, subject });
    return { ok: true, skipped: true };
  }
  if (!resend) {
    logger.warn('[EMAIL] RESEND_API_KEY lipsa', { to, subject });
    return { ok: false, error: 'No API key' };
  }
  try {
    const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    logger.info('[EMAIL] Trimis', { to, subject, id: result.id });
    return { ok: true, id: result.id };
  } catch (e) {
    logger.error('[EMAIL] Eroare', { to, subject, error: e.message });
    return { ok: false, error: e.message };
  }
}

async function getUsersByRole(roles) {
  const users = await db('auth.users').whereIn('role', roles).where('is_active', true).select('email');
  return users.map((u) => u.email).filter(Boolean);
}

export async function sendNotification({ type, data }) {
  switch (type) {
    case 'maintenance_new': {
      const { priority, machineCode, problemType, requestNumber, description } = data;
      if (!['high', 'critical'].includes(priority)) return;
      const to = await getUsersByRole(['maintenance']);
      if (!to.length) return;
      const tenantId = data.tenantId || null;
      const tpl = await getTemplate(tenantId, 'maintenance_new', 'ro');
      if (tpl) {
        const { subject, body_html } = renderTemplate(tpl, { machineCode, problemType, requestNumber, priority, description: description || '' });
        await sendEmail({ to, subject, html: body_html });
      } else {
        // fallback inline
        await sendEmail({
          to,
          subject: `[URGENT] Cerere mentenanta: ${machineCode} — ${problemType}`,
          html: `<h2>Cerere noua mentenanta — ${requestNumber}</h2><p>${machineCode} / ${problemType} / ${priority}</p>`,
        });
      }
      break;
    }

    case 'machine_stop': {
      const { machineCode, reason, category } = data;
      // Check if category is an equipment defect type from lookup_values
      const defectCategories = await db('system.lookup_values')
        .where({ lookup_type: 'stop_category', category: 'equipment_defect' })
        .select('value')
        .then(rows => rows.map(r => r.value))
        .catch(() => ['Defect utilaj', 'defect_utilaj']);
      if (!defectCategories.includes(category)) return;
      const to = await getUsersByRole(['production_manager']);
      if (!to.length) return;
      const tenantId = data.tenantId || null;
      const tpl = await getTemplate(tenantId, 'machine_stop', 'ro');
      if (tpl) {
        const { subject, body_html } = renderTemplate(tpl, { machineCode, reason, category });
        await sendEmail({ to, subject, html: body_html });
      } else {
        // fallback inline
        await sendEmail({
          to,
          subject: `Oprire masina: ${machineCode} — ${reason}`,
          html: `<h2>Masina oprita: ${machineCode}</h2><p><b>Motiv:</b> ${reason}</p><p><b>Categorie:</b> ${category}</p><hr/><p><small>ShopFloor.ro</small></p>`,
        });
      }
      break;
    }

    case 'stock_low': {
      const { itemName, currentQty, minStock } = data;
      const to = await getUsersByRole(['production_manager']);
      if (!to.length) return;
      const tenantId = data.tenantId || null;
      const tpl = await getTemplate(tenantId, 'stock_low', 'ro');
      if (tpl) {
        const { subject, body_html } = renderTemplate(tpl, { itemName, currentQty, minStock });
        await sendEmail({ to, subject, html: body_html });
      } else {
        // fallback inline
        await sendEmail({
          to,
          subject: `ALERTA STOC: ${itemName} — ${currentQty}/${minStock}`,
          html: `<h2>Alerta stoc minim</h2><p><b>Articol:</b> ${itemName}</p><p><b>Stoc curent:</b> ${currentQty}</p><p><b>Stoc minim:</b> ${minStock}</p><hr/><p><small>ShopFloor.ro</small></p>`,
        });
      }
      break;
    }

    case 'oee_low': {
      const { machineCode, oee } = data;
      const emailConfig = await getTenantConfig(data.tenantId || null).catch(() => ({}));
      const oeeThreshold = (emailConfig.oeeAlertThreshold || 60) / 100;
      if (oee >= oeeThreshold) return;
      const to = await getUsersByRole(['production_manager']);
      if (!to.length) return;
      const tenantId = data.tenantId || null;
      const oeePercent = Math.round(oee * 100);
      const tpl = await getTemplate(tenantId, 'oee_low', 'ro');
      if (tpl) {
        const { subject, body_html } = renderTemplate(tpl, { machineCode, oeePercent });
        await sendEmail({ to, subject, html: body_html });
      } else {
        // fallback inline
        await sendEmail({
          to,
          subject: `OEE scazut: ${machineCode} — ${oeePercent}%`,
          html: `<h2>OEE sub 60%: ${machineCode}</h2><p><b>OEE:</b> ${oeePercent}%</p><p>Verificati motivele de oprire si rebuturile pentru aceasta masina.</p><hr/><p><small>ShopFloor.ro</small></p>`,
        });
      }
      break;
    }

    default:
      logger.warn('[EMAIL] Tip notificare necunoscut:', type);
  }
}
