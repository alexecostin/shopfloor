import db from '../../config/db.js';
import { processUpload, confirmImport } from '../../services/import-engine.service.js';
import { findBestMatch } from '../../services/fuzzy-match.service.js';

const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

export const listTemplates = wrap(async (req, res) => {
  let q = db('imports.templates').where('is_active', true).orderBy('use_count', 'desc');
  if (req.query.importType) q = q.where('import_type', req.query.importType);
  res.json(await q);
});

export const createTemplate = wrap(async (req, res) => {
  const [r] = await db('imports.templates').insert({ ...req.body, created_by: req.user.userId }).returning('*');
  res.status(201).json(r);
});

export const updateTemplate = wrap(async (req, res) => {
  const [r] = await db('imports.templates').where('id', req.params.id).update(req.body).returning('*');
  if (!r) return res.status(404).json({ message: 'Template negasit.' });
  res.json(r);
});

export const deleteTemplate = wrap(async (req, res) => {
  await db('imports.templates').where('id', req.params.id).update({ is_active: false });
  res.json({ message: 'Sters.' });
});

export const upload = wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fisier lipsa.' });
  const { importType, templateId } = req.body;
  if (!importType) return res.status(400).json({ message: 'importType este obligatoriu.' });

  const result = await processUpload({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    importType,
    templateId,
  });

  // Create import log
  const [log] = await db('imports.import_logs').insert({
    template_id: templateId || null,
    import_type: importType,
    source_filename: req.file.originalname,
    source_type: templateId ? 'excel' : 'excel',
    status: 'preview',
    total_rows: result.total_rows,
    detected_columns: JSON.stringify(result.headers),
    applied_mappings: JSON.stringify(result.suggestedMapping),
    preview_rows: JSON.stringify(result.previewRows),
    created_by: req.user.userId,
  }).returning('*');

  // Store all raw rows temporarily (first 200 for preview)
  // We store validated rows after /map is called
  res.status(201).json({
    importLogId: log.id,
    detectedColumns: result.headers,
    suggestedMapping: result.suggestedMapping,
    previewRows: result.previewRows,
    totalRows: result.total_rows,
  });
});

export const mapImport = wrap(async (req, res) => {
  const { importLogId } = req.params;
  const { mappings, saveAsTemplate, templateName, importType } = req.body;

  const log = await db('imports.import_logs').where('id', importLogId).first();
  if (!log) return res.status(404).json({ message: 'Import log negasit.' });

  // We need the raw rows — for simplicity, store them in preview_rows on upload
  const previewRows = log.preview_rows || [];

  // Apply mappings
  const { applyMappings: apply, validateRows: validate } = await import('../../services/import-engine.service.js');

  // Save template if requested
  if (saveAsTemplate && templateName) {
    await db('imports.templates').insert({
      name: templateName,
      import_type: importType || log.import_type,
      source_type: 'excel',
      column_mappings: JSON.stringify(mappings),
      created_by: req.user.userId,
    });
  }

  // Update log with applied mappings
  await db('imports.import_logs').where('id', importLogId).update({
    applied_mappings: JSON.stringify(mappings),
  });

  res.json({
    message: 'Mapping aplicat. Folositi /confirm pentru a importa datele.',
    mappings_applied: mappings.length,
    note: 'Upload fisierul din nou cu templateId setat pentru a aplica mapping automat.',
  });
});

export const confirmImportHandler = wrap(async (req, res) => {
  const { importLogId } = req.params;
  const log = await db('imports.import_logs').where('id', importLogId).first();
  if (!log) return res.status(404).json({ message: 'Import log negasit.' });

  const result = await confirmImport(importLogId, log.import_type, req.user.userId);
  res.json(result);
});

export const pasteImport = wrap(async (req, res) => {
  const { text, importType, templateId } = req.body;
  if (!text || !importType) return res.status(400).json({ message: 'text si importType sunt obligatorii.' });

  const buf = Buffer.from(text, 'utf8');
  const result = await processUpload({ buffer: buf, filename: 'paste.csv', mimetype: 'text/csv', importType, templateId });

  const [log] = await db('imports.import_logs').insert({
    template_id: templateId || null,
    import_type: importType,
    source_filename: 'paste.csv',
    source_type: 'manual',
    status: 'preview',
    total_rows: result.total_rows,
    detected_columns: JSON.stringify(result.headers),
    applied_mappings: JSON.stringify(result.suggestedMapping),
    preview_rows: JSON.stringify(result.previewRows),
    created_by: req.user.userId,
  }).returning('*');

  res.status(201).json({
    importLogId: log.id,
    detectedColumns: result.headers,
    suggestedMapping: result.suggestedMapping,
    previewRows: result.previewRows,
    totalRows: result.total_rows,
  });
});

export const listLogs = wrap(async (req, res) => {
  res.json(await db('imports.import_logs').orderBy('created_at', 'desc').limit(100));
});

export const getLog = wrap(async (req, res) => {
  const log = await db('imports.import_logs').where('id', req.params.id).first();
  if (!log) return res.status(404).json({ message: 'Log negasit.' });
  const rows = await db('imports.import_row_details').where('import_log_id', req.params.id).orderBy('row_number');
  res.json({ ...log, rows });
});

// Email simulation
export const simulateEmail = wrap(async (req, res) => {
  const { from_address, subject, body_text, importType, templateId } = req.body;
  const [email] = await db('imports.email_inbox').insert({
    from_address: from_address || 'test@example.com',
    subject: subject || 'Test import',
    body_text,
    status: 'pending',
  }).returning('*');
  res.status(201).json({ email_id: email.id, message: 'Email simulat adaugat in inbox.' });
});

export const listEmailInbox = wrap(async (req, res) => {
  res.json(await db('imports.email_inbox').orderBy('received_at', 'desc'));
});

export const processEmailInbox = wrap(async (req, res) => {
  const email = await db('imports.email_inbox').where('id', req.params.id).first();
  if (!email) return res.status(404).json({ message: 'Email negasit.' });

  if (email.body_text) {
    const buf = Buffer.from(email.body_text, 'utf8');
    const result = await processUpload({ buffer: buf, filename: 'email.csv', mimetype: 'text/csv', importType: 'orders' });
    const [log] = await db('imports.import_logs').insert({
      import_type: 'orders',
      source_filename: `email-${email.id}.csv`,
      source_type: 'email',
      status: 'preview',
      total_rows: result.total_rows,
      detected_columns: JSON.stringify(result.headers),
      preview_rows: JSON.stringify(result.previewRows),
      created_by: req.user.userId,
    }).returning('*');
    await db('imports.email_inbox').where('id', email.id).update({ status: 'processed', import_log_id: log.id, processed_at: new Date() });
    return res.json({ import_log_id: log.id, preview: result.previewRows });
  }
  res.json({ message: 'Nicio data de procesat in email.' });
});
