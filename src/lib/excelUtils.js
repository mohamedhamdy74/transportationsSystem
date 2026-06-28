import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────────

function autoColumnWidths(ws) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const cols = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let maxWidth = 10;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v) {
        const cellLen = String(cell.v).length;
        if (cellLen > maxWidth) maxWidth = cellLen;
      }
    }
    cols.push({ wch: Math.min(maxWidth + 4, 50) });
  }
  ws['!cols'] = cols;
}

function headerStyle() {
  return {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
    fill: { fgColor: { rgb: '4F46E5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '312E81' } },
      bottom: { style: 'thin', color: { rgb: '312E81' } },
      left: { style: 'thin', color: { rgb: '312E81' } },
      right: { style: 'thin', color: { rgb: '312E81' } }
    }
  };
}

function cellStyle(isEven) {
  return {
    fill: { fgColor: { rgb: isEven ? 'F8FAFF' : 'FFFFFF' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'hair', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
      left: { style: 'hair', color: { rgb: 'E2E8F0' } },
      right: { style: 'hair', color: { rgb: 'E2E8F0' } }
    }
  };
}

function applyHeaderStyles(ws, headerRow) {
  const style = headerStyle();
  for (let C = 0; C < headerRow.length; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[cellRef]) {
      ws[cellRef].s = style;
    }
  }
}

// ─── Export Functions ────────────────────────────────────────────

/**
 * Export Daily Plans in format matching 20JUN2026.xlsx
 */
export function exportDailyPlans(plans, companyName, date) {
  const wb = XLSX.utils.book_new();
  const title = `${companyName} Transportation plan`;
  const totalManpower = plans.reduce((acc, p) => acc + (p.passengerQnt || 0), 0);

  // Build rows
  const headerInfo = [
    [null, title],
    [`- Total Manpower: ${plans.length}`, 'Total Manpower', `[${totalManpower}]`],
    ['Num', 'Type of vehicles', 'Plate number', 'Driver name', 'Driver phone', 'Route of vehicles', 'Passenger QNT']
  ];

    idx + 1,
    p.carType || '',
    p.plateNumber || '',
    p.driverName || '',
    p.driverPhone || '',
    p.route || '',
    p.passengerQnt || 0
  ]);

  dataRows.push([]);
  dataRows.push([null, null, null, 'note : All numbers include the driver']);

  // Passenger lists as separate sheets per vehicle
  const allRows = [...headerInfo, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  autoColumnWidths(ws);

  // Style header row (row index 3)
  const hStyle = headerStyle();
  for (let C = 0; C < 7; C++) {
    const ref = XLSX.utils.encode_cell({ r: 3, c: C });
    if (ws[ref]) ws[ref].s = hStyle;
  }

  XLSX.utils.book_append_sheet(wb, ws, 'traffic data');

  // Passenger sub-sheets
  plans.forEach((p, idx) => {
    let passengers = [];
    try { passengers = JSON.parse(p.passengers || '[]'); } catch { passengers = []; }
    if (passengers.length > 0) {
      const passengerRows = [
        [`سيارة #${idx + 1}`, p.plateNumber, p.driverName, p.route],
        ['م', 'اسم الراكب'],
        ...passengers.map((name, i) => [i + 1, name])
      ];
      const pasWs = XLSX.utils.aoa_to_sheet(passengerRows);
      autoColumnWidths(pasWs);
      const sheetName = `Bus ${idx + 1}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, pasWs, sheetName);
    }
  });

  const fileName = `${date || 'plan'}_${companyName.replace(/\s+/g, '_')}_transport.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Inspections in format matching AFRE Vehicle Register 2026.xlsx
 */
export function exportInspections(inspections) {
  const wb = XLSX.utils.book_new();

  const headerRow = [
    'Ser', 'Security Gate No.', 'Company', 'Vehicle Type', 'Vehicle Model',
    'No.', 'Letters', 'Inspection Date', 'Status', 'Operator/Driver',
    'License Expiry', 'Reg. Expiry', 'Inspected By', 'Entry Date', 'Exit Status', 'Remarks'
  ];

  const dataRows = inspections.map((ins, idx) => [
    idx + 1,
    `V ${String(idx + 1).padStart(3, '0')}`,
    ins.company || '',
    ins.vehicleType || '',
    ins.vehicleModel || '',
    ins.no || '',
    ins.letters || '',
    ins.inspectionDate || '',
    ins.status || '',
    ins.operatorDriver || '',
    ins.licenseExpiry || '',
    ins.regExpiry || '',
    ins.inspectedBy || '',
    ins.inspectionDate || '',
    ins.exitStatus || 'Till now',
    ins.remarks || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  applyHeaderStyles(ws, headerRow);
  autoColumnWidths(ws);

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const fileName = `AFRE_Vehicle_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export GPS Tracker Vehicles in format matching Vehicle Information GPS 2.xlsx
 */
export function exportGpsVehicles(vehicles) {
  const wb = XLSX.utils.book_new();

  const headerRow = ['N', 'Company', 'Username', 'Password', 'Car Type', 'Car No.', 'Comments'];
  
  const dataRows = vehicles.map((v, idx) => [
    idx + 1,
    v.company || '',
    v.username || '',
    v.password || '',
    v.carType || '',
    v.carNo || '',
    v.comments || 'Running'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  applyHeaderStyles(ws, headerRow);
  autoColumnWidths(ws);

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet2');

  const fileName = `GPS_Vehicles_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Passengers list from filtered daily plans (Admin view)
 */
export function exportPassengersList(plans, filters = {}, gpsVehicles = []) {
  const wb = XLSX.utils.book_new();
  const date = new Date().toISOString().slice(0, 10);

  // Summary sheet
  const summaryHeader = ['م', 'الشركة', 'رقم اللوحة', 'نوع السيارة', 'السائق', 'رقم الهاتف', 'GPS Username', 'GPS Password', 'المسار', 'الوردية', 'تاريخ اضافة العربية', 'عدد الركاب'];
  const summaryRows = plans.map((p, idx) => {
    let passengers = [];
    try { passengers = JSON.parse(p.passengers || '[]'); } catch {}
    const vehicle = gpsVehicles.find(v => String(v.carNo).trim() === String(p.plateNumber).trim()) || {};
    return [
      idx + 1,
      p.company || '',
      p.plateNumber || '',
      p.carType || '',
      p.driverName || '',
      p.driverPhone || '',
      vehicle.username || 'غير متوفر',
      vehicle.password || 'غير متوفر',
      p.route || '',
      p.shift === 'day' ? 'نهاري ☀️' : 'ليلي 🌙',
      p.date || '',
      passengers.length,
    ];
  });
  const totalPassengers = plans.reduce((s, p) => {
    let passengers = [];
    try { passengers = JSON.parse(p.passengers || '[]'); } catch {}
    return s + passengers.length;
  }, 0);
  summaryRows.push([]);
  summaryRows.push(['', '', '', '', '', '', '', '', '', '', 'الإجمالي:', totalPassengers]);

  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);
  applyHeaderStyles(wsSummary, summaryHeader);
  autoColumnWidths(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص الرحلات');

  // Per-company passenger sheets
  const companies = [...new Set(plans.map(p => p.company).filter(Boolean))];
  companies.forEach(company => {
    const companyPlans = plans.filter(p => p.company === company);
    const rows = [];
    companyPlans.forEach((p, idx) => {
      let passengers = [];
      try { passengers = JSON.parse(p.passengers || '[]'); } catch {}
      rows.push([`رحلة ${idx + 1}: ${p.plateNumber}`, `${p.shift === 'day' ? 'نهاري' : 'ليلي'} — ${p.route}`, `السائق: ${p.driverName || '-'}`, `تاريخ اضافة العربية: ${p.date}`]);
      rows.push(['م', 'اسم الراكب', '', '']);
      passengers.forEach((name, i) => rows.push([i + 1, name, '', '']));
      rows.push([]);
    });
    if (rows.length > 0) {
      const wsCompany = XLSX.utils.aoa_to_sheet(rows);
      autoColumnWidths(wsCompany);
      const sheetName = company.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, wsCompany, sheetName);
    }
  });

  // Build filter description for filename
  const filterParts = [];
  if (filters.company) filterParts.push(filters.company.replace(/\s+/g, '_'));
  if (filters.shift) filterParts.push(filters.shift === 'day' ? 'Day' : 'Night');
  if (filters.date) filterParts.push(filters.date);
  const suffix = filterParts.length ? `_${filterParts.join('_')}` : '';

  const fileName = `Passengers${suffix}_${date}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Inspections filtered by company (admin smart filter)
 */
export function exportFilteredInspections(inspections, filters = {}) {
  let filtered = inspections;
  if (filters.company) filtered = filtered.filter(i => i.company === filters.company);
  if (filters.exitStatus) filtered = filtered.filter(i => i.exitStatus === filters.exitStatus);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(i =>
      i.no?.toLowerCase().includes(term) ||
      i.letters?.toLowerCase().includes(term) ||
      i.company?.toLowerCase().includes(term) ||
      i.operatorDriver?.toLowerCase().includes(term)
    );
  }

  const wb = XLSX.utils.book_new();
  const headerRow = [
    'Ser', 'Company', 'Vehicle Type', 'Vehicle Model',
    'No.', 'Letters', 'Inspection Date', 'Status', 'Operator/Driver',
    'License Expiry', 'Reg. Expiry', 'Inspected By', 'Exit Status', 'Remarks'
  ];

  const dataRows = filtered.map((ins, idx) => [
    idx + 1,
    ins.company || '',
    ins.vehicleType || '',
    ins.vehicleModel || '',
    ins.no || '',
    ins.letters || '',
    ins.inspectionDate || '',
    ins.status || '',
    ins.operatorDriver || '',
    ins.licenseExpiry || '',
    ins.regExpiry || '',
    ins.inspectedBy || '',
    ins.exitStatus || 'Till now',
    ins.remarks || ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  applyHeaderStyles(ws, headerRow);
  autoColumnWidths(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'Inspections');

  const filterParts = [];
  if (filters.company) filterParts.push(filters.company.replace(/\s+/g, '_'));
  if (filters.exitStatus) filterParts.push(filters.exitStatus === 'Till now' ? 'Active' : 'Out');
  const suffix = filterParts.length ? `_${filterParts.join('_')}` : '';
  const date = new Date().toISOString().slice(0, 10);

  XLSX.writeFile(wb, `Inspections${suffix}_${date}.xlsx`);
}

// ─── Import Functions ────────────────────────────────────────────

/**
 * Parse Inspection file matching AFRE Vehicle Register 2026.xlsx format
 */
export function importInspections(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        const inspections = [];
        // Find the header row
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r && r.some(cell => String(cell || '').toLowerCase().includes('company'))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) headerIdx = 7; // Default to row 7

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[5] || !row[6]) continue;
          inspections.push({
            no: String(row[5]).trim(),
            letters: String(row[6]).trim(),
            company: String(row[2] || '').trim(),
            vehicleType: String(row[3] || '').trim(),
            vehicleModel: String(row[4] || '').trim(),
            inspectionDate: String(row[7] || '').trim(),
            status: String(row[8] || 'Accept').trim(),
            exitStatus: String(row[14] || 'Till now').trim(),
            operatorDriver: String(row[9] || '').trim(),
            licenseExpiry: String(row[10] || '').trim(),
            regExpiry: String(row[11] || '').trim(),
            inspectedBy: String(row[12] || '').trim(),
            remarks: String(row[16] || '').trim()
          });
        }
        resolve(inspections);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse GPS Tracker Vehicles file matching Vehicle Information GPS 2.xlsx
 */
export function importGpsVehicles(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.includes('Sheet2') ? 'Sheet2' : wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const vehicles = [];
        let currentCompany = '';
        // Find the N/Company header row (index around 5)
        let startRow = 6;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          if (rows[i] && rows[i][0] === 'N') { startRow = i + 1; break; }
        }

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          if (row[1]) currentCompany = String(row[1]).trim();
          if (!row[5]) continue;
          vehicles.push({
            company: currentCompany,
            username: row[2] ? String(row[2]).trim() : '',
            password: row[3] ? String(row[3]).trim() : '',
            carType: row[4] ? String(row[4]).trim() : '',
            carNo: String(row[5]).trim(),
            comments: row[6] ? String(row[6]).trim() : 'Running'
          });
        }
        resolve(vehicles);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse Daily Plans file matching 20JUN2026.xlsx traffic data format
 */
export function importDailyPlans(file, companyName) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets['traffic data'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const plans = [];
        let dataStart = 4;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (r && r.some(c => String(c || '').toLowerCase() === 'num')) {
            dataStart = i + 1;
            break;
          }
        }

        const today = new Date().toISOString().split('T')[0];
        for (let i = dataStart; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[2]) continue;
          if (row[3] && String(row[3]).toLowerCase().includes('note')) break;
          plans.push({
            date: today,
            company: companyName || 'Unknown',
            num: parseInt(row[0]) || (i - dataStart + 1),
            carType: String(row[1] || '').trim(),
            plateNumber: String(row[2]).trim(),
            driverName: String(row[3] || '').trim(),
            route: String(row[4] || '').trim(),
            passengerQnt: parseInt(row[5]) || 0,
            passengers: JSON.stringify([])
          });
        }
        resolve(plans);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
