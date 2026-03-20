import fs from 'fs';
import * as xlsx from 'xlsx';

try {
  const buf = fs.readFileSync('G:\\내 드라이브\\프로젝트\\채용 공고 수집\\공고현황.xlsx');
  const workbook = xlsx.read(buf, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log("URLs in column L for K4-K10:");
  for(let i = 4; i <= 10; i++) {
    const kVal = sheet[`K${i}`]?.v || '';
    const lVal = sheet[`L${i}`]?.v || '';
    
    // Check if lVal is a hyperlink object
    let url = lVal;
    const lCell = sheet[`L${i}`];
    if (lCell && lCell.l && lCell.l.Target) {
      url = lCell.l.Target;
    }
    
    // Check K column hyperlink
    const kCell = sheet[`K${i}`];
    let kUrl = '';
    if (kCell && kCell.l && kCell.l.Target) {
      kUrl = kCell.l.Target;
    }

    console.log(`Row ${i} (${kVal}): L_URL=${url}, K_URL=${kUrl}`);
  }
} catch (e) {
  console.error(e);
}
