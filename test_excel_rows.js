import fs from 'fs';
import * as xlsx from 'xlsx';

const buf = fs.readFileSync('c:\\\\Users\\\\namkyu-gu\\\\workspace\\\\Work-Finder\\\\공고현황.xlsx');
const workbook = xlsx.read(buf, { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for(let i=3; i<=11; i++){
  console.log(`ROW ${i}:`, JSON.stringify(rows[i]));
}
