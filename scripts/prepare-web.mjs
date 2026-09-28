import { copyFile } from 'node:fs/promises';
for (const name of ['results.json', 'new-postings.json', 'experience-results.json', 'source-health.json']) await copyFile(`crawlers/${name}`, `web/${name}`);
console.log('웹 데이터 복사 완료');
