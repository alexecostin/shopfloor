import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import db from '../../config/db.js';
import * as pdf from '../../services/pdf.service.js';

const router = Router();
router.use(authenticate);

function pdfHeaders(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

// ─── Production Report ────────────────────────────────────────────────────────

router.get('/production-report', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    let q = db('production.reports as r')
      .leftJoin('machines.machines as m', 'r.machine_id', 'm.id')
      .leftJoin('auth.users as u', 'r.operator_id', 'u.id')
      .select('r.*', 'm.code as machine', 'u.full_name as operator')
      .whereRaw(`DATE(r.reported_at) = ?`, [date]);
    if (req.query.machineId) q = q.where('r.machine_id', req.query.machineId);
    const reports = await q;

    const buf = await pdf.generateProductionReport(reports, date);
    pdfHeaders(res, `raport-productie-${date}.pdf`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ─── OEE Report ──────────────────────────────────────────────────────────────

router.get('/oee-report', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const machines = await db('machines.machines as m')
      .leftJoin('production.reports as r', function () {
        this.on('r.machine_id', 'm.id');
        if (dateFrom) this.andOnVal('r.reported_at', '>=', dateFrom);
        if (dateTo) this.andOnVal('r.reported_at', '<=', dateTo);
      })
      .select(
        'm.id', 'm.code as machine_code', 'm.name as machine_name',
        db.raw('COALESCE(SUM(r.good_pieces), 0) as good_pieces'),
        db.raw('COALESCE(SUM(r.scrap_pieces), 0) as scrap_pieces'),
        db.raw('COALESCE(SUM(r.good_pieces + r.scrap_pieces), 0) as total_pieces'),
      )
      .groupBy('m.id', 'm.code', 'm.name');

    const machinesWithOEE = machines.map((m) => {
      const total = Number(m.total_pieces);
      const good = Number(m.good_pieces);
      const quality = total > 0 ? good / total : 0;
      const oee = 0.9 * 1.0 * quality; // availability=0.9, performance=1
      return { ...m, quality, oee, availability: 0.9 };
    });

    const buf = await pdf.generateOEEReport(machinesWithOEE, dateFrom, dateTo);
    pdfHeaders(res, `raport-oee-${dateFrom || 'all'}.pdf`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ─── Maintenance Report ───────────────────────────────────────────────────────

router.get('/maintenance-report', async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let q = db('maintenance.requests as r')
      .leftJoin('machines.machines as m', 'r.machine_id', 'm.id')
      .select('r.*', 'm.code as machine');
    if (dateFrom) q = q.where('r.created_at', '>=', dateFrom);
    if (dateTo) q = q.where('r.created_at', '<=', dateTo);
    const requests = await q.orderBy('r.created_at', 'desc');

    // Calculate duration in minutes
    const enriched = requests.map((r) => ({
      ...r,
      duration: r.started_at && r.resolved_at
        ? Math.round((new Date(r.resolved_at) - new Date(r.started_at)) / 60000)
        : null,
    }));

    const buf = await pdf.generateMaintenanceReport(enriched, dateFrom, dateTo);
    pdfHeaders(res, `raport-mentenanta-${dateFrom || 'all'}.pdf`);
    res.send(buf);
  } catch (e) { next(e); }
});

// ─── Inventory Report ─────────────────────────────────────────────────────────

router.get('/inventory-report', async (req, res, next) => {
  try {
    const items = await db('inventory.items as i')
      .leftJoin('inventory.stock_levels as sl', 'i.id', 'sl.item_id')
      .select('i.code', 'i.name', 'i.category', 'i.unit', 'i.min_stock',
        db.raw('COALESCE(sl.current_qty, 0) as current_qty'))
      .where('i.is_active', true)
      .orderBy('i.name');

    const buf = await pdf.generateInventoryReport(items);
    pdfHeaders(res, 'raport-stocuri.pdf');
    res.send(buf);
  } catch (e) { next(e); }
});

export default router;
