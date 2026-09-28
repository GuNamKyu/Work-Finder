import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRules } from '../web/exclusions.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) { console.error('사용법: npm run exclusions:import -- "내보낸 JSON 파일의 경로"'); process.exit(1); }
try {
  const content = await readFile(resolve(input), 'utf8');
  if (Buffer.byteLength(content) > 5000000) throw new Error('5MB 이하 파일을 선택하세요.');
  const rules = validateRules(JSON.parse(content));
  const target = resolve(root, 'data/learned-exclusions.json');
  // Replace, rather than merge, so disabled rules can be removed by re-export/import.
  await copyFile(target, `${target}.previous.local`);
  await writeFile(target, JSON.stringify(rules, null, 2) + '\n');
  console.log(`${rules.rules.length}개 규칙 반영. 기존 파일은 data/learned-exclusions.json.previous.local에 보존했습니다.`);
  console.log('로컬 다음 수집부터 적용됩니다. GitHub 자동수집은 data/learned-exclusions.json을 커밋·푸시한 뒤 적용됩니다.');
} catch (error) { console.error(`가져오기 실패: ${error.message}`); process.exitCode = 1; }
