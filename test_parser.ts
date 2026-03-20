import fs from 'fs';
import { parseExcelFile } from './src/utils/excelParser.js';

// Polyfill File class for Node.js to use in parseExcelFile
class MockFile {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;

  constructor(buffer: Buffer, name: string) {
    this.buffer = buffer;
    this.name = name;
    this.size = buffer.length;
    this.type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}

// We also need to polyfill FileReader because parseExcelFile uses it!
class MockFileReader {
  onload: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  
  readAsBinaryString(file: MockFile) {
    if (this.onload) {
      this.onload({
        target: { result: file.buffer.toString('binary') }
      });
    }
  }
}

(global as any).File = MockFile;
(global as any).FileReader = MockFileReader;

async function run() {
  const buf = fs.readFileSync('c:\\\\Users\\\\namkyu-gu\\\\workspace\\\\Work-Finder\\\\공고현황.xlsx');
  const file = new MockFile(buf, '공고현황.xlsx');
  
  try {
    const orgs = await parseExcelFile(file as any);
    console.log(`Total parsed orgs: ${orgs.length}`);
    orgs.forEach(o => {
      console.log(`ID: ${o.id}, Name: ${o.orgName}, URL: ${o.url}`);
    });
  } catch (e) {
    console.error(e);
  }
}

run();
