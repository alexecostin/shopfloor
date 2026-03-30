import { Router } from 'express';
import multer from 'multer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as svc from '../../services/document.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadDir = resolve(__dirname, '../../../uploads/documents');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split('.').pop();
    cb(null, `${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = Router();
const mgr = authorize('admin', 'production_manager', 'quality_manager');

router.use(authenticate);

// ── Search (must be before /:id) ────────────────────────────────────────────

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    const results = await svc.searchDocuments(q, req.user.tenantId);
    res.json(results);
  } catch (e) { next(e); }
});

// ── Documents for Entity (must be before /:id) ─────────────────────────────

router.get('/for/:entityType/:entityId', async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    res.json(await svc.getDocumentsForEntity(entityType, entityId));
  } catch (e) { next(e); }
});

// ── List Documents ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { type, search, entityType, entityId, page, limit } = req.query;
    res.json(await svc.listDocuments({
      type,
      search,
      entityType,
      entityId,
      tenantId: req.user.tenantId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    }));
  } catch (e) { next(e); }
});

// ── Create Document ─────────────────────────────────────────────────────────

router.post('/', mgr, async (req, res, next) => {
  try {
    const doc = await svc.createDocument(
      { ...req.body, tenantId: req.user.tenantId },
      req.user.userId,
    );
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// ── Get Document Detail ─────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await svc.getDocument(req.params.id));
  } catch (e) { next(e); }
});

// ── Upload Revision ─────────────────────────────────────────────────────────

router.post('/:id/revisions', mgr, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'Fisierul este obligatoriu.' });
    }

    const revision = await svc.createRevision(
      req.params.id,
      {
        revisionCode: req.body.revisionCode || req.body.revision_code || 'A',
        filePath: `uploads/documents/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fullTextContent: req.body.fullTextContent || req.body.full_text_content || null,
      },
      req.user.userId,
    );
    res.status(201).json(revision);
  } catch (e) { next(e); }
});

// ── Link Document to Entity ─────────────────────────────────────────────────

router.post('/:id/link', mgr, async (req, res, next) => {
  try {
    const { entityType, entityId, linkType } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json({ message: 'entityType si entityId sunt obligatorii.' });
    }
    const link = await svc.linkDocument(
      req.params.id,
      entityType,
      entityId,
      linkType || 'reference',
    );
    res.status(201).json(link);
  } catch (e) { next(e); }
});

export default router;
