import fs from 'fs';
import * as xlsx from 'xlsx';

try {
  const buf = fs.readFileSync('G:\\내 드라이브\\프로젝트\\채용 공고 수집\\공고현황.xlsx');
  const workbook = xlsx.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log("Top 15 rows:");
  for(let i = 1; i <= 15; i++) {
    const orgName = sheet[`B${i}`]?.v || sheet[`A${i}`]?.v || '';
    const jVal = sheet[`J${i}`]?.v || '';
    const kVal = sheet[`K${i}`]?.v || '';
    const lVal = sheet[`L${i}`]?.v || '';
    console.log(`Row ${i}: Org: ${orgName}, J: ${jVal}, K: ${kVal}, L: ${lVal}`);
  }
} catch (e) {
  console.error(e);
}
