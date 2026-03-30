import db from '../config/db.js';
import crypto from 'crypto';
import logger from '../config/logger.js';

// ─── Export Templates ─────────────────────────────────────────────────────

export async function listTemplates(tenantId) {
  let q = db('integrations.export_templates').orderBy('created_at', 'desc');
  if (tenantId) q = q.where(function () { this.where('tenant_id', tenantId).orWhereNull('tenant_id'); });
  return q;
}

export async function createTemplate(data) {
  const [row] = await db('integrations.export_templates').insert({
    name: data.name,
    description: data.description || null,
    target_system: data.target_system,
    data_source: data.data_source,
    column_config: JSON.stringify(data.column_config || []),
    file_format: data.file_format || 'csv',
    delimiter: data.delimiter || ',',
    is_active: data.is_active !== undefined ? data.is_active : true,
    tenant_id: data.tenant_id || null,
  }).returning('*');
  return row;
}

export async function updateTemplate(id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.target_system !== undefined) update.target_system = data.target_system;
  if (data.data_source !== undefined) update.data_source = data.data_source;
  if (data.column_config !== undefined) update.column_config = JSON.stringify(data.column_config);
  if (data.file_format !== undefined) update.file_format = data.file_format;
  if (data.delimiter !== undefined) update.delimiter = data.delimiter;
  if (data.is_active !== undefined) update.is_active = data.is_active;

  const [row] = await db('integrations.export_templates').where('id', id).update(update).returning('*');
  return row;
}

export async function deleteTemplate(id) {
  return db('integrations.export_templates').where('id', id).del();
}

// ─── Data Source Queries ──────────────────────────────────────────────────

async function fetchSourceData(dataSource, dateFrom, dateTo) {
  let rows = [];
  try {
    switch (dataSource) {
      case 'receipts': {
        let q = db('inventory.receipts as r')
          .leftJoin('inventory.receipt_items as ri', 'ri.receipt_id', 'r.id')
          .select(
            'r.receipt_number', 'r.receipt_date', 'r.supplier_name',
            'ri.product_name', 'ri.quantity', 'ri.unit_price',
            db.raw('COALESCE(ri.quantity * ri.unit_price, 0) as total_value'),
            'ri.uom'
          );
        if (dateFrom) q = q.where('r.receipt_date', '>=', dateFrom);
        if (dateTo) q = q.where('r.receipt_date', '<=', dateTo);
        rows = await q.orderBy('r.receipt_date', 'asc');
        break;
      }
      case 'shipments': {
        let q = db('shipments.shipments');
        if (dateFrom) q = q.where('created_at', '>=', dateFrom);
        if (dateTo) q = q.where('created_at', '<=', dateTo);
        rows = await q.orderBy('created_at', 'asc');
        break;
      }
      case 'movements': {
        let q = db('inventory.stock_movements');
        if (dateFrom) q = q.where('movement_date', '>=', dateFrom);
        if (dateTo) q = q.where('movement_date', '<=', dateTo);
        rows = await q.orderBy('movement_date', 'asc');
        break;
      }
      case 'production': {
        let q = db('production.work_orders');
        if (dateFrom) q = q.where('created_at', '>=', dateFrom);
        if (dateTo) q = q.where('created_at', '<=', dateTo);
        rows = await q.orderBy('created_at', 'asc');
        break;
      }
      case 'inventory': {
        rows = await db('inventory.stock_levels').orderBy('product_name', 'asc');
        break;
      }
      default:
        rows = [];
    }
  } catch (err) {
    logger.warn(`Data source "${dataSource}" query failed: ${err.message}`);
    rows = [];
  }
  return rows;
}

// ─── Transform helpers ────────────────────────────────────────────────────

function applyTransform(value, transform) {
  if (value === null || value === undefined) return '';
  switch (transform) {
    case 'date_ro': {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('ro-RO');
    }
    case 'number':
      return Number(value) || 0;
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    default:
      return value;
  }
}

function escapeCsvField(val, delimiter) {
  const str = String(val ?? '');
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── Export Data ──────────────────────────────────────────────────────────

export async function exportData(templateId, dateFrom, dateTo, userId) {
  const template = await db('integrations.export_templates').where('id', templateId).first();
  if (!template) throw new Error('Template-ul nu a fost gasit');

  const columns = typeof template.column_config === 'string'
    ? JSON.parse(template.column_config)
    : template.column_config;
  const delimiter = template.delimiter || ',';

  let rows;
  let csvData;
  let logEntry;

  try {
    rows = await fetchSourceData(template.data_source, dateFrom, dateTo);

    // Build CSV header
    const header = columns.map(c => escapeCsvField(c.targetColumn, delimiter)).join(delimiter);

    // Build CSV rows
    const csvRows = rows.map(row => {
      return columns.map(col => {
        const rawVal = row[col.sourceField];
        const transformed = applyTransform(rawVal, col.transform);
        return escapeCsvField(transformed, delimiter);
      }).join(delimiter);
    });

    csvData = [header, ...csvRows].join('\n');

    // Log success
    [logEntry] = await db('integrations.export_logs').insert({
      template_id: templateId,
      exported_by: userId || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      row_count: rows.length,
      status: 'completed',
    }).returning('*');

  } catch (err) {
    // Log failure
    await db('integrations.export_logs').insert({
      template_id: templateId,
      exported_by: userId || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      row_count: 0,
      status: 'failed',
      error_message: err.message,
    });
    throw err;
  }

  return { csv: csvData, rowCount: rows.length, log: logEntry, template };
}

// ─── Export Logs ──────────────────────────────────────────────────────────

export async function listExportLogs(tenantId, page = 1, limit = 50) {
  let q = db('integrations.export_logs as el')
    .join('integrations.export_templates as et', 'et.id', 'el.template_id')
    .select(
      'el.*',
      'et.name as template_name',
      'et.target_system',
      'et.data_source',
    );
  if (tenantId) q = q.where(function () { this.where('et.tenant_id', tenantId).orWhereNull('et.tenant_id'); });

  const [{ count }] = await q.clone().count('* as count');
  const data = await q.clone().orderBy('el.created_at', 'desc').limit(limit).offset((page - 1) * limit);
  return { data, total: Number(count), page: Number(page), limit: Number(limit) };
}

// ─── Webhooks ─────────────────────────────────────────────────────────────

export async function listWebhooks(tenantId) {
  let q = db('integrations.webhooks').orderBy('created_at', 'desc');
  if (tenantId) q = q.where('tenant_id', tenantId);
  return q;
}

export async function createWebhook(data) {
  const [row] = await db('integrations.webhooks').insert({
    name: data.name,
    event_type: data.event_type,
    target_url: data.target_url,
    secret: data.secret || crypto.randomBytes(32).toString('hex'),
    is_active: data.is_active !== undefined ? data.is_active : true,
    tenant_id: data.tenant_id || null,
  }).returning('*');
  return row;
}

export async function updateWebhook(id, data) {
  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.event_type !== undefined) update.event_type = data.event_type;
  if (data.target_url !== undefined) update.target_url = data.target_url;
  if (data.secret !== undefined) update.secret = data.secret;
  if (data.is_active !== undefined) update.is_active = data.is_active;

  const [row] = await db('integrations.webhooks').where('id', id).update(update).returning('*');
  return row;
}

export async function deleteWebhook(id) {
  return db('integrations.webhooks').where('id', id).del();
}

// ─── Trigger Webhooks ─────────────────────────────────────────────────────

export async function triggerWebhooks(eventType, payload, tenantId) {
  let q = db('integrations.webhooks')
    .where('event_type', eventType)
    .where('is_active', true);
  if (tenantId) q = q.where('tenant_id', tenantId);
  const hooks = await q;

  const results = [];
  for (const hook of hooks) {
    try {
      const body = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload });
      const signature = crypto.createHmac('sha256', hook.secret || '').update(body).digest('hex');

      const response = await fetch(hook.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await db('integrations.webhooks').where('id', hook.id).update({
        last_triggered_at: db.fn.now(),
        last_status: response.status,
      });

      results.push({ id: hook.id, name: hook.name, status: response.status, success: response.ok });
    } catch (err) {
      await db('integrations.webhooks').where('id', hook.id).update({
        last_triggered_at: db.fn.now(),
        last_status: 0,
      });
      results.push({ id: hook.id, name: hook.name, status: 0, success: false, error: err.message });
      logger.warn(`Webhook ${hook.name} failed: ${err.message}`);
    }
  }
  return results;
}

// ─── Test Webhook ─────────────────────────────────────────────────────────

export async function testWebhook(id) {
  const hook = await db('integrations.webhooks').where('id', id).first();
  if (!hook) throw new Error('Webhook-ul nu a fost gasit');

  const payload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'Test webhook from ShopFloor', webhook_id: id },
  };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', hook.secret || '').update(body).digest('hex');

  try {
    const response = await fetch(hook.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'test',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    await db('integrations.webhooks').where('id', id).update({
      last_triggered_at: db.fn.now(),
      last_status: response.status,
    });

    return { success: response.ok, status: response.status };
  } catch (err) {
    await db('integrations.webhooks').where('id', id).update({
      last_triggered_at: db.fn.now(),
      last_status: 0,
    });
    return { success: false, status: 0, error: err.message };
  }
}
