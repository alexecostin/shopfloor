import db from '../config/db.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function err(msg, code = 400) {
  const e = new Error(msg);
  e.statusCode = code;
  throw e;
}

// ── List Documents (paginated, filtered) ────────────────────────────────────

export async function listDocuments({ type, search, entityType, entityId, tenantId, page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;

  let q = db('documents.documents as d')
    .leftJoin('documents.document_revisions as cr', 'd.current_revision_id', 'cr.id')
    .select(
      'd.*',
      'cr.revision_code as current_revision_code',
      'cr.file_name as current_file_name',
      'cr.file_size as current_file_size',
      'cr.mime_type as current_mime_type',
      'cr.status as current_revision_status',
    )
    .where('d.is_active', true)
    .orderBy('d.updated_at', 'desc');

  if (type) q = q.where('d.document_type', type);
  if (tenantId) q = q.where('d.tenant_id', tenantId);

  if (search) {
    const term = `%${search}%`;
    q = q.where(function () {
      this.whereILike('d.title', term)
        .orWhereILike('d.description', term);
    });
  }

  if (entityType && entityId) {
    q = q.whereExists(function () {
      this.select(db.raw(1))
        .from('documents.document_links as dl')
        .whereRaw('dl.document_id = d.id')
        .where('dl.entity_type', entityType)
        .where('dl.entity_id', entityId);
    });
  }

  const countQ = q.clone().clearSelect().clearOrder().count('d.id as count');
  const [{ count }] = await countQ;
  const data = await q.limit(limit).offset(offset);

  return { data, total: Number(count), page, limit };
}

// ── Get Single Document with Revisions and Links ────────────────────────────

export async function getDocument(id) {
  const doc = await db('documents.documents').where({ id }).first();
  if (!doc) err('Documentul nu a fost gasit.', 404);

  const revisions = await db('documents.document_revisions')
    .where({ document_id: id })
    .orderBy('created_at', 'desc');

  const links = await db('documents.document_links')
    .where({ document_id: id })
    .orderBy('created_at', 'desc');

  return { ...doc, revisions, links };
}

// ── Create Document ─────────────────────────────────────────────────────────

export async function createDocument(data, userId) {
  const [doc] = await db('documents.documents').insert({
    title: data.title,
    document_type: data.documentType || data.document_type || 'other',
    description: data.description || null,
    tags: JSON.stringify(data.tags || []),
    tenant_id: data.tenantId || data.tenant_id || null,
    created_by: userId,
  }).returning('*');

  return doc;
}

// ── Create Revision ─────────────────────────────────────────────────────────

export async function createRevision(documentId, { revisionCode, filePath, fileName, fileSize, mimeType, fullTextContent }, userId) {
  const doc = await db('documents.documents').where({ id: documentId }).first();
  if (!doc) err('Documentul nu a fost gasit.', 404);

  return db.transaction(async (trx) => {
    const [revision] = await trx('documents.document_revisions').insert({
      document_id: documentId,
      revision_code: revisionCode,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      full_text_content: fullTextContent || null,
      status: 'draft',
      uploaded_by: userId,
    }).returning('*');

    // Set as current revision on the document
    await trx('documents.documents').where({ id: documentId }).update({
      current_revision_id: revision.id,
      updated_at: new Date(),
    });

    return revision;
  });
}

// ── Link Document to Entity ─────────────────────────────────────────────────

export async function linkDocument(documentId, entityType, entityId, linkType = 'reference') {
  const doc = await db('documents.documents').where({ id: documentId }).first();
  if (!doc) err('Documentul nu a fost gasit.', 404);

  // Avoid duplicate links
  const existing = await db('documents.document_links')
    .where({ document_id: documentId, entity_type: entityType, entity_id: entityId })
    .first();
  if (existing) return existing;

  const [link] = await db('documents.document_links').insert({
    document_id: documentId,
    entity_type: entityType,
    entity_id: entityId,
    link_type: linkType,
  }).returning('*');

  return link;
}

// ── Get Documents for Entity ────────────────────────────────────────────────

export async function getDocumentsForEntity(entityType, entityId) {
  const rows = await db('documents.document_links as dl')
    .join('documents.documents as d', 'dl.document_id', 'd.id')
    .leftJoin('documents.document_revisions as cr', 'd.current_revision_id', 'cr.id')
    .where('dl.entity_type', entityType)
    .where('dl.entity_id', entityId)
    .where('d.is_active', true)
    .select(
      'd.*',
      'dl.link_type',
      'dl.id as link_id',
      'cr.revision_code as current_revision_code',
      'cr.file_name as current_file_name',
      'cr.file_size as current_file_size',
      'cr.mime_type as current_mime_type',
      'cr.status as current_revision_status',
    )
    .orderBy('d.updated_at', 'desc');

  return rows;
}

// ── Full-text Search ────────────────────────────────────────────────────────

export async function searchDocuments(query, tenantId) {
  if (!query || query.trim().length === 0) return [];

  const term = `%${query}%`;

  let q = db('documents.documents as d')
    .leftJoin('documents.document_revisions as cr', 'd.current_revision_id', 'cr.id')
    .leftJoin('documents.document_revisions as allrev', 'allrev.document_id', 'd.id')
    .where('d.is_active', true)
    .where(function () {
      this.whereILike('d.title', term)
        .orWhereILike('d.description', term)
        .orWhereILike('allrev.full_text_content', term);
    })
    .select(
      'd.*',
      'cr.revision_code as current_revision_code',
      'cr.file_name as current_file_name',
      'cr.file_size as current_file_size',
      'cr.mime_type as current_mime_type',
      'cr.status as current_revision_status',
    )
    .groupBy(
      'd.id', 'cr.id',
    )
    .orderBy('d.updated_at', 'desc')
    .limit(50);

  if (tenantId) q = q.where('d.tenant_id', tenantId);

  return q;
}
