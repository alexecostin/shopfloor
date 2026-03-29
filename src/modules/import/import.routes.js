import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../middleware/auth.js';
import { readExcel, generateTemplate } from '../../services/excel.service.js';
import db from '../../config/db.js';

const router = Router();
const mgr = authorize('admin', 'production_manager');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Doar fisiere .xlsx sunt acceptate.'));
    }
  },
});

router.use(authenticate);

// ─── Machines Import ──────────────────────────────────────────────────────────

router.post('/machines', mgr, upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await readExcel(req.file.buffer);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const { rowNum, data } of rows) {
      const code = String(data['Cod'] || '').trim();
      const name = String(data['Denumire'] || '').trim();
      if (!code || !name) { skipped++; errors.push({ row: rowNum, error: 'Cod si Denumire sunt obligatorii.' }); continue; }

      try {
        await db('machines.machines')
          .insert({ code, name, type: String(data['Tip'] || 'General').trim(), location: data['Locatie'] })
          .onConflict('code').ignore();
        imported++;
      } catch (e) {
        skipped++;
        errors.push({ row: rowNum, error: e.message });
      }
    }
    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
});

// ─── Products (BOM) Import ────────────────────────────────────────────────────

router.post('/products', mgr, upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await readExcel(req.file.buffer);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const { rowNum, data } of rows) {
      const reference = String(data['Referinta'] || '').trim();
      const name = String(data['Denumire'] || '').trim();
      if (!reference || !name) { skipped++; errors.push({ row: rowNum, error: 'Referinta si Denumire obligatorii.' }); continue; }

      try {
        await db('bom.products').insert({
          reference,
          name,
          variant: data['Varianta'] || null,
          client_name: data['Client'] || null,
          material_type: data['Material'] || null,
          weight_piece_kg: data['Masa Piesa'] ? Number(data['Masa Piesa']) : null,
          container_type: data['Container'] || null,
          qty_per_container: data['Qty/Container'] ? parseInt(data['Qty/Container']) : null,
        }).onConflict('reference').ignore();
        imported++;
      } catch (e) {
        skipped++;
        errors.push({ row: rowNum, error: e.message });
      }
    }
    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
});

// ─── Customer Demands Import ──────────────────────────────────────────────────

router.post('/demands', mgr, upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await readExcel(req.file.buffer);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const { rowNum, data } of rows) {
      const productReference = String(data['Referinta Produs'] || '').trim();
      const demandDate = data['Data Cerere'];
      const requiredQty = parseInt(data['Cantitate']);
      if (!productReference || !demandDate || isNaN(requiredQty)) {
        skipped++;
        errors.push({ row: rowNum, error: 'Referinta Produs, Data Cerere, Cantitate sunt obligatorii.' });
        continue;
      }
      try {
        await db('planning.customer_demands').insert({
          product_reference: productReference,
          demand_date: new Date(demandDate),
          required_qty: requiredQty,
          delivery_date: data['Data Livrare'] ? new Date(data['Data Livrare']) : null,
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push({ row: rowNum, error: e.message });
      }
    }
    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
});

// ─── Planning Allocations Import ──────────────────────────────────────────────

router.post('/planning', mgr, upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await readExcel(req.file.buffer);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const { rowNum, data } of rows) {
      const planDate = data['Data'];
      const shift = String(data['Tura'] || '').trim();
      const machineCode = String(data['Cod Masina'] || '').trim();
      if (!planDate || !shift || !machineCode) {
        skipped++;
        errors.push({ row: rowNum, error: 'Data, Tura, Cod Masina sunt obligatorii.' });
        continue;
      }
      try {
        const machine = await db('machines.machines').where({ code: machineCode }).first();
        if (!machine) { skipped++; errors.push({ row: rowNum, error: `Masina ${machineCode} negasita.` }); continue; }

        const date = new Date(planDate);
        const year = date.getFullYear();
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + 1);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        let plan = await db('planning.master_plans')
          .where('start_date', '<=', date).where('end_date', '>=', date).where('status', 'active').first();
        if (!plan) {
          [plan] = await db('planning.master_plans').insert({
            name: `Saptamana ${startOfWeek.toLocaleDateString('ro-RO')}`,
            year, start_date: startOfWeek, end_date: endOfWeek, status: 'active',
          }).returning('*');
        }

        await db('planning.daily_allocations').insert({
          master_plan_id: plan.id,
          plan_date: date,
          shift,
          machine_id: machine.id,
          product_reference: data['Referinta Produs'] || null,
          product_name: data['Denumire'] || null,
          planned_qty: parseInt(data['Cantitate Planificata']) || 0,
          planned_hours: data['Ore Planificate'] ? Number(data['Ore Planificate']) : null,
        });
        imported++;
      } catch (e) {
        skipped++;
        errors.push({ row: rowNum, error: e.message });
      }
    }
    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
});

// ─── Template Generator ───────────────────────────────────────────────────────

const TEMPLATES = {
  machines: ['Cod', 'Denumire', 'Tip', 'Locatie', 'Timp Ciclu (sec)'],
  products: ['Referinta', 'Denumire', 'Varianta', 'Client', 'Material', 'Masa Piesa', 'Container', 'Qty/Container'],
  demands: ['Referinta Produs', 'Data Cerere', 'Cantitate', 'Data Livrare'],
  planning: ['Data', 'Tura', 'Cod Masina', 'Referinta Produs', 'Denumire', 'Cantitate Planificata', 'Ore Planificate'],
};

router.get('/template/:type', async (req, res, next) => {
  try {
    const headers = TEMPLATES[req.params.type];
    if (!headers) return res.status(404).json({ message: 'Tip template necunoscut.' });
    const buffer = await generateTemplate(headers, req.params.type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-${req.params.type}.xlsx"`);
    res.send(buffer);
  } catch (e) { next(e); }
});

export default router;
