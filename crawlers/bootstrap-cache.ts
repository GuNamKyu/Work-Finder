import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { readResults, reconcileResults } from './resilience.js';
const dir = dirname(fileURLToPath(import.meta.url));
const seed = await readResults(join(dir, '..', 'data', 'source-recovery-seed.json'));
for (const [name, type] of [['results', 'job'], ['experience-results', 'experience']]) {
  const path = join(dir, `${name}.last-good.json`);
  const previous = await readResults(join(dir, `${name}.prev.json`));
  const cache = await readResults(path);
  const merged = reconcileResults([], [...seed.filter(r => (r.site.type || 'job') === type), ...previous], cache);
  await writeFile(path, JSON.stringify(merged.cache, null, 2));
  console.log(`${name}: ${merged.cache.length}개 소스의 정상 기록 확보`);
}
