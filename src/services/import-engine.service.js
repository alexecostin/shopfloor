import db from '../config/db.js';
import { findBestMatch } from './fuzzy-match.service.js';

/**
 * Parse a CSV text into rows of objects.
 */
function parseCSV(text, skipRows = 0) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= skipRows) return { headers: [], rows: [] };
  const headers = lines[skipRows].split(/[,\t;]/).map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];
  for (let i = skipRows + 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t;]/).map(c => c.replace(/^["']|["']$/g, '').trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Parse Excel buffer using ExcelJS.
 */
async function parseExcel(buffer, sheetName, skipRows = 0) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const allRows = [];
  ws.eachRow(row => allRows.push(row.values.slice(1))); // slice to remove 1-indexed empty

  if (allRows.length <= skipRows) return { headers: [], rows: [] };
  const headers = (allRows[skipRows] || []).map(h => String(h || '').trim());
  const rows = [];
  for (let i = skipRows + 1; i < allRows.length; i++) {
    const row = {};
    headers.forEach((h, idx) => { row[h] = String(allRows[i][idx] ?? '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Apply field mappings and optional transforms to raw rows.
 */
export function applyMappings(rawRows, mappings, defaultValues = {}) {
  return rawRows.map(raw => {
    const mapped = { ...defaultValues };
    for (const m of mappings) {
      let val = raw[m.source_column] ?? '';
      if (m.transform === 'integer') val = parseInt(val) || 0;
      else if (m.transform === 'float') val = parseFloat(val) || 0;
      else if (m.transform === 'date_dmy') {
        const parts = val.split(/[\/\-\.]/);
        if (parts.length === 3) val = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      else if (m.transform === 'date_mdy') {
        const parts = val.split(/[\/\-\.]/);
        if (parts.length === 3) val = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      if (m.target_field) mapped[m.target_field] = val;
    }
    return mapped;
  });
}

/**
 * Validate and fuzzy-match mapped rows against DB entities.
 */
export async function validateRows(mappedRows, importType) {
  // Load reference data for fuzzy matching
  let productRefs = [], itemCodes = [];
  try {
    const products = await db('bom.products').select('reference');
    productRefs = products.map(p => p.reference);
    const items = await db('inventory.items').select('code');
    itemCodes = items.map(i => i.code);
  } catch (e) { /* ignore */ }

  return mappedRows.map((row, idx) => {
    const status_checks = [];
    const suggestions = [];

    if (importType === 'orders' || importType === 'demands') {
      const ref = row.product_reference || row.product_code || '';
      if (ref && productRefs.length > 0) {
        const match = findBestMatch(ref, productRefs);
        if (!match) status_checks.push({ field: 'product_reference', error: `Codul "${ref}" nu exista in BOM.` });
        else if (!match.isExact) suggestions.push({ field: 'product_reference', original: ref, suggestion: match.match, score: match.score });
      }
    }

    if (importType === 'materials_receipt' || importType === 'stock_update') {
      const code = row.item_code || row.code || '';
      if (code && itemCodes.length > 0) {
        const match = findBestMatch(code, itemCodes);
        if (!match) status_checks.push({ field: 'item_code', error: `Codul "${code}" nu exista in inventar.` });
        else if (!match.isExact) suggestions.push({ field: 'item_code', original: code, suggestion: match.match, score: match.score });
      }
    }

    const hasErrors = status_checks.some(c => c.error);
    const hasWarnings = suggestions.length > 0;
    const status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid';

    return { rowNumber: idx + 1, rawData: {}, mappedData: row, status, errors: status_checks, suggestions };
  });
}

export async function processUpload({ buffer, filename, importType, templateId, mimetype }) {
  let rawRows = [], headers = [];

  const ext = (filename || '').split('.').pop().toLowerCase();
  const isExcel = ext === 'xlsx' || ext === 'xls' || mimetype?.includes('spreadsheet');
  const isCSV = ext === 'csv' || mimetype?.includes('csv') || mimetype?.includes('text');
  const isPDF = ext === 'pdf' || mimetype?.includes('pdf');

  let template = null;
  if (templateId) {
    template = await db('imports.templates').where('id', templateId).first();
  }

  const skipRows = template?.skip_rows || 0;
  const sheetName = template?.sheet_name || null;

  if (isExcel) {
    const parsed = await parseExcel(buffer, sheetName, skipRows);
    headers = parsed.headers;
    rawRows = parsed.rows;
  } else if (isCSV) {
    const text = buffer.toString('utf8');
    const parsed = parseCSV(text, skipRows);
    headers = parsed.headers;
    rawRows = parsed.rows;
  } else if (isPDF) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      const parsed = parseCSV(data.text, skipRows);
      headers = parsed.headers;
      rawRows = parsed.rows;
    } catch (e) {
      // OCR fallback would go here
      headers = ['raw_text'];
      rawRows = [{ raw_text: 'PDF parsing failed. Please use OCR or manual import.' }];
    }
  } else {
    const text = buffer.toString('utf8');
    const parsed = parseCSV(text, skipRows);
    headers = parsed.headers;
    rawRows = parsed.rows;
  }

  // Auto-detect mappings from template
  let suggestedMapping = [];
  if (template?.column_mappings) {
    suggestedMapping = template.column_mappings;
  } else {
    // Suggest mappings based on header names
    suggestedMapping = headers.map(h => {
      const lower = h.toLowerCase().replace(/[\s_\-]/g, '');
      let target = null;
      if (['partnumber', 'productcode', 'reference', 'cod', 'produs'].some(k => lower.includes(k))) target = 'product_reference';
      else if (['qty', 'quantity', 'cantitate', 'cantit'].some(k => lower.includes(k))) target = 'quantity';
      else if (['duedate', 'deadline', 'termen', 'data'].some(k => lower.includes(k))) target = 'deadline';
      else if (['order', 'comanda', 'nr'].some(k => lower.includes(k))) target = 'order_number';
      return { source_column: h, target_field: target, transform: null };
    });
  }

  const preview = rawRows.slice(0, 5);
  return {
    headers,
    total_rows: rawRows.length,
    suggestedMapping,
    previewRows: preview,
    rawRows, // keep for later confirm step
  };
}

export async function confirmImport(logId, importType, userId) {
  const log = await db('imports.import_logs').where('id', logId).first();
  if (!log) throw Object.assign(new Error('Import log negasit.'), { statusCode: 404 });

  const rows = await db('imports.import_row_details')
    .where({ import_log_id: logId })
    .whereIn('status', ['valid', 'warning']);

  let imported = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    const data = row.mapped_data;
    try {
      if (importType === 'orders') {
        await db('production.orders').insert({
          order_number: data.order_number || `IMP-${Date.now()}-${row.row_number}`,
          product_name: data.product_name || data.product_reference || 'Unknown',
          product_code: data.product_reference || data.product_code || null,
          machine_id: data.machine_id || (await db('machines.machines').first())?.id,
          target_quantity: parseInt(data.quantity) || 0,
          status: 'planned',
        }).onConflict('order_number').ignore();
      } else if (importType === 'demands') {
        const product = data.product_reference ? await db('bom.products').where('reference', data.product_reference).first() : null;
        if (product) {
          await db('planning.customer_demands').insert({
            product_id: product.id,
            quantity: parseInt(data.quantity) || 0,
            deadline: data.deadline || null,
            client_name: data.client_name || 'Import',
          }).catch(() => {});
        }
      } else if (importType === 'materials_receipt') {
        const item = await db('inventory.items').where('code', data.item_code).first();
        if (item) {
          await db('inventory.movements').insert({
            item_id: item.id,
            movement_type: 'receipt',
            quantity: parseFloat(data.quantity) || 0,
            unit_cost: parseFloat(data.unit_cost) || 0,
            reference: data.reference || `NIR-IMP-${Date.now()}`,
            notes: 'Import automat',
            created_by: userId,
          });
          await db('inventory.stock_levels').where('item_id', item.id)
            .increment('quantity', parseFloat(data.quantity) || 0);
        }
      } else if (importType === 'stock_update') {
        const item = await db('inventory.items').where('code', data.item_code || data.code).first();
        if (item) {
          await db('inventory.stock_levels').where('item_id', item.id)
            .update({ quantity: parseFloat(data.quantity) || 0 });
        }
      } else if (importType === 'products') {
        await db('bom.products').insert({
          reference: data.product_reference || data.reference,
          name: data.product_name || data.name,
          unit: data.unit || 'buc',
        }).onConflict('reference').ignore();
      }
      await db('imports.import_row_details').where('id', row.id).update({ status: 'imported' });
      imported++;
    } catch (e) {
      await db('imports.import_row_details').where('id', row.id).update({ status: 'error', error_message: e.message });
      errors++;
    }
  }

  skipped = rows.filter(r => r.status === 'skipped').length;

  await db('imports.import_logs').where('id', logId).update({
    status: 'completed',
    imported_rows: imported,
    error_rows: errors,
    completed_at: new Date(),
  });

  // Update template use count
  if (log.template_id) {
    await db('imports.templates').where('id', log.template_id).increment('use_count', 1).update({ last_used_at: new Date() });
  }

  return { imported, skipped, errors };
}
