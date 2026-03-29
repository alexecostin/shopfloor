import ExcelJS from 'exceljs';

// Read worksheet rows as objects using the first row as headers
export async function readExcel(buffer, sheetIndex = 0) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[sheetIndex];
  if (!ws) throw new Error('Sheet not found');

  const rows = [];
  let headers = [];
  ws.eachRow((row, rowNum) => {
    const values = row.values.slice(1); // strip leading undefined
    if (rowNum === 1) {
      headers = values.map((v) => String(v || '').trim());
    } else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? null; });
      rows.push({ rowNum, data: obj });
    }
  });
  return { headers, rows };
}

// Generate a template Excel with given headers
export async function generateTemplate(headers, sheetName = 'Date') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ShopFloor.ro';
  const ws = wb.addWorksheet(sheetName);

  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 4, 15) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  return wb.xlsx.writeBuffer();
}

// Write data to Excel and return buffer
export async function writeExcel(headers, rows, sheetName = 'Date') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ShopFloor.ro';
  const ws = wb.addWorksheet(sheetName);

  ws.columns = headers.map((h) => ({ header: h.label, key: h.key, width: h.width || 20 }));
  ws.getRow(1).font = { bold: true };

  for (const row of rows) {
    ws.addRow(row);
  }

  return wb.xlsx.writeBuffer();
}
