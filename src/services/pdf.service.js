import PDFDocument from 'pdfkit';

const PRIMARY = '#2563eb';
const TEXT = '#1e293b';
const MUTED = '#64748b';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ro-RO');
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ro-RO');
}

// ─── Base builder ─────────────────────────────────────────────────────────────

function createDoc() {
  return new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, autoFirstPage: true });
}

function header(doc, title, subtitle) {
  doc.fontSize(18).fillColor(PRIMARY).text('ShopFloor.ro', 50, 50);
  doc.fontSize(11).fillColor(MUTED).text(subtitle || '', 50, 72);
  doc.fontSize(14).fillColor(TEXT).text(title, { align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor(PRIMARY).lineWidth(2).stroke();
  doc.y = 110;
}

function footer(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(MUTED)
      .text(`Pagina ${i + 1} din ${pages.count}  •  Generat la ${formatDateTime(new Date())}  •  ShopFloor.ro`,
        50, doc.page.height - 40, { align: 'center', width: 495 });
  }
}

function tableHeader(doc, columns) {
  const y = doc.y;
  doc.rect(50, y, 495, 20).fillColor('#f1f5f9').fill();
  let x = 50;
  for (const col of columns) {
    doc.fontSize(8).fillColor(TEXT).font('Helvetica-Bold')
      .text(col.label, x + 4, y + 5, { width: col.width - 8, ellipsis: true });
    x += col.width;
  }
  doc.y = y + 22;
  doc.font('Helvetica');
}

function tableRow(doc, columns, row, even) {
  const y = doc.y;
  const rowH = 18;
  if (even) doc.rect(50, y, 495, rowH).fillColor('#f8fafc').fill();
  let x = 50;
  for (const col of columns) {
    const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '—';
    doc.fontSize(8).fillColor(TEXT)
      .text(val, x + 4, y + 4, { width: col.width - 8, ellipsis: true });
    x += col.width;
  }
  doc.y = y + rowH;
  if (doc.y > doc.page.height - 80) {
    doc.addPage();
    tableHeader(doc, columns);
  }
}

// ─── Production Report ────────────────────────────────────────────────────────

export async function generateProductionReport(reports, date) {
  return new Promise((resolve) => {
    const doc = createDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    header(doc, 'Raport Productie', `Data: ${formatDate(date)}`);

    const cols = [
      { key: 'machine', label: 'Masina', width: 80 },
      { key: 'shift', label: 'Tura', width: 60 },
      { key: 'good_pieces', label: 'Buc OK', width: 60 },
      { key: 'scrap_pieces', label: 'Rebuturi', width: 65 },
      { key: 'total', label: 'Total', width: 55 },
      { key: 'oee', label: 'OEE %', width: 55 },
      { key: 'operator', label: 'Operator', width: 120 },
    ];
    tableHeader(doc, cols);
    reports.forEach((r, i) => tableRow(doc, cols, { ...r, total: (r.good_pieces || 0) + (r.scrap_pieces || 0) }, i % 2 === 0));

    footer(doc);
    doc.end();
  });
}

// ─── OEE Report ──────────────────────────────────────────────────────────────

export async function generateOEEReport(machines, dateFrom, dateTo) {
  return new Promise((resolve) => {
    const doc = createDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    header(doc, 'Raport OEE', `Perioada: ${formatDate(dateFrom)} — ${formatDate(dateTo)}`);

    const cols = [
      { key: 'machine_code', label: 'Cod Masina', width: 90 },
      { key: 'machine_name', label: 'Denumire', width: 140 },
      { key: 'availability', label: 'Disponib. %', width: 80 },
      { key: 'quality', label: 'Calitate %', width: 75 },
      { key: 'oee', label: 'OEE %', width: 60 },
      { key: 'total_pieces', label: 'Total piese', width: 50 },
    ];
    tableHeader(doc, cols);
    machines.forEach((m, i) => {
      const row = {
        ...m,
        availability: m.availability ? `${Math.round(m.availability * 100)}` : '—',
        quality: m.quality ? `${Math.round(m.quality * 100)}` : '—',
        oee: m.oee ? `${Math.round(m.oee * 100)}` : '—',
      };
      tableRow(doc, cols, row, i % 2 === 0);
    });

    // Simple bar chart
    if (machines.length > 0) {
      doc.addPage();
      header(doc, 'Grafic OEE per Masina', `Perioada: ${formatDate(dateFrom)} — ${formatDate(dateTo)}`);
      const barW = Math.min(Math.floor(440 / machines.length) - 5, 60);
      const maxH = 150;
      const startX = 70;
      const baseY = doc.y + maxH + 10;

      machines.forEach((m, i) => {
        const oee = m.oee || 0;
        const barH = Math.round(oee * maxH);
        const x = startX + i * (barW + 5);
        const color = oee >= 0.85 ? '#22c55e' : oee >= 0.6 ? '#f59e0b' : '#ef4444';
        doc.rect(x, baseY - barH, barW, barH).fillColor(color).fill();
        doc.fontSize(7).fillColor(TEXT).text(`${Math.round(oee * 100)}%`, x, baseY - barH - 12, { width: barW, align: 'center' });
        doc.fontSize(6).fillColor(MUTED).text(m.machine_code || '', x, baseY + 4, { width: barW, align: 'center' });
      });
    }

    footer(doc);
    doc.end();
  });
}

// ─── Maintenance Report ───────────────────────────────────────────────────────

export async function generateMaintenanceReport(requests, dateFrom, dateTo) {
  return new Promise((resolve) => {
    const doc = createDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    header(doc, 'Raport Mentenanta', `Perioada: ${formatDate(dateFrom)} — ${formatDate(dateTo)}`);

    const cols = [
      { key: 'request_number', label: 'Nr.', width: 70 },
      { key: 'machine', label: 'Masina', width: 80 },
      { key: 'problem_type', label: 'Problema', width: 110 },
      { key: 'priority', label: 'Prioritate', width: 65 },
      { key: 'status', label: 'Status', width: 65 },
      { key: 'duration', label: 'Durata (min)', width: 65 },
      { key: 'created_at', label: 'Data', width: 85 },
    ];
    tableHeader(doc, cols);
    requests.forEach((r, i) => tableRow(doc, cols, { ...r, created_at: formatDate(r.created_at) }, i % 2 === 0));

    footer(doc);
    doc.end();
  });
}

// ─── Inventory Report ─────────────────────────────────────────────────────────

export async function generateInventoryReport(items) {
  return new Promise((resolve) => {
    const doc = createDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    header(doc, 'Raport Stocuri', `Generat la ${formatDateTime(new Date())}`);

    const cols = [
      { key: 'code', label: 'Cod', width: 80 },
      { key: 'name', label: 'Denumire', width: 170 },
      { key: 'category', label: 'Categorie', width: 80 },
      { key: 'current_qty', label: 'Stoc curent', width: 70 },
      { key: 'min_stock', label: 'Minim', width: 55 },
      { key: 'unit', label: 'UM', width: 40 },
    ];
    tableHeader(doc, cols);
    items.forEach((item, i) => {
      const row = {
        ...item,
        current_qty: item.current_qty ?? 0,
      };
      tableRow(doc, cols, row, i % 2 === 0);
    });

    footer(doc);
    doc.end();
  });
}
